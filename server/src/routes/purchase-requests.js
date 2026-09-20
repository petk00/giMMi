import { Router } from 'express'

import { query, queryOne, withTransaction } from '../db.js'
import { assertTransitionAllowed, nextRequestNumber, WorkflowError } from '../workflow.js'

export const purchaseRequestsRouter = Router()

const listSql = `
  select pr.id_purchase_request, pr.request_number, pr.source, pr.total_amount,
         pr.justification, pr.comment, pr.created_at, pr.updated_at,
         pr.fk_fiscal_year, fy.year,
         pr.fk_department_budget, dept.name as department_name,
         pr.fk_purchase_request_status, st.code as status_code, st.name as status_name,
         pr.fk_created_by_user,
         concat(u.first_name, ' ', u.last_name) as created_by_name,
         pr.fk_assigned_to_user,
         concat(handler.first_name, ' ', handler.last_name) as assigned_to_name
    from PurchaseRequest pr
    join FiscalYear fy on fy.id_fiscal_year = pr.fk_fiscal_year
    join DepartmentBudget budget on budget.id_department_budget = pr.fk_department_budget
    join Department dept on dept.id_department = budget.fk_department
    join PurchaseRequestStatus st on st.id_purchase_request_status = pr.fk_purchase_request_status
    join AppUser u on u.id_user = pr.fk_created_by_user
    left join AppUser handler on handler.id_user = pr.fk_assigned_to_user`

purchaseRequestsRouter.get('/', async (req, res) => {
  const { fiscalYear, status, departmentBudget, mine } = req.query

  // ?mine=1 vraca samo zahtjeve prijavljenog korisnika
  const onlyMine = mine === '1' || mine === 'true'

  const rows = await query(
    `${listSql}
      where (? is null or fy.year = ?)
        and (? is null or st.code = ?)
        and (? is null or budget.id_department_budget = ?)
        and (? is null or pr.fk_created_by_user = ?)
      order by pr.created_at desc`,
    [
      fiscalYear ?? null,
      fiscalYear ?? null,
      status ?? null,
      status ?? null,
      departmentBudget ?? null,
      departmentBudget ?? null,
      onlyMine ? req.user.id_user : null,
      onlyMine ? req.user.id_user : null,
    ],
  )

  res.json(rows)
})

// Zahtjev nastaje kao nacrt: fiskalnu godinu i proracun sluzbe odredjuje server
// iz prijavljenog korisnika, pa ih klijent ne moze pogrijesiti ni podmetnuti.
purchaseRequestsRouter.post('/', async (req, res) => {
  const { source = 'CATALOG', justification = null, items = [] } = req.body ?? {}

  if (!['OFFER', 'CATALOG'].includes(source)) {
    return res.status(400).json({ error: 'Izvor zahtjeva mora biti OFFER ili CATALOG' })
  }

  if (req.user.fk_department === null) {
    return res.status(422).json({ error: 'Niste rasporedjeni ni u jednu sluzbu' })
  }

  for (const item of items) {
    if (!item.item_name?.trim()) {
      return res.status(400).json({ error: 'Svaka stavka mora imati naziv' })
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return res.status(400).json({ error: `Kolicina za "${item.item_name}" mora biti cijeli broj veci od nule` })
    }
  }

  try {
    const created = await withTransaction(async (db) => {
      const budget = await db.queryOne(
        `select b.id_department_budget, b.fk_fiscal_year, fy.year
           from DepartmentBudget b
           join FiscalYear fy on fy.id_fiscal_year = b.fk_fiscal_year
          where b.fk_department = ? and fy.is_closed = 0
          order by fy.year desc
          limit 1`,
        [req.user.fk_department],
      )

      if (budget === null) {
        throw new WorkflowError('Vasa sluzba nema proracun u otvorenoj fiskalnoj godini')
      }

      const requestNumber = await nextRequestNumber(db, {
        fiscalYearId: budget.fk_fiscal_year,
        year: budget.year,
      })

      const draft = await db.queryOne(
        `select id_purchase_request_status from PurchaseRequestStatus where code = 'DRAFT'`,
      )

      const total = items.reduce((sum, item) => sum + item.quantity * (item.unit_price ?? 0), 0)

      const result = await db.query(
        `insert into PurchaseRequest
           (request_number, source, fk_fiscal_year, fk_department_budget,
            fk_purchase_request_status, fk_created_by_user, justification, total_amount)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestNumber,
          source,
          budget.fk_fiscal_year,
          budget.id_department_budget,
          draft.id_purchase_request_status,
          req.user.id_user,
          justification,
          total,
        ],
      )

      const requestId = result.insertId

      for (const item of items) {
        await db.query(
          `insert into PurchaseRequestItem
             (fk_purchase_request, fk_item_category_budget, item_name, quantity, unit_price)
           values (?, ?, ?, ?, ?)`,
          [
            requestId,
            item.fk_item_category_budget,
            item.item_name.trim(),
            item.quantity,
            item.unit_price ?? 0,
          ],
        )
      }

      // nastanak nacrta je prvi zapis u povijesti
      await db.query(
        `insert into PurchaseRequestStatusHistory
           (fk_purchase_request, fk_purchase_request_status, fk_changed_by_user)
         values (?, ?, ?)`,
        [requestId, draft.id_purchase_request_status, req.user.id_user],
      )

      return requestId
    })

    const request = await queryOne(`${listSql} where pr.id_purchase_request = ?`, [created])

    res.status(201).json(request)
  } catch (err) {
    if (err instanceof WorkflowError) {
      return res.status(err.status).json({ error: err.message })
    }

    throw err
  }
})

purchaseRequestsRouter.get('/:id', async (req, res) => {
  const request = await queryOne(`${listSql} where pr.id_purchase_request = ?`, [req.params.id])

  if (request === null) {
    return res.status(404).json({ error: `Zahtjev ${req.params.id} ne postoji` })
  }

  const [items, timeline, attachments, transitions] = await Promise.all([
    query(
      `select pri.id_purchase_request_item, pri.item_name, pri.quantity, pri.unit_price,
              pri.quantity * pri.unit_price as line_total,
              pri.fk_item_category_budget, cat.name as item_category_name
         from PurchaseRequestItem pri
         join ItemCategoryBudget cat on cat.id_item_category_budget = pri.fk_item_category_budget
        where pri.fk_purchase_request = ?
        order by pri.id_purchase_request_item`,
      [req.params.id],
    ),
    // Log zivotnog vijeka zahtjeva: promjene statusa i prilozeni dokumenti
    // spojeni u jedan niz po vremenu, bez dupliranja podataka.
    query(
      `select 'STATUS' as event, h.changed_at as happened_at,
              h.id_purchase_request_status_history as sort_id, h.comment,
              st.code as status_code, st.name as status_name,
              null as document_type_code, null as document_type_name,
              null as file_name, null as version,
              concat(u.first_name, ' ', u.last_name) as by_name
         from PurchaseRequestStatusHistory h
         join PurchaseRequestStatus st
           on st.id_purchase_request_status = h.fk_purchase_request_status
         join AppUser u on u.id_user = h.fk_changed_by_user
        where h.fk_purchase_request = ?
        union all
       select case when a.is_generated = 1 then 'DOCUMENT_GENERATED' else 'DOCUMENT_ADDED' end,
              a.uploaded_at, a.id_purchase_request_attachment, null,
              null, null,
              dt.code, dt.name,
              a.file_name, a.version,
              concat(u.first_name, ' ', u.last_name)
         from PurchaseRequestAttachment a
         join DocumentType dt on dt.id_document_type = a.fk_document_type
         join AppUser u on u.id_user = a.fk_uploaded_by_user
        where a.fk_purchase_request = ?
        order by happened_at desc, sort_id desc`,
      [req.params.id, req.params.id],
    ),
    query(
      `select a.id_purchase_request_attachment, a.file_name, a.mime_type,
              a.version, a.is_current, a.is_generated, a.external_reference,
              a.uploaded_at, a.fk_uploaded_by_user,
              a.fk_document_type, dt.code as document_type_code, dt.name as document_type_name
         from PurchaseRequestAttachment a
         join DocumentType dt on dt.id_document_type = a.fk_document_type
        where a.fk_purchase_request = ?
        order by dt.sort_order, a.version desc`,
      [req.params.id],
    ),
    // dopusteni sljedeci koraci, s uvjetima; pravila su u StatusTransition
    query(
      `select ts.id_purchase_request_status, ts.code, ts.name,
              st.requires_comment,
              rd.code as required_document_type_code,
              gd.code as generated_document_type_code,
              r.code as allowed_role_code
         from PurchaseRequest pr
         join StatusTransition st
           on st.fk_from_status = pr.fk_purchase_request_status
          and st.applies_to_source in ('ANY', pr.source)
         join PurchaseRequestStatus ts on ts.id_purchase_request_status = st.fk_to_status
         left join DocumentType rd on rd.id_document_type = st.fk_required_document_type
         left join DocumentType gd on gd.id_document_type = st.fk_generates_document_type
         left join Role r on r.id_role = st.fk_role
        where pr.id_purchase_request = ?
        order by ts.sort_order`,
      [req.params.id],
    ),
  ])

  res.json({ ...request, items, timeline, attachments, transitions })
})

// Promjena statusa. Sto je dopusteno, tko smije i sto mora biti prilozeno -
// sve dolazi iz StatusTransition, pa se pravila mijenjaju bez diranja koda.
purchaseRequestsRouter.post('/:id/transitions', async (req, res) => {
  const { toStatus, comment = null } = req.body ?? {}

  if (!toStatus) {
    return res.status(400).json({ error: 'Nedostaje ciljni status' })
  }

  try {
    await withTransaction(async (db) => {
      const request = await db.queryOne(
        `select pr.id_purchase_request, pr.source, pr.fk_purchase_request_status,
                pr.fk_created_by_user, st.code as status_code, st.name as status_name
           from PurchaseRequest pr
           join PurchaseRequestStatus st
             on st.id_purchase_request_status = pr.fk_purchase_request_status
          where pr.id_purchase_request = ?
          for update`,
        [req.params.id],
      )

      if (request === null) {
        throw new WorkflowError(`Zahtjev ${req.params.id} ne postoji`, 404)
      }

      const rule = await assertTransitionAllowed(db, {
        request,
        toStatusCode: toStatus,
        user: req.user,
        comment,
      })

      // preuzimanjem zahtjeva operater postaje njegov obradjivac
      const takingOver = toStatus === 'IN_PROGRESS'

      await db.query(
        `update PurchaseRequest
            set fk_purchase_request_status = ?,
                fk_assigned_to_user = ${takingOver ? '?' : 'fk_assigned_to_user'},
                updated_at = current_timestamp
          where id_purchase_request = ?`,
        takingOver
          ? [rule.to_status_id, req.user.id_user, req.params.id]
          : [rule.to_status_id, req.params.id],
      )

      await db.query(
        `insert into PurchaseRequestStatusHistory
           (fk_purchase_request, fk_purchase_request_status, fk_changed_by_user, comment)
         values (?, ?, ?, ?)`,
        [req.params.id, rule.to_status_id, req.user.id_user, comment?.trim() || null],
      )
    })

    const request = await queryOne(`${listSql} where pr.id_purchase_request = ?`, [req.params.id])

    res.json(request)
  } catch (err) {
    if (err instanceof WorkflowError) {
      return res.status(err.status).json({ error: err.message })
    }

    throw err
  }
})

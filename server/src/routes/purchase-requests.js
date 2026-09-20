import { Router } from 'express'

import { unlink } from 'node:fs/promises'

import { query, queryOne, withTransaction } from '../db.js'
import { attachmentPath, uploadAttachment } from '../uploads.js'
import { assertTransitionAllowed, nextRequestNumber, WorkflowError } from '../workflow.js'

export const purchaseRequestsRouter = Router()

// Ista granica vrijedi i u sucelju (NewRequestPage), ovdje je zato sto
// poziv na API ne mora doci kroz obrazac.
const JUSTIFICATION_MAX_LENGTH = 500

const listSql = `
  select pr.id_purchase_request, pr.request_number, pr.source,
         pr.net_amount, pr.vat_amount, pr.total_amount,
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

// Zahtjev nastaje kao nacrt. Troskovno mjesto bira podnositelj - isti covjek
// moze trositi na vise sluzbi ili projekata - a fiskalna godina se cita iz
// odabranog proracuna, pa ne moze zavrsiti u pogresnoj godini.
purchaseRequestsRouter.post('/', async (req, res) => {
  const {
    source = 'CATALOG',
    departmentBudget = null,
    justification = null,
    items = [],
  } = req.body ?? {}

  if (!['OFFER', 'CATALOG'].includes(source)) {
    return res.status(400).json({ error: 'Izvor zahtjeva mora biti OFFER ili CATALOG' })
  }

  if (!departmentBudget) {
    return res.status(400).json({ error: 'Odaberite troskovno mjesto' })
  }

  if (justification !== null && justification.length > JUSTIFICATION_MAX_LENGTH) {
    return res
      .status(400)
      .json({ error: `Svrha nabave smije imati najvise ${JUSTIFICATION_MAX_LENGTH} znakova` })
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
        `select b.id_department_budget, b.fk_fiscal_year, fy.year, fy.is_closed,
                d.name as department_name, d.is_active, d.valid_from, d.valid_to
           from DepartmentBudget b
           join FiscalYear fy on fy.id_fiscal_year = b.fk_fiscal_year
           join Department d on d.id_department = b.fk_department
          where b.id_department_budget = ?`,
        [departmentBudget],
      )

      if (budget === null) {
        throw new WorkflowError('Odabrano troskovno mjesto ne postoji', 404)
      }

      if (budget.is_closed === 1) {
        throw new WorkflowError(`Fiskalna godina ${budget.year} je zatvorena`)
      }

      if (budget.is_active !== 1) {
        throw new WorkflowError(`Troskovno mjesto "${budget.department_name}" nije aktivno`)
      }

      // projekt vrijedi samo unutar svojih datuma
      const today = new Date().toISOString().slice(0, 10)

      if (
        (budget.valid_from !== null && today < budget.valid_from) ||
        (budget.valid_to !== null && today > budget.valid_to)
      ) {
        throw new WorkflowError(`Projekt "${budget.department_name}" trenutno nije u tijeku`)
      }

      const requestNumber = await nextRequestNumber(db, {
        fiscalYearId: budget.fk_fiscal_year,
        year: budget.year,
      })

      const draft = await db.queryOne(
        `select id_purchase_request_status from PurchaseRequestStatus where code = 'DRAFT'`,
      )

      const net = items.reduce((sum, item) => sum + item.quantity * (item.unit_price ?? 0), 0)
      const vat = items.reduce(
        (sum, item) =>
          sum + (item.quantity * (item.unit_price ?? 0) * (item.vat_rate ?? 25)) / 100,
        0,
      )
      const total = net + vat

      const result = await db.query(
        `insert into PurchaseRequest
           (request_number, source, fk_fiscal_year, fk_department_budget,
            fk_purchase_request_status, fk_created_by_user, justification,
            net_amount, vat_amount, total_amount)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestNumber,
          source,
          budget.fk_fiscal_year,
          budget.id_department_budget,
          draft.id_purchase_request_status,
          req.user.id_user,
          justification,
          net.toFixed(2),
          vat.toFixed(2),
          total.toFixed(2),
        ],
      )

      const requestId = result.insertId

      for (const item of items) {
        await db.query(
          `insert into PurchaseRequestItem
             (fk_purchase_request, fk_item_category_budget, item_name, quantity,
              unit_price, vat_rate)
           values (?, ?, ?, ?, ?, ?)`,
          [
            requestId,
            item.fk_item_category_budget,
            item.item_name.trim(),
            item.quantity,
            item.unit_price ?? 0,
            item.vat_rate ?? 25,
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
              pri.vat_rate,
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

// Prilaganje dokumenta uz zahtjev. Verzija raste po tipu dokumenta, a prethodna
// verzija prestaje biti vazeca - stara ostaje zapisana jer ju je netko mozda
// vec vidio.
purchaseRequestsRouter.post('/:id/attachments', (req, res) => {
  uploadAttachment(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nedostaje datoteka' })
    }

    const cleanUp = () => unlink(attachmentPath(req.file.filename)).catch(() => {})

    try {
      const attachmentId = await withTransaction(async (db) => {
        const request = await db.queryOne(
          `select id_purchase_request from PurchaseRequest where id_purchase_request = ?`,
          [req.params.id],
        )

        if (request === null) {
          throw new WorkflowError(`Zahtjev ${req.params.id} ne postoji`, 404)
        }

        const documentType = await db.queryOne(
          `select id_document_type, code, name from DocumentType where code = ?`,
          [req.body.documentType ?? 'OTHER'],
        )

        if (documentType === null) {
          throw new WorkflowError(`Tip dokumenta ${req.body.documentType} ne postoji`, 400)
        }

        const previous = await db.queryOne(
          `select max(version) as last_version
             from PurchaseRequestAttachment
            where fk_purchase_request = ? and fk_document_type = ?
            for update`,
          [req.params.id, documentType.id_document_type],
        )

        const version = (previous?.last_version ?? 0) + 1

        // "Ostali prilog" skuplja razlicite dokumente (npr. usporedne ponude),
        // pa novi ne ponistava prethodni; ostali tipovi se verzioniraju.
        const replacesPrevious = documentType.code !== 'OTHER'

        if (version > 1 && replacesPrevious) {
          await db.query(
            `update PurchaseRequestAttachment
                set is_current = 0
              where fk_purchase_request = ? and fk_document_type = ?`,
            [req.params.id, documentType.id_document_type],
          )
        }

        const result = await db.query(
          `insert into PurchaseRequestAttachment
             (fk_purchase_request, fk_uploaded_by_user, fk_document_type, file_name,
              file_path, mime_type, version, is_current, is_generated, external_reference)
           values (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
          [
            req.params.id,
            req.user.id_user,
            documentType.id_document_type,
            req.file.originalname,
            req.file.filename,
            req.file.mimetype,
            version,
            req.body.externalReference ?? null,
          ],
        )

        return result.insertId
      })

      const attachment = await queryOne(
        `select a.id_purchase_request_attachment, a.file_name, a.mime_type, a.version,
                a.is_current, a.uploaded_at, dt.code as document_type_code
           from PurchaseRequestAttachment a
           join DocumentType dt on dt.id_document_type = a.fk_document_type
          where a.id_purchase_request_attachment = ?`,
        [attachmentId],
      )

      res.status(201).json(attachment)
    } catch (err) {
      // datoteka bez zapisa u bazi samo bi zauzimala prostor
      await cleanUp()

      if (err instanceof WorkflowError) {
        return res.status(err.status).json({ error: err.message })
      }

      throw err
    }
  })
})

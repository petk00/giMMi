import { Router } from 'express'

import { unlink } from 'node:fs/promises'
import { basename } from 'node:path'

import { requireRole } from '../auth.js'
import { coverageFor, itemGrossSql, listCategoryBudgets } from '../budget.js'
import { query, queryOne, withTransaction } from '../db.js'
import { attachmentPath, uploadAttachment } from '../uploads.js'
import { assertTransitionAllowed, nextRequestNumber, WorkflowError } from '../workflow.js'

export const purchaseRequestsRouter = Router()

// Ista granica vrijedi i u sucelju (NewRequestPage), ovdje je zato sto
// poziv na API ne mora doci kroz obrazac.
const JUSTIFICATION_MAX_LENGTH = 500

/**
 * Kad zahtjev nastaje iz ponude, iznosi su prepisani s nje i mjerodavni su -
 * server ih tada ne izvodi iz stavki, jer bi zaokruzivanje jedinicne cijene
 * dalo drugi iznos od onoga sto dobavljac trazi. Iz kataloga takvog izvora
 * nema, pa se racuna po stavkama.
 */
function requestAmounts(items, amounts) {
  const given = {
    net: Number(amounts?.net),
    vat: Number(amounts?.vat),
    total: Number(amounts?.total),
  }

  if (Object.values(given).every((value) => Number.isFinite(value) && value >= 0)) {
    return given
  }

  const net = items.reduce((sum, item) => sum + item.quantity * (item.unit_price ?? 0), 0)
  const vat = items.reduce(
    (sum, item) => sum + (item.quantity * (item.unit_price ?? 0) * (item.vat_rate ?? 25)) / 100,
    0,
  )

  return { net, vat, total: net + vat }
}

// Podnositelj vidi samo svoje zahtjeve; nabava i administrator vide sve.
// Tudji zahtjev se ponasa kao da ne postoji, da se ne otkriva sto postoji.
function seesAll(user) {
  return user.role_code === 'ADMIN' || user.role_code === 'PROCUREMENT'
}

function canSee(user, request) {
  return seesAll(user) || request.fk_created_by_user === user.id_user
}

// Kategoriju stavke nabava odredjuje dok o zahtjevu jos nije odluceno.
const CATEGORY_EDITABLE_STATUSES = ['SUBMITTED', 'IN_PROGRESS', 'NEEDS_INFO']

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

  // ?mine=1 vraca samo zahtjeve prijavljenog korisnika; podnositelj ionako
  // dobiva samo svoje
  const onlyMine = mine === '1' || mine === 'true' || !seesAll(req.user)

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

  const coverage = await coverageFor(rows)

  res.json(rows.map((row) => ({ ...row, coverage: coverage.get(row.id_purchase_request) })))
})

// Podnositelj mijenja zahtjev dok je nacrt ili kad ga nabava vrati na dopunu.
const EDITABLE_STATUSES = ['DRAFT', 'NEEDS_INFO']

function canEdit(user, request) {
  return (
    EDITABLE_STATUSES.includes(request.status_code) &&
    (user.role_code === 'ADMIN' || request.fk_created_by_user === user.id_user)
  )
}

/** Provjera sadrzaja zahtjeva; vraca poruku greske ili null. */
function invalidContent({ justification, comment, items }) {
  if (justification !== null && justification.length > JUSTIFICATION_MAX_LENGTH) {
    return `Svrha nabave smije imati najvise ${JUSTIFICATION_MAX_LENGTH} znakova`
  }

  if (comment !== null && comment.length > JUSTIFICATION_MAX_LENGTH) {
    return `Napomena smije imati najvise ${JUSTIFICATION_MAX_LENGTH} znakova`
  }

  for (const item of items) {
    if (!item.item_name?.trim()) {
      return 'Svaka stavka mora imati naziv'
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return `Kolicina za "${item.item_name}" mora biti cijeli broj veci od nule`
    }
  }

  return null
}

/** Troskovno mjesto na koje se smije trositi: postoji, aktivno je, godina je otvorena. */
async function findUsableBudget(db, departmentBudgetId) {
  const budget = await db.queryOne(
    `select b.id_department_budget, b.fk_fiscal_year, fy.year, fy.is_closed,
            d.name as department_name, d.is_active, d.valid_from, d.valid_to
       from DepartmentBudget b
       join FiscalYear fy on fy.id_fiscal_year = b.fk_fiscal_year
       join Department d on d.id_department = b.fk_department
      where b.id_department_budget = ?`,
    [departmentBudgetId],
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

  return budget
}

// Zahtjev nastaje kao nacrt. Troskovno mjesto bira podnositelj - isti covjek
// moze trositi na vise sluzbi ili projekata - a fiskalna godina se cita iz
// odabranog proracuna, pa ne moze zavrsiti u pogresnoj godini.
purchaseRequestsRouter.post('/', async (req, res) => {
  const {
    source = 'CATALOG',
    departmentBudget = null,
    justification = null,
    comment = null,
    items = [],
    amounts = null,
  } = req.body ?? {}

  if (!['OFFER', 'CATALOG'].includes(source)) {
    return res.status(400).json({ error: 'Izvor zahtjeva mora biti OFFER ili CATALOG' })
  }

  if (!departmentBudget) {
    return res.status(400).json({ error: 'Odaberite troskovno mjesto' })
  }

  const invalid = invalidContent({ justification, comment, items })

  if (invalid) {
    return res.status(400).json({ error: invalid })
  }

  try {
    const created = await withTransaction(async (db) => {
      const budget = await findUsableBudget(db, departmentBudget)

      const requestNumber = await nextRequestNumber(db, {
        fiscalYearId: budget.fk_fiscal_year,
        year: budget.year,
      })

      const draft = await db.queryOne(
        `select id_purchase_request_status from PurchaseRequestStatus where code = 'DRAFT'`,
      )

      const { net, vat, total } = requestAmounts(items, amounts)

      const result = await db.query(
        `insert into PurchaseRequest
           (request_number, source, fk_fiscal_year, fk_department_budget,
            fk_purchase_request_status, fk_created_by_user, justification, comment,
            net_amount, vat_amount, total_amount)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestNumber,
          source,
          budget.fk_fiscal_year,
          budget.id_department_budget,
          draft.id_purchase_request_status,
          req.user.id_user,
          justification,
          comment?.trim() || null,
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
            // kategoriju dodjeljuje nabava pri obradi, podnositelj je ne bira
            item.fk_item_category_budget ?? null,
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

// Izmjena nacrta ili zahtjeva vracenog na dopunu. Stavke koje dodju s id-em se
// azuriraju i zadrzavaju kategoriju koju im je nabava mozda vec dala; nove se
// dodaju, a one kojih vise nema brisu se. Izvor i broj zahtjeva se ne mijenjaju.
purchaseRequestsRouter.put('/:id', async (req, res) => {
  const {
    departmentBudget = null,
    justification = null,
    comment = null,
    items = [],
    amounts = null,
  } = req.body ?? {}

  if (!departmentBudget) {
    return res.status(400).json({ error: 'Odaberite troskovno mjesto' })
  }

  const invalid = invalidContent({ justification, comment, items })

  if (invalid) {
    return res.status(400).json({ error: invalid })
  }

  try {
    await withTransaction(async (db) => {
      const request = await db.queryOne(
        `select pr.id_purchase_request, pr.fk_fiscal_year, pr.fk_created_by_user,
                st.code as status_code, st.name as status_name
           from PurchaseRequest pr
           join PurchaseRequestStatus st
             on st.id_purchase_request_status = pr.fk_purchase_request_status
          where pr.id_purchase_request = ?
          for update`,
        [req.params.id],
      )

      if (request === null || !canSee(req.user, request)) {
        throw new WorkflowError(`Zahtjev ${req.params.id} ne postoji`, 404)
      }

      if (!canEdit(req.user, request)) {
        if (!EDITABLE_STATUSES.includes(request.status_code)) {
          throw new WorkflowError(`U statusu "${request.status_name}" zahtjev se vise ne mijenja`)
        }

        throw new WorkflowError('Zahtjev moze mijenjati samo podnositelj', 403)
      }

      const budget = await findUsableBudget(db, departmentBudget)

      // broj zahtjeva nosi godinu, pa zahtjev ne moze preseliti u drugu
      if (budget.fk_fiscal_year !== request.fk_fiscal_year) {
        throw new WorkflowError('Sluzba ili projekt mora biti iz iste fiskalne godine kao zahtjev')
      }

      const existing = await db.query(
        `select id_purchase_request_item from PurchaseRequestItem where fk_purchase_request = ?`,
        [req.params.id],
      )
      const existingIds = new Set(existing.map((row) => row.id_purchase_request_item))
      const keptIds = new Set()

      for (const item of items) {
        const id = Number(item.id_purchase_request_item)

        if (existingIds.has(id)) {
          keptIds.add(id)

          await db.query(
            `update PurchaseRequestItem
                set item_name = ?, quantity = ?, unit_price = ?, vat_rate = ?
              where id_purchase_request_item = ?`,
            [item.item_name.trim(), item.quantity, item.unit_price ?? 0, item.vat_rate ?? 25, id],
          )
        } else {
          await db.query(
            `insert into PurchaseRequestItem
               (fk_purchase_request, item_name, quantity, unit_price, vat_rate)
             values (?, ?, ?, ?, ?)`,
            [
              req.params.id,
              item.item_name.trim(),
              item.quantity,
              item.unit_price ?? 0,
              item.vat_rate ?? 25,
            ],
          )
        }
      }

      for (const id of existingIds) {
        if (!keptIds.has(id)) {
          await db.query(`delete from PurchaseRequestItem where id_purchase_request_item = ?`, [id])
        }
      }

      const { net, vat, total } = requestAmounts(items, amounts)

      await db.query(
        `update PurchaseRequest
            set fk_department_budget = ?, justification = ?, comment = ?,
                net_amount = ?, vat_amount = ?, total_amount = ?,
                updated_at = current_timestamp
          where id_purchase_request = ?`,
        [
          budget.id_department_budget,
          justification,
          comment?.trim() || null,
          net.toFixed(2),
          vat.toFixed(2),
          total.toFixed(2),
          req.params.id,
        ],
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

purchaseRequestsRouter.get('/:id', async (req, res) => {
  const request = await queryOne(`${listSql} where pr.id_purchase_request = ?`, [req.params.id])

  if (request === null || !canSee(req.user, request)) {
    return res.status(404).json({ error: `Zahtjev ${req.params.id} ne postoji` })
  }

  const [items, timeline, attachments, transitions, categories] = await Promise.all([
    query(
      `select pri.id_purchase_request_item, pri.item_name, pri.quantity, pri.unit_price,
              pri.vat_rate,
              pri.quantity * pri.unit_price as line_total,
              ${itemGrossSql} as line_gross,
              pri.fk_item_category_budget, cat.name as item_category_name
         from PurchaseRequestItem pri
         left join ItemCategoryBudget cat on cat.id_item_category_budget = pri.fk_item_category_budget
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
    // kategorije iste fiskalne godine, za izbor kategorije stavke
    listCategoryBudgets({ fiscalYearId: request.fk_fiscal_year }),
  ])

  res.json({
    ...request,
    items,
    timeline,
    attachments,
    transitions,
    categories,
    category_editable: CATEGORY_EDITABLE_STATUSES.includes(request.status_code),
    can_edit: canEdit(req.user, request),
  })
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

      if (request === null || !canSee(req.user, request)) {
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

// Kategorija mora biti aktivna i iz iste fiskalne godine kao zahtjev, inace
// bi trosak zavrsio u tudjem proracunu.
async function findUsableCategory(db, categoryId, fiscalYearId) {
  const category = await db.queryOne(
    `select id_item_category_budget, name, is_active, fk_fiscal_year
       from ItemCategoryBudget
      where id_item_category_budget = ?`,
    [categoryId],
  )

  if (category === null) {
    throw new WorkflowError(`Kategorija ${categoryId} ne postoji`, 400)
  }

  if (category.is_active !== 1) {
    throw new WorkflowError(`Kategorija "${category.name}" nije aktivna`)
  }

  if (category.fk_fiscal_year !== fiscalYearId) {
    throw new WorkflowError(`Kategorija "${category.name}" pripada drugoj fiskalnoj godini`)
  }

  return category
}

// Kategorija jedne stavke; null je brise.
purchaseRequestsRouter.patch(
  '/:id/items/:itemId',
  requireRole('PROCUREMENT'),
  async (req, res) => {
    const categoryId = req.body?.category ?? null

    try {
      await withTransaction(async (db) => {
        const item = await db.queryOne(
          `select pri.id_purchase_request_item, pr.fk_fiscal_year, st.code as status_code,
                  st.name as status_name
             from PurchaseRequestItem pri
             join PurchaseRequest pr on pr.id_purchase_request = pri.fk_purchase_request
             join PurchaseRequestStatus st
               on st.id_purchase_request_status = pr.fk_purchase_request_status
            where pri.id_purchase_request_item = ? and pri.fk_purchase_request = ?
            for update`,
          [req.params.itemId, req.params.id],
        )

        if (item === null) {
          throw new WorkflowError('Stavka ne postoji', 404)
        }

        if (!CATEGORY_EDITABLE_STATUSES.includes(item.status_code)) {
          throw new WorkflowError(
            `U statusu "${item.status_name}" kategorija se vise ne mijenja`,
          )
        }

        if (categoryId !== null) {
          await findUsableCategory(db, categoryId, item.fk_fiscal_year)
        }

        await db.query(
          `update PurchaseRequestItem
              set fk_item_category_budget = ?
            where id_purchase_request_item = ?`,
          [categoryId, req.params.itemId],
        )

        await db.query(
          `update PurchaseRequest set updated_at = current_timestamp
            where id_purchase_request = ?`,
          [req.params.id],
        )
      })

      res.json({ ok: true })
    } catch (err) {
      if (err instanceof WorkflowError) {
        return res.status(err.status).json({ error: err.message })
      }

      throw err
    }
  },
)

// Skupna dodjela s popisa u nabavi: kategorija ide samo stavkama koje je jos
// nemaju, da se ne pregaze odluke donesene stavku po stavku. Zahtjevi o
// kojima je vec odluceno preskacu se.
purchaseRequestsRouter.post('/assign-category', requireRole('PROCUREMENT'), async (req, res) => {
  const { requests: requestIds, category: categoryId } = req.body ?? {}

  if (!Array.isArray(requestIds) || requestIds.length === 0 || !categoryId) {
    return res.status(400).json({ error: 'Nedostaju zahtjevi ili kategorija' })
  }

  try {
    const result = await withTransaction(async (db) => {
      let updatedItems = 0
      const skipped = []

      for (const requestId of requestIds) {
        const request = await db.queryOne(
          `select pr.id_purchase_request, pr.request_number, pr.fk_fiscal_year,
                  st.code as status_code
             from PurchaseRequest pr
             join PurchaseRequestStatus st
               on st.id_purchase_request_status = pr.fk_purchase_request_status
            where pr.id_purchase_request = ?
            for update`,
          [requestId],
        )

        if (request === null || !CATEGORY_EDITABLE_STATUSES.includes(request.status_code)) {
          skipped.push(request?.request_number ?? String(requestId))
          continue
        }

        await findUsableCategory(db, categoryId, request.fk_fiscal_year)

        const update = await db.query(
          `update PurchaseRequestItem
              set fk_item_category_budget = ?
            where fk_purchase_request = ? and fk_item_category_budget is null`,
          [categoryId, requestId],
        )

        if (update.affectedRows > 0) {
          updatedItems += update.affectedRows

          await db.query(
            `update PurchaseRequest set updated_at = current_timestamp
              where id_purchase_request = ?`,
            [requestId],
          )
        }
      }

      return { updatedItems, skipped }
    })

    res.json(result)
  } catch (err) {
    if (err instanceof WorkflowError) {
      return res.status(err.status).json({ error: err.message })
    }

    throw err
  }
})

// Preuzimanje priloga. Otvara se u pregledniku (inline), pod imenom koje je
// datoteka imala kad je prilozena; na disku je spremljena pod UUID-om.
purchaseRequestsRouter.get('/:id/attachments/:attachmentId', async (req, res) => {
  const attachment = await queryOne(
    `select a.file_name, a.file_path, a.mime_type, pr.fk_created_by_user
       from PurchaseRequestAttachment a
       join PurchaseRequest pr on pr.id_purchase_request = a.fk_purchase_request
      where a.id_purchase_request_attachment = ? and a.fk_purchase_request = ?`,
    [req.params.attachmentId, req.params.id],
  )

  if (attachment === null || !canSee(req.user, attachment)) {
    return res.status(404).json({ error: 'Prilog ne postoji' })
  }

  // filename* nosi i hrvatske znakove; obican filename je zamjena za stare preglednike
  const asciiName = attachment.file_name.replace(/[^\x20-\x7e]|"/g, '_')
  const disposition =
    `inline; filename="${asciiName}"; ` +
    `filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`

  // ime na disku daje server, ali basename svejedno sprjecava izlazak iz mape
  res.sendFile(
    attachmentPath(basename(attachment.file_path)),
    {
      headers: {
        'Content-Type': attachment.mime_type ?? 'application/octet-stream',
        'Content-Disposition': disposition,
      },
    },
    (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'Datoteka priloga nije pronađena na disku' })
      }
    },
  )
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
          `select id_purchase_request, fk_created_by_user
             from PurchaseRequest
            where id_purchase_request = ?`,
          [req.params.id],
        )

        if (request === null || !canSee(req.user, request)) {
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

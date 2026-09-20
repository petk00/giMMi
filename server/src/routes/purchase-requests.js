import { Router } from 'express'

import { query, queryOne } from '../db.js'

export const purchaseRequestsRouter = Router()

const listSql = `
  select pr.id_purchase_request, pr.request_number, pr.source, pr.total_amount,
         pr.justification, pr.comment, pr.created_at, pr.updated_at,
         pr.fk_fiscal_year, fy.year,
         pr.fk_department_budget, dept.name as department_name,
         pr.fk_purchase_request_status, st.code as status_code, st.name as status_name,
         pr.fk_created_by_user,
         concat(u.first_name, ' ', u.last_name) as created_by_name
    from PurchaseRequest pr
    join FiscalYear fy on fy.id_fiscal_year = pr.fk_fiscal_year
    join DepartmentBudget dept on dept.id_department_budget = pr.fk_department_budget
    join PurchaseRequestStatus st on st.id_purchase_request_status = pr.fk_purchase_request_status
    join AppUser u on u.id_user = pr.fk_created_by_user`

purchaseRequestsRouter.get('/', async (req, res) => {
  const { fiscalYear, status, departmentBudget } = req.query

  const rows = await query(
    `${listSql}
      where (? is null or fy.year = ?)
        and (? is null or st.name = ?)
        and (? is null or dept.id_department_budget = ?)
      order by pr.created_at desc`,
    [
      fiscalYear ?? null,
      fiscalYear ?? null,
      status ?? null,
      status ?? null,
      departmentBudget ?? null,
      departmentBudget ?? null,
    ],
  )

  res.json(rows)
})

purchaseRequestsRouter.get('/:id', async (req, res) => {
  const request = await queryOne(`${listSql} where pr.id_purchase_request = ?`, [req.params.id])

  if (request === null) {
    return res.status(404).json({ error: `Zahtjev ${req.params.id} ne postoji` })
  }

  const [items, history, attachments, transitions] = await Promise.all([
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
    query(
      `select h.id_purchase_request_status_history, h.changed_at, h.comment,
              h.fk_purchase_request_status, st.name as status_name,
              h.fk_changed_by_user,
              concat(u.first_name, ' ', u.last_name) as changed_by_name
         from PurchaseRequestStatusHistory h
         join PurchaseRequestStatus st
           on st.id_purchase_request_status = h.fk_purchase_request_status
         join AppUser u on u.id_user = h.fk_changed_by_user
        where h.fk_purchase_request = ?
        order by h.changed_at desc`,
      [req.params.id],
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
              gd.code as generated_document_type_code
         from PurchaseRequest pr
         join StatusTransition st
           on st.fk_from_status = pr.fk_purchase_request_status
          and st.applies_to_source in ('ANY', pr.source)
         join PurchaseRequestStatus ts on ts.id_purchase_request_status = st.fk_to_status
         left join DocumentType rd on rd.id_document_type = st.fk_required_document_type
         left join DocumentType gd on gd.id_document_type = st.fk_generates_document_type
        where pr.id_purchase_request = ?
        order by ts.sort_order`,
      [req.params.id],
    ),
  ])

  res.json({ ...request, items, history, attachments, transitions })
})

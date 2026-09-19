import { Router } from 'express'

import { query, queryOne } from '../db.js'

export const purchaseRequestsRouter = Router()

const listSql = `
  select pr.id_purchase_request, pr.request_number, pr.total_amount,
         pr.justification, pr.comment, pr.created_at, pr.updated_at,
         pr.fk_fiscal_year, fy.year,
         pr.fk_department, d.name as department_name,
         pr.fk_request_status, rs.name as status_name,
         pr.fk_created_by_user,
         concat(u.first_name, ' ', u.last_name) as created_by_name
    from PurchaseRequest pr
    join FiscalYear fy on fy.id_fiscal_year = pr.fk_fiscal_year
    join Department d on d.id_department = pr.fk_department
    join RequestStatus rs on rs.id_request_status = pr.fk_request_status
    join AppUser u on u.id_user = pr.fk_created_by_user`

purchaseRequestsRouter.get('/', async (req, res) => {
  const { fiscalYear, status, department } = req.query

  const rows = await query(
    `${listSql}
      where (? is null or fy.year = ?)
        and (? is null or rs.name = ?)
        and (? is null or d.id_department = ?)
      order by pr.created_at desc`,
    [
      fiscalYear ?? null,
      fiscalYear ?? null,
      status ?? null,
      status ?? null,
      department ?? null,
      department ?? null,
    ],
  )

  res.json(rows)
})

purchaseRequestsRouter.get('/:id', async (req, res) => {
  const request = await queryOne(`${listSql} where pr.id_purchase_request = ?`, [req.params.id])

  if (request === null) {
    return res.status(404).json({ error: `Zahtjev ${req.params.id} ne postoji` })
  }

  const [items, history, attachments] = await Promise.all([
    query(
      `select pri.id_purchase_request_item, pri.item_name, pri.quantity,
              pri.fk_item_category, ic.name as item_category_name
         from PurchaseRequestItem pri
         join ItemCategory ic on ic.id_item_category = pri.fk_item_category
        where pri.fk_purchase_request = ?
        order by pri.id_purchase_request_item`,
      [req.params.id],
    ),
    query(
      `select h.id_request_status_history, h.changed_at, h.comment,
              h.fk_request_status, rs.name as status_name,
              h.fk_changed_by_user,
              concat(u.first_name, ' ', u.last_name) as changed_by_name
         from RequestStatusHistory h
         join RequestStatus rs on rs.id_request_status = h.fk_request_status
         join AppUser u on u.id_user = h.fk_changed_by_user
        where h.fk_purchase_request = ?
        order by h.changed_at desc`,
      [req.params.id],
    ),
    query(
      `select id_attachment, file_name, file_type, document_type, uploaded_at,
              fk_uploaded_by_user
         from Attachment
        where fk_purchase_request = ?
        order by uploaded_at desc`,
      [req.params.id],
    ),
  ])

  res.json({ ...request, items, history, attachments })
})

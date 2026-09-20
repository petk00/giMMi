import { Router } from 'express'

import { query } from '../db.js'

export const purchaseRequestStatusesRouter = Router()

purchaseRequestStatusesRouter.get('/', async (req, res) => {
  const rows = await query(
    `select id_purchase_request_status, code, name, sort_order, is_final
       from PurchaseRequestStatus
      order by sort_order`,
  )

  res.json(rows)
})

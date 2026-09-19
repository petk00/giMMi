import { Router } from 'express'

import { query } from '../db.js'

export const purchaseRequestStatusesRouter = Router()

purchaseRequestStatusesRouter.get('/', async (req, res) => {
  const rows = await query(
    `select id_purchase_request_status, name
       from PurchaseRequestStatus
      order by id_purchase_request_status`,
  )

  res.json(rows)
})

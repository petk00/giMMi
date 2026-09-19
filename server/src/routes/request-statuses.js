import { Router } from 'express'

import { query } from '../db.js'

export const requestStatusesRouter = Router()

requestStatusesRouter.get('/', async (req, res) => {
  const rows = await query(
    `select id_request_status, name from RequestStatus order by id_request_status`,
  )

  res.json(rows)
})

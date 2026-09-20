import { Router } from 'express'

import { query } from '../db.js'

export const departmentsRouter = Router()

// Trajne organizacijske jedinice, neovisne o fiskalnoj godini.
departmentsRouter.get('/', async (req, res) => {
  const rows = await query(
    `select id_department, name, is_active from Department order by name`,
  )

  res.json(rows)
})

import { Router } from 'express'

import { query } from '../db.js'

export const fiscalYearsRouter = Router()

fiscalYearsRouter.get('/', async (req, res) => {
  const rows = await query(
    `select id_fiscal_year, year, total_budget, is_closed
       from FiscalYear
      order by year desc`,
  )

  res.json(rows)
})

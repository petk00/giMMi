import { Router } from 'express'

import { query } from '../db.js'

export const departmentsRouter = Router()

departmentsRouter.get('/', async (req, res) => {
  const { fiscalYear } = req.query

  const rows = await query(
    `select d.id_department, d.name, d.department_limit, d.is_active,
            d.fk_fiscal_year, fy.year
       from Department d
       join FiscalYear fy on fy.id_fiscal_year = d.fk_fiscal_year
      where (? is null or fy.year = ?)
      order by d.name`,
    [fiscalYear ?? null, fiscalYear ?? null],
  )

  res.json(rows)
})

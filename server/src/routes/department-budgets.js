import { Router } from 'express'

import { query } from '../db.js'

export const departmentBudgetsRouter = Router()

// Odjel s limitom potrosnje unutar jedne fiskalne godine.
departmentBudgetsRouter.get('/', async (req, res) => {
  const { fiscalYear } = req.query

  const rows = await query(
    `select dept.id_department_budget, dept.name, dept.budget_limit, dept.is_active,
            dept.fk_fiscal_year, fy.year
       from DepartmentBudget dept
       join FiscalYear fy on fy.id_fiscal_year = dept.fk_fiscal_year
      where (? is null or fy.year = ?)
      order by dept.name`,
    [fiscalYear ?? null, fiscalYear ?? null],
  )

  res.json(rows)
})

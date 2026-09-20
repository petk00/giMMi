import { Router } from 'express'

import { query } from '../db.js'

export const departmentBudgetsRouter = Router()

// Proracun sluzbe za jednu fiskalnu godinu; sama sluzba je u Department.
departmentBudgetsRouter.get('/', async (req, res) => {
  const { fiscalYear } = req.query

  const rows = await query(
    `select b.id_department_budget, b.budget_limit,
            b.fk_department, d.name as department_name, d.kind, d.is_active,
            b.fk_fiscal_year, fy.year
       from DepartmentBudget b
       join Department d on d.id_department = b.fk_department
       join FiscalYear fy on fy.id_fiscal_year = b.fk_fiscal_year
      where (? is null or fy.year = ?)
      order by d.name`,
    [fiscalYear ?? null, fiscalYear ?? null],
  )

  res.json(rows)
})

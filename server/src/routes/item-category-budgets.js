import { Router } from 'express'

import { query } from '../db.js'

export const itemCategoryBudgetsRouter = Router()

// Kategorija stavki s limitom potrosnje unutar jedne fiskalne godine.
itemCategoryBudgetsRouter.get('/', async (req, res) => {
  const { fiscalYear } = req.query

  const rows = await query(
    `select cat.id_item_category_budget, cat.name, cat.budget_limit, cat.is_active,
            cat.fk_fiscal_year, fy.year
       from ItemCategoryBudget cat
       join FiscalYear fy on fy.id_fiscal_year = cat.fk_fiscal_year
      where (? is null or fy.year = ?)
      order by cat.name`,
    [fiscalYear ?? null, fiscalYear ?? null],
  )

  res.json(rows)
})

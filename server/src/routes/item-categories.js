import { Router } from 'express'

import { query } from '../db.js'

export const itemCategoriesRouter = Router()

itemCategoriesRouter.get('/', async (req, res) => {
  const { fiscalYear } = req.query

  const rows = await query(
    `select ic.id_item_category, ic.name, ic.category_limit, ic.is_active,
            ic.fk_fiscal_year, fy.year
       from ItemCategory ic
       join FiscalYear fy on fy.id_fiscal_year = ic.fk_fiscal_year
      where (? is null or fy.year = ?)
      order by ic.name`,
    [fiscalYear ?? null, fiscalYear ?? null],
  )

  res.json(rows)
})

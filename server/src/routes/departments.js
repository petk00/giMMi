import { Router } from 'express'

import { query } from '../db.js'

export const departmentsRouter = Router()

// Troskovna mjesta: sluzbe koje traju i projekti koji su vremenski omedjeni.
departmentsRouter.get('/', async (req, res) => {
  const { kind } = req.query

  const rows = await query(
    `select id_department, name, kind, is_active, valid_from, valid_to
       from Department
      where (? is null or kind = ?)
      order by kind, name`,
    [kind ?? null, kind ?? null],
  )

  res.json(rows)
})

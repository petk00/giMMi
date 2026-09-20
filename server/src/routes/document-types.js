import { Router } from 'express'

import { query } from '../db.js'

export const documentTypesRouter = Router()

documentTypesRouter.get('/', async (req, res) => {
  const rows = await query(
    `select id_document_type, code, name from DocumentType order by sort_order`,
  )

  res.json(rows)
})

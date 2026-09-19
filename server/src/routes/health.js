import { Router } from 'express'

import { ping } from '../db.js'
import { config } from '../config.js'

export const healthRouter = Router()

healthRouter.get('/', async (req, res) => {
  let database = 'ok'
  let databaseError = null

  try {
    await ping()
  } catch (err) {
    database = 'error'
    databaseError = err.message
  }

  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    service: 'gimmi-server',
    database,
    databaseName: config.db.database,
    ...(databaseError && { databaseError }),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { config } from './config.js'
import { apiRouter } from './routes/index.js'
import { notFound, errorHandler } from './middleware/error-handler.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(morgan(config.env === 'development' ? 'dev' : 'combined'))

  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

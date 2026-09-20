import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

import { config } from './config.js'
import { apiRouter } from './routes/index.js'
import { authenticate } from './auth.js'
import { notFound, errorHandler } from './middleware/error-handler.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: config.corsOrigin, credentials: true }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())
  app.use(morgan(config.env === 'development' ? 'dev' : 'combined'))

  // svaka ruta zna tko je prijavljen; tko mora biti, kaze requireAuth
  app.use(authenticate)

  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

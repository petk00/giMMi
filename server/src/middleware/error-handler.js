import { config } from '../config.js'

export function notFound(req, res) {
  res.status(404).json({ error: `Ruta ${req.method} ${req.originalUrl} ne postoji` })
}

// eslint-disable-next-line no-unused-vars -- Express prepoznaje error handler po 4 argumenta
export function errorHandler(err, req, res, next) {
  const status = err.status || 500

  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json({
    error: err.message || 'Interna greska servera',
    ...(config.env === 'development' && { stack: err.stack }),
  })
}

import { createApp } from './app.js'
import { config } from './config.js'
import { ping, closePool } from './db.js'

const app = createApp()

try {
  await ping()
  console.log(`Baza ${config.db.database} spojena na ${config.db.host}:${config.db.port}`)
} catch (err) {
  console.error(`Baza ${config.db.database} nije dostupna: ${err.message}`)
}

const server = app.listen(config.port, () => {
  console.log(`giMMi API slusa na http://localhost:${config.port} (${config.env})`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await closePool()
      process.exit(0)
    })
  })
}

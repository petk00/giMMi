export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:9000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  auth: {
    secret: process.env.JWT_SECRET || 'gimmi-dev-secret',
    ttl: process.env.JWT_TTL || '12h',
    ttlSeconds: Number(process.env.JWT_TTL_SECONDS) || 12 * 60 * 60,
  },
  // gdje se cuvaju prilozi i koliko smiju biti veliki
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES) || 10 * 1024 * 1024,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gimmi',
    poolLimit: Number(process.env.DB_POOL_LIMIT) || 10,
  },
}

import mysql from 'mysql2/promise'

import { config } from './config.js'

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.poolLimit,
  queueLimit: 0,
  // decimal(14,2) inace dolazi kao string
  decimalNumbers: true,
  dateStrings: ['DATE'],
})

// Uvijek preko placeholdera (?), nikad konkatenacije, zbog SQL injectiona.
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] ?? null
}

export async function ping() {
  const connection = await pool.getConnection()
  try {
    await connection.ping()
  } finally {
    connection.release()
  }
}

export async function closePool() {
  await pool.end()
}

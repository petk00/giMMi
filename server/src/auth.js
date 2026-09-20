import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { config } from './config.js'
import { queryOne } from './db.js'

export const TOKEN_COOKIE = 'gimmi_token'

const userSql = `
  select u.id_user, u.first_name, u.last_name, u.email, u.is_active, u.password_hash,
         u.fk_role, r.code as role_code, r.name as role_name
    from AppUser u
    join Role r on r.id_role = u.fk_role`

export function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function findUserByEmail(email) {
  return queryOne(`${userSql} where u.email = ?`, [email])
}

export async function findUserById(id) {
  return queryOne(`${userSql} where u.id_user = ?`, [id])
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(user) {
  return jwt.sign({ sub: user.id_user, role: user.role_code }, config.auth.secret, {
    expiresIn: config.auth.ttl,
  })
}

// password_hash nikad ne izlazi iz servera
export function publicUser(user) {
  const { password_hash, ...rest } = user
  void password_hash
  return rest
}

// Cita token iz kolacica i, ako je valjan, stavlja korisnika na req.user.
// Ne odbija zahtjev - to radi requireAuth, da javne rute ostanu javne.
export async function authenticate(req, res, next) {
  const token = req.cookies?.[TOKEN_COOKIE]

  if (!token) {
    return next()
  }

  try {
    const payload = jwt.verify(token, config.auth.secret)
    const user = await findUserById(payload.sub)

    if (user !== null && user.is_active === 1) {
      req.user = publicUser(user)
    }
  } catch {
    // istekao ili neispravan token - korisnik jednostavno nije prijavljen
    res.clearCookie(TOKEN_COOKIE)
  }

  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Niste prijavljeni' })
  }

  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Niste prijavljeni' })
    }

    // administrator smije sve
    if (req.user.role_code !== 'ADMIN' && !roles.includes(req.user.role_code)) {
      return res.status(403).json({ error: 'Nemate ovlasti za ovu radnju' })
    }

    next()
  }
}

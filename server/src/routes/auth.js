import { Router } from 'express'

import { config } from '../config.js'
import {
  TOKEN_COOKIE,
  findUserByEmail,
  publicUser,
  requireAuth,
  signToken,
  verifyPassword,
} from '../auth.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail i lozinka su obavezni' })
  }

  const user = await findUserByEmail(email)

  // ista poruka za nepostojeceg korisnika i krivu lozinku, da se ne moze
  // ispitivati koji e-mailovi postoje
  const invalid = { error: 'Neispravan e-mail ili lozinka' }

  if (user === null || user.is_active !== 1) {
    return res.status(401).json(invalid)
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json(invalid)
  }

  res.cookie(TOKEN_COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: config.auth.ttlSeconds * 1000,
  })

  res.json(publicUser(user))
})

authRouter.post('/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE)
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

import { Router } from 'express'

import { query } from '../db.js'

export const usersRouter = Router()

// password_hash i invite_token se nikad ne vracaju klijentu
usersRouter.get('/', async (req, res) => {
  const rows = await query(
    `select u.id_user, u.first_name, u.last_name, u.email, u.is_active,
            u.fk_role, r.code as role_code, r.name as role_name,
            u.fk_department, d.name as department_name
       from AppUser u
       join Role r on r.id_role = u.fk_role
       left join Department d on d.id_department = u.fk_department
      order by u.last_name, u.first_name`,
  )

  res.json(rows)
})

import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { extname, join, resolve } from 'node:path'

import multer from 'multer'

import { config } from './config.js'

export const uploadDir = resolve(config.uploadDir)

mkdirSync(uploadDir, { recursive: true })

const allowedTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

// Ime datoteke odredjuje server: ono s klijenta moze sadrzavati putanju ili
// znakove koji na disku znace nesto drugo. Original se pamti u bazi.
const storage = multer.diskStorage({
  destination: (req, file, done) => done(null, uploadDir),
  filename: (req, file, done) => done(null, `${randomUUID()}${extname(file.originalname)}`),
})

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: config.uploadMaxBytes, files: 1 },
  fileFilter: (req, file, done) => {
    if (!allowedTypes.has(file.mimetype)) {
      return done(new Error(`Vrsta datoteke ${file.mimetype} nije dopustena`))
    }

    done(null, true)
  },
}).single('file')

export function attachmentPath(fileName) {
  return join(uploadDir, fileName)
}

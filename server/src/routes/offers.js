import { Router } from 'express'

import { unlink } from 'node:fs/promises'

import { OfferReadError, readOffer } from '../offer-reader.js'
import { uploadAttachment } from '../uploads.js'

export const offersRouter = Router()

/**
 * Cita ponudu prije nego zahtjev uopce postoji, pa datoteka ovdje sluzi samo
 * modelu i brise se odmah. Isti dokument klijent kasnije salje kao prilog.
 */
offersRouter.post('/read', (req, res) => {
  uploadAttachment(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nedostaje datoteka ponude' })
    }

    // Samo PDF: slike model cita osjetno losije, pa se ne primaju kao ponuda.
    if (req.file.mimetype !== 'application/pdf') {
      await unlink(req.file.path).catch(() => {})

      return res.status(400).json({ error: 'Ponuda mora biti PDF' })
    }

    try {
      res.json(await readOffer(req.file))
    } catch (err) {
      if (err instanceof OfferReadError) {
        return res.status(err.status).json({ error: err.message })
      }

      res.status(500).json({ error: `Ocitavanje ponude nije uspjelo: ${err.message}` })
    } finally {
      await unlink(req.file.path).catch(() => {})
    }
  })
})

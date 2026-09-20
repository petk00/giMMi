import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { config } from './config.js'

const run = promisify(execFile)

export class OfferReadError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

// Model vraca tocno ovu strukturu; bez sheme bi vracao tekst koji treba parsirati.
const responseSchema = {
  type: 'object',
  properties: {
    supplier: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        oib: { type: 'string' },
        offerNumber: { type: 'string' },
        validUntil: { type: 'string' },
      },
      required: ['name'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
        },
        required: ['name', 'quantity', 'unitPrice'],
      },
    },
    netTotal: { type: 'number' },
  },
  required: ['supplier', 'items'],
}

const prompt = [
  'Ovo je ponuda dobavljaca. Izvuci:',
  '- dobavljaca (naziv, OIB ako pise),',
  '- broj ponude i datum do kojeg vrijedi,',
  '- sve stavke s kolicinom i jedinicnom cijenom bez PDV-a,',
  '- ukupnu osnovicu bez PDV-a.',
  'Cijene su u eurima; decimalni zarez pretvori u tocku, a tisucicu izbaci.',
  'Ne izmisljaj stavke kojih nema na ponudi. Vrati samo JSON.',
].join('\n')

/**
 * PDF nije slika, pa ga prvo treba rasterizirati. qlmanage je na macOS-u
 * dostupan bez instalacije i renderira prvu stranicu u trazenoj velicini.
 */
async function pdfToPng(filePath) {
  const dir = await mkdtemp(join(tmpdir(), 'gimmi-offer-'))

  try {
    await run('qlmanage', ['-t', '-s', String(config.ollama.renderWidth), '-o', dir, filePath])

    const [rendered] = (await readdir(dir)).filter((name) => name.endsWith('.png'))

    if (!rendered) {
      throw new OfferReadError('PDF nije moguce pretvoriti u sliku')
    }

    return await readFile(join(dir, rendered))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function askModel(imageBase64) {
  const started = Date.now()

  let response

  try {
    response = await fetch(`${config.ollama.url}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(config.ollama.timeoutMs),
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        think: false,
        format: responseSchema,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
      }),
    })
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new OfferReadError('Ocitavanje ponude je predugo trajalo', 504)
    }

    throw new OfferReadError(`Model nije dostupan na ${config.ollama.url}: ${err.message}`, 503)
  }

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new OfferReadError(data.error ?? `Model je vratio ${response.status}`)
  }

  try {
    return { reading: JSON.parse(data.message.content), tookMs: Date.now() - started }
  } catch {
    throw new OfferReadError('Model nije vratio ispravan JSON')
  }
}

/** Brojevi iz modela znaju doci kao string ("999,20"), pa ih svodimo na broj. */
function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number(value.replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
}

function normalise({ supplier = {}, items = [], netTotal }) {
  const cleanItems = items
    .map((item) => ({
      name: String(item.name ?? '').trim(),
      quantity: toNumber(item.quantity) ?? 1,
      unitPrice: toNumber(item.unitPrice) ?? 0,
    }))
    .filter((item) => item.name !== '')

  return {
    supplier: {
      name: String(supplier.name ?? '').trim(),
      oib: String(supplier.oib ?? '').trim() || null,
      offerNumber: String(supplier.offerNumber ?? '').trim() || null,
      validUntil: String(supplier.validUntil ?? '').trim() || null,
    },
    items: cleanItems,
    netTotal:
      toNumber(netTotal) ??
      cleanItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  }
}

/**
 * Ocitava ponudu lokalnim modelom. Slike idu ravno u model, PDF se prvo
 * renderira. Rezultat je prijedlog koji podnositelj jos uvijek provjerava.
 */
export async function readOffer({ path, mimetype }) {
  const bytes =
    mimetype === 'application/pdf' ? await pdfToPng(path) : await readFile(path)

  const { reading, tookMs } = await askModel(bytes.toString('base64'))

  return { ...normalise(reading), model: config.ollama.model, tookMs }
}

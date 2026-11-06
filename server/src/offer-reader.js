import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Agent, fetch } from 'undici'

import { config } from './config.js'
import { uploadDir } from './uploads.js'

const run = promisify(execFile)
const ollamaAgent = new Agent({ headersTimeout: 0, bodyTimeout: 0 })

export class OfferReadError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

const systemPrompt = `You are an expert document parser. Your job is to extract structured data from Croatian offer/invoice images into a clean JSON format.

CRITICAL INSTRUCTIONS:
1. Extract supplier info, offer header (offer number, dates), all line items, and totals.
2. For prices and totals: Do not calculate or guess anything. Copy exact figures from the image.
3. Number formatting: Convert European decimal comma (,) to dot (.). Remove thousand separators (.) entirely (e.g., "1.250,50" -> 1250.50).
4. Line totals: Copy the exact line total ("Iznos" column) for each item as written (which already includes discounts).
5. Missing values: Use empty string "" for string fields and null for missing numbers if not present on the document. Do not invent data.
6. Return ONLY a valid JSON object with exactly this structure:
{
  "supplier": { "name": "", "oib": "", "offerNumber": "", "issuedAt": "", "validUntil": "" },
  "items": [{ "name": "", "quantity": null, "unitPrice": null, "lineTotal": null }],
  "netTotal": null,
  "vatAmount": null,
  "totalWithVat": null
}
Use an empty items array when there are no line items. No conversational text or extra explanations.`

const userPrompt = `Ovo je slika ponude dobavljača. Izvuci sve podatke i stavke iz nje prema zadanoj JSON šemi.
Datume zapiši u obliku DD.MM.GGGG.`

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
      dispatcher: ollamaAgent,
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        think: false,
        format: 'json',
        options: { temperature: 0, num_ctx: 8192, num_predict: 4096 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt, images: [imageBase64] },
          ...(config.ollama.model === 'gimmi-qwen3-vl:8b-instruct'
            ? [{ role: 'assistant', content: '</think>\n' }]
            : []),
        ],
      }),
    })
  } catch (err) {
    const cause = err.cause
    const detail = cause?.code
      ? `${cause.code}${cause.message ? `: ${cause.message}` : ''}`
      : err.message

    throw new OfferReadError(`Model nije dostupan na ${config.ollama.url}: ${detail}`, 503)
  }

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new OfferReadError(data.error ?? `Model je vratio ${response.status}`)
  }

  const content = data.message?.content?.trim()

  if (!content) {
    throw new OfferReadError(
      data.done_reason === 'length'
        ? 'Model je dosegao limit tokena prije nego sto je vratio JSON'
        : 'Model nije vratio JSON u zavrsnom odgovoru',
    )
  }

  const raw = content.replace(/^```(?:json)?\s*|\s*```$/g, '')

  try {
    return {
      reading: JSON.parse(raw),
      tookMs: Date.now() - started,
      inputTokens: data.prompt_eval_count ?? null,
      outputTokens: data.eval_count ?? null,
    }
  } catch {
    throw new OfferReadError(
      data.done_reason === 'length'
        ? 'Model je dosegao limit tokena prije nego sto je zavrsio JSON'
        : 'Model nije vratio ispravan JSON',
    )
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

/**
 * Jedinicna cijena se racuna iz iznosa retka, jer na ponudama s rabatom model
 * gotovo uvijek prepise cijenu iz cjenika, a iznos retka je vec umanjen.
 */
function unitPriceOf({ unitPrice, lineTotal, quantity }) {
  if (lineTotal !== null && lineTotal > 0 && quantity > 0) {
    return Math.round((lineTotal / quantity) * 100) / 100
  }

  return unitPrice ?? 0
}

const VAT_RATES = [0.25, 0.13, 0.05]

const round2 = (value) => Math.round(value * 100) / 100

/** Odgovara li iznos PDV-a nekoj od zakonskih stopa na danoj osnovici. */
function vatFits(base, vat) {
  if (base <= 0 || vat <= 0) {
    return false
  }

  return VAT_RATES.some((rate) => Math.abs(base * rate - vat) <= Math.max(0.02, base * 0.002))
}

/**
 * Model zna uzeti iznos s PDV-om kao osnovicu pa PDV dodati jos jednom -
 * rezultat je iznos veci za jedan PDV. Stopa to otkriva: PDV odgovara jednoj
 * od zakonskih stopa samo na pravoj osnovici. Kad ni to ne pomogne, oslonac
 * je zbroj iznosa stavki, koji dolazi iz tablice a ne iz podnozja ponude.
 */
export function reconcileAmounts({ net, vat, total, itemsSum }) {
  const tolerance = 0.02
  const close = (a, b) => Math.abs(a - b) <= tolerance

  if (vatFits(net, vat)) {
    // osnovica je ispravna; ukupno mora biti njihov zbroj
    if (close(net + vat, total)) {
      return { net, vat, total, corrected: false }
    }

    return { net, vat, total: round2(net + vat), corrected: true }
  }

  // PDV pristaje na iznos umanjen za sebe: kao osnovica je uzet iznos s PDV-om
  if (vatFits(round2(net - vat), vat)) {
    return { net: round2(net - vat), vat, total: net, corrected: true }
  }

  if (itemsSum > 0 && !close(net, itemsSum)) {
    if (close(net - vat, itemsSum)) {
      return { net: itemsSum, vat, total: net, corrected: true }
    }

    if (close(total - vat, itemsSum)) {
      return { net: itemsSum, vat, total, corrected: true }
    }
  }

  return { net, vat, total, corrected: false }
}

function normalise({ supplier = {}, items = [], netTotal, vatAmount, totalWithVat }) {
  const cleanItems = items
    .map((item) => {
      const quantity = toNumber(item.quantity) ?? 1

      return {
        name: String(item.name ?? '').trim(),
        quantity,
        unitPrice: unitPriceOf({
          unitPrice: toNumber(item.unitPrice),
          lineTotal: toNumber(item.lineTotal),
          quantity,
        }),
      }
    })
    .filter((item) => item.name !== '')

  const itemsSum =
    Math.round(cleanItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) /
    100

  const amounts = reconcileAmounts({
    net: toNumber(netTotal) ?? 0,
    vat: toNumber(vatAmount) ?? 0,
    total: toNumber(totalWithVat) ?? 0,
    itemsSum,
  })

  return {
    supplier: {
      name: String(supplier.name ?? '').trim(),
      oib: String(supplier.oib ?? '').trim() || null,
      offerNumber: String(supplier.offerNumber ?? '').trim() || null,
      issuedAt: String(supplier.issuedAt ?? '').trim() || null,
      validUntil: String(supplier.validUntil ?? '').trim() || null,
    },
    items: cleanItems,
    // Iznosi se prepisuju s ponude; diraju se samo kad se ne slazu sa stavkama.
    netTotal: amounts.net,
    vatAmount: amounts.vat,
    totalWithVat: amounts.total,
    amountsCorrected: amounts.corrected,
    itemsSum,
  }
}

/**
 * U razvoju se zadnje ocitanje zapisuje na disk: kad model promasi iznos,
 * sirovi odgovor je jedino sto pokazuje zasto.
 */
async function dumpReading(payload) {
  if (config.env !== 'development') {
    return
  }

  await writeFile(
    join(uploadDir, 'zadnje-ocitanje.json'),
    JSON.stringify({ kada: new Date().toISOString(), ...payload }, null, 2),
  ).catch(() => {})
}

/**
 * Ocitava ponudu lokalnim modelom. Slike idu ravno u model, PDF se prvo
 * renderira. Rezultat je prijedlog koji podnositelj jos uvijek provjerava.
 */
export async function readOffer({ path, mimetype, originalname }) {
  const bytes =
    mimetype === 'application/pdf' ? await pdfToPng(path) : await readFile(path)

  const { reading, tookMs, inputTokens, outputTokens } = await askModel(bytes.toString('base64'))
  const result = {
    ...normalise(reading),
    model: config.ollama.model,
    tookMs,
    inputTokens,
    outputTokens,
  }

  await dumpReading({ originalname, reading, result })

  return result
}

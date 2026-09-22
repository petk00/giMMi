// Usporedba modela na istoj ponudi, kroz isti kod koji koristi server.
import { config } from './src/config.js'
import { readOffer } from './src/offer-reader.js'

const file = process.argv[2]
const models = process.argv.slice(3)

for (const model of models) {
  config.ollama.model = model

  try {
    const result = await readOffer({ path: file, mimetype: 'application/pdf' })

    console.log(`\n=== ${model} — ${result.tookMs} ms ===`)
    console.log('dobavljac:', JSON.stringify(result.supplier))
    console.log('osnovica :', result.netTotal)

    for (const item of result.items) {
      console.log(`  ${item.quantity} x ${item.unitPrice} = ${(item.quantity * item.unitPrice).toFixed(2)}  ${item.name}`)
    }
  } catch (err) {
    console.log(`\n=== ${model} — GRESKA: ${err.message}`)
  }
}

// Ponuda odabrana na "Mojim zahtjevima" putuje do novog zahtjeva. Datoteka se
// ne moze staviti u adresu, pa ceka ovdje dok je nova stranica ne preuzme.
let pending = []

export function handOverOffers(files) {
  pending = [...files]
}

// preuzimanjem se prazni, pa povratak na stranicu ne doda ponudu jos jednom
export function takeHandedOffers() {
  const files = pending
  pending = []

  return files
}

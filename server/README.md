# giMMi - server

Node.js / Express API za giMMi, spojen na MySQL bazu `gimmi`.

## Pokretanje

```bash
npm install
cp .env.example .env   # ako .env ne postoji
npm run dev            # node --watch, restart na promjenu
npm start              # produkcijski start
```

Server slusa na `http://localhost:3000` (promjenjivo preko `PORT` u `.env`).
Na startu pinga bazu i ispise je li spojena.

## Baza

Spajanje ide preko `mysql2` connection poola (`src/db.js`), parametri iz `.env`:

| Varijabla | Default |
| --- | --- |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | (prazno) |
| `DB_NAME` | `gimmi` |
| `DB_POOL_LIMIT` | `10` |

Sheme se ne generiraju iz koda - baza `gimmi` je rucno modelirana, server je
samo cita i pise preko SQL-a. Svi upiti idu kroz `?` placeholdere
(`query()` / `queryOne()`), nikad kroz konkatenaciju stringova.

## Endpointi

| Metoda | Ruta | Opis |
| --- | --- | --- |
| GET | `/api/health` | status servera i ping baze (503 ako baza pada) |
| GET | `/api/fiscal-years` | fiskalne godine s budzetom |
| GET | `/api/departments?fiscalYear=` | odjeli s limitima |
| GET | `/api/item-categories?fiscalYear=` | kategorije stavki s limitima |
| GET | `/api/request-statuses` | statusi zahtjeva |
| GET | `/api/users` | korisnici s rolom (bez `password_hash`) |
| GET | `/api/purchase-requests?fiscalYear=&status=&department=` | lista zahtjeva |
| GET | `/api/purchase-requests/:id` | zahtjev + stavke, povijest statusa i prilozi |

## Struktura

```
src/
  index.js                  # start servera, ping baze, graceful shutdown
  app.js                    # Express app, middleware, /api router
  config.js                 # citanje env varijabli
  db.js                     # mysql2 pool + query helperi
  routes/                   # jedan router po resursu
  middleware/error-handler.js
```

## Veza s klijentom (Quasar)

Quasar dev server proxyja sve `/api` pozive na ovaj server
(`devServer.proxy` u `client/quasar.config.js`), pa klijent koristi relativni
`baseURL` iz `src/boot/axios.js`, a pozive drzi u `client/src/services/gimmi-api.js`.

Za drugi port servera postavi `API_PROXY_TARGET` prije `quasar dev`, a za
produkciju `API_BASE_URL` prije `quasar build`.

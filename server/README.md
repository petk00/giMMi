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

Shema se ne generira iz koda - baza `gimmi` je rucno modelirana, server je
samo cita i pise preko SQL-a. Svi upiti idu kroz `?` placeholdere
(`query()` / `queryOne()`), nikad kroz konkatenaciju stringova.

U `db/` se drzi shema:

```
db/schema.sql      # trenutno stanje sheme, izvezeno iz baze
db/migrations/     # promjene sheme, kronoloski
db/seed.sql        # sifrarnici bez kojih aplikacija ne radi
```

Sifrarnici se ucitavaju iz `db/seed.sql` (`mysql -u root gimmi < db/seed.sql`).
Skripta se smije pokrenuti vise puta - postojeci redci se samo osvjeze.

Migracija se pokrece rucno: `mysql -u root gimmi < db/migrations/<ime>.sql`,
a nakon toga se `db/schema.sql` ponovo izvozi:

```bash
mysqldump -u root --no-data --compact --skip-comments --set-gtid-purged=OFF \
  --skip-add-drop-table gimmi | grep -v '^/\*!' | grep -v '^SET ' > db/schema.sql
```

### Konvencije imena

| Element | Oblik | Primjer |
| --- | --- | --- |
| tablica | PascalCase, jednina | `PurchaseRequestItem` |
| primarni kljuc | `id_<tablica>` | `id_purchase_request` |
| strani kljuc | `fk_<entitet>` | `fk_department_budget` |
| unique indeks | `uq_<tablica>_<kolone>` | `uq_fiscal_year_year` |
| obicni indeks | `idx_<tablica>_<kolone>` | `idx_app_user_invite_token` |

`AppUser` je jedina iznimka s prefiksom - `User` je rezervirana rijec u
PostgreSQL-u, pa se izbjegava i ovdje; njezin PK ostaje `id_user`.

`DepartmentBudget` i `ItemCategoryBudget` nisu odjel i kategorija nego njihov
proracun za jednu fiskalnu godinu (unique po `(fk_fiscal_year, name)`).
`PurchaseRequest` je slozenim stranim kljucem vezan na `(id_department_budget,
fk_fiscal_year)`, pa ne moze pokazivati na proracun odjela iz druge godine.

### Tok zahtjeva

Zahtjev nastaje kao `DRAFT` i prolazi kroz statuse do `RECEIVED` ili `REJECTED`.
Pravila nisu u kodu nego u tablici `StatusTransition`: koji je prijelaz dopusten,
trazi li prilozeni dokument, generira li ga i treba li komentar.

| Prijelaz | Uvjet | Nastaje |
| --- | --- | --- |
| `DRAFT` -> `SUBMITTED` | ponuda, samo ako je `source = OFFER` | zahtjev za nabavom |
| `SUBMITTED` -> `NEEDS_INFO` | komentar | - |
| `NEEDS_INFO` -> `SUBMITTED` | ponuda, samo ako je `source = OFFER` | nova verzija zahtjeva |
| `SUBMITTED` -> `APPROVED` | - | - |
| `SUBMITTED` -> `REJECTED` | komentar | - |
| `APPROVED` -> `ORDERED` | narudzbenica | - |
| `ORDERED` -> `RECEIVED` | dostavnica | - |

`PurchaseRequest.source` govori je li zahtjev nastao iz ponude dobavljaca
(`OFFER`) ili iz kataloga s ugovorenim cijenama (`CATALOG`) - o tome ovisi je li
ponuda uvjet za podnosenje. Zahtjev za nabavom generira sustav (`is_generated`),
pa se pri svakoj dopuni sprema kao nova `version`, a stara ostaje zapisana.

`GET /api/purchase-requests/:id` uz zahtjev vraca i `transitions` - popis koraka
koji su s tog zahtjeva trenutno dopusteni, s uvjetima.

## Endpointi

| Metoda | Ruta | Opis |
| --- | --- | --- |
| GET | `/api/health` | status servera i ping baze (503 ako baza pada) |
| GET | `/api/fiscal-years` | fiskalne godine s budzetom |
| GET | `/api/department-budgets?fiscalYear=` | odjeli s limitima po godini |
| GET | `/api/item-category-budgets?fiscalYear=` | kategorije stavki s limitima po godini |
| GET | `/api/purchase-request-statuses` | statusi zahtjeva |
| GET | `/api/document-types` | tipovi dokumenata |
| GET | `/api/users` | korisnici s rolom (bez `password_hash`) |
| GET | `/api/purchase-requests?fiscalYear=&status=&departmentBudget=` | lista zahtjeva |
| GET | `/api/purchase-requests/:id` | zahtjev + stavke, povijest statusa i prilozi |

## Struktura

```
db/
  schema.sql                # trenutna shema
  migrations/               # promjene sheme
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

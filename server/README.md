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
db/seed-dev.sql    # razvojni korisnici, NE na pravi server
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

`Department` je troskovno mjesto: `kind = DEPARTMENT` za sluzbu koja se
preslikava iz godine u godinu, `kind = PROJECT` za projekt omedjen datumima
(`valid_from`, `valid_to`). `DepartmentBudget` je iznos koji to mjesto ima u
jednoj fiskalnoj godini (unique po `(fk_department, fk_fiscal_year)`).
`ItemCategoryBudget` je kategorija s limitom unutar godine.

Korisnik nije vezan ni na jedno troskovno mjesto - isti zaposlenik moze trositi
na vise sluzbi i projekata - pa ga podnositelj bira pri sastavljanju zahtjeva.
Server tada provjerava da mjesto postoji, da je aktivno, da fiskalna godina nije
zatvorena i da je projekt u tijeku.
`PurchaseRequest` je slozenim stranim kljucem vezan na `(id_department_budget,
fk_fiscal_year)`, pa ne moze pokazivati na proracun odjela iz druge godine.

### Tok zahtjeva

Zahtjev nastaje kao `DRAFT` i prolazi kroz statuse do `RECEIVED` ili `REJECTED`.
Pravila nisu u kodu nego u tablici `StatusTransition`: koji je prijelaz dopusten,
trazi li prilozeni dokument, generira li ga i treba li komentar.

| Prijelaz | Uvjet | Nastaje |
| --- | --- | --- |
| `DRAFT` -> `SUBMITTED` | ponuda, samo ako je `source = OFFER` | zahtjev za nabavom |
| `SUBMITTED` -> `IN_PROGRESS` | - (preuzimanje zahtjeva) | - |
| `IN_PROGRESS` -> `NEEDS_INFO` | komentar | - |
| `NEEDS_INFO` -> `SUBMITTED` | ponuda, samo ako je `source = OFFER` | nova verzija zahtjeva |
| `IN_PROGRESS` -> `APPROVED` | - | - |
| `IN_PROGRESS` -> `REJECTED` | komentar | - |
| `APPROVED` -> `ORDERED` | narudzbenica | - |
| `ORDERED` -> `RECEIVED` | dostavnica | - |
| `RECEIVED` -> `CLOSED` | - (kasnije: knjizenje) | - |

`IN_PROGRESS` ne postavlja se rucno nego preuzimanjem zahtjeva: operater postaje
`fk_assigned_to_user` i status se pomice iz `SUBMITTED`. Zavrsna stanja su
`CLOSED` i `REJECTED`.

Tko koji prijelaz smije, stoji u `StatusTransition.fk_role`: `SUBMITTER`
podnosi i dopunjuje, `PROCUREMENT` obradjuje, odobrava, narucuje i zakljucuje.
Prijelaz u `RECEIVED` nema role jer dostavnicu prilaze onaj tko je robu preuzeo.
`ADMIN` smije sve i to se provjerava u kodu, ne pravilima.

`PurchaseRequest.source` govori je li zahtjev nastao iz ponude dobavljaca
(`OFFER`) ili iz kataloga s ugovorenim cijenama (`CATALOG`) - o tome ovisi je li
ponuda uvjet za podnosenje. Zahtjev za nabavom generira sustav (`is_generated`),
pa se pri svakoj dopuni sprema kao nova `version`, a stara ostaje zapisana.

`GET /api/purchase-requests/:id` uz zahtjev vraca:

* `transitions` - koraci koji su s tog zahtjeva trenutno dopusteni, s uvjetima
* `timeline` - log zivotnog vijeka: promjene statusa i prilozeni ili generirani
  dokumenti, spojeni u jedan niz po vremenu (`event` je `STATUS`,
  `DOCUMENT_ADDED` ili `DOCUMENT_GENERATED`)

## Prijava

Prijava vraca JWT u `httpOnly` kolacicu (`gimmi_token`), pa ga klijentski kod
ne vidi ni ne sprema. Sve rute osim `/api/health` i `/api/auth/*` traze
prijavljenog korisnika i vracaju 401 bez nje.

| Metoda | Ruta | Opis |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }`, postavlja kolacic |
| POST | `/api/auth/logout` | brise kolacic |
| GET | `/api/auth/me` | trenutno prijavljeni korisnik |

Lozinke su bcrypt hashevi (`bcryptjs`, bez native builda). Tajna za potpis
tokena je `JWT_SECRET` u `.env` - u produkciji je obavezno promijeniti.

Razvojni korisnici iz `db/seed-dev.sql`, lozinka svima `123456`:

| E-mail | Rola |
| --- | --- |
| `admin@veleri.hr` | Administrator |
| `submitter@veleri.hr` | Podnositelj |
| `procurement@veleri.hr` | Operater nabave |

## Endpointi

| Metoda | Ruta | Opis |
| --- | --- | --- |
| GET | `/api/health` | status servera i ping baze (503 ako baza pada) |
| GET | `/api/fiscal-years` | fiskalne godine s budzetom |
| GET | `/api/departments?kind=` | troskovna mjesta: sluzbe i projekti |
| GET | `/api/department-budgets?fiscalYear=` | proracuni sluzbi po godini |
| GET | `/api/item-category-budgets?fiscalYear=` | kategorije stavki s limitima po godini |
| GET | `/api/purchase-request-statuses` | statusi zahtjeva |
| GET | `/api/document-types` | tipovi dokumenata |
| GET | `/api/users` | korisnici s rolom (bez `password_hash`) |
| GET | `/api/purchase-requests?fiscalYear=&status=&departmentBudget=&mine=1` | lista zahtjeva; `mine=1` samo svoje |
| POST | `/api/purchase-requests` | novi nacrt sa stavkama; `amounts` prepisuje iznose |
| GET | `/api/purchase-requests/:id` | zahtjev + stavke, timeline, prilozi, dopusteni koraci |
| POST | `/api/purchase-requests/:id/attachments` | multipart: `file` + `documentType` |
| POST | `/api/purchase-requests/:id/transitions` | `{ toStatus, comment }`, promjena statusa |
| POST | `/api/offers/read` | multipart: `file`; lokalni model cita ponudu i vraca stavke |

### Ocitavanje ponude

`POST /api/offers/read` salje prilozenu ponudu lokalnom modelu na Ollami i
vraca prijedlog `{ supplier, items, netTotal, model, tookMs }`. Zahtjev tada
jos ne postoji, pa se datoteka koristi samo za ocitavanje i odmah brise -
isti dokument klijent poslije salje kao prilog nacrta.

Prima se samo PDF - slike s mobitela model cita osjetno losije, pa ih ruta
odbija s 400. PDF se renderira u PNG preko `qlmanage`, koji na macOS-u postoji
bez instalacije; na drugom sustavu tu treba zamjena (npr. `pdftoppm` iz
poplera). Citanje slike je i dalje u `offer-reader.js` ako ogranicenje padne.

Iznosi (`netTotal`, `vatAmount`, `totalWithVat`) prepisuju se s ponude i takvi
idu u bazu: klijent ih salje kao `amounts` u `POST /api/purchase-requests`, a
server ih tada ne izvodi iz stavki. Bez `amounts` - primjerice kod zahtjeva iz
kataloga - racuna se po stavkama kao i prije.

Iznose provjerava `reconcileAmounts`. Model zna uzeti iznos s PDV-om kao
osnovicu pa PDV dodati jos jednom; stopa to otkriva, jer PDV odgovara jednoj od
zakonskih stopa (25, 13, 5 %) samo na pravoj osnovici. Kad ni stopa ne pomogne,
oslonac je zbroj iznosa stavki (`itemsSum`), koji dolazi iz tablice a ne iz
podnozja. Ispravljen iznos nosi `amountsCorrected: true`, sto sucelje prikaze
uz tu ponudu - rijec je o novcu, pa se ne mijenja tiho.

Model vraca JSON po zadanoj shemi (Ollamin `format`), pa odgovor ne treba
parsirati iz teksta. Ocitano je prijedlog - kategoriju stavke i dalje bira
podnositelj, a zbroj stavki se usporedjuje s iznosom s ponude.

| Varijabla | Zadano |
| --- | --- |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `gemma4:e2b` |
| `OLLAMA_TIMEOUT_MS` | `120000` |
| `OFFER_RENDER_WIDTH` | `1700` |

### Prilozi

Datoteke se cuvaju na disku (`UPLOAD_DIR`, po defaultu `server/uploads/`, izvan
gita), a u bazi ostaje zapis s izvornim imenom. Ime na disku dodjeljuje server
(`uuid` + ekstenzija), jer ime s klijenta moze sadrzavati putanju. Dopusteni su
PDF, JPG, PNG, DOCX i XLSX do `UPLOAD_MAX_BYTES` (10 MB). Novi prilog istog tipa
podize `version` i gasi `is_current` na prethodnom, pa stara verzija ostaje
zapisana. Ako zapis u bazi ne uspije, datoteka se brise.

Kod stvaranja zahtjeva klijent salje `source`, `departmentBudget`,
`justification` i `items` (svaka stavka nosi `vat_rate`). `total_amount` je
iznos s PDV-om, a `net_amount` i `vat_amount` cuvaju razradu.
Fiskalna godina se cita iz odabranog proracuna, pa
zahtjev ne moze zavrsiti u pogresnoj godini, a broj zahtjeva
(`ZN-<godina>-<redni broj>`) dodjeljuje se unutar transakcije, pa dva
istovremena zahtjeva ne mogu dobiti isti broj.

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

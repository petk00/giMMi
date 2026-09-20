-- Sifrarnici bez kojih aplikacija ne radi.
-- Skripta se smije pokrenuti vise puta - postojeci redci se samo osvjeze.
--   mysql -u root gimmi < db/seed.sql

-- role
--   ADMIN       - sve, ukljucujuci sifrarnike i korisnike
--   SUBMITTER   - zaposlenik koji podnosi zahtjev
--   PROCUREMENT - operater nabave, koji zahtjev i obradjuje i odobrava
INSERT INTO Role (code, name) VALUES
  ('ADMIN',       'Administrator'),
  ('SUBMITTER',   'Podnositelj'),
  ('PROCUREMENT', 'Operater nabave')
  ON DUPLICATE KEY UPDATE name = VALUES(name);

-- statusi zahtjeva
INSERT INTO PurchaseRequestStatus (code, name, sort_order, is_final) VALUES
  ('DRAFT',       'Nacrt',        10, 0),
  ('SUBMITTED',   'Podnesen',     20, 0),
  ('IN_PROGRESS', 'U obradi',     30, 0),
  ('NEEDS_INFO',  'Čeka dopunu',  40, 0),
  ('APPROVED',    'Odobren',      50, 0),
  ('REJECTED',    'Odbijen',      60, 1),
  ('ORDERED',     'Naručen',      70, 0),
  ('RECEIVED',    'Zaprimljen',   80, 0),
  ('CLOSED',      'Zaključen',    90, 1)
  ON DUPLICATE KEY UPDATE
    name = VALUES(name), sort_order = VALUES(sort_order), is_final = VALUES(is_final);

-- tipovi dokumenata
INSERT INTO DocumentType (code, name, sort_order) VALUES
  ('OFFER',          'Ponuda',              10),
  ('REQUEST',        'Zahtjev za nabavom',  20),
  ('PURCHASE_ORDER', 'Narudžbenica',        30),
  ('DELIVERY_NOTE',  'Dostavnica',          40)
  ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- dopusteni prijelazi statusa
--   podnosenje zahtjeva iz ponude trazi prilozenu ponudu, iz kataloga ne trazi
--   nista; oba puta pri podnosenju generiraju zahtjev za nabavom
--   iz "Podnesen" se ide samo u "U obradi" - preuzimanjem zahtjeva; odluke se
--   donose iz "U obradi"
--   narudzbenica je uvjet za "Narucen", dostavnica za "Zaprimljen"
--   zakljucivanje zasad nema uvjeta; kad se naprave knjizenja, dodaje se ovdje
--   role: podnositelj podnosi i dopunjuje, operater nabave sve ostalo;
--   dostavnicu prilaze onaj tko je robu preuzeo, pa taj prijelaz nema role
--   (administrator smije sve, to se provjerava u kodu)
--
-- Pravila su u cijelosti definirana ovom skriptom, pa se prvo brisu stara.
DELETE FROM StatusTransition;

INSERT INTO StatusTransition
  (fk_from_status, fk_to_status, applies_to_source,
   fk_required_document_type, fk_generates_document_type, requires_comment, fk_role)
SELECT
  frm.id_purchase_request_status,
  cilj.id_purchase_request_status,
  t.applies_to_source,
  req.id_document_type,
  gen.id_document_type,
  t.requires_comment,
  r.id_role
FROM (
  SELECT 'DRAFT'      AS from_code, 'SUBMITTED'  AS to_code, 'OFFER'   AS applies_to_source,
         'OFFER'          AS required_doc, 'REQUEST' AS generated_doc, 0 AS requires_comment,
         'SUBMITTER'      AS role_code
  UNION ALL SELECT 'DRAFT',       'SUBMITTED',   'CATALOG', NULL,             'REQUEST', 0, 'SUBMITTER'
  UNION ALL SELECT 'SUBMITTED',   'IN_PROGRESS', 'ANY',     NULL,             NULL,      0, 'PROCUREMENT'
  UNION ALL SELECT 'IN_PROGRESS', 'NEEDS_INFO',  'ANY',     NULL,             NULL,      1, 'PROCUREMENT'
  UNION ALL SELECT 'NEEDS_INFO',  'SUBMITTED',   'OFFER',   'OFFER',          'REQUEST', 0, 'SUBMITTER'
  UNION ALL SELECT 'NEEDS_INFO',  'SUBMITTED',   'CATALOG', NULL,             'REQUEST', 0, 'SUBMITTER'
  UNION ALL SELECT 'IN_PROGRESS', 'APPROVED',    'ANY',     NULL,             NULL,      0, 'PROCUREMENT'
  UNION ALL SELECT 'IN_PROGRESS', 'REJECTED',    'ANY',     NULL,             NULL,      1, 'PROCUREMENT'
  UNION ALL SELECT 'APPROVED',    'ORDERED',     'ANY',     'PURCHASE_ORDER', NULL,      0, 'PROCUREMENT'
  UNION ALL SELECT 'ORDERED',     'RECEIVED',    'ANY',     'DELIVERY_NOTE',  NULL,      0, NULL
  UNION ALL SELECT 'RECEIVED',    'CLOSED',      'ANY',     NULL,             NULL,      0, 'PROCUREMENT'
) AS t
JOIN PurchaseRequestStatus frm ON frm.code = t.from_code
JOIN PurchaseRequestStatus cilj ON cilj.code = t.to_code
LEFT JOIN DocumentType req ON req.code = t.required_doc
LEFT JOIN DocumentType gen ON gen.code = t.generated_doc
LEFT JOIN Role r ON r.code = t.role_code
ON DUPLICATE KEY UPDATE
  fk_required_document_type = VALUES(fk_required_document_type),
  fk_generates_document_type = VALUES(fk_generates_document_type),
  requires_comment = VALUES(requires_comment),
  fk_role = VALUES(fk_role);

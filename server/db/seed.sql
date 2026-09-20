-- Sifrarnici bez kojih aplikacija ne radi.
-- Skripta se smije pokrenuti vise puta - postojeci redci se samo osvjeze.
--   mysql -u root gimmi < db/seed.sql

-- role
INSERT INTO Role (name) VALUES ('Administrator')
  ON DUPLICATE KEY UPDATE name = VALUES(name);

-- statusi zahtjeva
INSERT INTO PurchaseRequestStatus (code, name, sort_order, is_final) VALUES
  ('DRAFT',      'Nacrt',        10, 0),
  ('SUBMITTED',  'Podnesen',     20, 0),
  ('NEEDS_INFO', 'Čeka dopunu',  30, 0),
  ('APPROVED',   'Odobren',      40, 0),
  ('REJECTED',   'Odbijen',      50, 1),
  ('ORDERED',    'Naručen',      60, 0),
  ('RECEIVED',   'Zaprimljen',   70, 1)
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
--   narudzbenica je uvjet za "Narucen", dostavnica za "Zaprimljen"
INSERT INTO StatusTransition
  (fk_from_status, fk_to_status, applies_to_source,
   fk_required_document_type, fk_generates_document_type, requires_comment)
SELECT
  frm.id_purchase_request_status,
  cilj.id_purchase_request_status,
  t.applies_to_source,
  req.id_document_type,
  gen.id_document_type,
  t.requires_comment
FROM (
  SELECT 'DRAFT'      AS from_code, 'SUBMITTED'  AS to_code, 'OFFER'   AS applies_to_source,
         'OFFER'          AS required_doc, 'REQUEST' AS generated_doc, 0 AS requires_comment
  UNION ALL SELECT 'DRAFT',      'SUBMITTED',  'CATALOG', NULL,             'REQUEST', 0
  UNION ALL SELECT 'SUBMITTED',  'NEEDS_INFO', 'ANY',     NULL,             NULL,      1
  UNION ALL SELECT 'NEEDS_INFO', 'SUBMITTED',  'OFFER',   'OFFER',          'REQUEST', 0
  UNION ALL SELECT 'NEEDS_INFO', 'SUBMITTED',  'CATALOG', NULL,             'REQUEST', 0
  UNION ALL SELECT 'SUBMITTED',  'APPROVED',   'ANY',     NULL,             NULL,      0
  UNION ALL SELECT 'SUBMITTED',  'REJECTED',   'ANY',     NULL,             NULL,      1
  UNION ALL SELECT 'APPROVED',   'ORDERED',    'ANY',     'PURCHASE_ORDER', NULL,      0
  UNION ALL SELECT 'ORDERED',    'RECEIVED',   'ANY',     'DELIVERY_NOTE',  NULL,      0
) AS t
JOIN PurchaseRequestStatus frm ON frm.code = t.from_code
JOIN PurchaseRequestStatus cilj ON cilj.code = t.to_code
LEFT JOIN DocumentType req ON req.code = t.required_doc
LEFT JOIN DocumentType gen ON gen.code = t.generated_doc
ON DUPLICATE KEY UPDATE
  fk_required_document_type = VALUES(fk_required_document_type),
  fk_generates_document_type = VALUES(fk_generates_document_type),
  requires_comment = VALUES(requires_comment);

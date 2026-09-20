-- 002 - tok zahtjeva i dokumenti koji su uvjet za promjenu statusa
--
-- Sto ova migracija uvodi:
--   * cijena po stavci, pa se iznos zahtjeva moze izracunati i provjeriti
--   * izvor zahtjeva (iz ponude ili iz kataloga), o kojem ovisi treba li ponuda
--   * sifrarnik tipova dokumenata umjesto slobodnog teksta
--   * verzioniranje priloga, jer se zahtjev za nabavom regenerira nakon dopune
--   * tablicu prijelaza statusa s pravilima, umjesto pravila raspisanih u kodu

-- 1. cijena stavke
ALTER TABLE PurchaseRequestItem
  ADD COLUMN unit_price decimal(14,2) NOT NULL DEFAULT 0.00 AFTER quantity;

-- 2. izvor zahtjeva - iz ponude dobavljaca ili iz kataloga s ugovorenim cijenama
ALTER TABLE PurchaseRequest
  ADD COLUMN source enum('OFFER','CATALOG') NOT NULL DEFAULT 'CATALOG' AFTER request_number;

-- 3. statusi dobivaju kod po kojem ih kod prepoznaje, redoslijed i oznaku
--    zavrsnog stanja; naziv ostaje samo za prikaz
ALTER TABLE PurchaseRequestStatus
  ADD COLUMN code varchar(30) NOT NULL AFTER id_purchase_request_status,
  ADD COLUMN sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN is_final tinyint(1) NOT NULL DEFAULT 0,
  ADD UNIQUE KEY uq_purchase_request_status_code (code);

-- 4. sifrarnik tipova dokumenata (d1 - d4)
CREATE TABLE DocumentType (
  id_document_type int NOT NULL AUTO_INCREMENT,
  code varchar(30) NOT NULL,
  name varchar(100) NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (id_document_type),
  UNIQUE KEY uq_document_type_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. prilozi: tip iz sifrarnika, verzioniranje i razlika generirano / prilozeno
--    document_type je bio slobodan tekst, a o njemu ovisi smije li zahtjev dalje
ALTER TABLE PurchaseRequestAttachment
  DROP COLUMN document_type,
  ADD COLUMN fk_document_type int NOT NULL AFTER fk_uploaded_by_user,
  ADD COLUMN version int NOT NULL DEFAULT 1,
  ADD COLUMN is_current tinyint(1) NOT NULL DEFAULT 1,
  -- zahtjev za nabavom generira sustav, ostalo ljudi prilazu
  ADD COLUMN is_generated tinyint(1) NOT NULL DEFAULT 0,
  -- broj narudzbenice iz aplikacije koja ju je izdala
  ADD COLUMN external_reference varchar(100) DEFAULT NULL,
  ADD KEY fk_purchase_request_attachment_document_type (fk_document_type),
  ADD UNIQUE KEY uq_purchase_request_attachment_version
    (fk_purchase_request, fk_document_type, version),
  ADD CONSTRAINT fk_purchase_request_attachment_document_type
    FOREIGN KEY (fk_document_type) REFERENCES DocumentType (id_document_type)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. dopusteni prijelazi statusa s uvjetima
--    applies_to_source = 'ANY' znaci da pravilo vrijedi za oba puta; to je
--    izricita vrijednost, a ne NULL, jer MySQL u UNIQUE indeksu svaki NULL
--    broji kao razlicit pa bi se isto pravilo moglo unijeti vise puta
--    fk_role NULL znaci da prijelaz zasad smije svatko - popuniti kad se
--    definiraju role
CREATE TABLE StatusTransition (
  id_status_transition int NOT NULL AUTO_INCREMENT,
  fk_from_status int NOT NULL,
  fk_to_status int NOT NULL,
  applies_to_source enum('ANY','OFFER','CATALOG') NOT NULL DEFAULT 'ANY',
  fk_required_document_type int DEFAULT NULL,
  fk_generates_document_type int DEFAULT NULL,
  requires_comment tinyint(1) NOT NULL DEFAULT 0,
  fk_role int DEFAULT NULL,
  PRIMARY KEY (id_status_transition),
  UNIQUE KEY uq_status_transition_from_to_source
    (fk_from_status, fk_to_status, applies_to_source),
  KEY fk_status_transition_to_status (fk_to_status),
  KEY fk_status_transition_required_document (fk_required_document_type),
  KEY fk_status_transition_generates_document (fk_generates_document_type),
  KEY fk_status_transition_role (fk_role),
  CONSTRAINT fk_status_transition_from_status FOREIGN KEY (fk_from_status)
    REFERENCES PurchaseRequestStatus (id_purchase_request_status)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_status_transition_to_status FOREIGN KEY (fk_to_status)
    REFERENCES PurchaseRequestStatus (id_purchase_request_status)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_status_transition_required_document FOREIGN KEY (fk_required_document_type)
    REFERENCES DocumentType (id_document_type) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_status_transition_generates_document FOREIGN KEY (fk_generates_document_type)
    REFERENCES DocumentType (id_document_type) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_status_transition_role FOREIGN KEY (fk_role)
    REFERENCES Role (id_role) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

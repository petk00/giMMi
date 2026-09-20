-- 005 - troskovno mjesto se bira u zahtjevu, ne izvodi iz korisnika
--
-- Zaposlenik moze trositi na vise mjesta: profesor koji predaje dva predmeta
-- ima i dvije razlicite kategorije troska. Veza korisnik -> sluzba je zato
-- pogresna i uklanja se; sluzbu (ili projekt) korisnik bira pri sastavljanju
-- zahtjeva.
--
-- Department uz to dobiva vrstu: sluzbe se preslikavaju iz godine u godinu,
-- projekti traju ograniceno i imaju pocetak i kraj.

-- 1. korisnik vise ne pripada jednoj sluzbi
ALTER TABLE AppUser
  DROP FOREIGN KEY fk_app_user_department;

ALTER TABLE AppUser
  DROP INDEX fk_app_user_department,
  DROP COLUMN fk_department;

-- 2. sluzba ili projekt
ALTER TABLE Department
  ADD COLUMN kind enum('DEPARTMENT','PROJECT') NOT NULL DEFAULT 'DEPARTMENT' AFTER name,
  -- popunjeno samo za projekte
  ADD COLUMN valid_from date DEFAULT NULL,
  ADD COLUMN valid_to date DEFAULT NULL;

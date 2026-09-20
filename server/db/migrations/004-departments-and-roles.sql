-- 004 - sluzba kao trajna jedinica, korisnik u sluzbi, role s kodom
--
-- Do sada je "DepartmentBudget" bio i sluzba i njen proracun za godinu, pa bi
-- vezanje korisnika na njega znacilo mijenjanje veze svake nove fiskalne
-- godine. Sluzba se zato izdvaja u vlastitu tablicu, a proracun ostaje ono sto
-- mu ime kaze: iznos koji ta sluzba ima na raspolaganju u toj godini.
--
-- Nakon ove migracije pokrenuti db/seed.sql.

-- 1. trajna organizacijska jedinica
CREATE TABLE Department (
  id_department int NOT NULL AUTO_INCREMENT,
  name varchar(150) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_department),
  UNIQUE KEY uq_department_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. proracun sluzbe pokazuje na sluzbu umjesto da nosi njeno ime
--    (tablica je prazna, pa se kolona moze mijenjati bez prijenosa podataka)
ALTER TABLE DepartmentBudget
  DROP INDEX uq_department_budget_year_name,
  DROP COLUMN name,
  DROP COLUMN is_active,
  ADD COLUMN fk_department int NOT NULL AFTER id_department_budget,
  ADD UNIQUE KEY uq_department_budget_department_year (fk_department, fk_fiscal_year),
  ADD CONSTRAINT fk_department_budget_department FOREIGN KEY (fk_department)
    REFERENCES Department (id_department) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. korisnik pripada sluzbi, ne njenom proracunu
ALTER TABLE AppUser
  ADD COLUMN fk_department int DEFAULT NULL AFTER fk_role,
  ADD KEY fk_app_user_department (fk_department),
  ADD CONSTRAINT fk_app_user_department FOREIGN KEY (fk_department)
    REFERENCES Department (id_department) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. role dobivaju kod, da kod ne ovisi o hrvatskom nazivu
ALTER TABLE Role
  ADD COLUMN code varchar(30) NOT NULL AFTER id_role;

UPDATE Role SET code = 'ADMIN' WHERE name = 'Administrator';

ALTER TABLE Role
  ADD UNIQUE KEY uq_role_code (code);

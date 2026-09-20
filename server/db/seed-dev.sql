-- Razvojni podaci: po jedan korisnik za svaku rolu i jedna sluzba.
-- NE pokretati na pravom serveru - lozinka svima je "123456".
--   mysql -u root gimmi < db/seed-dev.sql

INSERT INTO Department (name) VALUES ('Služba za IT')
  ON DUPLICATE KEY UPDATE name = VALUES(name);

-- $2b$10$Py7sqVUA3B6EL0.EyLITbeV5d4CDLGPyzY96M2bTeQM.JkcuEm15C = bcrypt("123456")
INSERT INTO AppUser (fk_role, fk_department, first_name, last_name, email, password_hash, is_active)
SELECT r.id_role, d.id_department, t.first_name, t.last_name, t.email,
       '$2b$10$Py7sqVUA3B6EL0.EyLITbeV5d4CDLGPyzY96M2bTeQM.JkcuEm15C', 1
FROM (
  SELECT 'ADMIN' AS role_code, 'Admin' AS first_name, 'Korisnik' AS last_name,
         'admin@veleri.hr' AS email
  UNION ALL SELECT 'SUBMITTER',   'Podnositelj', 'Zahtjeva',  'submitter@veleri.hr'
  UNION ALL SELECT 'PROCUREMENT', 'Operater',    'Nabave',    'procurement@veleri.hr'
) AS t
JOIN Role r ON r.code = t.role_code
JOIN Department d ON d.name = 'Služba za IT'
ON DUPLICATE KEY UPDATE
  fk_role = VALUES(fk_role),
  fk_department = VALUES(fk_department),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  password_hash = VALUES(password_hash),
  is_active = 1;

-- otvorena fiskalna godina s proracunom sluzbe i kategorijama, bez cega se
-- zahtjev ne moze stvoriti
INSERT INTO FiscalYear (year, total_budget, is_closed) VALUES (2026, 500000.00, 0)
  ON DUPLICATE KEY UPDATE total_budget = VALUES(total_budget), is_closed = 0;

INSERT INTO DepartmentBudget (fk_department, fk_fiscal_year, budget_limit)
SELECT d.id_department, fy.id_fiscal_year, 80000.00
  FROM Department d JOIN FiscalYear fy ON fy.year = 2026
 WHERE d.name = 'Služba za IT'
  ON DUPLICATE KEY UPDATE budget_limit = VALUES(budget_limit);

INSERT INTO ItemCategoryBudget (fk_fiscal_year, name, budget_limit)
SELECT fy.id_fiscal_year, t.name, t.budget_limit
  FROM (
    SELECT 'Računalna oprema' AS name, 50000.00 AS budget_limit
    UNION ALL SELECT 'Uredski materijal', 15000.00
    UNION ALL SELECT 'Licence i software', 30000.00
  ) AS t
  JOIN FiscalYear fy ON fy.year = 2026
  ON DUPLICATE KEY UPDATE budget_limit = VALUES(budget_limit);

-- 007 - kategorija stavke se dodjeljuje u nabavi
--
-- Podnositelj vise ne bira kategoriju po stavci: on prilaze ponudu i navodi
-- sto treba, a kategoriju (i konto uz nju) dodjeljuje nabava pri obradi.
-- Stavka zato moze neko vrijeme stajati bez kategorije.

ALTER TABLE PurchaseRequestItem
  MODIFY COLUMN fk_item_category_budget int DEFAULT NULL;

-- 003 - statusi "U obradi" i "Zakljucen" te obradjivac zahtjeva
--
-- "U obradi" ne postavlja covjek rucno nego nastaje preuzimanjem zahtjeva:
-- operater postaje fk_assigned_to_user i status prelazi iz "Podnesen".
-- "Zakljucen" je novo zavrsno stanje - zaprimljeno znaci da je roba stigla,
-- zakljuceno da je administrativno gotovo (kasnije: proknjizeno).
--
-- Nakon ove migracije pokrenuti db/seed.sql, koji ponovo slaze pravila
-- prijelaza (StatusTransition).

-- 1. tko rjesava zahtjev
ALTER TABLE PurchaseRequest
  ADD COLUMN fk_assigned_to_user int DEFAULT NULL AFTER fk_created_by_user,
  ADD KEY fk_purchase_request_assigned_to (fk_assigned_to_user),
  ADD CONSTRAINT fk_purchase_request_assigned_to FOREIGN KEY (fk_assigned_to_user)
    REFERENCES AppUser (id_user) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. razmak u redoslijedu za nove statuse rade seed i sort_order, pa se ovdje
--    samo pomice zavrsno stanje sa "Zaprimljen" na "Zakljucen"
UPDATE PurchaseRequestStatus SET is_final = 0 WHERE code = 'RECEIVED';

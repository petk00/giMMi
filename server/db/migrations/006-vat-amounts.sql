-- 006 - PDV na stavci i razrada iznosa na zahtjevu
--
-- Ponuda razlikuje osnovicu, PDV i ukupno, a zahtjev je do sada imao samo
-- jedan iznos. Proracun se troši ukupnim iznosom, pa `total_amount` ostaje
-- iznos s PDV-om, a osnovica i porez se pamte uz njega.

ALTER TABLE PurchaseRequestItem
  ADD COLUMN vat_rate decimal(5,2) NOT NULL DEFAULT 25.00 AFTER unit_price;

ALTER TABLE PurchaseRequest
  ADD COLUMN net_amount decimal(14,2) DEFAULT NULL AFTER total_amount,
  ADD COLUMN vat_amount decimal(14,2) DEFAULT NULL AFTER net_amount;

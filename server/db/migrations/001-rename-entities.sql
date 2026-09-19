-- 001 - uskladjivanje imena tablica, kolona, indeksa i stranih kljuceva
--
-- Konvencije nakon ove migracije:
--   tablica          PascalCase, jednina (AppUser, PurchaseRequestItem)
--   primarni kljuc   id_<tablica u snake_case>; iznimka je AppUser -> id_user,
--                    jer je "App" samo tehnicki prefiks (User/user je rezervirana
--                    rijec u PostgreSQL-u, pa se izbjegava i ovdje)
--   strani kljuc     fk_<entitet na koji pokazuje>
--   unique indeks    uq_<tablica>_<kolone>
--   obicni indeks    idx_<tablica>_<kolone>
--   FK constraint    fk_<tablica>_<cilj>

-- 1. svi strani kljucevi se uklanjaju jer im se mijenjaju i imena i kolone
ALTER TABLE AppUser DROP FOREIGN KEY fk_appuser_role;
ALTER TABLE Attachment DROP FOREIGN KEY fk_attachment_request;
ALTER TABLE Attachment DROP FOREIGN KEY fk_attachment_user;
ALTER TABLE Department DROP FOREIGN KEY fk_department_fiscalyear;
ALTER TABLE ItemCategory DROP FOREIGN KEY fk_itemcategory_fiscalyear;
ALTER TABLE PurchaseRequest DROP FOREIGN KEY fk_purchaserequest_department;
ALTER TABLE PurchaseRequest DROP FOREIGN KEY fk_purchaserequest_fiscalyear;
ALTER TABLE PurchaseRequest DROP FOREIGN KEY fk_purchaserequest_status;
ALTER TABLE PurchaseRequest DROP FOREIGN KEY fk_purchaserequest_user;
ALTER TABLE PurchaseRequestItem DROP FOREIGN KEY fk_pritem_request;
ALTER TABLE PurchaseRequestItem DROP FOREIGN KEY fk_pritem_category;
ALTER TABLE RequestStatusHistory DROP FOREIGN KEY fk_statushistory_request;
ALTER TABLE RequestStatusHistory DROP FOREIGN KEY fk_statushistory_status;
ALTER TABLE RequestStatusHistory DROP FOREIGN KEY fk_statushistory_user;

-- 2. imena tablica
--    Department i ItemCategory nose fiskalnu godinu i limit, dakle nisu odjel
--    i kategorija nego njihov proracun za tu godinu - ime to sada govori.
--    Attachment i RequestStatus* vezani su iskljucivo uz PurchaseRequest.
RENAME TABLE
  AppSetting           TO Setting,
  Department           TO DepartmentBudget,
  ItemCategory         TO ItemCategoryBudget,
  Attachment           TO PurchaseRequestAttachment,
  RequestStatus        TO PurchaseRequestStatus,
  RequestStatusHistory TO PurchaseRequestStatusHistory;

-- 3. imena kolona
ALTER TABLE DepartmentBudget
  RENAME COLUMN id_department TO id_department_budget,
  RENAME COLUMN department_limit TO budget_limit;

ALTER TABLE ItemCategoryBudget
  RENAME COLUMN id_item_category TO id_item_category_budget,
  RENAME COLUMN category_limit TO budget_limit;

ALTER TABLE PurchaseRequestStatus
  RENAME COLUMN id_request_status TO id_purchase_request_status;

ALTER TABLE PurchaseRequestStatusHistory
  RENAME COLUMN id_request_status_history TO id_purchase_request_status_history,
  RENAME COLUMN fk_request_status TO fk_purchase_request_status;

ALTER TABLE PurchaseRequestAttachment
  RENAME COLUMN id_attachment TO id_purchase_request_attachment,
  RENAME COLUMN file_type TO mime_type;

ALTER TABLE PurchaseRequest
  RENAME COLUMN fk_department TO fk_department_budget,
  RENAME COLUMN fk_request_status TO fk_purchase_request_status;

ALTER TABLE PurchaseRequestItem
  RENAME COLUMN fk_item_category TO fk_item_category_budget;

-- 4. imena indeksa (dio ih je do sada bio automatski imenovan po koloni)
ALTER TABLE AppUser
  RENAME INDEX email TO uq_app_user_email,
  RENAME INDEX idx_invite_token TO idx_app_user_invite_token,
  RENAME INDEX fk_appuser_role TO fk_app_user_role;

ALTER TABLE Role RENAME INDEX name TO uq_role_name;

ALTER TABLE FiscalYear RENAME INDEX year TO uq_fiscal_year_year;

ALTER TABLE PurchaseRequestStatus RENAME INDEX name TO uq_purchase_request_status_name;

ALTER TABLE DepartmentBudget
  RENAME INDEX uq_department_year_name TO uq_department_budget_year_name,
  RENAME INDEX fk_department_fiscalyear TO fk_department_budget_fiscal_year;

ALTER TABLE ItemCategoryBudget
  RENAME INDEX uq_cat_name_per_year TO uq_item_category_budget_year_name,
  RENAME INDEX fk_itemcategory_fiscalyear TO fk_item_category_budget_fiscal_year;

ALTER TABLE PurchaseRequest
  RENAME INDEX request_number TO uq_purchase_request_number,
  RENAME INDEX fk_purchaserequest_fiscalyear TO fk_purchase_request_fiscal_year,
  RENAME INDEX fk_purchaserequest_status TO fk_purchase_request_status,
  RENAME INDEX fk_purchaserequest_user TO fk_purchase_request_created_by;

ALTER TABLE PurchaseRequestItem
  RENAME INDEX fk_pritem_request TO fk_purchase_request_item_request,
  RENAME INDEX fk_pritem_category TO fk_purchase_request_item_category;

ALTER TABLE PurchaseRequestStatusHistory
  RENAME INDEX fk_statushistory_request TO fk_purchase_request_status_history_request,
  RENAME INDEX fk_statushistory_status TO fk_purchase_request_status_history_status,
  RENAME INDEX fk_statushistory_user TO fk_purchase_request_status_history_changed_by;

ALTER TABLE PurchaseRequestAttachment
  RENAME INDEX fk_attachment_request TO fk_purchase_request_attachment_request,
  RENAME INDEX fk_attachment_user TO fk_purchase_request_attachment_uploaded_by;

-- 5. zahtjev je do sada mogao pokazivati na proracun odjela iz jedne godine,
--    a u fk_fiscal_year imati drugu godinu. Slozeni strani kljuc to sada
--    onemogucuje, pa jednokolonski indeks na odjel zamjenjuje slozeni.
ALTER TABLE DepartmentBudget
  ADD UNIQUE KEY uq_department_budget_id_year (id_department_budget, fk_fiscal_year);

ALTER TABLE PurchaseRequest
  DROP INDEX fk_purchaserequest_department,
  ADD KEY fk_purchase_request_department_budget (fk_department_budget, fk_fiscal_year);

-- 6. strani kljucevi natrag, s novim imenima i nepromijenjenim pravilima
ALTER TABLE AppUser
  ADD CONSTRAINT fk_app_user_role FOREIGN KEY (fk_role)
    REFERENCES Role (id_role) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE DepartmentBudget
  ADD CONSTRAINT fk_department_budget_fiscal_year FOREIGN KEY (fk_fiscal_year)
    REFERENCES FiscalYear (id_fiscal_year) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ItemCategoryBudget
  ADD CONSTRAINT fk_item_category_budget_fiscal_year FOREIGN KEY (fk_fiscal_year)
    REFERENCES FiscalYear (id_fiscal_year) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE PurchaseRequest
  ADD CONSTRAINT fk_purchase_request_fiscal_year FOREIGN KEY (fk_fiscal_year)
    REFERENCES FiscalYear (id_fiscal_year) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchase_request_department_budget
    FOREIGN KEY (fk_department_budget, fk_fiscal_year)
    REFERENCES DepartmentBudget (id_department_budget, fk_fiscal_year)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchase_request_status FOREIGN KEY (fk_purchase_request_status)
    REFERENCES PurchaseRequestStatus (id_purchase_request_status)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchase_request_created_by FOREIGN KEY (fk_created_by_user)
    REFERENCES AppUser (id_user) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE PurchaseRequestItem
  ADD CONSTRAINT fk_purchase_request_item_request FOREIGN KEY (fk_purchase_request)
    REFERENCES PurchaseRequest (id_purchase_request) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchase_request_item_category FOREIGN KEY (fk_item_category_budget)
    REFERENCES ItemCategoryBudget (id_item_category_budget)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE PurchaseRequestStatusHistory
  ADD CONSTRAINT fk_purchase_request_status_history_request FOREIGN KEY (fk_purchase_request)
    REFERENCES PurchaseRequest (id_purchase_request) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchase_request_status_history_status
    FOREIGN KEY (fk_purchase_request_status)
    REFERENCES PurchaseRequestStatus (id_purchase_request_status)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchase_request_status_history_changed_by
    FOREIGN KEY (fk_changed_by_user)
    REFERENCES AppUser (id_user) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE PurchaseRequestAttachment
  ADD CONSTRAINT fk_purchase_request_attachment_request FOREIGN KEY (fk_purchase_request)
    REFERENCES PurchaseRequest (id_purchase_request) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchase_request_attachment_uploaded_by
    FOREIGN KEY (fk_uploaded_by_user)
    REFERENCES AppUser (id_user) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `AppUser` (
  `id_user` int NOT NULL AUTO_INCREMENT,
  `fk_role` int NOT NULL,
  `fk_department` int DEFAULT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `invite_token` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invite_token_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id_user`),
  UNIQUE KEY `uq_app_user_email` (`email`),
  KEY `fk_app_user_role` (`fk_role`),
  KEY `idx_app_user_invite_token` (`invite_token`),
  KEY `fk_app_user_department` (`fk_department`),
  CONSTRAINT `fk_app_user_department` FOREIGN KEY (`fk_department`) REFERENCES `Department` (`id_department`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_app_user_role` FOREIGN KEY (`fk_role`) REFERENCES `Role` (`id_role`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Department` (
  `id_department` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_department`),
  UNIQUE KEY `uq_department_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `DepartmentBudget` (
  `id_department_budget` int NOT NULL AUTO_INCREMENT,
  `fk_department` int NOT NULL,
  `fk_fiscal_year` int NOT NULL,
  `budget_limit` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id_department_budget`),
  UNIQUE KEY `uq_department_budget_id_year` (`id_department_budget`,`fk_fiscal_year`),
  UNIQUE KEY `uq_department_budget_department_year` (`fk_department`,`fk_fiscal_year`),
  KEY `fk_department_budget_fiscal_year` (`fk_fiscal_year`),
  CONSTRAINT `fk_department_budget_department` FOREIGN KEY (`fk_department`) REFERENCES `Department` (`id_department`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_department_budget_fiscal_year` FOREIGN KEY (`fk_fiscal_year`) REFERENCES `FiscalYear` (`id_fiscal_year`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `DocumentType` (
  `id_document_type` int NOT NULL AUTO_INCREMENT,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_document_type`),
  UNIQUE KEY `uq_document_type_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `FiscalYear` (
  `id_fiscal_year` int NOT NULL AUTO_INCREMENT,
  `year` int NOT NULL,
  `is_closed` tinyint(1) NOT NULL DEFAULT '0',
  `total_budget` decimal(14,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id_fiscal_year`),
  UNIQUE KEY `uq_fiscal_year_year` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ItemCategoryBudget` (
  `id_item_category_budget` int NOT NULL AUTO_INCREMENT,
  `fk_fiscal_year` int NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_limit` decimal(14,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_item_category_budget`),
  UNIQUE KEY `uq_item_category_budget_year_name` (`fk_fiscal_year`,`name`),
  KEY `fk_item_category_budget_fiscal_year` (`fk_fiscal_year`),
  CONSTRAINT `fk_item_category_budget_fiscal_year` FOREIGN KEY (`fk_fiscal_year`) REFERENCES `FiscalYear` (`id_fiscal_year`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PurchaseRequest` (
  `id_purchase_request` int NOT NULL AUTO_INCREMENT,
  `request_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` enum('OFFER','CATALOG') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CATALOG',
  `fk_fiscal_year` int NOT NULL,
  `fk_department_budget` int NOT NULL,
  `fk_purchase_request_status` int NOT NULL,
  `fk_created_by_user` int NOT NULL,
  `fk_assigned_to_user` int DEFAULT NULL,
  `total_amount` decimal(14,2) DEFAULT NULL,
  `justification` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_purchase_request`),
  UNIQUE KEY `uq_purchase_request_number` (`request_number`),
  KEY `fk_purchase_request_fiscal_year` (`fk_fiscal_year`),
  KEY `fk_purchase_request_status` (`fk_purchase_request_status`),
  KEY `fk_purchase_request_created_by` (`fk_created_by_user`),
  KEY `fk_purchase_request_department_budget` (`fk_department_budget`,`fk_fiscal_year`),
  KEY `fk_purchase_request_assigned_to` (`fk_assigned_to_user`),
  CONSTRAINT `fk_purchase_request_assigned_to` FOREIGN KEY (`fk_assigned_to_user`) REFERENCES `AppUser` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_created_by` FOREIGN KEY (`fk_created_by_user`) REFERENCES `AppUser` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_department_budget` FOREIGN KEY (`fk_department_budget`, `fk_fiscal_year`) REFERENCES `DepartmentBudget` (`id_department_budget`, `fk_fiscal_year`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_fiscal_year` FOREIGN KEY (`fk_fiscal_year`) REFERENCES `FiscalYear` (`id_fiscal_year`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_status` FOREIGN KEY (`fk_purchase_request_status`) REFERENCES `PurchaseRequestStatus` (`id_purchase_request_status`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PurchaseRequestAttachment` (
  `id_purchase_request_attachment` int NOT NULL AUTO_INCREMENT,
  `fk_purchase_request` int NOT NULL,
  `fk_uploaded_by_user` int NOT NULL,
  `fk_document_type` int NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `version` int NOT NULL DEFAULT '1',
  `is_current` tinyint(1) NOT NULL DEFAULT '1',
  `is_generated` tinyint(1) NOT NULL DEFAULT '0',
  `external_reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_purchase_request_attachment`),
  UNIQUE KEY `uq_purchase_request_attachment_version` (`fk_purchase_request`,`fk_document_type`,`version`),
  KEY `fk_purchase_request_attachment_request` (`fk_purchase_request`),
  KEY `fk_purchase_request_attachment_uploaded_by` (`fk_uploaded_by_user`),
  KEY `fk_purchase_request_attachment_document_type` (`fk_document_type`),
  CONSTRAINT `fk_purchase_request_attachment_document_type` FOREIGN KEY (`fk_document_type`) REFERENCES `DocumentType` (`id_document_type`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_attachment_request` FOREIGN KEY (`fk_purchase_request`) REFERENCES `PurchaseRequest` (`id_purchase_request`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_attachment_uploaded_by` FOREIGN KEY (`fk_uploaded_by_user`) REFERENCES `AppUser` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PurchaseRequestItem` (
  `id_purchase_request_item` int NOT NULL AUTO_INCREMENT,
  `fk_purchase_request` int NOT NULL,
  `fk_item_category_budget` int NOT NULL,
  `item_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id_purchase_request_item`),
  KEY `fk_purchase_request_item_request` (`fk_purchase_request`),
  KEY `fk_purchase_request_item_category` (`fk_item_category_budget`),
  CONSTRAINT `fk_purchase_request_item_category` FOREIGN KEY (`fk_item_category_budget`) REFERENCES `ItemCategoryBudget` (`id_item_category_budget`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_item_request` FOREIGN KEY (`fk_purchase_request`) REFERENCES `PurchaseRequest` (`id_purchase_request`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PurchaseRequestStatus` (
  `id_purchase_request_status` int NOT NULL AUTO_INCREMENT,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_final` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_purchase_request_status`),
  UNIQUE KEY `uq_purchase_request_status_name` (`name`),
  UNIQUE KEY `uq_purchase_request_status_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PurchaseRequestStatusHistory` (
  `id_purchase_request_status_history` int NOT NULL AUTO_INCREMENT,
  `fk_purchase_request` int NOT NULL,
  `fk_purchase_request_status` int NOT NULL,
  `fk_changed_by_user` int NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id_purchase_request_status_history`),
  KEY `fk_purchase_request_status_history_request` (`fk_purchase_request`),
  KEY `fk_purchase_request_status_history_status` (`fk_purchase_request_status`),
  KEY `fk_purchase_request_status_history_changed_by` (`fk_changed_by_user`),
  CONSTRAINT `fk_purchase_request_status_history_changed_by` FOREIGN KEY (`fk_changed_by_user`) REFERENCES `AppUser` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_status_history_request` FOREIGN KEY (`fk_purchase_request`) REFERENCES `PurchaseRequest` (`id_purchase_request`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_request_status_history_status` FOREIGN KEY (`fk_purchase_request_status`) REFERENCES `PurchaseRequestStatus` (`id_purchase_request_status`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Role` (
  `id_role` int NOT NULL AUTO_INCREMENT,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_role`),
  UNIQUE KEY `uq_role_name` (`name`),
  UNIQUE KEY `uq_role_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Setting` (
  `setting_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `StatusTransition` (
  `id_status_transition` int NOT NULL AUTO_INCREMENT,
  `fk_from_status` int NOT NULL,
  `fk_to_status` int NOT NULL,
  `applies_to_source` enum('ANY','OFFER','CATALOG') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ANY',
  `fk_required_document_type` int DEFAULT NULL,
  `fk_generates_document_type` int DEFAULT NULL,
  `requires_comment` tinyint(1) NOT NULL DEFAULT '0',
  `fk_role` int DEFAULT NULL,
  PRIMARY KEY (`id_status_transition`),
  UNIQUE KEY `uq_status_transition_from_to_source` (`fk_from_status`,`fk_to_status`,`applies_to_source`),
  KEY `fk_status_transition_to_status` (`fk_to_status`),
  KEY `fk_status_transition_required_document` (`fk_required_document_type`),
  KEY `fk_status_transition_generates_document` (`fk_generates_document_type`),
  KEY `fk_status_transition_role` (`fk_role`),
  CONSTRAINT `fk_status_transition_from_status` FOREIGN KEY (`fk_from_status`) REFERENCES `PurchaseRequestStatus` (`id_purchase_request_status`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_status_transition_generates_document` FOREIGN KEY (`fk_generates_document_type`) REFERENCES `DocumentType` (`id_document_type`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_status_transition_required_document` FOREIGN KEY (`fk_required_document_type`) REFERENCES `DocumentType` (`id_document_type`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_status_transition_role` FOREIGN KEY (`fk_role`) REFERENCES `Role` (`id_role`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_status_transition_to_status` FOREIGN KEY (`fk_to_status`) REFERENCES `PurchaseRequestStatus` (`id_purchase_request_status`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

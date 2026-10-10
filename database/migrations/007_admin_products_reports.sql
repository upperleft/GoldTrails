-- Back up first; MariaDB DDL commits implicitly. Apply once, inspect partial failures.
-- No account, role, membership or public product is changed by this migration.
CREATE TABLE product_overrides (
 product_id VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 changes_json LONGTEXT NOT NULL,
 edit_version INT UNSIGNED NOT NULL DEFAULT 1,
 updated_by VARCHAR(180) NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 CHECK(JSON_VALID(changes_json)), CHECK(edit_version>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE product_change_log (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 product_id VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor VARCHAR(180) NOT NULL,
 changes_json LONGTEXT NOT NULL,
 editor_note TEXT NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CHECK(JSON_VALID(changes_json)),
 FOREIGN KEY(product_id) REFERENCES product_overrides(product_id) ON DELETE RESTRICT,
 INDEX product_changes(product_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE product_reports (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 submission_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 product_id VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 product_name_snapshot VARCHAR(255) NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 report_type ENUM('incorrect','discontinued','replacement','description','broken_link','other') NOT NULL,
 message TEXT NOT NULL,
 suggested_url VARCHAR(2048) NULL,
 sender_name VARCHAR(180) NULL,
 business_name VARCHAR(180) NULL,
 reply_email VARCHAR(254) NULL,
 status ENUM('new','reviewing','resolved','dismissed') NOT NULL DEFAULT 'new',
 editor_note TEXT NULL,
 reviewed_by VARCHAR(180) NULL,
 edit_version INT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(CHAR_LENGTH(TRIM(message)) BETWEEN 10 AND 4000),
 INDEX reports_queue(status,created_at), INDEX reports_product(product_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE product_report_events (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 report_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor VARCHAR(180) NOT NULL,
 status ENUM('new','reviewing','resolved','dismissed') NOT NULL,
 editor_note TEXT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(report_id) REFERENCES product_reports(id) ON DELETE RESTRICT,
 INDEX report_events(report_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version,description) VALUES('007_admin_products_reports','Audited product overrides and private on-site correction queue');

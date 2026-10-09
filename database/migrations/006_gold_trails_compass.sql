-- Apply after 004_member_accounts. Back up first; MariaDB DDL commits implicitly.
-- Additive only. Do not drop existing tables to retry a partially applied migration.
CREATE TABLE IF NOT EXISTS compass_profiles (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 answers_json JSON NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1,
 onboarding_step TINYINT UNSIGNED NOT NULL DEFAULT 0, completed_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
 CHECK(onboarding_step<=7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS compass_equipment (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 category VARCHAR(40) NOT NULL, product_id VARCHAR(40) NULL,
 manufacturer VARCHAR(180) NULL, model VARCHAR(180) NULL, quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
 INDEX compass_inventory_owner(account_id), CHECK(quantity BETWEEN 1 AND 999)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS compass_activity (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 item_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 saved BOOLEAN NOT NULL DEFAULT FALSE, completed BOOLEAN NOT NULL DEFAULT FALSE,
 dismissed BOOLEAN NOT NULL DEFAULT FALSE, already_known BOOLEAN NOT NULL DEFAULT FALSE,
 preference TINYINT NOT NULL DEFAULT 0,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 PRIMARY KEY(account_id,item_id),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
 CHECK(preference BETWEEN -1 AND 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS compass_recommendation_cache (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 result_json JSON NOT NULL, expires_at DATETIME(6) NOT NULL,
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS compass_guide_usage (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 usage_day DATE NOT NULL, attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 last_call_at DATETIME(6) NOT NULL,
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS compass_destinations (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, slug VARCHAR(160) NOT NULL UNIQUE,
 title VARCHAR(180) NOT NULL, state_province VARCHAR(180) NOT NULL, country VARCHAR(100) NOT NULL,
 summary TEXT NOT NULL, restrictions TEXT NOT NULL,
 access_source_url TEXT NOT NULL, access_checked_at DATE NOT NULL, access_valid_until DATE NOT NULL,
 access_verified BOOLEAN NOT NULL DEFAULT FALSE,
 publication_status ENUM('draft','published') NOT NULL DEFAULT 'draft', archived_at DATETIME(6) NULL,
 CHECK(access_valid_until>=access_checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO schema_migrations(version,description) VALUES('006_gold_trails_compass','Private member profiling, inventory, activity, recommendation cache and vetted destinations');

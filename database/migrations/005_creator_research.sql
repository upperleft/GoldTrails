-- Additive, repeatable migration. Back up a populated database before applying.
-- Existing people, channels, sources and associations are not rewritten.
CREATE TABLE IF NOT EXISTS creator_profile_claims (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 field_key VARCHAR(64) NOT NULL, claim_value VARCHAR(1000) NOT NULL,
 source_url TEXT NOT NULL, locator VARCHAR(500) NOT NULL, evidence_note TEXT NOT NULL,
 assessment ENUM('verified','creator_stated','uncertain') NOT NULL,
 checked_at DATE NOT NULL, statement_date DATE NULL,
 review_state ENUM('accepted','conflict','pending','archived') NOT NULL,
 publication_status ENUM('draft','published') NOT NULL DEFAULT 'draft',
 archived_at DATETIME(6) NULL,
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT,
 INDEX creator_claim_lookup(person_id,field_key,review_state),
 CHECK(CHAR_LENGTH(TRIM(claim_value))>0), CHECK(CHAR_LENGTH(TRIM(evidence_note))>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS creator_channel_identities (
 channel_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS waterways (
 identity_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 name VARCHAR(180) NOT NULL,kind ENUM('river','creek','other') NOT NULL,
 state_province VARCHAR(180) NULL,country VARCHAR(100) NULL,geographic_context VARCHAR(500) NULL,
 resolution ENUM('verified','unresolved') NOT NULL,identity_source TEXT NOT NULL,identity_note TEXT NOT NULL,checked_at DATE NOT NULL,
 parent_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL,watershed VARCHAR(180) NULL,parent_source TEXT NULL,
 archived_at DATETIME(6) NULL,
 FOREIGN KEY(parent_key) REFERENCES waterways(identity_key) ON DELETE RESTRICT,
 CHECK(parent_key IS NULL OR parent_source IS NOT NULL),
 CHECK(resolution='unresolved' OR (country IS NOT NULL AND state_province IS NOT NULL AND geographic_context IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS creator_waterway_evidence (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 waterway_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_url TEXT NOT NULL,source_identity CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 title VARCHAR(500) NOT NULL,kind ENUM('video','webpage','pdf') NOT NULL,publication_date DATE NULL,
 timestamp_seconds INT UNSIGNED NULL,techniques_json JSON NOT NULL,public_note TEXT NOT NULL,
 location_status ENUM('explicit','uncertain') NOT NULL,
 inspection_basis ENUM('footage','title_description','article') NOT NULL,
 visit_key VARCHAR(180) NULL,checked_at DATE NOT NULL,
 publication_status ENUM('draft','published') NOT NULL DEFAULT 'draft',archived_at DATETIME(6) NULL,
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT,
 FOREIGN KEY(waterway_key) REFERENCES waterways(identity_key) ON DELETE RESTRICT,
 UNIQUE(person_id,waterway_key,source_identity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS creator_research_conflicts (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 field_key VARCHAR(64) NOT NULL,proposed_json JSON NOT NULL,
 reason VARCHAR(500) NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 status ENUM('open','resolved','archived') NOT NULL DEFAULT 'open',
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO schema_migrations(version,description) VALUES('005_creator_research','Evidence-backed profile claims and named waterways; additive draft-only import');

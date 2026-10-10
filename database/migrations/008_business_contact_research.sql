-- Additive private contact snapshots. Back up the populated database first.
-- Member/login email and public_contacts are never modified.
CREATE TABLE IF NOT EXISTS business_contact_research (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 research_record_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 snapshot_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(80) NOT NULL,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 creator_slug VARCHAR(160) NULL,
 entity_name VARCHAR(255) NOT NULL,
 checked_at DATE NOT NULL,
 snapshot_json JSON NOT NULL,
 imported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 imported_by VARCHAR(180) NOT NULL,
 UNIQUE(research_record_id,snapshot_hash),
 INDEX contact_person(person_id),
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO schema_migrations(version,description) VALUES('008_business_contact_research','Private sourced alternate business contacts; member account email stays separate');

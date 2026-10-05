-- Apply once before deploying the associates editor. Existing profiles are unchanged.
CREATE TABLE creator_associates (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 creator_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 linked_person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 display_name VARCHAR(180) NOT NULL,
 relationship_type ENUM('co_creator','partner','friend','collaborator','other') NOT NULL DEFAULT 'collaborator',
 description TEXT NULL,
 canonical_url VARCHAR(2048) NULL,
 source_url VARCHAR(2048) NULL,
 publication_status ENUM('draft','published') NOT NULL DEFAULT 'draft',
 archived_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(creator_id) REFERENCES people(id) ON DELETE RESTRICT,
 FOREIGN KEY(linked_person_id) REFERENCES people(id) ON DELETE RESTRICT,
 CHECK(linked_person_id IS NULL OR linked_person_id<>creator_id),
 INDEX associates_creator(creator_id,archived_at,publication_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version,description) VALUES('003_creator_associates','Optional people and associates attached to shared creator portfolios');

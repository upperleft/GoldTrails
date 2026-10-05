-- Apply once. No administrator account or password is created by this migration.
CREATE TABLE admin_sessions (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 csrf_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 authenticated BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NOT NULL,
 CHECK (authenticated IN (0,1)), INDEX admin_session_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE admin_login_limits (
 bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 window_start DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE people ADD COLUMN edit_version INT UNSIGNED NOT NULL DEFAULT 0;
CREATE TABLE creator_change_log (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor VARCHAR(180) NOT NULL,
 action ENUM('create','save','archive','restore') NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT,
 INDEX creator_log(person_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version,description) VALUES('002_creator_management','Private owner sessions, login limits, revision protection and creator audit');

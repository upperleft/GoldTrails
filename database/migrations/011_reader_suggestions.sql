-- Export a full private backup before applying. Additive; MariaDB DDL auto-commits.
CREATE TABLE IF NOT EXISTS reader_suggestions (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 message TEXT NOT NULL,
 page_path VARCHAR(250) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
 status ENUM('new','reviewed') NOT NULL DEFAULT 'new',
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX suggestions_status_date(status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO schema_migrations(version,description) VALUES('011_reader_suggestions','Private reader suggestions and reversible review status');

-- Back up first. Additive migration; MariaDB DDL commits implicitly.
-- No accounts, IP addresses, raw user agents, form text or query strings.
CREATE TABLE IF NOT EXISTS site_usage_events (
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 visitor_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_type ENUM('pageview','outbound') NOT NULL,
 page_path VARCHAR(250) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 target_url VARCHAR(1500) NOT NULL DEFAULT '',
 referrer_host VARCHAR(180) NOT NULL DEFAULT 'Direct / unknown',
 device_class ENUM('desktop','tablet','mobile') NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX usage_date(created_at),
 INDEX usage_visitor(visitor_hash,created_at),
 INDEX usage_session(session_hash,created_at),
 CHECK((event_type='pageview' AND target_url='') OR (event_type='outbound' AND target_url<>''))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO schema_migrations(version,description) VALUES('010_site_analytics','Opt-in public page views and outbound resource clicks');

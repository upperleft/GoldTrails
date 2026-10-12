-- Apply after 004_member_accounts. Back up first; MariaDB DDL commits implicitly.
-- Additive and retryable. The application only checks this marker; startup never
-- changes schema. Do not drop tables to retry a partially applied migration.
-- Removing these new tables is a separate, explicitly approved data-deletion
-- operation once members have saved appointments.
CREATE TABLE IF NOT EXISTS calendar_calendars (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(100) NOT NULL,
 color CHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 visible BOOLEAN NOT NULL DEFAULT TRUE,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(owner_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
 INDEX calendar_owner(owner_id,id),
 CHECK(visible IN(0,1)), CHECK(revision>0),
 CHECK(CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100),
 CHECK(color REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_events (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 calendar_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 title VARCHAR(200) NOT NULL,
 description TEXT NOT NULL,
 location VARCHAR(500) NOT NULL DEFAULT '',
 -- Wall dates/times and IANA zone preserve recurrence through DST. All-day
 -- values are dates; their UTC indexes are only coarse query candidates.
 start_local VARCHAR(19) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 end_local VARCHAR(19) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 time_zone VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 all_day BOOLEAN NOT NULL DEFAULT FALSE,
 start_utc DATETIME(6) NOT NULL,
 end_utc DATETIME(6) NOT NULL,
 rrule VARCHAR(1000) CHARACTER SET ascii COLLATE ascii_bin NULL,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(calendar_id) REFERENCES calendar_calendars(id) ON DELETE CASCADE,
 INDEX calendar_event_range(calendar_id,start_utc,end_utc),
 INDEX calendar_event_local_range(calendar_id,all_day,start_local,end_local),
 CHECK(all_day IN(0,1)), CHECK(revision>0), CHECK(end_utc>start_utc),
 CHECK(CHAR_LENGTH(TRIM(title)) BETWEEN 1 AND 200),
 CHECK(all_day=FALSE OR end_local>start_local)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_event_exceptions (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 occurrence_start VARCHAR(19) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 cancelled BOOLEAN NOT NULL DEFAULT FALSE,
 override_json JSON NULL,
 override_all_day BOOLEAN NULL,
 override_start_local VARCHAR(19) CHARACTER SET ascii COLLATE ascii_bin NULL,
 override_end_local VARCHAR(19) CHARACTER SET ascii COLLATE ascii_bin NULL,
 override_start_utc DATETIME(6) NULL,
 override_end_utc DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
 UNIQUE calendar_exception_occurrence(event_id,occurrence_start),
 INDEX calendar_exception_moved(override_start_utc,override_end_utc,event_id),
 CHECK(cancelled IN(0,1)),
 CHECK((cancelled=TRUE AND override_json IS NULL AND override_start_utc IS NULL AND override_end_utc IS NULL)
   OR (cancelled=FALSE AND override_json IS NOT NULL AND override_end_utc>override_start_utc))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_preferences (
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 view_name ENUM('dayGridMonth','timeGridWeek','timeGridDay','listMonth') NOT NULL DEFAULT 'dayGridMonth',
 time_zone VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'America/New_York',
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(owner_id) REFERENCES member_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Metadata only: never put private titles, descriptions, locations or payloads
-- in audit records. Entity references intentionally survive event deletion.
CREATE TABLE IF NOT EXISTS calendar_audit_log (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 action VARCHAR(60) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 entity_type ENUM('calendar','event','preferences') NOT NULL,
 entity_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 revision INT UNSIGNED NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(owner_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
 INDEX calendar_audit_owner(owner_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_write_limits (
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 window_started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 read_window_started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 read_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY(owner_id) REFERENCES member_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO schema_migrations(version,description)
 VALUES('009_native_calendar','Private native calendars, scoped recurring events and exceptions, display preferences, audit metadata and read/write limits')
 ON DUPLICATE KEY UPDATE version=VALUES(version);

-- Back up first. Apply once after 014; MariaDB DDL commits implicitly.
-- Private header references only. No account, invitation, grant or email is created.
CREATE TABLE creator_reply_references (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 mailbox VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
 message_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 thread_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 from_email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
 from_name VARCHAR(180) NOT NULL DEFAULT '',
 subject VARCHAR(500) NOT NULL DEFAULT '',
 received_at DATETIME(6) NOT NULL,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 invitation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 status ENUM('new','reviewed') NOT NULL DEFAULT 'new',
 imported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 reviewed_by VARCHAR(180) NULL,
 reviewed_at DATETIME(6) NULL,
 UNIQUE KEY creator_reply_message(mailbox,message_id),
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT,
 FOREIGN KEY(invitation_id) REFERENCES creator_invitations(id) ON DELETE RESTRICT,
 CHECK(mailbox='pshmker@gmail.com'),
 INDEX creator_replies_received(received_at,id),
 INDEX creator_replies_person(person_id,received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE creator_reply_sync_state (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 last_success_at DATETIME(6) NULL,
 imported_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 duplicate_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 unmatched_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 ambiguous_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 CHECK(id=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO creator_reply_sync_state(id) VALUES(1);
INSERT INTO schema_migrations(version,description) VALUES('015_creator_reply_references','Private creator reply header references and authenticated metadata sync');

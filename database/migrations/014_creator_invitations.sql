-- Apply once after migration 004, with a database backup. MariaDB DDL commits.
-- No accounts, passwords, administrator roles, or complimentary grants are seeded.
-- Existing edit_profile permissions remain unchanged; invitations use creator only.
ALTER TABLE member_creator_connections MODIFY permission ENUM('edit_profile','creator') NOT NULL DEFAULT 'edit_profile';

CREATE TABLE creator_invitation_settings (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 owner_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 configured_by VARCHAR(180) NOT NULL DEFAULT '',
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(owner_account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(id=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO creator_invitation_settings(id) VALUES(1);

CREATE TABLE creator_invitations (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 target_email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 invited_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_label VARCHAR(180) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NOT NULL,
 consumed_at DATETIME(6) NULL,
 revoked_at DATETIME(6) NULL,
 accepted_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT,
 FOREIGN KEY(invited_by) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 FOREIGN KEY(accepted_account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(CHAR_LENGTH(TRIM(target_email)) BETWEEN 3 AND 254),
 CHECK(expires_at>created_at),
 CHECK((consumed_at IS NULL AND accepted_account_id IS NULL) OR (consumed_at IS NOT NULL AND accepted_account_id IS NOT NULL)),
 INDEX creator_invitation_target(person_id,target_email,consumed_at,revoked_at),
 INDEX creator_invitation_expiry(expires_at),
 INDEX creator_invitation_account(accepted_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE creator_invitation_audit (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 invitation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 actor_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_label VARCHAR(180) NOT NULL,
 action VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(invitation_id) REFERENCES creator_invitations(id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 INDEX creator_invitation_audit_invitation(invitation_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO schema_migrations(version,description) VALUES('014_creator_invitations','Owner-bound creator invitations with verified account acceptance and complimentary Plus');

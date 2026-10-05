-- Apply once. No accounts, passwords, paid access or administrator grants are created.
CREATE TABLE member_accounts (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 account_number BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 username VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL UNIQUE,
 password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('pending_verification','active','suspended') NOT NULL DEFAULT 'pending_verification',
 email_verified_at DATETIME(6) NULL,
 password_changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 auth_version INT UNSIGNED NOT NULL DEFAULT 0,
 last_login_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 archived_at DATETIME(6) NULL,
 CHECK(CHAR_LENGTH(TRIM(username)) BETWEEN 3 AND 40),
 CHECK(CHAR_LENGTH(TRIM(email)) BETWEEN 3 AND 254),
 CHECK(CHAR_LENGTH(password_hash)>40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_profiles (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 display_name VARCHAR(180) NULL,
 country_code CHAR(2) NULL,
 state_province VARCHAR(180) NULL,
 biography TEXT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_roles (
 code VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 name VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO member_roles(code,name) VALUES('member','Member'),('contributor','Contributor'),('moderator','Moderator'),('admin','Administrator');
CREATE TABLE member_role_grants (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 role_code VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 granted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 granted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 revoked_at DATETIME(6) NULL,
 PRIMARY KEY(account_id,role_code),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 FOREIGN KEY(role_code) REFERENCES member_roles(code) ON DELETE RESTRICT,
 FOREIGN KEY(granted_by) REFERENCES member_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_subscriptions (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider_customer_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
 provider_subscription_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('pending','trialing','active','past_due','canceled','expired') NOT NULL DEFAULT 'pending',
 current_period_start DATETIME(6) NULL,
 current_period_end DATETIME(6) NULL,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
 canceled_at DATETIME(6) NULL,
 last_event_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 UNIQUE(provider,provider_subscription_id),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(cancel_at_period_end IN(0,1)),
 CHECK(current_period_end IS NULL OR current_period_start IS NULL OR current_period_end>current_period_start),
 INDEX subscriptions_account(account_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_memberships (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 level ENUM('free','subscriber') NOT NULL DEFAULT 'free',
 status ENUM('active','suspended','expired') NOT NULL DEFAULT 'active',
 grant_source ENUM('free','payment','complimentary') NOT NULL DEFAULT 'free',
 subscription_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 granted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 starts_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 ends_at DATETIME(6) NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 FOREIGN KEY(subscription_id) REFERENCES member_subscriptions(id) ON DELETE RESTRICT,
 FOREIGN KEY(granted_by) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(ends_at IS NULL OR ends_at>starts_at),
 CHECK((level='free' AND grant_source='free' AND subscription_id IS NULL) OR (level='subscriber' AND ((grant_source='payment' AND subscription_id IS NOT NULL) OR (grant_source='complimentary' AND granted_by IS NOT NULL AND subscription_id IS NULL))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_creator_connections (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('requested','approved','rejected','revoked') NOT NULL DEFAULT 'requested',
 permission ENUM('edit_profile') NOT NULL DEFAULT 'edit_profile',
 requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 reviewed_at DATETIME(6) NULL,
 review_note TEXT NULL,
 PRIMARY KEY(account_id,person_id),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewed_by) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(status<>'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
 INDEX creator_connections_profile(person_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_sessions (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 csrf_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 auth_version INT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NOT NULL,
 revoked_at DATETIME(6) NULL,
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(expires_at>created_at),
 INDEX member_session_expiry(expires_at), INDEX member_session_account(account_id,revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_tokens (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 purpose ENUM('verify_email','reset_password','creator_invitation') NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 target_email VARCHAR(254) COLLATE utf8mb4_bin NULL,
 person_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NOT NULL,
 consumed_at DATETIME(6) NULL,
 revoked_at DATETIME(6) NULL,
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE RESTRICT,
 CHECK(expires_at>created_at),
 CHECK((purpose='creator_invitation' AND target_email IS NOT NULL AND person_id IS NOT NULL) OR (purpose IN('verify_email','reset_password') AND account_id IS NOT NULL)),
 INDEX member_token_expiry(expires_at), INDEX member_token_account(account_id,purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE member_audit_log (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 action VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 INDEX member_audit_account(account_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version,description) VALUES('004_member_accounts','Private member accounts, free/subscriber access, separate role grants, creator claims and hashed sessions/tokens');

-- Back up first. Apply once after 015; MariaDB DDL commits implicitly.
-- Billing remains disabled until application configuration is explicitly enabled.
-- No customer, subscription, charge, account or access grant is created here.
ALTER TABLE member_subscriptions
 MODIFY status ENUM('pending','trialing','active','past_due','canceled','expired','incomplete','incomplete_expired','unpaid','paused','unknown') NOT NULL DEFAULT 'pending',
 ADD stripe_account_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD livemode BOOLEAN NOT NULL DEFAULT FALSE,
 ADD price_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD price_valid BOOLEAN NOT NULL DEFAULT FALSE,
 ADD provider_status VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD paid_through DATETIME(6) NULL,
 ADD latest_invoice_paid BOOLEAN NOT NULL DEFAULT FALSE,
 ADD schedule_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD pause_at DATETIME(6) NULL,
 ADD resume_at DATETIME(6) NULL,
 ADD pause_reminder_sent_at DATETIME(6) NULL,
 ADD last_reconciled_at DATETIME(6) NULL,
 ADD INDEX subscriptions_stripe_scope(stripe_account_id,livemode,account_id,status),
 ADD CHECK(livemode IN(0,1) AND price_valid IN(0,1) AND latest_invoice_paid IN(0,1)),
 ADD CHECK((pause_at IS NULL AND resume_at IS NULL) OR (pause_at IS NOT NULL AND resume_at IS NOT NULL AND resume_at>pause_at));

CREATE TABLE billing_customers (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 stripe_account_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 livemode BOOLEAN NOT NULL,
 provider_customer_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(account_id,stripe_account_id,livemode),
 UNIQUE KEY billing_customer_identity(stripe_account_id,livemode,provider_customer_id),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 CHECK(livemode IN(0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE billing_checkout_attempts (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 stripe_account_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 livemode BOOLEAN NOT NULL,
 provider_customer_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider_session_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
 status ENUM('creating','open','completed','expired','failed') NOT NULL DEFAULT 'creating',
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NOT NULL,
 finished_at DATETIME(6) NULL,
 UNIQUE KEY billing_checkout_identity(stripe_account_id,livemode,provider_session_id),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 INDEX billing_checkout_account(account_id,stripe_account_id,livemode,status,expires_at),
 CHECK(livemode IN(0,1)),
 CHECK(expires_at>created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE billing_events (
 stripe_account_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 livemode BOOLEAN NOT NULL,
 event_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider_subscription_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_type VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_created DATETIME(6) NOT NULL,
 processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 membership_outcome VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(stripe_account_id,livemode,event_id),
 FOREIGN KEY(account_id) REFERENCES member_accounts(id) ON DELETE RESTRICT,
 INDEX billing_events_account(account_id,processed_at),
 CHECK(livemode IN(0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO schema_migrations(version,description) VALUES('016_stripe_billing','Scoped Stripe customer bindings, checkout attempts, durable webhook events, paid membership reconciliation and service-pause state');

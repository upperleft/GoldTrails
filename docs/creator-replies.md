# Gold Trails email references

The private administrator page at `/admin/creator-replies/` lists header references for incoming messages addressed to `paul@goldtrails.org` and copied to the connected `pshmker@gmail.com` mailbox. It stores sender, subject, received time and a Gmail reference. Open the original message in Gmail to read or reply. Message bodies, snippets, attachments and invitation links are not imported.

Sender addresses are matched exactly to the canonical target email of previously issued creator invitations. A unique creator match links to the existing editor. Unmatched senders and addresses shared by multiple creators remain **General Gold Trails email**. A matching header does not verify identity, change account ownership, grant membership, consume an invitation or send email. Marking a reference reviewed affects only this private list.

## Setup and current limits

The code is prepared; forwarding, scheduled checks, the private import key and production migration are separate activation steps. An enabled import endpoint does not establish that forwarding or a monitor is running. The panel shows this distinction and the last successful metadata check. A successful empty batch records a check without inventing a message.

1. Back up the live database and apply `database/migrations/015_creator_reply_references.sql` once after migration 014. It adds the reference table and singleton sync state. It creates no account, invitation, grant or email. No migration runs on startup. MariaDB DDL commits implicitly; inspect partial failure before retrying.
2. Verify delivery from the existing Hostinger mailbox into the connected Gmail account using a controlled test. Retain the original Hostinger copy. Do not claim forwarding works until that test arrives. [Hostinger forwarding instructions](https://www.hostinger.com/support/1583221-how-to-set-up-a-forwarder-for-hostinger-email/)
3. Generate a random 32-byte key represented as 64 lowercase hexadecimal characters. Store it privately as `CREATOR_REPLY_SYNC_KEY` in Hostinger's server environment and in the authorized local sync process. Keep it out of chat, logs, source control, browser/client code and automation prompt text. A missing or invalid key disables ingestion. It is separate from the mailbox password and only authorizes this metadata import endpoint.
4. Configure a narrow check of the forwarded Gold Trails messages. Prefer Gmail `search_email_ids` followed by `read_email` with `format: metadata`; do not retrieve full/raw messages or snippets for this panel. Use a destination-specific query and verify the actual forwarded headers from the test before enabling it. Exclude personal Gmail messages. [Gmail metadata format](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get)
5. Parse only From, To, Subject and Gmail received time plus immutable message/thread IDs. Confirm the original destination is `paul@goldtrails.org`; do not label arbitrary personal Gmail messages with that destination. Use Gmail's received timestamp rather than trusting an arbitrary Date header. Unfold header whitespace locally, bound fields, and submit at most 20 references per batch. Page through search results when needed; use a small overlapping time window so missed runs are recoverable. Repeated IDs are safe to retry.
6. Submit the metadata to the authenticated endpoint below and verify the private panel shows the controlled test. Set up the requested scheduled watch only after this round trip works. Keep notifications quiet when no meaningful new mail or failure occurs. An import key does not provide Gmail access; Gmail connector authorization remains in Codex.

## Import contract

`POST https://goldtrails.org/api/creator-replies/import` requires `Authorization: Bearer <private 64-hex key>` and `Content-Type: application/json`. It accepts no query parameters or browser Origin. Other methods are rejected; no CORS permission is issued. Responses are private, no-store and noindex, and successful responses contain counts only.

```json
{
  "mailbox": "pshmker@gmail.com",
  "destination": "paul@goldtrails.org",
  "records": [
    {
      "message_id": "1a16063e26c25562",
      "thread_id": "1a16063e26c25562",
      "from_email": "creator@example.invalid",
      "from_name": "Example Creator",
      "to_email": "paul@goldtrails.org",
      "subject": "Re: A personal invitation to Gold Trails",
      "received_at": "2026-11-02T16:20:00.000Z"
    }
  ]
}
```

The total JSON body is limited to 32 KiB and 20 records. Empty records arrays are valid checks. Gmail IDs must be 8–32 lowercase hexadecimal characters; dates must be canonical UTC ISO timestamps, not future-dated beyond five minutes. From addresses are trimmed by the sync process and canonicalized to lowercase without Gmail dot or plus rewriting. `from_name` is optional, up to 180 characters; subject is at most 500 characters. Control characters, duplicate message IDs within a batch, body/snippet/attachment fields and other unexpected fields are rejected. Invitation URLs and token-shaped strings are removed from header text before storage.

On success, counts are `imported`, `duplicates`, `unmatched` and `ambiguous`. The last two are subsets of newly imported general references. A mailbox/message ID is recorded once; retries preserve review state. A conflicting existing message's sender or thread ID is rejected. Imports and last-success state commit together, and failures roll back both. A timeout can be retried with the same IDs. Errors do not return or log SQL, provider credentials or message content.

The import capability can store metadata references and update check time only. It cannot read the mailbox, retrieve site-private data, send messages, change recipients or modify invitations/accounts. Disabling or rotating the key stops that capability. Administrator access to the panel and review forms uses the existing authenticated owner session, same-origin and CSRF checks; the sync key never grants administrator access.

## Verification

Fifteen HTTP, input and transaction tests cover key authorization, CORS/method/body limits, destination isolation, forbidden content, token redaction, header escaping, idempotency, general and ambiguous matches, rollback, missing storage, owner access, CSRF and review state. Run `node --test tests/creator-replies.test.js tests/creator-reply-store.test.js` on Node 22. Production forwarding, migration and delivery verification are activation work and are not implied by these tests.

Six real MariaDB fixture checks passed on November 2, including nullable foreign keys, actual invitation matching, redaction, review preservation, concurrent duplicate imports, transaction rollback and empty checks. Fictional accounts and references were cleaned, and the temporary server was stopped. This verifies the isolated schema and store, not production activation.

To reproduce, apply migrations 001, 004, 014 and 015 to the explicitly isolated `gold_creator_invitation_test` database, then set `RUN_CREATOR_REPLIES_DB_TESTS=true` and `CREATOR_REPLIES_DB_SOCKET` to its `/private/tmp/goldtrails-invitations-db-.../mysql.sock` and run `node --test tests/creator-replies-mariadb.integration.mjs`. Do not run this fixture concurrently with the creator invitation fixture; both require an otherwise empty isolated member database. It refuses other socket paths and leaves production untouched.

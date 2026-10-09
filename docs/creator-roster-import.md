# Consolidating the creator roster

The research catalog has 68 entries. The live website was checked on 2026-10-09 and had seven published profiles. The map merges that catalog with the database, while archived, sample, and unpublished database records take precedence and stay excluded.

The administrator creator list now links to `/admin/creators/import/`. This protected page previews additions, existing profiles to preserve, and duplicate public channel URLs. Submission requires the administrator session, matching origin, CSRF token, and a digest of the reviewed roster/database snapshot. A stale preview is rejected. It uses the existing foundation and creator-management tables; no new schema migration is needed.

An import creates minimal people, public-source references, creator roles, and channels only when the source is a real channel or website. A YouTube watch URL remains a source video and does not become a channel. Dates, experience, residence, subscriptions and site permissions are not invented. Broad coverage regions from the existing research roster are labeled as coverage, never access locations. Research leads remain under review. Choose published basic profiles or private drafts.

Existing people—including drafts and archived entries—are skipped, never overwritten or restored. Same normalized channel URL on another person is flagged and skipped. Both archived and active channels are checked. Review-page state is rechecked under transaction locks before mutation. All inserts and audit logs commit together; errors roll back the batch. A new preview after a completed import shows those creators as existing, making reruns non-destructive.

Validation: tests cover duplicate/archived ownership, source-video handling, transaction failures, stale previews, repeated batches, authentication, origin and CSRF. Actual MariaDB execution is still pending: no development MariaDB runtime or administrator session was available in this turn. The production importer has not been run. The separate 005 research migration is not required for this import and is not applied at startup.

Once deployed, sign in to the creator workspace, review the import page, and run the batch. Verify all profiles appear in the editor/directory, then check the map and profile links. Preserve a database backup before the first production batch. No credentials are committed to the repository.

The authenticated backup link exports the creator-domain tables in a consistent read transaction as a JSON attachment. It includes creator/editor research notes; keep it private. It excludes member accounts, sessions, credentials and billing. Optional associate/research tables are included only when their schema markers exist. This is a creator-data snapshot, not a complete server backup or an automatic restore tool.

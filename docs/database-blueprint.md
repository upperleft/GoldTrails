# Gold Trails database blueprint

Status: directory foundation created on Hostinger, 5 October 2026. MariaDB 11.8.9; migration 001 applied and verified: 27 tables, 46 foreign keys, 13 CHECK constraints. See ../database/README.md and ../database/migrations/001_directory_foundation.sql. Website database connection remains a separate next step.

## First implementation

Deliver browse/search prospectors → open one database-populated public profile. Start with people, names, roles, regions, topics, channels, resources, and source attribution. Use clearly fictional seed records only for previews. No billing, login, account administration, or live creator claims in this slice.

Build the directory and profile through the existing Node application. Keep database queries on the server. A small server-side template layer can reuse the established visual layout. Preserve existing static category routes during this transition. Validate a working database connection in a separate development environment before configuring production.

## Shared conventions

- Every entity has an opaque permanent primary key. Use application-generated UUIDs, with engine-appropriate storage once selected. Never use names or email addresses as relationship keys.
- Public pages have unique slugs, separate from primary keys. Preserve redirects when slugs change.
- Entity records carry created_at, updated_at, archived_at, and optional created_by_account_id / updated_by_account_id. Use UTC timestamps and render in the relevant user timezone.
- NULL means not established. UI renders TBD for NULL or absent optional text. False displays No; true displays Yes; zero remains zero. Do not store the string TBD. Unknown dates and years remain NULL, never invented defaults.
- Store year-only facts as years, not fictitious full dates. Approximate or disputed facts need source notes.
- Publication status (draft, published) is separate from archiving and source verification. Normal public searches include only published, non-archived records.
- Archive rather than routinely delete. Preserve foreign-key relationships. Existing public references to archived content resolve to an archive notice or retained historical entry. Do not expose draft or private records through this rule.
- References normally restrict hard deletion; do not cascade-delete article citations or historical associations. Account privacy/deletion policies will be designed with membership, separately from editorial archiving.
- Public contact information is distinct from account email and private research notes. Public APIs use an explicit field allowlist.
- Empty multi-value sets mean no entries recorded; they do not assert that no such relationship exists.

## People and public profiles

### people

id, slug, display_name, nickname, portrait_asset_url, short_introduction, biography, country_code, state_province, primary_region_id (nullable FK regions), experience_since_year, offers_instruction (nullable boolean), instruction_description, verification_status (unverified, source_checked, creator_confirmed), publication_status, shared timestamps and archive fields.

Region is broad coverage/location information, not a precise private address or evidence of legal prospecting access. Experience year refers to prospecting experience. A fictional sample must carry is_sample=true, be clearly labeled, and be excluded from factual directory results by default.

### person_aliases

id, person_id, alias, alias_type (nickname, former_name, alternate_spelling), source_reference_id nullable. Search aliases alongside the current display name.

### public_roles / person_public_roles

Role vocabulary: prospector, educator, inventor, manufacturer, seller, creator. person_public_roles links person_id + role_id with optional evidence reference. A person can hold multiple roles. These are descriptive labels and never grant site permissions.

### languages / person_languages

Language code and display name; unique person_id + language_code relationship. Channel-specific languages can be added later.

### regions / person_regions

regions: id, slug, name, region_type, country_code, parent_region_id nullable, description, publication/archive fields. Hierarchy must be acyclic.
person_regions: person_id, region_id, relationship_type (based_in, covers, teaches_in), source_reference_id nullable, notes. Unique association by person, region, and relationship type.

### topics / person_topics

topics: id, slug, name, topic_group, parent_topic_id nullable, description, archive fields.
person_topics: person_id, topic_id, relationship_type (specialty, technique_demonstrated, deposit_interest, content_topic, equipment_discussed), source_reference_id nullable.

Use shared vocabularies for panning, sluicing, detecting, geology, placer, lode, and beach deposits. Equipment products link through product relationships when identified; an equipment topic can describe a general class without implying endorsement.

### audience_levels / person_audience_levels

Beginner, intermediate, advanced; many-to-many associations. No level recorded means TBD.

## Creator channels and contact

### channels

id, person_id nullable, organization_id nullable (future), platform (YouTube, Facebook, Instagram, website, podcast, other), channel_name, handle nullable, canonical_url, external_channel_id nullable, description, publishing_since_year nullable, publishing_since_basis (earliest_verified_content, creator_statement, unknown), verification_status, link_status, last_checked_at, publication/archive fields.

At least one owner is required. YouTube publishing_since is not automatically account creation date. Unique platform + external_channel_id where supplied; do not let NULL external IDs conflict. Store external IDs as text. Channel URL/handle changes must not change the owner’s permanent ID.

### public_contacts

id, person_id, contact_type (business_email, contact_page), public_value, source_reference_id nullable, last_checked_at, archive fields. Only intentionally public details belong here.

### formats / person_formats

Controlled formats: video, article, podcast, livestream, field_notes. Link multiple formats to each person.

## Resources, sources, and evidence

### resources

id, slug, title, summary, canonical_url nullable, normalized_url nullable, publisher_name nullable, publication_date nullable, publication_year nullable, language_code nullable, format_code, verification_status, link_status (unchecked, reachable, moved, broken), last_checked_at, last_http_status nullable, publication/archive fields.

Allow date or year with a constraint ensuring consistency when both exist. Avoid rewriting meaningful URL query parameters during normalization. canonical_url can remain NULL while a draft is being prepared. Publication requires the appropriate real resource destination or hosted content.

### resource_people

resource_id, person_id, relationship_type (author, presenter, featured_subject, contributor), source_reference_id nullable. Multiple creators may share one resource.

### resource_topics / resource_regions

Many-to-many links with evidence/notes where appropriate. These enable regional and subject-based research across creators and materials.

### resource_collections / collection_resources

Collections: id, slug, title, description, publication/archive fields.
Membership: collection_id, resource_id, position, editorial_note. Unique collection + resource. Manual ordering uses position, with a stable secondary sort.

### person_featured_resources

person_id, resource_id, position, editorial_note. Links selected lessons, featured videos, downloads, and references to a profile without duplicating the resource.

### source_references

id, resource_id (FK resources), section_locator nullable, video_timestamp_seconds nullable, quotation_excerpt nullable, evidence_note, accessed_at, reviewed_by_account_id nullable. Keep quotations brief and attributed. Require timestamps to be nonnegative.

### person_fact_sources (first slice)

id, person_id, field_key, source_reference_id, assessment (supports, disputes), reviewer_note, reviewed_at. field_key is validated against an application-maintained allowlist, not arbitrary SQL. Multiple sources can support or dispute one fact.

Add explicitly typed channel_fact_sources, organization_fact_sources, and product_fact_sources as their modules ship. Relationship tables link evidence directly. Avoid unrestricted polymorphic entity IDs that bypass referential integrity.

## Companies, equipment, and products — planned expansion

### organizations / person_organizations

organizations: id, slug, name, description, official_website_url, official_store_url, country_code, publication/archive fields.
person_organizations: person_id, organization_id, role (founder, inventor, manufacturer, seller, member), start_year nullable, end_year nullable, source_reference_id nullable. Clubs and relevant affiliations use organization_type.

### products

id, slug, name, description, equipment_category_topic_id, publication/archive fields. Preserve stable IDs when model names change.

### product_people / product_organizations

product_people: product_id, person_id, relationship_type (inventor, designer, collaborator), source_reference_id.
product_organizations: product_id, organization_id, relationship_type (brand, manufacturer), source_reference_id.

### sales_listings

id, product_id nullable, seller_organization_id nullable, associated_person_id nullable, listing_title, url, listing_type (official_store, retailer, marketplace), link_status, last_checked_at, archive fields. A brand storefront can exist before individual products are catalogued. Require at least a product or person association. Price and availability are future fields, not manually assumed current facts.

Separate inventor, manufacturer, and seller relationships. A profile can display connected products, and products can link back to their inventors and manufacturers.

## Articles — planned expansion

articles: id, slug, title, summary, body, publication_status, published_at nullable, shared timestamps/archive fields.
article_people: article_id, person_id, relationship_type (author, contributor, featured_subject).
article_resources: id, article_id, resource_id, usage_type (citation, further_reading, demonstration, featured_subject), source_reference_id nullable, relevant_section nullable, editorial_note, position.
article_topics, article_regions, article_products: typed many-to-many links.

This connects research to an article while keeping attribution and the original resource record reusable.

## Accounts, site roles, and subscriptions — membership phase

### accounts

id (permanent account ID), member_number (unique readable reference such as GT-000123), auth_provider, auth_subject (unique provider + subject), display_name, account_email (private), status, created_at, updated_at. Generate member numbers transactionally; never use row count + 1. IDs and member numbers never grant access.

Authentication approach is undecided. Do not store plaintext passwords or put account details in public profile APIs.

### account_people

account_id, person_id, link_status (pending, approved), approved_by_account_id, approved_at. Optional verified connection between a member and a public profile. Initial rule: one approved owner account per profile; multiple profiles per account are supported. Linking or claiming a profile must not grant editor/admin permissions.

### site_roles / account_roles

Roles: Subscriber, Contributor, Editor/Reviewer, Administrator. Store assignments explicitly with granted_by_account_id, granted_at, revoked_at nullable. Allow multiple roles per account; define and enforce permissions server-side.

- Subscriber: read member content when an active entitlement allows it; save trails.
- Contributor: submit content and propose corrections; cannot publish or manage permissions.
- Editor/Reviewer: review and publish editorial content; cannot manage billing or grant administrator access by default.
- Administrator: site/user permission administration through explicit capabilities.

Public creator roles are independent. Paid subscription status is independent. A role label alone does not establish active paid access; define complimentary and staff access separately if needed.

### subscriptions / subscription_events

subscriptions: id (internal), account_id, payment_provider, provider_customer_id, provider_subscription_id (unique within provider), plan_code, status, started_at, current_period_end nullable, ended_at nullable.
subscription_events: id, subscription_id, provider_event_id unique per provider, event_type, occurred_at, processed_at. Verify provider webhooks and process idempotently. Never store card numbers. An account retains its identity across cancellation and rejoining; multiple subscription records can belong to it.

## Maintenance and integrity

- Later revision history: immutable change records with responsible editor, entity type, entity ID, action, changed fields, timestamp, reason. Restrict access to private data in history.
- Duplicate merges: keep redirect/merge mappings from old IDs/slugs to the surviving record; reassociate references transactionally, preserving evidence and merge history. Do not reuse an old ID for a different entity.
- Index profile slug and searchable name/alias; use a supported full-text index when needed. Index publication/archive status, FK join columns, external channel IDs, topic/region associations, and member number. Choose exact index design after the engine is selected.
- Enforce foreign keys, unique join keys, status constraints, nonnegative positions/timestamps, and reasonable year ranges. Use parameterized queries, pagination, deterministic sorting, and server-side permission checks.
- Make search consider names, aliases, topics, regions, and selected channel fields. Exclude archived, unpublished, and private data by default. Start with basic keyword and category criteria rather than advanced ranking.
- Separate development seeds from production. Record migration versions in Git. Back up before schema changes and test restore procedures before accumulating valuable content.

## Display contract

If a scalar optional field is NULL or blank, show TBD in its profile slot. Preserve false and zero. A missing URL displays non-clickable TBD; never create an empty or fake link. An empty resource collection displays a short forthcoming message. Do not render internal notes, account email, auth IDs, billing data, or moderation evidence as public fields.

## Acceptance for the first working slice

1. Browse and keyword-search published sample profiles in development.
2. Open a profile by slug and display stored fields, related regions/topics, channels, and resources.
3. Unset facts display TBD; false and zero remain real values.
4. Archived profiles disappear from default results while retained public references have a clear archive response.
5. Source notes support facts and relationships without exposing private notes.
6. Development seed data is explicitly fictional; production has no fabricated factual claims.
7. Pagination, safe database queries, clean missing-record responses, and shared Gold Trails navigation work.
8. Contributor/admin permissions and payment integrations are not implied by this directory slice.

## Decisions still needed

Development database location; administration workflow for adding records; authentication and payment providers (later). No database passwords or tokens belong in this document or Git.

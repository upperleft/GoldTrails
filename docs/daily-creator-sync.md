# Daily creator directory sync

`npm run sync:creator-research -- <file.json>` previews a normalized research batch. It never writes by default. Add `--apply` to update `app/creator-catalog.json` and `app/creator-video-library.json` after reviewing the preview.

The input is a JSON object with `version: 1` and `creators: []`. Each creator needs a public name, canonical YouTube channel ID and URL, and a list of videos. Each video needs its stable YouTube ID, title, canonical watch URL, channel ID, source check date, subject and topic tags. Do not include email addresses or private invitation links in the input.

The reconciler matches profiles and videos by YouTube channel/video IDs. Existing IDs are preserved. A matching creator name without a confirmed channel ID, a channel claimed by more than one profile, a reused video ID with a different owner/title, or an existing library slug mismatch is reported as an exception and left unchanged. New channels are added as `lead` records with identity-only verification scope; this does not turn research notes into checked geological claims or endorsements. New videos retain the canonical YouTube URL, channel ID, source check date and topic metadata.

The command prints counts and identity-conflict details only. It does not discover contacts, create invitation codes, send email, or deploy the site. Public contact research and outreach remain separate: source URL, check date and verification state stay with contact evidence, while send, failure, reply and opt-out events stay in the private outreach ledger. Do not send an invitation unless the contact is freshly verified, the source permits general business contact, the relevant jurisdictional basis is documented, and the campaign's required postal and opt-out details are configured.

Directory updates still need to be committed and pushed through the existing GitHub → Hostinger deployment flow. Confirm the deployment before describing a change as live. A failed or ambiguous sync should remain queued for the next run or manual identity review; never resolve a conflict by name guess.

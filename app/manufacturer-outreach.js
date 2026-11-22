// Private administrator view. Contact snapshots reuse migration 008; never public catalog data.
import {escapeHtml as h,safeUrl} from './directory-views.js';
import {assetUrl} from './asset-url.js';
import {contactSnapshots} from './business-contacts.js';
const statuses=new Set(['provider_accepted','provider_rejected','provider_uncertain','attempting']);
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function validateManufacturerBatch(batch){
 const snapshots=contactSnapshots(batch);
 if(!snapshots.length||snapshots.length>100)throw Error('Use 1–100 manufacturer snapshots.');
 for(const {record:r} of snapshots){
  if(r.record_type!=='manufacturer_outreach'||r.linked_manufacturer_ids.length!==1||r.creator_slug||!date(r.mailbox_checked_at)||!Array.isArray(r.outreach_events)||!Array.isArray(r.reply_references))throw Error('Invalid manufacturer snapshot');
  for(const e of r.outreach_events)if(!statuses.has(e.status)||!date(e.at)||!r.methods.some(m=>m.kind==='email'&&m.value.toLowerCase()===e.to)||!safeUrl(e.source_url)||typeof e.subject!=='string'||e.subject.length>500||typeof e.text!=='string'||e.text.length>12000)throw Error('Invalid send receipt');
  for(const e of r.reply_references)if(!e.message_id||String(e.message_id).length>512||!date(e.at)||!['reply','automatic_acknowledgment','possible_reply'].includes(e.kind)||!/^\S+@\S+\.\S+$/.test(e.from)||typeof e.subject!=='string'||e.subject.length>500)throw Error('Invalid reply reference');
 }
 return batch;
}
export function manufacturerOverview(snapshots){
 const groups=new Map();
 const sorted=[...snapshots].sort((a,b)=>Date.parse(a.record.mailbox_checked_at)-Date.parse(b.record.mailbox_checked_at));
 for(const {record:r} of sorted){
  if(r.record_type!=='manufacturer_outreach')continue;
  const id=r.linked_manufacturer_ids?.[0];if(!id)continue;
  const previous=groups.get(id);
  const events=new Map([...(previous?.outreach_events||[]),...r.outreach_events].map(e=>[e.at+'|'+e.to+'|'+e.status,e]));
  const replies=new Map([...(previous?.reply_references||[]),...r.reply_references].map(e=>[e.message_id,e]));
  groups.set(id,{...r,prior_contact:r.prior_contact||previous?.prior_contact,outreach_events:[...events.values()],reply_references:[...replies.values()]});
 }
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function manufacturerOutreachView(records,csrf){
 if(!Array.isArray(records))return '';
 const sent=r=>r.outreach_events.some(e=>e.status==='provider_accepted')||Boolean(r.prior_contact?.sent_at);
 const replied=r=>r.reply_references.some(e=>e.kind==='reply');
 const email=records.filter(r=>r.methods.some(m=>m.kind==='email')).length,contacted=records.filter(sent).length,replies=records.filter(replied).length;
 const pct=(a,b)=>b?(100*a/b).toFixed(1)+'%':'0.0%';
 const when=s=>s?h(new Date(s).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})):'Not recorded';
 const rows=records.map(r=>{
  const events=r.outreach_events,accepted=events.filter(e=>e.status==='provider_accepted');
  const status=accepted.length?'Sent · provider accepted':r.prior_contact?.sent_at?'Previously contacted':events.length?'Send needs review':'Not contacted';
  const refs=r.reply_references;
  return `<tr><td>${h(r.name)}<small>${h(r.linked_manufacturer_ids[0])}</small><small>${h((r.linked_product_names||[]).join(', '))}</small></td><td>${r.methods.filter(m=>m.kind==='email').map(m=>`${h(m.value)} <a href="${h(safeUrl(m.source_url))}" target="_blank" rel="noopener noreferrer">Source</a>`).join('<br>')||'No verified email'}</td><td>${h(status)}${accepted.map(e=>`<small>${when(e.at)} · ${h(e.to)}</small><details><summary>View sent welcome</summary><p>${h(e.subject)}</p><p class="report-message">${h(e.text)}</p></details>`).join('')}${r.prior_contact?.sent_at?`<small>${when(r.prior_contact.sent_at)} · earlier creator outreach</small>`:''}</td><td>${replied(r)?'Reply received':refs.length?'Acknowledgment / possible reply — review':'No reply recorded'}${refs.map(e=>`<small>${when(e.at)} · ${h(e.from)} · ${h(e.kind.replaceAll('_',' '))}</small><small>${h(e.subject)}</small>`).join('')}</td></tr>`;
 }).join('');
 const checked=records.map(r=>r.mailbox_checked_at).sort().at(-1);
 return `<link rel="stylesheet" href="${h(assetUrl('manufacturer-outreach.css'))}"><section id="manufacturers" aria-label="Manufacturer outreach"><h3>Manufacturer outreach</h3><dl class="dashboard-counts"><div><dt>Manufacturers</dt><dd><strong>${records.length}</strong></dd></div><div><dt>With verified public email</dt><dd><strong>${email}</strong><p>${pct(email,records.length)} of manufacturers</p></dd></div><div><dt>Contacted</dt><dd><strong>${contacted}</strong><p>${pct(contacted,email)} of those with email</p></dd></div><div><dt>Replied</dt><dd><strong>${replies}</strong><p>${pct(replies,contacted)} of contacted manufacturers</p></dd></div></dl><p>“Sent” means the mail provider accepted the message. Earlier creator outreach counts once per manufacturer. Automatic acknowledgments and possible replies are listed separately and do not count as a personal reply. Mailbox last checked: ${when(checked)}. Replies after this check may not appear yet.</p><details><summary>Show manufacturers and contact history</summary><div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Manufacturer / products</th><th>Verified public email</th><th>Contact history</th><th>Replies</th></tr></thead><tbody>${rows||'<tr><td colspan="4">No manufacturer records imported.</td></tr>'}</tbody></table></div></details><details><summary>Sync manufacturer contact history</summary><p>Import a validated private contact snapshot from the outreach mailbox check. This saves history and sends no email. Reimporting the same snapshot adds no duplicates.</p><form method="post" class="admin-form" action="/admin/creator-invitations/"><input type="hidden" name="csrf" value="${h(csrf)}"><input type="hidden" name="action" value="import_manufacturers"><label>Contact snapshot JSON<textarea name="records" rows="5" required></textarea></label><button type="submit">Sync manufacturer history</button></form></details></section>`;
}

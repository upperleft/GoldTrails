// Portable SQL for the existing phpMyAdmin session. No credentials or network.
import {writeFileSync} from 'node:fs';
import {contactSnapshots} from '../app/business-contacts.js';
export const sqlText=v=>v==null?'NULL':`CONVERT(0x${Buffer.from(String(v),'utf8').toString('hex')} USING utf8mb4)`;
export function contactImportSql(){
 const sql=['START TRANSACTION;'];
 for(const s of contactSnapshots()){
  const r=s.record,person=r.creator_slug?`(SELECT id FROM people WHERE slug=${sqlText(r.creator_slug)} AND is_sample=FALSE AND archived_at IS NULL LIMIT 1)`:'NULL';
  const allowed=r.linked_manufacturer_ids.length?'1=1':`${person} IS NOT NULL`;
  sql.push(`INSERT INTO business_contact_research(id,research_record_id,snapshot_hash,batch_id,person_id,creator_slug,entity_name,checked_at,snapshot_json,imported_by) SELECT ${[s.id,r.record_id,s.hash,s.batch].map(sqlText).join(',')},${person},${[r.creator_slug,r.name,s.date,s.json,'site-owner'].map(sqlText).join(',')} WHERE ${allowed} ON DUPLICATE KEY UPDATE person_id=COALESCE(person_id,VALUES(person_id));`);
 }
 sql.push('COMMIT;','SELECT COUNT(*) AS research_records, COUNT(person_id) AS linked_creators FROM business_contact_research;',...contactSnapshots().filter(s=>s.record.creator_slug).map(s=>`SELECT ${sqlText(s.record.creator_slug)} AS missing_creator WHERE NOT EXISTS(SELECT id FROM people WHERE slug=${sqlText(s.record.creator_slug)} AND is_sample=FALSE AND archived_at IS NULL);`));
 return sql.join('\n')+'\n';
}
if(process.argv[1]===new URL(import.meta.url).pathname){if(!process.argv[2])throw Error('Supply an output SQL path');writeFileSync(process.argv[2],contactImportSql(),{mode:0o600});console.log('Reviewed contact import SQL exported.');}

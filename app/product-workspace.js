import {businessContacts} from './business-contacts.js';
import {randomUUID} from 'node:crypto';
import {digest} from './admin-auth.js';
import {safeUrl} from './directory-views.js';
import {productCatalog,mergedProducts} from './products-page.js';
export class ProductInputError extends Error {}
export class ProductConflict extends Error {}
export const reportTypes={incorrect:'Inaccurate information',discontinued:'No longer sold',replacement:'Updated or replacement product',description:'New or improved description',broken_link:'Broken product link',other:'Other correction'};
export const reportStatuses=['new','reviewing','resolved','dismissed'];
export const productFields=['product_name','manufacturer_or_brand','model','short_description','official_product_url','manufacturer_purchase_url','availability'];
const text=(f,key,max,required=false)=>{const v=(f.get(key)||'').trim();if(v.length>max||(required&&!v))throw new ProductInputError(`Check ${key.replaceAll('_',' ')} (maximum ${max} characters).`);return v;};
const url=(f,key)=>{const v=text(f,key,2048);if(v&&!safeUrl(v))throw new ProductInputError('Use a full http:// or https:// URL without account credentials.');return v;};
export function reportInput(f){
 const type=f.get('report_type');if(!Object.hasOwn(reportTypes,type))throw new ProductInputError('Choose a report type.');
 const message=text(f,'message',4000,true);if(message.length<10)throw new ProductInputError('Please describe the change in at least 10 characters.');
 const email=text(f,'reply_email',254);if(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new ProductInputError('Enter a valid reply email or leave it blank.');
 if(text(f,'company_website',200))throw new ProductInputError('This report could not be accepted.');
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(f.get('submission_id')||''))throw new ProductInputError('Refresh the report form.');
 return {type,message,url:url(f,'suggested_url')||null,name:text(f,'sender_name',180)||null,business:text(f,'business_name',180)||null,email:email||null};
}
export function productInput(f){
 const changes={product_name:text(f,'product_name',255,true),manufacturer_or_brand:text(f,'manufacturer_or_brand',180,true),model:text(f,'model',255),short_description:text(f,'short_description',4000,true),official_product_url:url(f,'official_product_url'),manufacturer_purchase_url:url(f,'manufacturer_purchase_url'),availability:f.get('availability')};
 if(!['current','unknown','out of stock','discontinued','made to order'].includes(changes.availability))throw new ProductInputError('Choose a listed availability.');
 const source=url(f,'source_url'),note=text(f,'editor_note',2000,true);
 return {changes,source,note};
}
export function editVersion(f){const v=f.get('version');if(!/^(0|[1-9]\d{0,8})$/.test(v||''))throw new ProductInputError('Reload the current form.');return Number(v);}
export function createProductWorkspace(db){
 const tx=async fn=>{const c=await db.getConnection();try{await c.beginTransaction();const out=await fn(c);await c.commit();return out;}catch(e){await c.rollback();if(e.code==='ER_DUP_ENTRY')throw new ProductConflict('Another edit came first.');throw e;}finally{c.release();}};
 const api={
 async contactResearch(){return businessContacts(db);},
 async ready(){return (await db.query("SELECT version FROM schema_migrations WHERE version='007_admin_products_reports'")).length>0;},
 async overrides(){return await api.ready()?db.query('SELECT product_id,changes_json,edit_version,updated_at,updated_by FROM product_overrides'):[];},
 async products(){return mergedProducts(await api.overrides());},
 async product(id){const base=productCatalog().find(p=>p.product_id===id);if(!base)return null;const r=await api.ready()?(await db.query('SELECT product_id,changes_json,edit_version,updated_at,updated_by FROM product_overrides WHERE product_id=?',[id]))[0]:null;return {product:mergedProducts(r?[r]:[]).find(p=>p.product_id===id),version:r?.edit_version||0,updatedBy:r?.updated_by||null,updatedAt:r?.updated_at||null};},
 async saveProduct(id,version,{changes,source,note},actor){if(!productCatalog().some(p=>p.product_id===id))throw new ProductInputError('Choose a catalog product.');return tx(async c=>{
  const old=(await c.query('SELECT edit_version,changes_json FROM product_overrides WHERE product_id=? FOR UPDATE',[id]))[0];if((old?.edit_version||0)!==version)throw new ProductConflict('Another edit came first.');
  const baseline=productCatalog().find(p=>p.product_id===id),previous=old?JSON.parse(old.changes_json):{};
  const values={...Object.fromEntries(Object.entries(previous).filter(([k])=>productFields.includes(k)||k==='source_urls')),...changes};
  if(source)values.source_urls=[...new Set(String(previous.source_urls||baseline.source_urls||'').split('|').filter(Boolean).concat(source))].join('|');
  const json=JSON.stringify(values);
  await c.query('INSERT INTO product_overrides(product_id,changes_json,edit_version,updated_by) VALUES(?,?,1,?) ON DUPLICATE KEY UPDATE changes_json=VALUES(changes_json),edit_version=edit_version+1,updated_by=VALUES(updated_by)',[id,json,actor]);
  await c.query('INSERT INTO product_change_log(id,product_id,actor,changes_json,editor_note) VALUES(?,?,?,?,?)',[randomUUID(),id,actor,json,note]);return version+1;
 });},
 async changes(id){return db.query('SELECT actor,editor_note,created_at FROM product_change_log WHERE product_id=? ORDER BY created_at DESC LIMIT 20',[id]);},
 async allowReport(nonce){for(const [bucket,limit] of [[digest('product-report-global'),40],[digest('product-report-'+nonce),5]]){await db.query(`INSERT INTO admin_login_limits(bucket,attempts,window_start) VALUES(?,1,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE attempts=IF(window_start<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),1,attempts+1),window_start=IF(window_start<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),UTC_TIMESTAMP(6),window_start)`,[bucket]);if((await db.query('SELECT attempts FROM admin_login_limits WHERE bucket=?',[bucket]))[0].attempts>limit)return false;}return true;},
 async submit(product,submissionKey,data,accountId=null){
  const id=randomUUID();try{await db.query('INSERT INTO product_reports(id,submission_key,product_id,product_name_snapshot,account_id,report_type,message,suggested_url,sender_name,business_name,reply_email) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,submissionKey,product.product_id,product.product_name,accountId,data.type,data.message,data.url,data.name,data.business,data.email]);return id;}catch(e){if(e.code!=='ER_DUP_ENTRY')throw e;const old=(await db.query('SELECT id FROM product_reports WHERE submission_key=?',[submissionKey]))[0];if(!old)throw e;return old.id;}
 },
 async stats(){const ready=await api.ready(),creators=(await db.query('SELECT COUNT(*) AS total FROM people WHERE is_sample=FALSE AND archived_at IS NULL'))[0].total,members=(await db.query('SELECT COUNT(*) AS total FROM member_accounts WHERE archived_at IS NULL'))[0].total,reports=ready?(await db.query("SELECT COUNT(*) AS total FROM product_reports WHERE status IN ('new','reviewing')"))[0].total:0;return {ready,creators:Number(creators),members:Number(members),reports:Number(reports),products:productCatalog().length};},
 async members(q=''){return db.query("SELECT a.id,a.account_number,a.username,a.email,a.status,a.email_verified_at,a.created_at,p.display_name,m.level,m.grant_source,m.status AS membership_status FROM member_accounts a LEFT JOIN member_profiles p ON p.account_id=a.id LEFT JOIN member_memberships m ON m.account_id=a.id WHERE a.archived_at IS NULL AND (a.username LIKE ? OR a.email LIKE ? OR p.display_name LIKE ?) ORDER BY a.created_at DESC LIMIT 200",Array(3).fill('%'+q.replace(/[\\%_]/g,'\\$&')+'%'));},
 async member(id){return (await db.query('SELECT a.id,a.account_number,a.username,a.email,a.status,a.email_verified_at,a.created_at,a.last_login_at,p.display_name,p.country_code,p.state_province,p.biography,m.level,m.grant_source,m.status AS membership_status FROM member_accounts a LEFT JOIN member_profiles p ON p.account_id=a.id LEFT JOIN member_memberships m ON m.account_id=a.id WHERE a.id=? AND a.archived_at IS NULL',[id]))[0]||null;},
 async reports(status='open'){if(!['open','all',...reportStatuses].includes(status))throw new ProductInputError('Choose a queue status.');const where=status==='open'?"status IN ('new','reviewing')":status==='all'?'1=1':'status=?';return db.query(`SELECT id,product_id,product_name_snapshot,report_type,status,business_name,created_at FROM product_reports WHERE ${where} ORDER BY created_at DESC LIMIT 200`,status==='open'||status==='all'?[]:[status]);},
 async report(id){return (await db.query('SELECT id,product_id,product_name_snapshot,account_id,report_type,message,suggested_url,sender_name,business_name,reply_email,status,editor_note,reviewed_by,edit_version,created_at FROM product_reports WHERE id=?',[id]))[0]||null;},
 async events(id){return db.query('SELECT actor,status,editor_note,created_at FROM product_report_events WHERE report_id=? ORDER BY created_at DESC LIMIT 20',[id]);},
 async review(id,version,status,note,actor){if(!reportStatuses.includes(status)||note.length>2000)throw new ProductInputError('Check the status and private note.');return tx(async c=>{const r=(await c.query('SELECT edit_version FROM product_reports WHERE id=? FOR UPDATE',[id]))[0];if(!r||r.edit_version!==version)throw new ProductConflict('Reload this report before saving.');await c.query('UPDATE product_reports SET status=?,editor_note=?,reviewed_by=?,edit_version=edit_version+1 WHERE id=?',[status,note||null,actor,id]);await c.query('INSERT INTO product_report_events(id,report_id,actor,status,editor_note) VALUES(?,?,?,?,?)',[randomUUID(),id,actor,status,note||null]);});}
 };
 return api;
}

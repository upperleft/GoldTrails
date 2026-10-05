import { randomUUID } from 'node:crypto';
import { digest, token } from './admin-auth.js';
export class EditConflict extends Error {}
export function createAdminStore(db, credentialVersion = '') {
 const sessionDigest = raw => digest(raw + '|' + credentialVersion);
 const columns = 'id,slug,display_name,nickname,short_introduction,biography,country_code,state_province,primary_region_id,experience_since_year,offers_instruction,instruction_description,publication_status,verification_status,archived_at,edit_version';
 return {
  async session(raw) { if (!raw) return null; return (await db.query('SELECT csrf_token,authenticated FROM admin_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(6)',[sessionDigest(raw)]))[0] || null; },
  async newSession(authenticated) {
   const raw=token(), csrf=token();
   await db.query('DELETE FROM admin_sessions WHERE expires_at<UTC_TIMESTAMP(6)');
   await db.query('INSERT INTO admin_sessions(token_hash,csrf_token,authenticated,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL ? SECOND))',[sessionDigest(raw),csrf,authenticated ? 1:0,authenticated ? 28800:900]);
   return { raw, csrf_token:csrf, authenticated };
  },
  async logout(raw) { if (raw) await db.query('DELETE FROM admin_sessions WHERE token_hash=?',[sessionDigest(raw)]); },
  async allowLogin() {
   // A shared database counter works across Hostinger's multiple Node processes.
   const bucket=digest('gold-trails-owner-login');
   await db.query(`INSERT INTO admin_login_limits(bucket,attempts,window_start) VALUES(?,1,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE attempts=IF(window_start<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),1,attempts+1), window_start=IF(window_start<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),UTC_TIMESTAMP(6),window_start)`,[bucket]);
   return (await db.query('SELECT attempts FROM admin_login_limits WHERE bucket=?',[bucket]))[0].attempts <= 10;
  },
  async list() { return db.query('SELECT id,display_name,slug,publication_status,archived_at FROM people WHERE is_sample=FALSE ORDER BY display_name LIMIT 500'); },
  async regions() { return db.query("SELECT id,name FROM regions WHERE archived_at IS NULL AND publication_status='published' ORDER BY name"); },
  async get(id) {
   const p=(await db.query(`SELECT ${columns} FROM people WHERE id=? AND is_sample=FALSE`,[id]))[0];
   if (!p) return null;
   p.channels=await db.query('SELECT id,platform,channel_name,canonical_url,description,publication_status FROM channels WHERE person_id=? AND archived_at IS NULL ORDER BY created_at,id',[id]);
   p.sources=await db.query(`SELECT DISTINCT r.title,r.canonical_url FROM person_fact_sources f JOIN source_references s ON s.id=f.source_reference_id JOIN resources r ON r.id=s.resource_id WHERE f.person_id=? AND f.archived_at IS NULL AND s.archived_at IS NULL AND r.archived_at IS NULL`,[id]);
   return p;
  },
  async save(input,actor) {
   const conn=await db.getConnection();
   try {
    await conn.beginTransaction();
    const id=input.id || randomUUID();
    let current;
    if (input.id) {
     current=(await conn.query('SELECT edit_version,archived_at FROM people WHERE id=? AND is_sample=FALSE FOR UPDATE',[id]))[0];
     if (!current || current.edit_version!==input.version || current.archived_at) throw new EditConflict();
    }
    if (input.region) {
     const region=await conn.query("SELECT id FROM regions WHERE id=? AND archived_at IS NULL AND publication_status='published'",[input.region]);
     if (!region.length) throw new Error('Invalid region');
    }
    const values=[input.name,input.slug,input.nickname,input.introduction,input.biography,input.country,input.province,input.region,input.since,input.instruction,input.instructionDescription,input.status];
    if (current) await conn.query(`UPDATE people SET display_name=?,slug=?,nickname=?,short_introduction=?,biography=?,country_code=?,state_province=?,primary_region_id=?,experience_since_year=?,offers_instruction=?,instruction_description=?,publication_status=?,verification_status='unverified',edit_version=edit_version+1 WHERE id=?`,[...values,id]);
    else await conn.query(`INSERT INTO people(display_name,slug,nickname,short_introduction,biography,country_code,state_province,primary_region_id,experience_since_year,offers_instruction,instruction_description,publication_status,id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[...values,id]);
    for (const ch of input.channels) {
     if (ch.id) {
      const rows=await conn.query('SELECT id FROM channels WHERE id=? AND person_id=? AND archived_at IS NULL FOR UPDATE',[ch.id,id]);
      if (!rows.length) throw new EditConflict();
      await conn.query("UPDATE channels SET channel_name=?,canonical_url=?,description=?,publication_status=?,verification_status='unverified',link_status='unchecked' WHERE id=? AND person_id=?",[ch.name,ch.url,ch.description,ch.status,ch.id,id]);
     } else await conn.query('INSERT INTO channels(id,person_id,platform,channel_name,canonical_url,description,publication_status) VALUES(?,?,?,?,?,?,?)',[randomUUID(),id,ch.platform,ch.name,ch.url,ch.description,ch.status]);
    }
    if (input.source) {
     const resource=randomUUID(), reference=randomUUID();
     await conn.query(`INSERT INTO resources(id,slug,title,canonical_url,format_id,publication_status) VALUES(?,?,?,?,'93f46b7c-9b41-586b-ad53-1aa344c7ff6c','published')`,[resource,'creator-source-'+resource,input.sourceTitle,input.source]);
     await conn.query('INSERT INTO source_references(id,resource_id,evidence_note,accessed_at) VALUES(?,?,?,UTC_TIMESTAMP(6))',[reference,resource,input.sourceNote]);
     // Record editorial evidence without automatically certifying every field.
     await conn.query("INSERT INTO person_fact_sources(id,person_id,field_key,source_reference_id,assessment,reviewer_note,reviewed_at) VALUES(?,?,'biography',?,'supports',?,UTC_TIMESTAMP(6))",[randomUUID(),id,reference,input.sourceNote]);
    }
    await conn.query('INSERT INTO creator_change_log(id,person_id,actor,action) VALUES(?,?,?,?)',[randomUUID(),id,actor,current?'save':'create']);
    await conn.commit(); return id;
   } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
  },
  async archive(id,version,restore,actor) {
   const conn=await db.getConnection();
   try {
    await conn.beginTransaction();
    const p=(await conn.query('SELECT edit_version,archived_at FROM people WHERE id=? AND is_sample=FALSE FOR UPDATE',[id]))[0];
    if (!p || p.edit_version!==version || Boolean(p.archived_at)!==restore) throw new EditConflict();
    await conn.query(restore ? "UPDATE people SET archived_at=NULL,publication_status='draft',edit_version=edit_version+1 WHERE id=?" : 'UPDATE people SET archived_at=UTC_TIMESTAMP(6),edit_version=edit_version+1 WHERE id=?',[id]);
    await conn.query('INSERT INTO creator_change_log(id,person_id,actor,action) VALUES(?,?,?,?)',[randomUUID(),id,actor,restore?'restore':'archive']);
    await conn.commit();
   } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }
 };
}

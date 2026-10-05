import { randomUUID } from 'node:crypto';
import { digest, token } from './admin-auth.js';
import { starterTopics, topicChoices } from './creator-taxonomy.js';
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
  async taxonomy() {
   const roles=await db.query('SELECT id,name FROM public_roles WHERE archived_at IS NULL ORDER BY name');
   // Include archived slugs in merging so they cannot be recreated implicitly.
   const topics=await db.query('SELECT id,slug,name,archived_at FROM topics ORDER BY name');
   const associatesEnabled=(await db.query("SELECT version FROM schema_migrations WHERE version='003_creator_associates'")).length>0;
   return {associatesEnabled,roles,topics:topicChoices(topics).filter(t=>!t.archived_at)};
  },
  async get(id) {
   const p=(await db.query(`SELECT ${columns} FROM people WHERE id=? AND is_sample=FALSE`,[id]))[0];
   if (!p) return null;
   p.channels=await db.query('SELECT id,platform,channel_name,canonical_url,description,publication_status,publishing_since_year FROM channels WHERE person_id=? AND archived_at IS NULL ORDER BY created_at,id',[id]);
   p.sources=await db.query(`SELECT DISTINCT r.title,r.canonical_url FROM person_fact_sources f JOIN source_references s ON s.id=f.source_reference_id JOIN resources r ON r.id=s.resource_id WHERE f.person_id=? AND f.archived_at IS NULL AND s.archived_at IS NULL AND r.archived_at IS NULL`,[id]);
   p.roles=await db.query('SELECT v.id FROM person_public_roles a JOIN public_roles v ON v.id=a.role_id WHERE a.person_id=? AND a.archived_at IS NULL AND v.archived_at IS NULL',[id]);
   p.topics=await db.query("SELECT v.id FROM person_topics a JOIN topics v ON v.id=a.topic_id WHERE a.person_id=? AND a.relationship_type='content_topic' AND a.archived_at IS NULL AND v.archived_at IS NULL",[id]);
   if((await db.query("SELECT version FROM schema_migrations WHERE version='003_creator_associates'")).length)p.associates=await db.query('SELECT id,display_name,relationship_type,description,canonical_url,source_url,publication_status,archived_at FROM creator_associates WHERE creator_id=? ORDER BY created_at,id',[id]);
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
    // Validate submitted IDs against public vocabularies before changing records.
    const roles=await conn.query('SELECT id FROM public_roles WHERE archived_at IS NULL FOR UPDATE');
    if(input.roles.some(id=>!roles.some(r=>r.id===id)))throw new EditConflict();
    for(const topicId of input.topics) {
     const seed=starterTopics.find(t=>t.id===topicId);
     if(seed) {
      // Preserve existing rows with the same slug, including archived vocabulary.
      const rows=await conn.query('SELECT id,archived_at FROM topics WHERE id=? OR slug=? FOR UPDATE',[seed.id,seed.slug]);
      if(!rows.length)await conn.query('INSERT INTO topics(id,slug,name,topic_group) VALUES(?,?,?,?)',[seed.id,seed.slug,seed.name,'Prospecting']);
     }
    }
    const topics=await conn.query('SELECT id FROM topics WHERE archived_at IS NULL FOR UPDATE');
    if(input.topics.some(id=>!topics.some(t=>t.id===id)))throw new EditConflict();
    if (input.region) {
     const region=await conn.query("SELECT id FROM regions WHERE id=? AND archived_at IS NULL AND publication_status='published'",[input.region]);
     if (!region.length) throw new Error('Invalid region');
    }
    const values=[input.name,input.slug,input.nickname,input.introduction,input.biography,input.country,input.province,input.region,input.since,input.instruction,input.instructionDescription,input.status];
    if (current) await conn.query(`UPDATE people SET display_name=?,slug=?,nickname=?,short_introduction=?,biography=?,country_code=?,state_province=?,primary_region_id=?,experience_since_year=?,offers_instruction=?,instruction_description=?,publication_status=?,verification_status='unverified',edit_version=edit_version+1 WHERE id=?`,[...values,id]);
    else await conn.query(`INSERT INTO people(display_name,slug,nickname,short_introduction,biography,country_code,state_province,primary_region_id,experience_since_year,offers_instruction,instruction_description,publication_status,id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[...values,id]);
    // Archive deselected links; restoration reuses the original composite key and evidence.
    const oldRoles=await conn.query('SELECT role_id FROM person_public_roles WHERE person_id=? AND archived_at IS NULL',[id]);
    for(const row of oldRoles)if(!input.roles.includes(row.role_id))await conn.query('UPDATE person_public_roles SET archived_at=UTC_TIMESTAMP(6) WHERE person_id=? AND role_id=?',[id,row.role_id]);
    for(const roleId of input.roles)await conn.query('INSERT INTO person_public_roles(person_id,role_id) VALUES(?,?) ON DUPLICATE KEY UPDATE archived_at=NULL',[id,roleId]);
    const oldTopics=await conn.query("SELECT topic_id FROM person_topics WHERE person_id=? AND relationship_type='content_topic' AND archived_at IS NULL",[id]);
    for(const row of oldTopics)if(!input.topics.includes(row.topic_id))await conn.query("UPDATE person_topics SET archived_at=UTC_TIMESTAMP(6) WHERE person_id=? AND topic_id=? AND relationship_type='content_topic'",[id,row.topic_id]);
    for(const topicId of input.topics)await conn.query("INSERT INTO person_topics(person_id,topic_id,relationship_type) VALUES(?,?,'content_topic') ON DUPLICATE KEY UPDATE archived_at=NULL",[id,topicId]);
    for (const ch of input.channels) {
     if (ch.id) {
      const rows=await conn.query('SELECT id FROM channels WHERE id=? AND person_id=? AND archived_at IS NULL FOR UPDATE',[ch.id,id]);
      if (!rows.length) throw new EditConflict();
      await conn.query("UPDATE channels SET channel_name=?,canonical_url=?,description=?,publication_status=?,publishing_since_year=IF(?=1,?,publishing_since_year),verification_status='unverified',link_status='unchecked' WHERE id=? AND person_id=?",[ch.name,ch.url,ch.description,ch.status,ch.publishingSince!==undefined?1:0,ch.publishingSince??null,ch.id,id]);
     } else await conn.query('INSERT INTO channels(id,person_id,platform,channel_name,canonical_url,description,publication_status,publishing_since_year) VALUES(?,?,?,?,?,?,?,?)',[randomUUID(),id,ch.platform,ch.name,ch.url,ch.description,ch.status,ch.publishingSince??null]);
    }
    if(input.associates!==null&&input.associates!==undefined) {
     if(!(await conn.query("SELECT version FROM schema_migrations WHERE version='003_creator_associates'")).length)throw new EditConflict();
     for(const a of input.associates) {
      if(a.id) {
       if(!(await conn.query('SELECT id FROM creator_associates WHERE id=? AND creator_id=? FOR UPDATE',[a.id,id])).length)throw new EditConflict();
       await conn.query('UPDATE creator_associates SET display_name=?,relationship_type=?,description=?,canonical_url=?,source_url=?,publication_status=?,archived_at=IF(?=1,COALESCE(archived_at,UTC_TIMESTAMP(6)),NULL) WHERE id=? AND creator_id=?',[a.name,a.relationship,a.description,a.url,a.source,a.status==='published'?'published':'draft',a.status==='archived'?1:0,a.id,id]);
      } else await conn.query('INSERT INTO creator_associates(id,creator_id,display_name,relationship_type,description,canonical_url,source_url,publication_status) VALUES(?,?,?,?,?,?,?,?)',[randomUUID(),id,a.name,a.relationship,a.description,a.url,a.source,a.status==='published'?'published':'draft']);
     }
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

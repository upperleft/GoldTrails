import { identity } from './creator-research.js';
const publicPerson = "p.publication_status = 'published' AND p.archived_at IS NULL AND p.is_sample = 0";
const like = value => `%${value.replace(/[=%_]/g, char => '=' + char)}%`;

export function searchCriteria(params) {
  const q = (params.get('q') || '').trim();
  const topic = params.get('topic') || '';
  const region = params.get('region') || '';
  const specialty = params.get('specialty') || '';
  const rawPage = params.get('page') || '1';
  if (q.length > 100 || !/^\d{1,5}$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 10000 ||
      [topic, region, specialty].some(value => value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) || topic.length > 160 || region.length > 160 || specialty.length > 160) {
    return null;
  }
  return { q, topic, region, specialty, page: Number(rawPage), pageSize: 20 };
}

export function createDirectoryStore(db) {
  const query = (sql, values = []) => db.query({ sql, timeout: 8000 }, values);
  async function options() {
    const topics = await query('SELECT slug, name FROM topics WHERE archived_at IS NULL ORDER BY name, id');
    const regions = await query("SELECT slug, name FROM regions WHERE publication_status='published' AND archived_at IS NULL ORDER BY name, id");
    const researchEnabled=(await query("SELECT version FROM schema_migrations WHERE version='005_creator_research'")).length>0;
    let specialties=[];
    if(researchEnabled){
      const claims=await query("SELECT DISTINCT field_key,claim_value FROM creator_profile_claims cp JOIN people p ON p.id=cp.person_id WHERE cp.field_key IN ('region','specialty') AND cp.review_state='accepted' AND cp.publication_status='published' AND cp.archived_at IS NULL AND p.publication_status='published' AND p.archived_at IS NULL AND p.is_sample=0 ORDER BY cp.claim_value");
      for(const r of claims){if(r.field_key==='region')regions.push({slug:'coverage-'+identity(r.claim_value).replaceAll('-',''),name:r.claim_value,claimValue:r.claim_value});else specialties.push({slug:r.claim_value,name:r.claim_value.replaceAll('-',' ')});}
    }
    return { topics, regions, specialties, researchEnabled };
  }
  async function search(criteria) {
    const { q, topic, region, specialty, page, pageSize } = criteria;
    const choices=await options();
    let where = publicPerson;
    const values = [];
    if (q) {
      where += ` AND (p.display_name LIKE ? ESCAPE '=' OR p.nickname LIKE ? ESCAPE '='
        OR p.short_introduction LIKE ? ESCAPE '=' OR p.biography LIKE ? ESCAPE '='
        OR p.state_province LIKE ? ESCAPE '=' OR p.country_code LIKE ? ESCAPE '='
        OR EXISTS (SELECT 1 FROM person_aliases a WHERE a.person_id=p.id AND a.archived_at IS NULL AND a.alias LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM person_topics pt JOIN topics t ON t.id=pt.topic_id WHERE pt.person_id=p.id AND pt.archived_at IS NULL AND t.archived_at IS NULL AND t.name LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM person_regions pr JOIN regions r ON r.id=pr.region_id WHERE pr.person_id=p.id AND pr.archived_at IS NULL AND r.archived_at IS NULL AND r.publication_status='published' AND r.name LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM regions r WHERE r.id=p.primary_region_id AND r.archived_at IS NULL AND r.publication_status='published' AND r.name LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM channels c WHERE c.person_id=p.id AND c.archived_at IS NULL AND c.publication_status='published' AND (c.channel_name LIKE ? ESCAPE '=' OR c.handle LIKE ? ESCAPE '=')))`;
      values.push(...Array(12).fill(like(q)));
    }
    if (topic) {
      where += ' AND EXISTS (SELECT 1 FROM person_topics pt JOIN topics t ON t.id=pt.topic_id WHERE pt.person_id=p.id AND pt.archived_at IS NULL AND t.archived_at IS NULL AND t.slug=?)';
      values.push(topic);
    }
    if (specialty) {
      if(!choices.researchEnabled) where += ' AND 1=0';
      else {where += " AND EXISTS (SELECT 1 FROM creator_profile_claims cp WHERE cp.person_id=p.id AND cp.field_key='specialty' AND cp.claim_value=? AND cp.review_state='accepted' AND cp.publication_status='published' AND cp.archived_at IS NULL)";values.push(specialty);}
    }
    const coverage=choices.regions.find(r=>r.slug===region && r.claimValue);
    if (coverage) {where += " AND EXISTS (SELECT 1 FROM creator_profile_claims cp WHERE cp.person_id=p.id AND cp.field_key='region' AND cp.claim_value=? AND cp.review_state='accepted' AND cp.publication_status='published' AND cp.archived_at IS NULL)";values.push(coverage.claimValue);}
    else if (region) {
      where += ` AND (EXISTS (SELECT 1 FROM person_regions pr JOIN regions r ON r.id=pr.region_id WHERE pr.person_id=p.id AND pr.archived_at IS NULL AND r.archived_at IS NULL AND r.publication_status='published' AND r.slug=?)
        OR EXISTS (SELECT 1 FROM regions r WHERE r.id=p.primary_region_id AND r.archived_at IS NULL AND r.publication_status='published' AND r.slug=?))`;
      values.push(region, region);
    }
    const totals = await query(`SELECT COUNT(*) AS total FROM people p WHERE ${where}`, values);
    const total = Number(totals[0].total);
    const people = await query(`SELECT p.slug, p.display_name, p.short_introduction, r.name AS primary_region
      FROM people p LEFT JOIN regions r ON r.id=p.primary_region_id AND r.archived_at IS NULL AND r.publication_status='published'
      WHERE ${where} ORDER BY p.display_name, p.id LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
    return { people, total, ...choices };
  }
  async function profile(slug) {
    const rows = await query(`SELECT p.id, p.slug, p.display_name, p.nickname, p.short_introduction, p.biography,
      p.country_code, p.state_province, p.experience_since_year, p.offers_instruction, p.instruction_description,
      p.verification_status, p.archived_at, r.name AS primary_region, r.slug AS primary_region_slug
      FROM people p LEFT JOIN regions r ON r.id=p.primary_region_id AND r.archived_at IS NULL AND r.publication_status='published'
      WHERE p.slug=? AND p.publication_status='published' AND p.is_sample=0 LIMIT 1`, [slug]);
    if (!rows.length) return null;
    const p = rows[0];
    if (p.archived_at) return { archived: true, display_name: p.display_name };
    const id = p.id;
    const roles = await query('SELECT r.name FROM person_public_roles j JOIN public_roles r ON r.id=j.role_id WHERE j.person_id=? AND j.archived_at IS NULL AND r.archived_at IS NULL ORDER BY r.name', [id]);
    const languages = await query('SELECT l.name FROM person_languages j JOIN languages l ON l.id=j.language_id WHERE j.person_id=? AND j.archived_at IS NULL AND l.archived_at IS NULL ORDER BY l.name', [id]);
    const audience = await query('SELECT a.name FROM person_audience_levels j JOIN audience_levels a ON a.id=j.audience_level_id WHERE j.person_id=? AND j.archived_at IS NULL AND a.archived_at IS NULL ORDER BY a.name', [id]);
    const formats = await query('SELECT f.name FROM person_formats j JOIN formats f ON f.id=j.format_id WHERE j.person_id=? AND j.archived_at IS NULL AND f.archived_at IS NULL ORDER BY f.name', [id]);
    const topics = await query('SELECT t.slug,t.name,j.relationship_type FROM person_topics j JOIN topics t ON t.id=j.topic_id WHERE j.person_id=? AND j.archived_at IS NULL AND t.archived_at IS NULL ORDER BY t.name,j.relationship_type LIMIT 60', [id]);
    const regions = await query("SELECT r.slug,r.name,j.relationship_type FROM person_regions j JOIN regions r ON r.id=j.region_id WHERE j.person_id=? AND j.archived_at IS NULL AND r.archived_at IS NULL AND r.publication_status='published' ORDER BY r.name,j.relationship_type LIMIT 60", [id]);
    const channels = await query("SELECT platform,channel_name,canonical_url,description,publishing_since_year FROM channels WHERE person_id=? AND archived_at IS NULL AND publication_status='published' ORDER BY platform,channel_name,id LIMIT 60", [id]);
    const contacts = await query('SELECT contact_type,public_value FROM public_contacts WHERE person_id=? AND archived_at IS NULL ORDER BY contact_type,id LIMIT 20', [id]);
    const resources = await query(`SELECT r.id,r.title,r.summary,r.canonical_url,f.name AS format
      FROM person_featured_resources j JOIN resources r ON r.id=j.resource_id JOIN formats f ON f.id=r.format_id
      WHERE j.person_id=? AND j.archived_at IS NULL AND r.archived_at IS NULL AND r.publication_status='published' AND f.archived_at IS NULL
      ORDER BY j.position,r.id LIMIT 20`, [id]);
    // Only public resource metadata is exposed, never evidence/reviewer notes or quotations.
    const sources = await query(`SELECT DISTINCT r.id,r.title,r.canonical_url FROM resources r JOIN source_references s ON s.resource_id=r.id
      WHERE r.publication_status='published' AND r.archived_at IS NULL AND s.archived_at IS NULL AND (
        EXISTS (SELECT 1 FROM person_fact_sources f WHERE f.person_id=? AND f.source_reference_id=s.id AND f.archived_at IS NULL)
        OR EXISTS (SELECT 1 FROM channel_fact_sources f JOIN channels c ON c.id=f.channel_id WHERE c.person_id=? AND c.archived_at IS NULL AND c.publication_status='published' AND f.source_reference_id=s.id AND f.archived_at IS NULL))
      ORDER BY r.title,r.id LIMIT 20`, [id, id]);
    const enabled=(await query("SELECT version FROM schema_migrations WHERE version='003_creator_associates'")).length>0;
    const associates=enabled?await query("SELECT a.display_name,a.relationship_type,a.description,a.canonical_url,a.source_url,p.slug AS linked_slug FROM creator_associates a LEFT JOIN people p ON p.id=a.linked_person_id AND p.publication_status='published' AND p.archived_at IS NULL AND p.is_sample=0 WHERE a.creator_id=? AND a.archived_at IS NULL AND a.publication_status='published' ORDER BY a.created_at,a.id LIMIT 30",[id]):[];
    const researchEnabled=(await query("SELECT version FROM schema_migrations WHERE version='005_creator_research'")).length>0;
    const researchClaims=researchEnabled?await query("SELECT field_key,claim_value,source_url,locator,assessment,checked_at,statement_date FROM creator_profile_claims WHERE person_id=? AND review_state='accepted' AND publication_status='published' AND archived_at IS NULL ORDER BY field_key,checked_at DESC,id",[id]):[];
    const waterways=researchEnabled?await query("SELECT w.name,w.state_province,w.country,w.resolution,e.source_url,e.title,e.kind,e.publication_date,e.timestamp_seconds,e.techniques_json,e.public_note,e.location_status,e.inspection_basis,e.visit_key,e.checked_at,e.waterway_key FROM creator_waterway_evidence e JOIN waterways w ON w.identity_key=e.waterway_key WHERE e.person_id=? AND e.archived_at IS NULL AND w.archived_at IS NULL AND e.publication_status='published' ORDER BY w.name,e.publication_date,e.id",[id]):[];
    return { ...p, researchClaims, waterways, associates, roles, languages, audience, formats, topics, regions, channels, contacts, resources, sources };
  }
  async function map() {
    const people=await query(`SELECT p.id,p.slug,p.display_name,p.short_introduction,p.nickname,p.biography,p.state_province,p.country_code FROM people p WHERE ${publicPerson} ORDER BY p.display_name,p.id`);
    const regions=await query(`SELECT p.id AS person_id,r.name,r.slug FROM people p JOIN person_regions pr ON pr.person_id=p.id JOIN regions r ON r.id=pr.region_id WHERE ${publicPerson} AND pr.archived_at IS NULL AND pr.relationship_type='covers' AND r.archived_at IS NULL AND r.publication_status='published' UNION SELECT p.id AS person_id,r.name,r.slug FROM people p JOIN regions r ON r.id=p.primary_region_id WHERE ${publicPerson} AND r.archived_at IS NULL AND r.publication_status='published'`);
    const topics=await query(`SELECT p.id AS person_id,t.name,t.slug,pt.relationship_type FROM people p JOIN person_topics pt ON pt.person_id=p.id JOIN topics t ON t.id=pt.topic_id WHERE ${publicPerson} AND pt.archived_at IS NULL AND t.archived_at IS NULL`);
    const aliases=await query(`SELECT p.id AS person_id,a.alias AS name FROM people p JOIN person_aliases a ON a.person_id=p.id WHERE ${publicPerson} AND a.archived_at IS NULL UNION SELECT p.id AS person_id,CONCAT_WS(' ',c.channel_name,c.handle) AS name FROM people p JOIN channels c ON c.person_id=p.id WHERE ${publicPerson} AND c.archived_at IS NULL AND c.publication_status='published'`);
    for(const p of people)p.search_aliases=aliases.filter(a=>a.person_id===p.id).map(a=>a.name).join(' ');
    const researchEnabled=(await query("SELECT version FROM schema_migrations WHERE version='005_creator_research'")).length>0;
    if(researchEnabled){
      const claims=await query(`SELECT p.id AS person_id,cp.field_key,cp.claim_value FROM creator_profile_claims cp JOIN people p ON p.id=cp.person_id WHERE ${publicPerson} AND cp.field_key IN ('region','specialty') AND cp.review_state='accepted' AND cp.publication_status='published' AND cp.archived_at IS NULL`);
      for(const claim of claims){if(claim.field_key==='region')regions.push({person_id:claim.person_id,name:claim.claim_value,slug:'coverage-'+identity(claim.claim_value).replaceAll('-','')});else topics.push({person_id:claim.person_id,name:claim.claim_value.replaceAll('-',' '),slug:claim.claim_value,is_specialty:true});}
    }
    const excludedSlugs=(await query(`SELECT p.slug FROM people p WHERE NOT (${publicPerson})`)).map(p=>p.slug);
    return {people,regions,topics,excludedSlugs};
  }
  async function catalogAllowed(slug){return (await query('SELECT slug FROM people WHERE slug=? LIMIT 1',[slug])).length===0;}
  async function compassResources(){return query(`SELECT r.id,r.title,r.summary,r.canonical_url,r.publisher_name,f.code AS format FROM resources r JOIN formats f ON f.id=r.format_id WHERE r.publication_status='published' AND r.archived_at IS NULL AND r.verification_status IN ('source_checked','creator_confirmed') AND r.link_status<>'broken' AND f.archived_at IS NULL ORDER BY r.title LIMIT 500`);}
  return { search, profile, map, catalogAllowed, compassResources };
}

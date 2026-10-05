const publicPerson = "p.publication_status = 'published' AND p.archived_at IS NULL AND p.is_sample = 0";
const like = value => `%${value.replace(/[=%_]/g, char => '=' + char)}%`;

export function searchCriteria(params) {
  const q = (params.get('q') || '').trim();
  const topic = params.get('topic') || '';
  const region = params.get('region') || '';
  const rawPage = params.get('page') || '1';
  if (q.length > 100 || !/^\d{1,5}$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 10000 ||
      [topic, region].some(value => value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) || topic.length > 160 || region.length > 160) {
    return null;
  }
  return { q, topic, region, page: Number(rawPage), pageSize: 20 };
}

export function createDirectoryStore(db) {
  const query = (sql, values = []) => db.query({ sql, timeout: 8000 }, values);
  async function options() {
    const topics = await query('SELECT slug, name FROM topics WHERE archived_at IS NULL ORDER BY name, id');
    const regions = await query("SELECT slug, name FROM regions WHERE publication_status='published' AND archived_at IS NULL ORDER BY name, id");
    return { topics, regions };
  }
  async function search(criteria) {
    const { q, topic, region, page, pageSize } = criteria;
    let where = publicPerson;
    const values = [];
    if (q) {
      where += ` AND (p.display_name LIKE ? ESCAPE '=' OR p.nickname LIKE ? ESCAPE '='
        OR EXISTS (SELECT 1 FROM person_aliases a WHERE a.person_id=p.id AND a.archived_at IS NULL AND a.alias LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM person_topics pt JOIN topics t ON t.id=pt.topic_id WHERE pt.person_id=p.id AND pt.archived_at IS NULL AND t.archived_at IS NULL AND t.name LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM person_regions pr JOIN regions r ON r.id=pr.region_id WHERE pr.person_id=p.id AND pr.archived_at IS NULL AND r.archived_at IS NULL AND r.publication_status='published' AND r.name LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM regions r WHERE r.id=p.primary_region_id AND r.archived_at IS NULL AND r.publication_status='published' AND r.name LIKE ? ESCAPE '=')
        OR EXISTS (SELECT 1 FROM channels c WHERE c.person_id=p.id AND c.archived_at IS NULL AND c.publication_status='published' AND (c.channel_name LIKE ? ESCAPE '=' OR c.handle LIKE ? ESCAPE '=')))`;
      values.push(...Array(8).fill(like(q)));
    }
    if (topic) {
      where += ' AND EXISTS (SELECT 1 FROM person_topics pt JOIN topics t ON t.id=pt.topic_id WHERE pt.person_id=p.id AND pt.archived_at IS NULL AND t.archived_at IS NULL AND t.slug=?)';
      values.push(topic);
    }
    if (region) {
      where += ` AND (EXISTS (SELECT 1 FROM person_regions pr JOIN regions r ON r.id=pr.region_id WHERE pr.person_id=p.id AND pr.archived_at IS NULL AND r.archived_at IS NULL AND r.publication_status='published' AND r.slug=?)
        OR EXISTS (SELECT 1 FROM regions r WHERE r.id=p.primary_region_id AND r.archived_at IS NULL AND r.publication_status='published' AND r.slug=?))`;
      values.push(region, region);
    }
    const totals = await query(`SELECT COUNT(*) AS total FROM people p WHERE ${where}`, values);
    const total = Number(totals[0].total);
    const people = await query(`SELECT p.slug, p.display_name, p.short_introduction, r.name AS primary_region
      FROM people p LEFT JOIN regions r ON r.id=p.primary_region_id AND r.archived_at IS NULL AND r.publication_status='published'
      WHERE ${where} ORDER BY p.display_name, p.id LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
    return { people, total, ...await options() };
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
    const resources = await query(`SELECT r.title,r.summary,r.canonical_url,f.name AS format
      FROM person_featured_resources j JOIN resources r ON r.id=j.resource_id JOIN formats f ON f.id=r.format_id
      WHERE j.person_id=? AND j.archived_at IS NULL AND r.archived_at IS NULL AND r.publication_status='published' AND f.archived_at IS NULL
      ORDER BY j.position,r.id LIMIT 20`, [id]);
    // Only public resource metadata is exposed, never evidence/reviewer notes or quotations.
    const sources = await query(`SELECT DISTINCT r.id,r.title,r.canonical_url FROM resources r JOIN source_references s ON s.resource_id=r.id
      WHERE r.publication_status='published' AND r.archived_at IS NULL AND s.archived_at IS NULL AND (
        EXISTS (SELECT 1 FROM person_fact_sources f WHERE f.person_id=? AND f.source_reference_id=s.id AND f.archived_at IS NULL)
        OR EXISTS (SELECT 1 FROM channel_fact_sources f JOIN channels c ON c.id=f.channel_id WHERE c.person_id=? AND c.archived_at IS NULL AND c.publication_status='published' AND f.source_reference_id=s.id AND f.archived_at IS NULL))
      ORDER BY r.title,r.id LIMIT 20`, [id, id]);
    return { ...p, roles, languages, audience, formats, topics, regions, channels, contacts, resources, sources };
  }
  return { search, profile };
}

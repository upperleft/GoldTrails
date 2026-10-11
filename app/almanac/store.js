// Read-only public projection. No membership data, private notes, or copied biographies.
export function createAlmanacStore(db){
 const q=(sql,params=[])=>db.query(sql,params);
 return async state=>{
  const cte=`WITH RECURSIVE state_regions AS (
   SELECT id,name,slug,region_type,description,0 AS depth FROM regions
   WHERE name=? AND country_code='US' AND region_type='state_province' AND publication_status='published' AND archived_at IS NULL
   UNION ALL SELECT r.id,r.name,r.slug,r.region_type,r.description,s.depth+1 FROM regions r JOIN state_regions s ON r.parent_region_id=s.id
   WHERE s.depth<4 AND r.publication_status='published' AND r.archived_at IS NULL AND (r.country_code='US' OR r.country_code IS NULL)
  ) `;
  const publicSource="src.publication_status='published' AND src.archived_at IS NULL AND src.verification_status IN ('source_checked','creator_confirmed') AND src.link_status<>'broken'";
  const people="p.publication_status='published' AND p.archived_at IS NULL AND p.is_sample=0";
  const regions=await q(cte+'SELECT id,name,slug,region_type FROM state_regions WHERE depth>0 ORDER BY name LIMIT 100',[state.name]);
  const creators=await q(cte+`SELECT DISTINCT p.id,p.slug,p.display_name,s.name AS region_name,j.relationship_type,src.canonical_url AS source_url,sr.accessed_at AS checked_at,
   (SELECT canonical_url FROM channels c WHERE c.person_id=p.id AND c.publication_status='published' AND c.archived_at IS NULL ORDER BY c.platform,c.id LIMIT 1) AS channel_url
   FROM people p JOIN person_regions j ON j.person_id=p.id JOIN state_regions s ON s.id=j.region_id
   JOIN source_references sr ON sr.id=j.source_reference_id AND sr.archived_at IS NULL JOIN resources src ON src.id=sr.resource_id
   WHERE ${people} AND j.archived_at IS NULL AND j.relationship_type IN ('covers','teaches_in') AND ${publicSource} ORDER BY p.display_name LIMIT 100`,[state.name]);
  const resources=await q(cte+`SELECT DISTINCT src.id,src.title,src.summary,src.canonical_url,src.publisher_name,src.publication_year,src.last_checked_at,sr.id AS reference_id,sr.section_locator
   FROM resource_regions j JOIN state_regions s ON s.id=j.region_id JOIN resources src ON src.id=j.resource_id
   JOIN source_references sr ON sr.id=j.source_reference_id AND sr.resource_id=src.id AND sr.archived_at IS NULL
   WHERE j.archived_at IS NULL AND ${publicSource} ORDER BY src.title LIMIT 100`,[state.name]);
  const excludedSlugs=(await q(`SELECT p.slug FROM people p WHERE NOT (${people})`)).map(p=>p.slug);
  let waterways=[];
  if((await q("SELECT version FROM schema_migrations WHERE version='005_creator_research'")).length){
   waterways=await q(`SELECT w.identity_key,w.name,w.geographic_context,w.identity_source,w.checked_at,w.state_province,
    e.id AS evidence_id,e.source_url,e.title,e.kind,e.timestamp_seconds,e.inspection_basis,e.public_note,e.publication_date,e.checked_at AS evidence_checked_at,p.slug AS creator_slug,p.display_name AS creator_name
    FROM waterways w JOIN creator_waterway_evidence e ON e.waterway_key=w.identity_key JOIN people p ON p.id=e.person_id
    WHERE w.archived_at IS NULL AND w.resolution='verified' AND w.state_province=? AND w.country IN ('US','USA','United States','United States of America')
    AND e.publication_status='published' AND e.archived_at IS NULL AND e.location_status='explicit' AND ${people}
    ORDER BY w.name,e.publication_date LIMIT 100`,[state.name]);
  }
  return {regions,creators,resources,excludedSlugs,waterways};
 };
}

import {migration,reportNumbers} from './model.js';
export function createAnalyticsStore(db){
 let checked=0,available=false,purged=0;
 const store={
  async ready(){if(Date.now()-checked>30000){available=(await db.query('SELECT version FROM schema_migrations WHERE version=?',[migration])).length===1;checked=Date.now();}return available;},
  async purge(){if(Date.now()-purged>3600000){await db.query('DELETE FROM site_usage_events WHERE created_at<DATE_SUB(UTC_DATE(),INTERVAL 89 DAY)');purged=Date.now();}},
  async record(event){
   await store.purge();
   const usage=await db.query('SELECT COUNT(*) AS total FROM site_usage_events WHERE visitor_hash=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)',[event.visitor]);
   if(Number(usage[0]?.total)>=300)return false;
   const result=await db.query('INSERT IGNORE INTO site_usage_events(event_id,visitor_hash,session_hash,event_type,page_path,target_url,referrer_host,device_class) VALUES(?,?,?,?,?,?,?,?)',[event.id,event.visitor,event.session,event.type,event.page,event.target,event.referrer,event.device]);
   return Number(result.affectedRows)>0;
  },
  async report(range){
   await store.purge();const values=[range.from,range.until],where='created_at>=? AND created_at<?';
   const queries=[
    db.query(`SELECT COUNT(CASE WHEN event_type='pageview' THEN 1 END) AS views,COUNT(DISTINCT CASE WHEN event_type='pageview' THEN visitor_hash END) AS visitors,COUNT(DISTINCT CASE WHEN event_type='pageview' THEN session_hash END) AS sessions,COUNT(CASE WHEN event_type='outbound' THEN 1 END) AS clicks FROM site_usage_events WHERE ${where}`,values),
    db.query(`SELECT COUNT(DISTINCT c.session_hash) AS total FROM site_usage_events c WHERE c.event_type='outbound' AND c.${where} AND EXISTS(SELECT 1 FROM site_usage_events v WHERE v.event_type='pageview' AND v.session_hash=c.session_hash AND v.${where})`,[...values,...values]),
    db.query(`SELECT COUNT(DISTINCT v.visitor_hash) AS total FROM site_usage_events v WHERE v.event_type='pageview' AND v.${where} AND EXISTS(SELECT 1 FROM site_usage_events old WHERE old.visitor_hash=v.visitor_hash AND old.created_at<?)`,[...values,range.from]),
    db.query(`SELECT page_path AS page,COUNT(CASE WHEN event_type='pageview' THEN 1 END) AS views,COUNT(DISTINCT CASE WHEN event_type='pageview' THEN visitor_hash END) AS visitors,COUNT(CASE WHEN event_type='outbound' THEN 1 END) AS clicks FROM site_usage_events WHERE ${where} GROUP BY page_path ORDER BY views DESC,page_path LIMIT 100`,values),
    db.query(`SELECT target_url AS target,COUNT(*) AS clicks,COUNT(DISTINCT visitor_hash) AS visitors FROM site_usage_events WHERE ${where} AND event_type='outbound' GROUP BY target_url ORDER BY clicks DESC,target_url LIMIT 100`,values),
    db.query(`SELECT referrer_host AS referrer,COUNT(*) AS views,COUNT(DISTINCT session_hash) AS sessions FROM site_usage_events WHERE ${where} AND event_type='pageview' GROUP BY referrer_host ORDER BY sessions DESC,referrer_host LIMIT 50`,values),
    db.query(`SELECT device_class AS device,COUNT(*) AS views FROM site_usage_events WHERE ${where} AND event_type='pageview' GROUP BY device_class ORDER BY views DESC`,values),
    db.query(`SELECT DATE_FORMAT(created_at,'%Y-%m-%d') AS date,COUNT(CASE WHEN event_type='pageview' THEN 1 END) AS views,COUNT(DISTINCT CASE WHEN event_type='pageview' THEN visitor_hash END) AS visitors,COUNT(CASE WHEN event_type='outbound' THEN 1 END) AS clicks FROM site_usage_events WHERE ${where} GROUP BY DATE_FORMAT(created_at,'%Y-%m-%d') ORDER BY date`,values),
    db.query('SELECT MIN(created_at) AS earliest FROM site_usage_events'),
   ];
   const [totals,clicked,returning,pages,destinations,referrals,devices,days,earliest]=await Promise.all(queries);
   return {...reportNumbers(totals[0]),clickSessions:Number(clicked[0]?.total||0),returning:Number(returning[0]?.total||0),pages:pages.map(reportNumbers),destinations:destinations.map(reportNumbers),referrals:referrals.map(reportNumbers),devices:devices.map(reportNumbers),days:days.map(reportNumbers),earliest:earliest[0]?.earliest||null};
  },
 };
 return store;
}

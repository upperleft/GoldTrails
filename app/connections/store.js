import {randomUUID} from 'node:crypto';
import {ConnectionsError,occurrenceInputs,publicEvent} from './model.js';
import {coverageStates} from './geography.js';
const sqlTime=value=>value?new Date(value).toISOString().slice(0,23).replace('T',' '):null;
const iso=value=>value?(value instanceof Date?value.toISOString():String(value).replace(' ','T').replace(/Z?$/,'Z')):null;
const json=value=>typeof value==='string'?JSON.parse(value):value;
const missing=()=>new ConnectionsError('That event or item is unavailable.',404);
const stale=()=>new ConnectionsError('This event changed. Reload before saving.',409);
const baseSelect=`SELECT e.*,COALESCE(p.display_name,a.username) AS organizer_name,
 (SELECT COUNT(*) FROM connection_rsvps r WHERE r.event_id=e.id AND r.status='yes') AS yes_count,
 (SELECT COUNT(*) FROM connection_rsvps r WHERE r.event_id=e.id AND r.status='waitlisted') AS waitlist_count,
 (SELECT id FROM connection_photos ph WHERE ph.event_id=e.id AND ph.kind='cover' AND ph.hidden=0 ORDER BY ph.created_at DESC LIMIT 1) AS image_id,
 (SELECT caption FROM connection_photos ph WHERE ph.event_id=e.id AND ph.kind='cover' AND ph.hidden=0 ORDER BY ph.created_at DESC LIMIT 1) AS image_caption
 FROM connection_events e JOIN member_accounts a ON a.id=e.organizer_id LEFT JOIN member_profiles p ON p.account_id=a.id`;
export function eventFromRow(row){if(!row)return null;return {...json(row.details_json),id:row.id,organizerId:row.organizer_id,organizerName:row.organizer_name,state:row.state_code,title:row.title,status:row.status,visibility:row.visibility,mode:row.mode,category:row.category,level:row.experience_level,startUtc:iso(row.start_utc),endUtc:iso(row.end_utc),deadlineUtc:iso(row.deadline_utc),capacity:row.capacity==null?null:Number(row.capacity),waitlist:Boolean(row.waitlist_enabled),revision:Number(row.revision),moderated:Boolean(row.moderated),meetingCipher:row.meeting_cipher,yesCount:Number(row.yes_count||0),waitlistCount:Number(row.waitlist_count||0),imageId:row.image_id||null,imageCaption:row.image_caption||null,seriesId:row.series_id};}
export function allocateRsvp(event,current,yesCount,now=Date.now()){
 if(event.status!=='published'||Date.parse(event.startUtc)<=now||event.deadlineUtc&&Date.parse(event.deadlineUtc)<=now)throw new ConnectionsError('RSVPs are closed for this event.',409);
 if(current&&['yes','waitlisted'].includes(current.status))return current.status;
 if(event.capacity==null||yesCount<event.capacity)return 'yes';
 if(event.waitlist)return 'waitlisted';
 throw new ConnectionsError('This event is full.',409);
}
export function createConnectionsStore(db,{vault,billingProvider='stripe'}={}){
 if(!['stripe','stripe_test'].includes(billingProvider))throw Error('Invalid billing provider');
 const tx=async fn=>{const c=await db.getConnection();try{await c.beginTransaction();const value=await fn(c);await c.commit();return value;}catch(e){await c.rollback();throw e;}finally{c.release();}};
 const audit=(c,account,event,action)=>c.query('INSERT INTO connection_audit(id,account_id,event_id,action) VALUES(?,?,?,?)',[randomUUID(),account,event,action]);
 const get=async(c,id)=>eventFromRow((await c.query(baseSelect+' WHERE e.id=?',[id]))[0]);
 const lock=async(c,id)=>{const row=(await c.query('SELECT id,organizer_id,revision FROM connection_events WHERE id=? FOR UPDATE',[id]))[0];if(!row)throw missing();return row;};
 const own=async(c,account,id,revision)=>{const row=await lock(c,id);if(row.organizer_id!==account)throw missing();if(revision!=null&&Number(row.revision)!==revision)throw stale();return get(c,id);};
 const eventValues=(event,cipher)=>[event.state,event.title,event.status,event.visibility,event.mode,event.category,event.level,sqlTime(event.startUtc),sqlTime(event.endUtc),sqlTime(event.deadlineUtc),event.capacity,event.waitlist?1:0,JSON.stringify(Object.fromEntries(Object.entries(event).filter(([k])=>!['meeting','meetingCipher','id','organizerId','organizerName','revision','seriesId','yesCount','waitlistCount','imageId'].includes(k)))),cipher];
 const queue=(c,event,account,kind,revision=event.revision,due=null)=>c.query('INSERT IGNORE INTO connection_notifications(id,event_id,account_id,kind,event_revision,due_at) VALUES(?,?,?,?,?,?)',[randomUUID(),event.id,account,kind,kind==='new_event'?0:revision,sqlTime(due||new Date())]);
 // Eligibility is rechecked before delivery; complimentary access follows the same existing Plus rule.
 const eligible=`a.status='active' AND a.email_verified_at IS NOT NULL AND a.archived_at IS NULL AND m.level='subscriber' AND m.status='active' AND m.starts_at<=UTC_TIMESTAMP(6) AND (m.ends_at IS NULL OR m.ends_at>UTC_TIMESTAMP(6)) AND ((m.grant_source='complimentary' AND m.granted_by IS NOT NULL) OR (m.grant_source='payment' AND EXISTS(SELECT 1 FROM member_subscriptions s WHERE s.id=m.subscription_id AND s.account_id=a.id AND s.provider='${billingProvider}' AND s.status IN('active','trialing') AND s.current_period_start<=UTC_TIMESTAMP(6) AND s.current_period_end>UTC_TIMESTAMP(6))))`;
 const activeAccount=async(c,account)=>Boolean((await c.query(`SELECT a.id FROM member_accounts a JOIN member_memberships m ON m.account_id=a.id WHERE a.id=? AND ${eligible}`,[account])).length);
 const notifyFollowers=async(c,event)=>{const codes=coverageStates(event.state,event.notificationRange).map(s=>s.code);await c.query(`INSERT IGNORE INTO connection_notifications(id,event_id,account_id,kind,event_revision,due_at) SELECT UUID(),?,f.account_id,'new_event',0,UTC_TIMESTAMP(6) FROM connection_follows f JOIN connection_preferences p ON p.account_id=f.account_id WHERE f.state_code IN(${codes.map(()=>'?').join(',')}) AND p.new_events=1 GROUP BY f.account_id`,[event.id,...codes]);};
 const notifyAttendees=async(c,event,kind,revision=event.revision)=>{await c.query(`INSERT IGNORE INTO connection_notifications(id,event_id,account_id,kind,event_revision,due_at) SELECT UUID(),?,r.account_id,?,?,UTC_TIMESTAMP(6) FROM connection_rsvps r WHERE r.event_id=? AND r.status IN('yes','waitlisted')`,[event.id,kind,revision,event.id]);};
 const promote=async(c,event)=>{
  if(event.status!=='published'||Date.parse(event.startUtc)<=Date.now()||event.deadlineUtc&&Date.parse(event.deadlineUtc)<=Date.now())return;
  const count=Number((await c.query("SELECT COUNT(*) AS n FROM connection_rsvps WHERE event_id=? AND status='yes'",[event.id]))[0].n);
  const spaces=event.capacity==null?10000:Math.max(0,event.capacity-count);if(!spaces)return;
  const candidates=await c.query(`SELECT r.account_id FROM connection_rsvps r JOIN member_accounts a ON a.id=r.account_id JOIN member_memberships m ON m.account_id=a.id WHERE r.event_id=? AND r.status='waitlisted' AND ${eligible} ORDER BY r.joined_at,r.account_id LIMIT ? FOR UPDATE`,[event.id,spaces]);
  for(const row of candidates){await c.query("UPDATE connection_rsvps SET status='yes' WHERE event_id=? AND account_id=? AND status='waitlisted'",[event.id,row.account_id]);await queue(c,event,row.account_id,'promotion');}
 };
 const store={
  async siteReports(){return db.query("SELECT r.id,r.event_id,r.target_type,r.target_id,r.reason,e.title FROM connection_reports r JOIN connection_events e ON e.id=r.event_id WHERE r.status='open' ORDER BY r.created_at LIMIT 200");},
  async ownerModerate(id,type,target,action,report){return tx(async c=>{await lock(c,id);if(action==='hide'){
   if(type==='event'){if(id!==target)throw missing();await c.query("UPDATE connection_events SET moderated=1,status='cancelled',revision=revision+1 WHERE id=?",[id]);await notifyAttendees(c,await get(c,id),'cancellation');}
   else{const table=type==='comment'?'connection_comments':'connection_photos';await c.query('UPDATE '+table+' SET hidden=1 WHERE id=? AND event_id=?',[target,id]);}
  }if(report)await c.query("UPDATE connection_reports SET status='resolved' WHERE id=? AND event_id=? AND target_id=?",[report,id,target]);await audit(c,null,id,'owner_moderate_'+action);});},
  ready:async()=>Boolean((await db.query("SELECT version FROM schema_migrations WHERE version='013_gold_connections'")).length),
  async allowWrite(account){await db.query('INSERT INTO connection_limits(account_id,attempts) VALUES(?,1) ON DUPLICATE KEY UPDATE attempts=IF(window_started<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),1,attempts+1),window_started=IF(window_started<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),UTC_TIMESTAMP(6),window_started)',[account]);return Number((await db.query('SELECT attempts FROM connection_limits WHERE account_id=?',[account]))[0].attempts)<=60;},
  async list(filters={},member=null){
   const where=["e.moderated=0","e.status IN('published','cancelled')",filters.period==='past'?'e.end_utc<UTC_TIMESTAMP(6)':'e.end_utc>=UTC_TIMESTAMP(6)'],values=[];
   if(member?.effective_level!=='subscriber')where.push("e.visibility='public'");
   if(filters.state){const codes=coverageStates(filters.state,filters.range||0).map(s=>s.code);where.push(`e.state_code IN(${codes.map(()=>'?').join(',')})`);values.push(...codes);}
   if(filters.q){where.push("(e.title LIKE ? ESCAPE '=' OR JSON_UNQUOTE(JSON_EXTRACT(e.details_json,'$.description')) LIKE ? ESCAPE '=')");const q='%'+filters.q.replace(/[=%_]/g,'=$&')+'%';values.push(q,q);}
   for(const [field,column]of [['category','category'],['level','experience_level']])if(filters[field]){where.push('e.'+column+'=?');values.push(filters[field]);}
   if(filters.mode){where.push(filters.mode==='hybrid'?"e.mode='hybrid'":filters.mode==='online'?"e.mode IN('online','hybrid')":"e.mode IN('in-person','hybrid')");}
   if(filters.from){where.push('e.start_utc>=?');values.push(filters.from+' 00:00:00');}if(filters.to){where.push('e.start_utc<DATE_ADD(?,INTERVAL 1 DAY)');values.push(filters.to+' 00:00:00');}
   if(filters.spaces)where.push("e.status='published' AND (e.capacity IS NULL OR e.capacity>(SELECT COUNT(*) FROM connection_rsvps r WHERE r.event_id=e.id AND r.status='yes'))");
   const rows=await db.query(baseSelect+' WHERE '+where.join(' AND ')+` ORDER BY e.start_utc ${filters.period==='past'?'DESC':'ASC'},e.id LIMIT 25 OFFSET ?`,[...values,((filters.page||1)-1)*24]);
   return {events:rows.slice(0,24).map(eventFromRow).map(publicEvent),hasMore:rows.length>24};
  },
  get:async id=>get(db,id),
  async create(account,event){return tx(async c=>{
   await c.query('SELECT id FROM member_accounts WHERE id=? FOR UPDATE',[account]);
   if(!await activeAccount(c,account))throw new ConnectionsError('Gold Trails Plus is required.',403);
   if(Number((await c.query('SELECT COUNT(*) AS n FROM connection_events WHERE organizer_id=? AND end_utc>UTC_TIMESTAMP(6)',[account]))[0].n)+event.occurrences>200)throw new ConnectionsError('You can organize up to 200 upcoming events.',429);
   const occurrences=occurrenceInputs(event),series=occurrences.length>1?randomUUID():null,ids=[];
   for(const next of occurrences){const id=randomUUID(),cipher=vault.seal(next.meeting);await c.query('INSERT INTO connection_events(id,organizer_id,state_code,title,status,visibility,mode,category,experience_level,start_utc,end_utc,deadline_utc,capacity,waitlist_enabled,details_json,meeting_cipher,series_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,account,...eventValues(next,cipher),series]);const saved={...next,id,revision:1};if(saved.status==='published')await notifyFollowers(c,saved);await audit(c,account,id,'create');ids.push(id);}
   return ids;
  });},
  async update(account,id,event,revision){return tx(async c=>{
   const before=await own(c,account,id,revision);if(!await activeAccount(c,account))throw new ConnectionsError('Gold Trails Plus is required to edit events.',403);
   if(before.moderated)throw new ConnectionsError('This event is under moderation. Contact Gold Trails before editing.',409);
   if(before.status==='cancelled')throw new ConnectionsError('Duplicate a cancelled event to organize it again.',409);
   if(before.status==='published'&&event.status==='draft')throw new ConnectionsError('Cancel a published event instead of reverting it to draft.',409);
   if(event.capacity!==null&&event.capacity<before.yesCount)throw new ConnectionsError('Capacity cannot be below the confirmed RSVP count.',409);
   if(event.occurrences>1)throw new ConnectionsError('Edit one occurrence at a time. Create a new series from Duplicate.');
   if(before.status==='published'&&(event.visibility!==before.visibility||event.state!==before.state))throw new ConnectionsError('A published event keeps its host state and visibility. Duplicate it to change those.',409);
   await c.query('UPDATE connection_events SET state_code=?,title=?,status=?,visibility=?,mode=?,category=?,experience_level=?,start_utc=?,end_utc=?,deadline_utc=?,capacity=?,waitlist_enabled=?,details_json=?,meeting_cipher=?,revision=revision+1 WHERE id=? AND organizer_id=?',[...eventValues(event,vault.seal(event.meeting)),id,account]);
   const saved={...event,id,revision:revision+1};
   if(before.status==='draft'&&event.status==='published')await notifyFollowers(c,saved);else if(event.status==='published')await notifyAttendees(c,saved,'update');
   await promote(c,saved);await audit(c,account,id,'edit');return id;
  });},
  async cancel(account,id,revision){return tx(async c=>{const event=await own(c,account,id,revision);if(event.status==='cancelled')return;await c.query("UPDATE connection_events SET status='cancelled',revision=revision+1 WHERE id=?",[id]);await notifyAttendees(c,{...event,revision:revision+1},'cancellation');await audit(c,account,id,'cancel');});},
  async rsvp(account,id,action){return tx(async c=>{
   await lock(c,id);const event=await get(c,id),current=(await c.query('SELECT status,attended FROM connection_rsvps WHERE event_id=? AND account_id=? FOR UPDATE',[id,account]))[0];
   if(action==='cancel'){if(current&&current.status!=='cancelled'){await c.query("UPDATE connection_rsvps SET status='cancelled',attended=0 WHERE event_id=? AND account_id=?",[id,account]);await promote(c,event);await audit(c,account,id,'rsvp_cancel');}return 'cancelled';}
   if(!await activeAccount(c,account))throw new ConnectionsError('Gold Trails Plus is required to RSVP.',403);
   const status=allocateRsvp(event,current,event.yesCount);
   if(current?.status===status)return status;
   await c.query('INSERT INTO connection_rsvps(event_id,account_id,status) VALUES(?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),attended=0,joined_at=UTC_TIMESTAMP(6)',[id,account,status]);
   await queue(c,event,account,'rsvp',Math.floor(current?Date.now()/1000:1));await audit(c,account,id,'rsvp_'+status);return status;
  });},
  async participation(account,id){return(await db.query('SELECT status,attended FROM connection_rsvps WHERE event_id=? AND account_id=?',[id,account]))[0]||null;},
  async mine(account){const rows=await db.query(baseSelect+" WHERE e.organizer_id=? OR EXISTS(SELECT 1 FROM connection_rsvps r WHERE r.event_id=e.id AND r.account_id=? AND r.status IN('yes','waitlisted')) ORDER BY e.start_utc LIMIT 300",[account,account]);const rsvps=await db.query('SELECT event_id,status,attended FROM connection_rsvps WHERE account_id=?',[account]);return rows.map(row=>{const e=eventFromRow(row),r=rsvps.find(r=>r.event_id===e.id);return {...publicEvent(e),organizing:e.organizerId===account,rsvp:r?.status||null,attended:Boolean(r?.attended)};});},
  async attendees(account,id){return tx(async c=>{await own(c,account,id);return c.query("SELECT r.account_id,r.status,r.attended,COALESCE(p.display_name,a.username) AS name FROM connection_rsvps r JOIN member_accounts a ON a.id=r.account_id LEFT JOIN member_profiles p ON p.account_id=a.id WHERE r.event_id=? AND r.status IN('yes','waitlisted') ORDER BY r.joined_at,r.account_id LIMIT 10000",[id]);});},
  async preferences(account){const prefs=(await db.query('SELECT new_events,updates,reminders,rsvp FROM connection_preferences WHERE account_id=?',[account]))[0]||{};return {states:(await db.query('SELECT state_code FROM connection_follows WHERE account_id=? ORDER BY state_code',[account])).map(r=>r.state_code),...Object.fromEntries(['new_events','updates','reminders','rsvp'].map(k=>[k,Boolean(prefs[k])]))};},
  async savePreferences(account,prefs){return tx(async c=>{await c.query('SELECT id FROM member_accounts WHERE id=? FOR UPDATE',[account]);await c.query('INSERT INTO connection_preferences(account_id,new_events,updates,reminders,rsvp) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE new_events=VALUES(new_events),updates=VALUES(updates),reminders=VALUES(reminders),rsvp=VALUES(rsvp)',[account,...['new_events','updates','reminders','rsvp'].map(k=>prefs[k]?1:0)]);await c.query('DELETE FROM connection_follows WHERE account_id=?',[account]);for(const state of prefs.states)await c.query('INSERT INTO connection_follows(account_id,state_code) VALUES(?,?)',[account,state]);await audit(c,account,null,'preferences');});},
  async unsubscribe(account){await db.query('UPDATE connection_preferences SET new_events=0,updates=0,reminders=0,rsvp=0 WHERE account_id=?',[account]);},
  async comments(id,viewer){return (await db.query(`SELECT c.id,c.author_id,c.kind,c.body,c.revision,c.created_at,COALESCE(p.display_name,a.username) AS author_name,e.organizer_id,COALESCE(r.attended,0) AS attended FROM connection_comments c JOIN connection_events e ON e.id=c.event_id JOIN member_accounts a ON a.id=c.author_id LEFT JOIN member_profiles p ON p.account_id=a.id LEFT JOIN connection_rsvps r ON r.event_id=c.event_id AND r.account_id=c.author_id WHERE c.event_id=? AND c.hidden=0 AND c.deleted=0 ORDER BY c.created_at,c.id LIMIT 300`,[id])).map(r=>({id:r.id,kind:r.kind,body:r.body,revision:Number(r.revision),authorName:r.author_name,attended:Boolean(r.attended),organizer:r.author_id===r.organizer_id,canEdit:r.author_id===viewer}));},
  async comment(account,id,body,kind){return tx(async c=>{
   await lock(c,id);const e=await get(c,id);if(e.status!=='published')throw new ConnectionsError('Discussion is closed for this event.',409);
   if(!await activeAccount(c,account))throw new ConnectionsError('Gold Trails Plus is required.',403);
   if(kind!=='comment'&&e.organizerId!==account)throw missing();
   const r=(await c.query('SELECT status FROM connection_rsvps WHERE event_id=? AND account_id=?',[id,account]))[0];
   if(Date.parse(e.endUtc)<Date.now()&&e.organizerId!==account&&r?.status!=='yes')throw new ConnectionsError('Post-event comments are for confirmed participants.',403);
   if(kind==='recap'&&Date.parse(e.endUtc)>=Date.now())throw new ConnectionsError('Post a recap after the event.');
   if(Number((await c.query('SELECT COUNT(*) AS n FROM connection_comments WHERE event_id=? AND deleted=0',[id]))[0].n)>=300)throw new ConnectionsError('This discussion has reached its posting limit.',429);
   await c.query('INSERT INTO connection_comments(id,event_id,author_id,kind,body) VALUES(?,?,?,?,?)',[randomUUID(),id,account,kind,body]);
   if(kind==='announcement'){await c.query('UPDATE connection_events SET revision=revision+1 WHERE id=?',[id]);await notifyAttendees(c,{...e,revision:e.revision+1},'announcement');}
   await audit(c,account,id,'comment_'+kind);
  });},
  async editComment(account,event,id,body,revision,remove){return tx(async c=>{await lock(c,event);const row=(await c.query('SELECT author_id,revision FROM connection_comments WHERE id=? AND event_id=? AND deleted=0 FOR UPDATE',[id,event]))[0];if(row?.author_id!==account)throw missing();if(Number(row.revision)!==revision)throw stale();await c.query('UPDATE connection_comments SET body=?,deleted=?,revision=revision+1 WHERE id=? AND event_id=? AND author_id=?',[remove?'':body,remove?1:0,id,event,account]);await audit(c,account,event,remove?'comment_delete':'comment_edit');});},
  async attendance(account,id,attendee,attended){return tx(async c=>{const e=await own(c,account,id);if(Date.parse(e.endUtc)>=Date.now())throw new ConnectionsError('Confirm attendance after the event.',409);const result=await c.query("UPDATE connection_rsvps SET attended=? WHERE event_id=? AND account_id=? AND status='yes'",[attended?1:0,id,attendee]);if(!result.affectedRows)throw missing();await audit(c,account,id,'attendance');});},
  async removeAttendee(account,id,attendee){return tx(async c=>{const e=await own(c,account,id);await c.query("UPDATE connection_rsvps SET status='cancelled',attended=0 WHERE event_id=? AND account_id=?",[id,attendee]);await queue(c,e,attendee,'update',e.revision);await promote(c,e);await audit(c,account,id,'remove_rsvp');});},
  async photos(id,viewer){return(await db.query(`SELECT ph.id,ph.author_id,ph.caption,COALESCE(p.display_name,a.username) AS author_name,e.organizer_id FROM connection_photos ph JOIN member_accounts a ON a.id=ph.author_id LEFT JOIN member_profiles p ON p.account_id=a.id JOIN connection_events e ON e.id=ph.event_id WHERE ph.event_id=? AND ph.kind='experience' AND ph.hidden=0 ORDER BY ph.created_at LIMIT 100`,[id])).map(p=>({id:p.id,caption:p.caption,authorName:p.author_name,canDelete:p.author_id===viewer||p.organizer_id===viewer}));},
  async photo(id){const p=(await db.query('SELECT event_id,content FROM connection_photos WHERE id=? AND hidden=0',[id]))[0];return p?{eventId:p.event_id,content:p.content}:null;},
  async addPhoto(account,id,kind,caption,content){return tx(async c=>{await lock(c,id);const e=await get(c,id);if(e.status!=='published'&&e.status!=='draft')throw new ConnectionsError('Photos are closed.',409);
   if(!await activeAccount(c,account))throw new ConnectionsError('Gold Trails Plus is required.',403);
   const storage=(await c.query('SELECT bytes_used FROM connection_storage WHERE id=1 FOR UPDATE'))[0];const used=Number((await c.query('SELECT COALESCE(SUM(OCTET_LENGTH(content)),0) AS n FROM connection_photos WHERE author_id=?',[account]))[0].n);if(!storage||Number(storage.bytes_used)+content.length>500*1024*1024||used+content.length>30*1024*1024)throw new ConnectionsError('Photo storage limit reached. Contact Gold Trails for help.',429);
   if(kind==='cover'){if(e.organizerId!==account)throw missing();await c.query("UPDATE connection_photos SET hidden=1 WHERE event_id=? AND kind='cover'",[id]);}
   else{const r=(await c.query('SELECT status FROM connection_rsvps WHERE event_id=? AND account_id=?',[id,account]))[0];if(e.organizerId!==account&&r?.status!=='yes'||Date.parse(e.endUtc)>=Date.now())throw new ConnectionsError('Share photos after attending the event.',403);}
   const counts=await c.query('SELECT COUNT(*) AS n,SUM(author_id=?) AS mine FROM connection_photos WHERE event_id=?',[account,id]);if(Number(counts[0].n)>=100||Number(counts[0].mine)>=10)throw new ConnectionsError('Photo limit reached: 10 per member and 100 per event.',429);
   const photo=randomUUID();await c.query('INSERT INTO connection_photos(id,event_id,author_id,kind,caption,content) VALUES(?,?,?,?,?,?)',[photo,id,account,kind,caption,content]);await c.query('UPDATE connection_storage SET bytes_used=bytes_used+? WHERE id=1',[content.length]);await audit(c,account,id,'photo_add');return photo;
  });},
  async deletePhoto(account,id,photo){return tx(async c=>{await lock(c,id);const e=await get(c,id),p=(await c.query('SELECT author_id FROM connection_photos WHERE id=? AND event_id=?',[photo,id]))[0];if(!p||p.author_id!==account&&e.organizerId!==account)throw missing();await c.query('UPDATE connection_photos SET hidden=1 WHERE id=? AND event_id=?',[photo,id]);await audit(c,account,id,'photo_remove');});},
  async report(account,id,type,target,reason){return tx(async c=>{await lock(c,id);if(type==='event'&&target!==id)throw missing();const table=type==='comment'?'connection_comments':type==='photo'?'connection_photos':null;if(table&&!(await c.query(`SELECT id FROM ${table} WHERE id=? AND event_id=?`,[target,id])).length)throw missing();const old=await c.query("SELECT id FROM connection_reports WHERE event_id=? AND reporter_id=? AND target_id=? AND status='open'",[id,account,target]);if(!old.length)await c.query('INSERT INTO connection_reports(id,event_id,reporter_id,target_type,target_id,reason) VALUES(?,?,?,?,?,?)',[randomUUID(),id,account,type,target,reason]);await audit(c,account,id,'report');});},
  async reports(account,id){return tx(async c=>{await own(c,account,id);return c.query("SELECT id,target_type,target_id,reason FROM connection_reports WHERE event_id=? AND status='open' ORDER BY created_at LIMIT 100",[id]);});},
  async moderate(account,id,type,target,action,report){return tx(async c=>{await own(c,account,id);if(action==='hide'){
   if(type==='event'){if(id!==target)throw missing();await c.query("UPDATE connection_events SET status='cancelled',revision=revision+1 WHERE id=?",[id]);await notifyAttendees(c,await get(c,id),'cancellation');}
   else{const table=type==='comment'?'connection_comments':'connection_photos';await c.query(`UPDATE ${table} SET hidden=1 WHERE id=? AND event_id=?`,[target,id]);}
   }if(report)await c.query("UPDATE connection_reports SET status='resolved' WHERE id=? AND event_id=? AND target_id=?",[report,id,target]);await audit(c,account,id,'moderate_'+action);
  });},
  async copyToCalendar(account,id){return tx(async c=>{
   // Match the private calendar's account-first lock order to avoid deadlocks.
   await c.query('SELECT id FROM member_accounts WHERE id=? FOR UPDATE',[account]);const e=await get(c,id);if(!e||e.status==='draft'&&e.organizerId!==account)throw missing();
   const existing=await c.query('SELECT calendar_event_id FROM connection_calendar_copies WHERE account_id=? AND event_id=?',[account,id]);if(existing.length){const present=await c.query('SELECT e.id FROM calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=? AND e.id=?',[account,existing[0].calendar_event_id]);if(present.length)return existing[0].calendar_event_id;await c.query('DELETE FROM connection_calendar_copies WHERE account_id=? AND event_id=?',[account,id]);}
   let calendar=(await c.query('SELECT id FROM calendar_calendars WHERE owner_id=? ORDER BY created_at,id LIMIT 1',[account]))[0];
   if(!calendar){calendar={id:randomUUID()};await c.query('INSERT INTO calendar_calendars(id,owner_id,name,color) VALUES(?,?,?,?)',[calendar.id,account,'Gold Connections','#a67920']);}
   const count=await c.query('SELECT COUNT(*) AS n FROM calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=?',[account]);if(Number(count[0].n)>=10000)throw new ConnectionsError('Your private calendar is full.',429);
   const copy=randomUUID();await c.query('INSERT INTO calendar_events(id,calendar_id,title,description,location,start_local,end_local,time_zone,all_day,start_utc,end_utc) VALUES(?,?,?,?,?,?,?,?,0,?,?)',[copy,calendar.id,e.title,'Gold Connections: https://goldtrails.org/connections/events/'+id+'/\nThis is a saved copy. Check the event page for changes and cancellations.',[e.locationName,e.city,e.state].filter(Boolean).join(', '),e.startLocal,e.endLocal,e.timeZone,sqlTime(e.startUtc),sqlTime(e.endUtc)]);
   await c.query('INSERT INTO connection_calendar_copies(account_id,event_id,calendar_event_id) VALUES(?,?,?)',[account,id,copy]);await audit(c,account,id,'calendar_copy');return copy;
  });},

  async enqueueReminders(){return db.query(`INSERT IGNORE INTO connection_notifications(id,event_id,account_id,kind,event_revision,due_at) SELECT UUID(),e.id,r.account_id,'reminder',e.revision,GREATEST(UTC_TIMESTAMP(6),DATE_SUB(e.start_utc,INTERVAL 24 HOUR)) FROM connection_events e JOIN connection_rsvps r ON r.event_id=e.id JOIN connection_preferences p ON p.account_id=r.account_id WHERE e.status='published' AND e.start_utc>UTC_TIMESTAMP(6) AND e.start_utc<=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 24 HOUR) AND r.status='yes' AND p.reminders=1`);},
  async withDispatchLock(fn){const c=await db.getConnection();try{const got=(await c.query("SELECT GET_LOCK('gold_connections_mail_dispatch',0) AS acquired"))[0].acquired;if(!Number(got))return {busy:true};try{return await fn();}finally{await c.query("SELECT RELEASE_LOCK('gold_connections_mail_dispatch')");}}finally{c.release();}},
  async claimNotification(){return tx(async c=>{
   // A provider idempotency key is valid for 24 hours. Never replay an ambiguous
   // delivery beyond 23 hours; preserve it for manual reconciliation instead.
   await c.query("UPDATE connection_notifications SET status='uncertain' WHERE status IN('pending','sending') AND first_attempt_at<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 23 HOUR)");
   const gate=(await c.query('SELECT next_send_at FROM connection_dispatch_control WHERE id=1 FOR UPDATE'))[0];if(gate&&new Date(iso(gate.next_send_at)).getTime()>Date.now())return {waitMs:Math.min(3000,new Date(iso(gate.next_send_at)).getTime()-Date.now())};
   const row=(await c.query("SELECT * FROM connection_notifications WHERE due_at<=UTC_TIMESTAMP(6) AND (status='pending' OR (status='sending' AND lease_until<UTC_TIMESTAMP(6))) AND attempts<5 ORDER BY due_at,id LIMIT 1 FOR UPDATE"))[0];if(!row)return null;
   await c.query('UPDATE connection_dispatch_control SET next_send_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 3 SECOND) WHERE id=1');
   await c.query("UPDATE connection_notifications SET status='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,UTC_TIMESTAMP(6)),lease_until=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 2 MINUTE) WHERE id=?",[row.id]);return {...row,attempts:Number(row.attempts)+1,payload:row.payload_json?json(row.payload_json):null};
  });},
  async notificationRecipient(job){
   const row=(await db.query(`SELECT a.id,a.email,p.new_events,p.updates,p.reminders,p.rsvp FROM member_accounts a JOIN member_memberships m ON m.account_id=a.id JOIN connection_preferences p ON p.account_id=a.id WHERE a.id=? AND ${eligible}`,[job.account_id]))[0];if(!row)return null;
   const e=await get(db,job.event_id);if(!e)return null;const pref=job.kind==='new_event'?'new_events':job.kind==='reminder'?'reminders':['rsvp','promotion'].includes(job.kind)?'rsvp':'updates';if(!row[pref])return null;
   if(job.kind==='new_event'){
    if(e.status!=='published'||Date.parse(e.startUtc)<=Date.now())return null;
    const codes=coverageStates(e.state,e.notificationRange).map(s=>s.code),follows=await db.query(`SELECT state_code FROM connection_follows WHERE account_id=? AND state_code IN(${codes.map(()=>'?').join(',')}) LIMIT 1`,[row.id,...codes]);if(!follows.length)return null;
   }else{const r=await store.participation(row.id,e.id);if(!r||!['yes','waitlisted'].includes(r.status))return null;if(job.kind==='cancellation'){if(e.status!=='cancelled')return null;}else if(e.status!=='published')return null;if(job.kind==='reminder'&&(r.status!=='yes'||Date.parse(e.startUtc)<=Date.now()||Number(job.event_revision)!==e.revision))return null;}
   return {accountId:row.id,email:row.email,event:publicEvent(e)};
  },
  async freezeNotification(id,payload){await db.query("UPDATE connection_notifications SET payload_json=COALESCE(payload_json,?) WHERE id=? AND status='sending'",[JSON.stringify(payload),id]);return json((await db.query('SELECT payload_json FROM connection_notifications WHERE id=?',[id]))[0].payload_json);},
  async finishNotification(id,status,providerId=null){if(!['sent','skipped','failed','uncertain','pending'].includes(status))throw Error('Invalid delivery status');await db.query("UPDATE connection_notifications SET status=?,provider_id=?,sent_at=IF(?='sent',UTC_TIMESTAMP(6),sent_at),due_at=IF(?='pending',DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 5 MINUTE),due_at),lease_until=NULL WHERE id=? AND status='sending'",[status,providerId,status,status,id]);},

 };
 return store;
}

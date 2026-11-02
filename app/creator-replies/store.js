import {randomUUID} from 'node:crypto';
import {CreatorReplyInputError,replyBatch,replyId,replyMailbox,replyDestination,replyMigration} from './model.js';

export function createCreatorRepliesStore(db){
 const tx=async fn=>{const c=await db.getConnection();try{await c.beginTransaction();const value=await fn(c);await c.commit();return value;}catch(error){await c.rollback();throw error;}finally{c.release();}};
 return {
  async ready(){return(await db.query('SELECT version FROM schema_migrations WHERE version=?',[replyMigration])).length===1;},
  async overview(){
   const state=(await db.query('SELECT last_success_at,imported_count,duplicate_count,unmatched_count,ambiguous_count FROM creator_reply_sync_state WHERE id=1'))[0]||null;
   const replies=await db.query('SELECT r.id,r.message_id,r.thread_id,r.from_email,r.from_name,r.subject,r.received_at,r.status,r.imported_at,p.id AS person_id,p.slug,p.display_name FROM creator_reply_references r LEFT JOIN people p ON p.id=r.person_id ORDER BY r.received_at DESC,r.id DESC LIMIT 100');
   return {state,replies};
  },
  async importBatch(batch){
   const records=replyBatch({mailbox:replyMailbox,destination:replyDestination,records:batch});
   return tx(async c=>{
    const state=await c.query('SELECT id FROM creator_reply_sync_state WHERE id=1 FOR UPDATE');
    if(state.length!==1)throw Error('Creator reply storage is unavailable');
    const result={imported:0,duplicates:0,unmatched:0,ambiguous:0};
    for(const row of records){
     const old=(await c.query('SELECT id,thread_id,from_email FROM creator_reply_references WHERE mailbox=? AND message_id=? FOR UPDATE',[replyMailbox,row.message_id]))[0];
     if(old){if(old.thread_id!==row.thread_id||old.from_email!==row.from_email)throw new CreatorReplyInputError('This message reference conflicts with an existing record.');result.duplicates++;continue;}
     // A header match is only a reference for the owner. It never proves identity or grants access.
     const matches=await c.query("SELECT i.id AS invitation_id,i.person_id FROM creator_invitations i JOIN people p ON p.id=i.person_id WHERE i.target_email=? AND p.is_sample=FALSE AND p.archived_at IS NULL ORDER BY i.created_at DESC,i.id DESC",[row.from_email]);
     let match=null;
     if(!matches.length)result.unmatched++;
     else if(new Set(matches.map(m=>m.person_id)).size!==1)result.ambiguous++;
     else match=matches[0];
     await c.query('INSERT INTO creator_reply_references(id,mailbox,message_id,thread_id,from_email,from_name,subject,received_at,person_id,invitation_id) VALUES(?,?,?,?,?,?,?,?,?,?)',[randomUUID(),replyMailbox,row.message_id,row.thread_id,row.from_email,row.from_name,row.subject,row.received_at.replace('T',' ').replace('Z',''),match?.person_id||null,match?.invitation_id||null]);
     result.imported++;
    }
    await c.query('UPDATE creator_reply_sync_state SET last_success_at=UTC_TIMESTAMP(6),imported_count=?,duplicate_count=?,unmatched_count=?,ambiguous_count=? WHERE id=1',[result.imported,result.duplicates,result.unmatched,result.ambiguous]);
    return result;
   });
  },
  async review(id,status,actor){
   if(!replyId(id)||!['new','reviewed'].includes(status)||typeof actor!=='string'||!actor.trim()||actor.length>180||/[\x00-\x1f\x7f]/.test(actor))throw new CreatorReplyInputError('Choose a valid reply and review status.');
   await db.query('UPDATE creator_reply_references SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP(6) WHERE id=?',[status,actor,id]);
  }
 };
}

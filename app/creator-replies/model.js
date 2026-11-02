import {createHash,timingSafeEqual} from 'node:crypto';

export const replyDestination='paul@goldtrails.org';
export const replyMigration='015_creator_reply_references';
export class CreatorReplyInputError extends Error {}
const fields=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
const invalid=()=>{throw new CreatorReplyInputError('Check the creator reply metadata.');};
const gmailId=value=>typeof value==='string'&&/^[a-f0-9]{8,32}$/.test(value);
export const replyId=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const address=value=>{
 if(typeof value!=='string'||value.length>254||!value||value!==value.trim()||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))invalid();
 return value.toLowerCase();
};
export const configuredReplyMailbox=value=>{try{return address(value);}catch{return null;}};
const header=(value,max,required=false)=>{
 if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f]/.test(value)||required&&!value.trim())invalid();
 // Header text is never treated as HTML; remove invitation capabilities even in subjects.
 return value.replace(/https?:\/\/[^\s<>]*(?:creator-invitation|[?&]token=)[^\s<>]*/gi,'[private link removed]').replace(/[a-f0-9]{64,}/gi,'[private token removed]').trim();
};
export function replyBatch(value,{mailbox=null,now=Date.now()}={}){
 const expectedMailbox=configuredReplyMailbox(mailbox);
 if(!expectedMailbox||!fields(value,['mailbox','destination','records'])||value.mailbox!==expectedMailbox||value.destination!==replyDestination||!Array.isArray(value.records)||value.records.length>20)invalid();
 const ids=new Set();
 return value.records.map(row=>{
  if(!fields(row,['message_id','thread_id','from_email','from_name','to_email','subject','received_at'])||!gmailId(row.message_id)||!gmailId(row.thread_id)||ids.has(row.message_id)||row.to_email!==replyDestination)invalid();
  ids.add(row.message_id);
  const from_email=address(row.from_email),from_name=header(row.from_name??'',180),subject=header(row.subject,500);
  if(typeof row.received_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(row.received_at))invalid();
  const date=new Date(row.received_at),canonical=row.received_at.includes('.')?row.received_at:row.received_at.replace('Z','.000Z');
  if(!Number.isFinite(date.getTime())||date.toISOString()!==canonical||date.getTime()<Date.UTC(2000,0,1)||date.getTime()>now+300000)invalid();
  return {message_id:row.message_id,thread_id:row.thread_id,from_email,from_name,to_email:replyDestination,subject,received_at:date.toISOString()};
 });
}
export const syncKeyHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?createHash('sha256').update(value).digest():null;
export function syncAuthorized(header,expected){
 const supplied=typeof header==='string'?header.match(/^Bearer ([a-f0-9]{64})$/)?.[1]:null;
 return Boolean(expected&&supplied&&timingSafeEqual(createHash('sha256').update(supplied).digest(),expected));
}
export const gmailReplyUrl=(threadId,mailbox)=>gmailId(threadId)&&configuredReplyMailbox(mailbox)?'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(configuredReplyMailbox(mailbox))+'#all/'+threadId:null;

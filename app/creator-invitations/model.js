export class CreatorInvitationError extends Error {
 constructor(code,message,status=400){super(message);this.name='CreatorInvitationError';this.code=code;this.status=status;}
}
export const invitationToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const invitationSlug=value=>typeof value==='string'&&value.length<=160&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export const invitationId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export function invitationEmail(value){
 const email=typeof value==='string'?value.trim().toLowerCase():'';
 if(email.length>254||!email||/[\x00-\x1f\x7f]/.test(value)||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new CreatorInvitationError('input','Enter a valid email address.');
 return email;
}
export function invitationActor(value){
 const actor=typeof value==='string'?value.trim():'';
 if(!actor||actor.length>180||/[\r\n\x00-\x1f]/.test(actor))throw new CreatorInvitationError('input','The owner identity is unavailable.');
 return actor;
}
import {validHash} from '../admin-auth.js';

export function invitationJoinInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new CreatorInvitationError('input','Complete the account form.');
 const {passwordHash,csrf}=value,username=typeof value.username==='string'?value.username.trim():'';
 if(!/^[a-z0-9_-]{3,40}$/i.test(username)||['admin','administrator','support','goldtrails','root'].includes(username.toLowerCase()))throw new CreatorInvitationError('input','Choose a username of 3–40 letters, numbers, underscores or hyphens.');
 const email=invitationEmail(value.email);
 if(typeof passwordHash!=='string'||!validHash(passwordHash))throw new CreatorInvitationError('input','Choose a valid password.');
 if(!invitationToken(csrf))throw new CreatorInvitationError('input','Refresh the account form.');
 if(value.displayName!=null&&(typeof value.displayName!=='string'||/[\x00-\x1f\x7f]/.test(value.displayName)))throw new CreatorInvitationError('input','Check your display name.');
 const displayName=value.displayName?.trim()||null;
 if(displayName&&(displayName.length>180||/[\x00-\x1f\x7f]/.test(displayName)))throw new CreatorInvitationError('input','Use a display name of at most 180 characters without control characters.');
 return{username,email,passwordHash,displayName,csrf};
}

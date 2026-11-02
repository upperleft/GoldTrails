export class CreatorInvitationError extends Error {
 constructor(code,message,status=400){super(message);this.name='CreatorInvitationError';this.code=code;this.status=status;}
}
export const invitationToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const invitationId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export function invitationEmail(value){
 const email=typeof value==='string'?value.trim().toLowerCase():'';
 if(email.length>254||!email||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new CreatorInvitationError('input','Enter a valid email address.');
 return email;
}
export function invitationActor(value){
 const actor=typeof value==='string'?value.trim():'';
 if(!actor||actor.length>180||/[\r\n\x00-\x1f]/.test(actor))throw new CreatorInvitationError('input','The owner identity is unavailable.');
 return actor;
}

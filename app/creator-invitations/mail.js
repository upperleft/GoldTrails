import {creatorNameSlug} from './context.js';

const api='https://api.mail.hostinger.com/api/v1';
const mailboxResource='AC4cbf541ba1a3e4be1b4ccc11784a';
const mailboxAddress='paul@goldtrails.org';
const origin='https://goldtrails.org';
const userAgent='GoldTrails-Approved-Creator-Invitations/1.0';
const failed=httpStatus=>({status:'failed',httpStatus});
const statusOf=response=>Number.isInteger(response?.status)?response.status:null;
const line=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():null;
const singleEmail=value=>typeof value==='string'&&value.length<=254&&!/\s/.test(value)&&value.split('@')[0].length<=64&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value)&&!value.startsWith('.')&&!value.includes('..')&&!value.includes('.@');

function invitationText({greeting,personalNote,email,url}){
 return `Hi ${greeting},

I’m Paul Shoemaker, and I’m building Gold Trails, a learning site for gold prospectors. We’re opening an early preview for creators before our wider launch, and I’d love your feedback on what’s useful and what we could improve.
${personalNote?'\n'+personalNote+'\n':''}
I’d like to offer you a complimentary Gold Trails Plus membership, normally $5/month, with no subscription fee or card required and no obligation to promote the site. Your access has no expiry once you accept.

Here’s your personal invitation—no reply is needed to get started:
${url}

It opens the homepage. Choose “Continue to your free creator account,” then set up your account using ${email} and accept. Already have an account? Sign in instead. No separate verification email is needed. You’ll return to the homepage, ready to explore and view your creator profile.

If you like what you see, we’d love it if you mentioned Gold Trails on your channel.

Thanks for taking a look!

Paul Shoemaker
Gold Trails
paul@goldtrails.org

Prefer another email, or no further invitations? Just let me know.
`;
}

// Sending is opt-in at the caller. This adapter has no persistence or retries;
// callers must preserve an uncertain result before offering another send.
export function creatorInvitationMail(env=process.env,send=fetch){
 const key=env?.CREATOR_MAIL_API_KEY;
 if(typeof key!=='string'||key.length<16||key.length>4096||/\s/.test(key))return null;
 return async({invitation,url,contact={}}={})=>{
  if(!invitation||!creatorNameSlug(invitation.slug)||/\s/.test(invitation.slug)||typeof invitation.raw!=='string'||invitation.raw.length!==64||!(/^[a-f0-9]{64}$/).test(invitation.raw)||!singleEmail(invitation.target_email))return failed(null);
  // Exact equality rejects redirects, alternate hosts, extra query parameters,
  // and links belonging to a different creator or private invitation.
  if(typeof url!=='string'||url!==`${origin}/invite/${invitation.slug}/?code=${invitation.raw}`)return failed(null);
  if(!contact||typeof contact!=='object'||Array.isArray(contact))return failed(null);
  if(contact.email!==undefined&&(!singleEmail(contact.email)||contact.email.toLowerCase()!==invitation.target_email.toLowerCase()))return failed(null);
  if(contact.creator_slug!==undefined&&contact.creator_slug!==invitation.slug)return failed(null);
  const greeting=line(contact.greeting??contact.contact_name??invitation.display_name,180);
  const personalValue=contact.personal_note??contact.personalization??contact.personal;
  const personalNote=personalValue===undefined||personalValue===''?'':line(personalValue,2000);
  if(!greeting||personalNote===null)return failed(null);
  const payload={to:[invitation.target_email],displayName:'Paul Shoemaker at Gold Trails',subject:'Your complimentary Gold Trails Plus creator invitation',text:invitationText({greeting,personalNote,email:invitation.target_email,url})};
  const headers={Authorization:'Bearer '+key,Accept:'application/json','User-Agent':userAgent};
  let identityStatus=null;
  try{
   const response=await send(api+'/me',{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(12000)});
   identityStatus=statusOf(response);
   if(identityStatus!==200)return failed(identityStatus);
   const identity=await response.json();
   const mailboxes=identity?.data?.mailboxes;
   if(!Array.isArray(mailboxes)||mailboxes.filter(mailbox=>mailbox?.resourceId===mailboxResource&&mailbox?.address===mailboxAddress).length!==1)return failed(identityStatus);
  }catch{return failed(identityStatus);}
  try{
   const response=await send(`${api}/mailboxes/${mailboxResource}/send`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(12000)});
   const httpStatus=statusOf(response);
   if(httpStatus===204)return {status:'sent',httpStatus};
   if(httpStatus>=400&&httpStatus<500)return failed(httpStatus);
   return {status:'uncertain',httpStatus};
  }catch{return {status:'uncertain',httpStatus:null};}
 };
}

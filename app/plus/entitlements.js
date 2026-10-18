import {guestPlusAccess} from './guest-access.js';
// Add feature keys only when an offering is approved. Approved features share the existing Plus entitlement.
export const premiumFeatures=Object.freeze({almanac:Object.freeze({name:'Almanac & creator map',plan:'plus'}),connections:Object.freeze({name:'Gold Connections participation',plan:'plus'})});
const read=(req,name)=>(req.headers.cookie||'').match(new RegExp('(?:^|;\\s*)__Host-gold-'+name+'=([a-f0-9]{64})(?:;|$)'))?.[1]||null;
export async function hasPremiumFeature(req,{members=null,owners=null,guests=guestPlusAccess}={},feature='almanac'){
 if(!Object.hasOwn(premiumFeatures,feature))return false;
 // A guest pass can open premium reading only; it never supplies an account or writing entitlement.
 try{if(['GET','HEAD'].includes(req.method)&&guests?.read(req))return true;}catch{/* A broken guest configuration must not affect ordinary paid access. */}
 const member=members?await members.session(read(req,'member')):null;
 if(member?.effective_level==='subscriber')return true;
 return Boolean(owners&&(await owners.session(read(req,'admin')))?.authenticated);
}
export function almanacReturnPath(value){
 if(typeof value!=='string'||value.length>2048||!value.startsWith('/gold-almanac/'))return null;
 const u=new URL(value,'https://gold.invalid');if(u.origin!=='https://gold.invalid'||!/^\/gold-almanac\/(?:[a-z-]+\/)?$/.test(u.pathname)||u.hash)return null;
 const keys=['q','region','setting','topic','specialty','sort','creator'];
 if([...u.searchParams].some(([k,v])=>!keys.includes(k)||v.length>160||u.searchParams.getAll(k).length!==1))return null;
 return u.pathname+u.search;
}

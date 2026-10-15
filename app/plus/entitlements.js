// Add feature keys only when an offering is approved. The current plan unlocks Almanac.
export const premiumFeatures=Object.freeze({almanac:Object.freeze({name:'Almanac & creator map',plan:'plus'})});
const read=(req,name)=>(req.headers.cookie||'').match(new RegExp('(?:^|;\\s*)__Host-gold-'+name+'=([a-f0-9]{64})(?:;|$)'))?.[1]||null;
export async function hasPremiumFeature(req,{members=null,owners=null}={},feature='almanac'){
 if(!Object.hasOwn(premiumFeatures,feature))return false;
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

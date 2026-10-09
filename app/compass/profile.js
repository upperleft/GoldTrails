export const experience={new:'Completely new',beginner:'Beginner with some experience',intermediate:'Intermediate',experienced:'Experienced',expert:'Expert'};
export const interests={panning:'Recreational gold panning',river:'Rivers and streams',sluicing:'Sluicing',detecting:'Metal detecting for gold',geology:'Gold geology',locations:'Finding promising locations',history:'Historic mines and mining history',equipment:'Equipment and technology',creators:'Learning from YouTube prospectors',family:'Family-friendly adventures',other:'Other interests'};
export const equipment={pan:'Gold pan',classifier:'Classifier',snuffer:'Snuffer bottle',sluice:'Sluice box',highbanker:'Highbanker',detector:'Gold metal detector',pinpointer:'Pinpointer',crevice:'Crevice tools',shovel:'Shovel / digging tools',magnifier:'Magnifier / scale',pump:'Pump',other:'Other equipment',none:'None yet'};
export const goals={first:'Find my first gold',panning:'Improve my panning technique',locations:'Find better prospecting locations',sluice:'Become proficient with a sluice',detecting:'Learn gold metal detecting',fine:'Get more gold from concentrates',vacation:'Plan a prospecting vacation',equipment:'Build my equipment collection',learn:'Learn everything I can'};
export const learning={videos:'Watch videos',articles:'Read articles',demonstrations:'Interactive demonstrations',steps:'Step-by-step instructions',ai:'Guide conversations',challenges:'Hands-on challenges'};
export const discoveries={not_yet:'Not yet',flakes:'A few flakes',small:'Small amounts',grams:'Several grams',ounce:'An ounce or more',private:'Prefer not to say'};
export const steps=[['experience'],['interests','otherInterests'],['region','postalCode','travelMiles','camping','interstate'],['equipment'],['discoveries'],['goal'],['learning'],['budget','currency','terrain','favoriteCreators','videoLength','accessibility','children','tripDuration','destinations','frustrations','explanation','aiConsent']];
export class ProfileError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const text=(v,n)=>{if(v==null||v==='')return null;if(typeof v!=='string'||v.trim().length>n)throw new ProfileError('That answer is too long.');return v.trim()||null;};
const one=(v,choices)=>{if(v==null||v==='')return null;if(typeof v!=='string'||!Object.hasOwn(choices,v))throw new ProfileError('Choose one of the listed answers.');return v;};
const many=(v,choices)=>{if(!Array.isArray(v)||v.length>Object.keys(choices).length||v.some(x=>typeof x!=='string'||!Object.hasOwn(choices,x)))throw new ProfileError('Choose from the listed options.');return [...new Set(v)];};
const bool=v=>{if(v==null||v==='')return null;if(typeof v!=='boolean')throw new ProfileError('Choose yes, no, or skip.');return v;};
export function validateAnswers(patch,step,records=[]){
 if(!Number.isInteger(step)||!steps[step]||!patch||Array.isArray(patch)||typeof patch!=='object')throw new ProfileError('Choose a valid questionnaire step.');
 if(Object.keys(patch).some(k=>!steps[step].includes(k)))throw new ProfileError('That field does not belong to this step.');
 const out={};for(const [k,v] of Object.entries(patch)){
 if(k==='experience')out[k]=one(v,experience);else if(k==='interests')out[k]=many(v,interests);else if(k==='equipment'){out[k]=many(v,equipment);if(out[k].includes('none')&&out[k].length>1)throw new ProfileError('Choose None yet on its own.');}
 else if(k==='goal')out[k]=one(v,goals);else if(k==='learning')out[k]=many(v,learning);else if(k==='discoveries')out[k]=one(v,discoveries);
 else if(['camping','interstate','children','aiConsent'].includes(k))out[k]=bool(v);
 else if(['travelMiles','budget'].includes(k)){if(v==null||v==='')out[k]=null;else if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>(k==='budget'?100000:10000))throw new ProfileError('Use a sensible nonnegative amount.');else out[k]=v;}
 else if(k==='currency')out[k]=one(v,{USD:1,CAD:1,AUD:1,GBP:1,EUR:1,NZD:1});
 else if(k==='videoLength')out[k]=one(v,{short:1,medium:1,long:1,any:1});
 else if(k==='explanation')out[k]=one(v,{beginner:1,technical:1,balanced:1});
 else if(k==='favoriteCreators'){if(!Array.isArray(v)||v.length>10||v.some(id=>!records.some(r=>r.kind==='creator'&&r.id===id)))throw new ProfileError('Choose creators from the current directory.');out[k]=[...new Set(v)];}
 else out[k]=text(v,k==='postalCode'?16:k==='region'?180:500);
 }return out;
}
export function patchFromForm(f,step){const p={};for(const k of steps[step]||[]){if(['interests','equipment','learning','favoriteCreators'].includes(k))p[k]=f.getAll(k);else if(['camping','interstate','children','aiConsent'].includes(k))p[k]=f.get(k)==='yes'?true:f.get(k)==='no'?false:null;else if(['travelMiles','budget'].includes(k))p[k]=f.get(k)?.trim()?Number(f.get(k)):null;else p[k]=f.get(k)||null;}return p;}
export function ownedCategories(answers,inventory=[]){return new Set([...(answers.equipment||[]),...inventory.map(x=>x.category)].filter(x=>x!=='none'));}

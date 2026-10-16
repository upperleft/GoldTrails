import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=new URL('../research/combined-archive/2026-10-15/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,base),'utf8'));
const raw=readFileSync(new URL('original.json',base)),archive=JSON.parse(raw),baseline=read('baseline.json'),decisions=read('publication-decisions.json');
const sha=value=>createHash('sha256').update(value).digest('hex');
const content=JSON.parse(readFileSync(new URL('../app/almanac/content.json',import.meta.url))),community=JSON.parse(readFileSync(new URL('../app/community-catalog.json',import.meta.url)));
const duplicates=new Map([[1,'boston-mineral'],[10,'douglas-county'],[23,'amra'],[34,'reddit-prospecting'],[43,'au-mojave'],[47,'gold-rockies'],[53,'treasurenet-gold'],[68,'new-49ers'],[98,'western-washington']]);
const flags={
 'destinations/3':['Official Sharps Creek page conflicts on cash/check versus electronic-only payment. Recheck with the land manager before publishing payment or seasonal details.'],
 'communityResources/13':['The checked page has a May 8, 2026 membership moratorium alongside generic membership language. Public listing avoids declaring applications open; recheck current notice.'],
 'communityResources/65':['Event cancellations and rescheduling on the official page make archive event dates unsafe to reuse.'],
 'communityResources/66':['Archive and organizer outing dates require separate confirmation; the displayed October–November span is ambiguous.'],
 'communityResources/106':['Organization location not independently established in this review. Hold the entire new listing.'],
 'communityResources/109':['Official current property information differs from older claim references. No claim names or access entitlements imported.']
};
const normalize=url=>{try{const u=new URL(url);return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');}catch{return null;}};
const baselineSources=new Map(baseline.almanac.sources.map(s=>[s.id,s]));
const sourceObservations=[...archive.destinationSources.map((s,index)=>({...s,id:'destination-source-'+index,archivePath:'/destinationSources/'+index})),...archive.communitySources.map((s,index)=>({...s,id:'community-source-'+index,archivePath:'/communitySources/'+index}))];
const records=[];
for(const [key,type] of [['destinations','destination'],['communityResources','community']])for(const [index,record]of archive[key].entries()){
 const decision=(type==='destination'?decisions.destinations:decisions.communities).find(d=>d.index===index);
 const duplicate=type==='community'?duplicates.get(index):null;
 const published=decision?(type==='destination'?content.states.flatMap(s=>s.destinations||[]):community.entries).find(r=>r.id===decision.targetId):null;
 if(decision&&!published)throw Error('Missing selected public record '+decision.targetId);
 const urls=type==='destination'?[record.permissionSourceUrl,...(record.tripFacts||[]).flatMap(f=>f.sourceUrls||[])]:[record.sourceUrl,...(record.sourceUrls||[])];
 const context=type==='destination'?[...baselineSources.values()].filter(s=>urls.some(url=>normalize(url)===normalize(s.url))).map(s=>s.id):[];
 records.push({id:type+'-'+index,archivePath:'/'+key+'/'+index,title:record.title||record.name,kind:record.kind,state:record.state,status:decision?'selected_checked_fields':duplicate?'existing_entry_preserved':'held_for_reverification',targetId:decision?.targetId||duplicate||null,selectedFields:decision?.publicFields||[],verifiedAt:decision?.reviewedAt||null,existingContextSourceIds:context,sourceObservationIds:sourceObservations.filter(s=>urls.some(url=>normalize(url)===normalize(s.url))).map(s=>s.id),publicSourceIds:type==='destination'?(published?.sourceIds||[]):[],flags:flags[key+'/'+index]||[],conflicts:record.conflicts||[],unresolvedQuestions:record.unresolvedQuestions||[],notes:decision?'Only selected independently rechecked fields are published; remaining archive details stay research.':duplicate?'Existing listing retained without overwriting it. Archive details remain available for later review.':'Archive information is preserved, not treated as current access permission, event availability or a verified listing.'});
}
const counts={destinations:archive.destinations.length,communityResources:archive.communityResources.length,sourceObservations:sourceObservations.length,selectedDestinations:decisions.destinations.length,selectedCommunities:decisions.communities.length,existingCommunityMatches:duplicates.size,heldRecords:records.filter(r=>r.status==='held_for_reverification').length,unconfirmedDestinationLeads:archive.unconfirmedLeads.destinations.length,unconfirmedCommunityLeads:archive.unconfirmedLeads.community.length,publishedDestinationTotal:content.states.flatMap(s=>s.destinations||[]).length,publishedCommunityTotal:community.entries.length};
const crosswalk={schemaVersion:1,archiveSha256:sha(raw),reviewDate:'2026-10-15',counts,records,existingDestinationReferences:archive.previouslyExistingDestinations.map(r=>({...r,decision:'Preserved existing detailed destination; the archive intentionally omitted it.'})),socialIndexDecision:'socialDirectoryIndex repeats communityResources; do not add 133 extra records.'};
const sources={schemaVersion:1,notice:'Original observations retain their original checked dates. A source URL match is context, not independent verification of every fact or identity.',observations:sourceObservations,publicationDecisions:decisions};
const gaps={schemaVersion:1,unconfirmedLeads:archive.unconfirmedLeads,records:records.filter(r=>r.status==='held_for_reverification'||r.flags.length||r.conflicts.length||r.unresolvedQuestions.length).map(r=>({archivePath:r.archivePath,title:r.title,status:r.status,flags:r.flags,conflicts:r.conflicts,unresolvedQuestions:r.unresolvedQuestions})),publicationRules:['Do not publish an unreviewed record simply because its source is official.','Events, past outings and recurring schedules require a separate calendar review; none are imported as upcoming events.','Gold occurrence does not grant access. Confirm exact land, claim and equipment rules.','Selected destination cards omit unconfirmed fee or seasonal fields.','Existing entries are preserved, including checked dates.']};
const manifest={schemaVersion:1,originalFilename:'Gold_Trails_ALL_Research_for_Codex_2026-10-11.json',archiveSha256:sha(raw),archiveBytes:raw.length,baselineSha256:sha(readFileSync(new URL('baseline.json',base))),originalAssemblyDate:archive.assembledAt,reviewDate:'2026-10-15',counts};
const files={'manifest.json':manifest,'crosswalk.json':crosswalk,'source-database.json':sources,'research-gaps.json':gaps};
for(const[name,value]of Object.entries(files)){const text=JSON.stringify(value,null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(new URL(name,base),'utf8')!==text)throw Error('Stale audit file '+name);}else writeFileSync(new URL(name,base),text);}
console.log(JSON.stringify(counts));

import test from 'node:test';
import assert from 'node:assert/strict';
import {communityCatalog,validateCommunityCatalog} from '../app/community-catalog.js';
import {renderCommunitiesPage} from '../app/communities-page.js';
import {matchesCommunity} from '../dist/communities.js';

test('catalog requires provenance, safe platform URLs and explicit archive classification',()=>{
 assert.equal(validateCommunityCatalog(communityCatalog),communityCatalog);
 for(const mutate of [d=>d.entries[0].sources=[],d=>d.entries[0].status='held_for_review',d=>d.entries[0].links[0].url='javascript:alert(1)',d=>d.entries[0].links[0].platform='Facebook',d=>d.entries.push(d.entries[0]),d=>d.entries.find(e=>e.status==='historical_archive').kind='Online community']){
  const copy=structuredClone(communityCatalog);mutate(copy);assert.throws(()=>validateCommunityCatalog(copy));
 }
 assert.ok(!communityCatalog.entries.some(e=>/prescott|net-gold|goldprospectorsspace/i.test(e.name)));
});
test('multi-platform filters compose with location, type and accent-insensitive search',()=>{
 const entry={search:'Au Mojave prospectors · éducation',region:'California',kind:'Club',platforms:'Website|Facebook'};
 assert.ok(matchesCommunity(entry,{query:'education Mojave',region:'California',kind:'Club',platform:'Facebook'}));
 for(const filters of [{query:'Nevada'},{region:'Oregon'},{kind:'Association'},{platform:'Meetup'}])assert.ok(!matchesCommunity(entry,filters));
 assert.ok(!matchesCommunity({...entry,platforms:'Website|NotFacebook'},{platform:'Facebook'}));
 const archive={search:'Google Groups gold pan historical',region:'Online · historical',kind:'Historical archive',platforms:'Google Groups'};
 assert.ok(matchesCommunity(archive,{platform:'Google Groups',kind:'Historical archive'}));
 assert.ok(!matchesCommunity(archive,{kind:'Online community'}));
});
test('public rendering preserves archive/access notes, escapes text and offers safe outbound links',()=>{
 const html=renderCommunitiesPage();
 assert.match(html,/45 community listings · 1 historical archive/);
 assert.match(html,/Read-only historical archive/);assert.match(html,/Private Meetup group/);
 assert.match(html,/Facebook group · club-linked/);assert.match(html,/Google Groups/);
 for(const a of html.matchAll(/<a\b[^>]*href="https?:[^>]*>/g)){assert.match(a[0],/target="_blank"/);assert.match(a[0],/rel="noopener noreferrer"/);}
 const injected=structuredClone(communityCatalog.entries[0]);injected.name='<img src=x onerror=alert(1)>';injected.summary='"quoted" & text';
 const safe=renderCommunitiesPage([injected]);assert.match(safe,/&lt;img/);assert.doesNotMatch(safe,/<img src=x/);assert.match(safe,/&quot;quoted&quot; &amp; text/);
});

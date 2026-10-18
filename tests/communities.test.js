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

test('community page has one prominent title and a brief introduction immediately before its directory',()=>{
 const html=renderCommunitiesPage(),center=html.match(/<div class="center" id="main-content">([\s\S]*?)<\/div><\/div><\/main>/)?.[1]||'';
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/<h1>Clubs &amp; Groups<\/h1>/);
 assert.match(html,/Find prospecting clubs and online communities by location, group type or platform/);
 assert.doesNotMatch(html,/class="culture-welcome"|THERE’S ROOM FOR ANOTHER PAN|GOOD COMPANY \/ ON THE TRAIL|A little company goes a long way/);
 assert.ok(center.trim().startsWith('<section aria-label="Community directory"'),'The directory, rather than a second welcome panel, begins the main content');
 assert.ok(center.indexOf('id="community-search"')<center.indexOf('About these listings'));
 const about=center.match(/<section class="culture-about">([\s\S]*?)<\/section>/)?.[1]||'';
 assert.match(about,/mainly in the United States, with Australian and worldwide online communities/);
 assert.match(about,/Google Groups is represented by a clearly marked historical archive/);
 assert.match(about,/private discussions were not inspected/);
 assert.match(about,/do not confer permission to prospect or certify advice/);
});

test('simplifying the introduction preserves every listing, source, access qualification and verification date',()=>{
 const html=renderCommunitiesPage();
 for(const entry of communityCatalog.entries){
  assert.ok(html.includes('id="'+entry.id+'"'),entry.name);
  assert.ok(html.includes('datetime="'+entry.checkedAt+'"'),entry.name+' verification date');
  for(const source of entry.sources)assert.ok(html.includes(source.url.replaceAll('&','&amp;')),entry.name+' source');
  for(const destination of entry.links)assert.ok(html.includes(destination.url.replaceAll('&','&amp;')),entry.name+' public link');
 }
 assert.match(html,/id="community-region"/);assert.match(html,/id="community-kind"/);assert.match(html,/id="community-platform"/);
 assert.match(html,/Sources &amp; entry notes/);assert.match(html,/Group access and membership rules are set by each community/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandResearchGlossary,validateResearchGlossary} from '../scripts/build-glossary-research.mjs';
import {expandGlossary} from '../scripts/build-glossary-regional.mjs';

const data=JSON.parse(readFileSync(new URL('../app/glossary/bedrock-map-terms.json',import.meta.url),'utf8'));
const regional=JSON.parse(readFileSync(new URL('../app/glossary/regional-terms.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../dist/glossary/index.html',import.meta.url),'utf8');
const termRows=html=>[...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0]).filter(r=>r.includes('class="term"'));

test('soil and bedrock terms have primary sources, locators and actual check dates',()=>{
 assert.equal(validateResearchGlossary(data),data);
 assert.equal(data.terms.length,12);
 assert.equal(data.checkedAt,'2026-10-17');
 for(const s of data.sources){assert.match(new URL(s.url).hostname,/(?:^|\.)(?:usgs\.gov|usda\.gov)$/);assert.equal(s.checkedAt,data.checkedAt);}
 for(const t of data.terms){assert.equal(t.checkedAt,data.checkedAt);assert.ok(t.sourceIds.length);assert.equal(t.topic,'Geology');}
 assert.ok(!data.terms.some(t=>['Bedrock','False bedrock','Overburden'].includes(t.term)));
 const densic=data.terms.find(t=>t.id==='densic-bedrock');assert.match(densic.definition,/report distinguishes/);assert.match(densic.definition,/other densic layers/);
 const basement=data.terms.find(t=>t.id==='crystalline-basement');assert.match(basement.definition,/Definitions vary by region/);assert.match(basement.definition,/separate layer of consolidated bedrock/);
 const depth=data.terms.find(t=>t.id==='depth-to-bedrock');assert.match(depth.definition,/not a measurement of gravel in a nearby stream/);
});

test('research terms retain original and regional definitions and the existing overlay contract',()=>{
 const before=termRows(source).filter(r=>!r.includes('data-research-term='));
 const result=expandResearchGlossary(source,data),after=termRows(result.html);
 assert.equal(after.length,before.length+data.terms.length);
 for(const row of before)assert.ok(after.includes(row),'Existing glossary row preserved');
 for(const t of data.terms){
  const row=after.find(r=>r.includes('data-research-term="'+t.id+'"'));
  assert.ok(row);assert.match(row,/class="term" aria-expanded="false" aria-controls="definition-research-/);assert.match(row,/<div class="definition"[^>]+hidden>/);assert.match(row,/target="_blank" rel="noopener noreferrer"/);assert.ok(row.includes(t.locator.replaceAll('&','&amp;').replaceAll('→','→').replaceAll("'",'&#39;')));
 }
 assert.equal((result.html.match(/research-glossary:start/g)||[]).length,1);
 assert.match(result.html,/Depth to Bedrock — View Description/);
 assert.ok(result.html.includes('/glossary.js?v='));
});

test('normal build order is idempotent and never multiplies research or regional rows',()=>{
 const once=expandResearchGlossary(expandGlossary(source,regional).html,data);
 const twice=expandResearchGlossary(expandGlossary(once.html,regional).html,data);
 assert.equal(twice.html,once.html);
 assert.equal(twice.total,183);
 assert.equal((twice.html.match(/data-research-term=/g)||[]).length,12);
 assert.equal((twice.html.match(/data-regional-term=/g)||[]).length,regional.terms.length);
});

test('unsafe citations, broken source relationships, and duplicate existing names fail the build',()=>{
 let changed=structuredClone(data);changed.sources[0].url='javascript:alert(1)';assert.throws(()=>validateResearchGlossary(changed),/source/);
 changed=structuredClone(data);changed.terms[0].sourceIds=['missing'];assert.throws(()=>validateResearchGlossary(changed),/term/);
 changed=structuredClone(data);changed.terms[0].term='Bedrock';assert.throws(()=>expandResearchGlossary(source,changed),/duplicates existing entry/);
 changed=structuredClone(data);changed.terms[1].term=changed.terms[0].term;assert.throws(()=>validateResearchGlossary(changed),/term/);
 changed=structuredClone(data);changed.terms[0].locator='';assert.throws(()=>validateResearchGlossary(changed),/term/);
});

test('new term definitions and labels render as text rather than active HTML',()=>{
 const changed=structuredClone(data);changed.terms[0].definition='<img src=x onerror=alert(1)> & unknown';
 const result=expandResearchGlossary(source,changed);
 assert.match(result.html,/&lt;img src=x onerror=alert\(1\)&gt; &amp; unknown/);assert.doesNotMatch(result.html,/<img src=x/);
});

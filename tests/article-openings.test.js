import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const articles={
 'where-gold-settles':['gold-source','water-sorts','places-to-test','sampling','interpret-results','field-check','sources'],
 'is-that-really-gold':['look-alikes','properties','observe','record','sources'],
 'black-sands':['mixture','meaning','cleanup','magnet','notes','sources'],
 'classification-basics':['separate','opening','routine','compare','finish','sources'],
 'compare-test-pans':['fair-comparison','consistent-input','recovery','identify','repeat','notebook','decision','sources']
};

for(const [slug,destinations] of Object.entries(articles)){
 const html=readFileSync(new URL('../dist/articles/'+slug+'/index.html',import.meta.url),'utf8');
 const article=html.match(/<article\b[^>]*>[\s\S]*?<\/article>/)?.[0]||'';
 const contents=article.match(/<details\b[^>]*class="article-contents"[^>]*>[\s\S]*?<\/details>/)?.[0]||'';

 test(slug+' introduces the article before optional jump navigation',()=>{
  assert.ok(article&&contents);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  const title=article.indexOf('<h1 id="article-title">');
  const metadata=article.indexOf('<p class="article-meta">');
  const authorNote=article.indexOf('<p class="author-note">');
  const intro=article.indexOf('<p>',authorNote);
  const takeaways=article.indexOf('<div class="takeaways">');
  const navigation=article.indexOf(contents);
  assert.ok(title>=0&&metadata>title&&authorNote>metadata&&intro>authorNote);
  assert.ok(takeaways>intro&&navigation>takeaways,'The introduction and existing takeaway precede jump navigation');
  assert.ok(navigation<article.indexOf('<section id="'+destinations[0]+'">'),'Navigation remains available before the main sections');
  assert.match(contents,/^<details\b[^>]*><summary>In this article<\/summary>/);
  assert.ok(!/<details\b[^>]*\bopen(?:\s|=|>)/.test(contents),'Contents starts collapsed');
  assert.match(contents,/<nav aria-label="In this article">/);
  assert.ok(!html.includes('<section class="panel article-contents">'),'No duplicate full-height contents panel before the title');
 });

 test(slug+' keeps every existing jump destination and source section reachable',()=>{
  const links=[...contents.matchAll(/<a\b[^>]*href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(m=>m[1]),destinations);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'No duplicate anchor IDs');
  for(const link of links){
   assert.ok(ids.includes(link[1]),'Destination exists: '+link[1]);
   assert.ok(link[2].replace(/<[^>]+>/g,'').trim().length>3,'Jump link has a useful label');
  }
  assert.match(article,/<section id="sources">/);
  assert.match(article,/class="reference-list"/);
  assert.match(article,/Sources? checked October 7, 2026/);
  assert.match(article,/assistance from ChatGPT/);
 });
}

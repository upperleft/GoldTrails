import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {publishedArticles} from '../app/compass/content.js';

const listing=readFileSync(new URL('../dist/articles/index.html',import.meta.url),'utf8');
const about=readFileSync(new URL('../dist/about-the-camp/index.html',import.meta.url),'utf8');
const plain=value=>value.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const rows=[...listing.matchAll(/<li data-date="([^"]+)" data-title="([^"]+)">([\s\S]*?)<\/li>/g)].map(m=>({date:m[1],title:plain(m[2]),html:m[3]}));

test('article entry page starts with its search and preserves every published article and its metadata',()=>{
 const articles=publishedArticles();assert.equal(rows.length,articles.length);
 assert.equal((listing.match(/<h1\b/g)||[]).length,1);assert.match(listing,/<h1>Articles<\/h1>/);
 assert.doesNotMatch(listing,/THE OLD-TIMER’S READING ROOM|<h2>Explore the articles/);
 const start=listing.indexOf('id="main-content"'),search=listing.indexOf('id="article-search"'),first=listing.indexOf('<li data-date=');
 assert.ok(start<search&&search<first);
 for(const article of articles){
  const row=rows.find(r=>r.title===article.title);assert.ok(row,article.title);
  assert.ok(row.html.includes('href="'+article.url+'"'));assert.match(row.html,/<p class="article-meta">/);assert.match(row.html,/<span class="article-category">[^<]+<\/span>/);assert.match(row.html,/<span class="article-byline">By [^<]+<\/span>/);
  const detail=readFileSync(new URL('../dist'+article.url+'index.html',import.meta.url),'utf8');
  assert.ok(detail.includes('datetime="'+row.date+'"'),article.title+' retains its published date');
 }
 assert.match(listing,/<link rel="stylesheet" href="\/article-listing\.css\?v=[a-f0-9]{12}">/);
 assert.ok(existsSync(new URL('../dist/article-listing.css',import.meta.url)));
});

test('article keyword and category search, empty results, and all four sort choices still work',()=>{
 const listeners=()=>({handlers:{},value:'',addEventListener(name,fn){this.handlers[name]=fn;}});
 const search=listeners(),sort=listeners();sort.value='newest';
 const items=rows.map(r=>({dataset:{title:r.title,date:r.date},textContent:plain(r.html),hidden:false}));
 const list={children:[...items],append(item){this.children=this.children.filter(x=>x!==item);this.children.push(item);}};
 const count={textContent:''},empty={hidden:true};
 const nodes={'#article-list':list,'#article-search':search,'#article-sort':sort,'#article-count':count,'#article-empty':empty};
 const script=[...listing.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(code=>code.includes("querySelector('#article-list')"));assert.ok(script);
 vm.runInNewContext(script,{document:{querySelector:selector=>nodes[selector]}});
 search.value='screen';search.handlers.input();assert.equal(items.filter(x=>!x.hidden).length,1);assert.match(items.find(x=>!x.hidden).dataset.title,/Classification/);
 search.value='geology';search.handlers.input();assert.equal(items.filter(x=>!x.hidden).length,5,'Category text remains searchable');
 search.value='not-a-matching-prospecting-topic';search.handlers.input();assert.equal(count.textContent,'0 articles');assert.equal(empty.hidden,false);
 search.value='';sort.value='az';sort.handlers.change();assert.equal(empty.hidden,true);assert.equal(count.textContent,rows.length+' articles');assert.match(list.children[0].dataset.title,/Black Sands/);assert.match(list.children.at(-1).dataset.title,/Where Gold Settles/);
 sort.value='za';sort.handlers.change();assert.match(list.children[0].dataset.title,/Where Gold Settles/);
 sort.value='oldest';sort.handlers.change();assert.equal(list.children[0].dataset.date,'2026-10-07');
 sort.value='newest';sort.handlers.change();assert.equal(list.children[0].dataset.date,'2026-10-27');
});

test('About leads with the three access levels while preserving free creator access and editorial qualifications',()=>{
 assert.equal((about.match(/<h1\b/g)||[]).length,1);assert.match(about,/<h1>About Gold Trails<\/h1>/);
 const comparison=about.indexOf('class="about-membership-section"'),editorial=about.indexOf('class="about-editorial-note"');assert.ok(comparison>about.indexOf('id="main-content"')&&comparison<editorial);
 assert.ok(about.indexOf('<h2 id="how-we-work">')>about.indexOf('id="plus-member-features"'));
 for(const heading of ['Visitor','Free member','Gold Trails Plus'])assert.ok(about.includes('>'+heading+'</h3>'));
 for(const id of ['visitor-features','free-member-features','plus-member-features'])assert.equal((about.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(about,/Free · no account needed/);assert.match(about,/Creator profiles and links to creators’ videos always remain free/);
 assert.match(about,/private calendar of outings/);assert.match(about,/Set up recurring events/);assert.match(about,/\$5 USD per month/);assert.match(about,/full 50-state Almanac/);assert.match(about,/Create Gold Connections events, RSVP, and join event discussions/);
 assert.match(about,/Everything available to visitors, plus/);assert.match(about,/Everything in free membership, plus/);
 assert.match(about,/supporting references/);assert.match(about,/Old-Timer is our editorial voice/);assert.match(about,/assistance from ChatGPT is labeled accordingly/);assert.match(about,/illustrations, not evidence of a particular field result/);
 assert.match(about,/href="\/signup\/"/);assert.match(about,/href="\/plus\/"/);
 assert.doesNotMatch(about,/My Gold Trail|personal dashboard|advanced trip planner|learning progress/i);
});

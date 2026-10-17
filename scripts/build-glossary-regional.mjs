// Add the reviewed regional word book without replacing the existing glossary or shell.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const h=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const topic='Regional words & tools';
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'');
const text=value=>typeof value==='string'&&Boolean(value.trim());
const https=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
export function validateRegionalGlossary(data){
 if(data.version!==1||!validDate(data.checkedAt)||!Array.isArray(data.sources)||!Array.isArray(data.terms))throw new Error('Invalid regional glossary');
 const sourceIds=new Set(),termIds=new Set(),names=new Set();
 for(const source of data.sources){
  if(!text(source.id)||sourceIds.has(source.id)||!text(source.title)||!text(source.publisher)||!https(source.url)||!text(source.inspection)||!validDate(source.checkedAt))throw new Error('Invalid regional source');
  sourceIds.add(source.id);
 }
 for(const term of data.terms){
  if(!/^[a-z]+(?:-[a-z]+)*$/.test(term.id)||termIds.has(term.id)||!text(term.term)||names.has(normalized(term.term))||!text(term.definition)||!text(term.kind)||!text(term.locator)||!validDate(term.checkedAt)||!term.regions?.length||term.regions.some(v=>!text(v))||!Array.isArray(term.aliases)||term.aliases.some(v=>!text(v))||!term.sourceIds?.length||term.sourceIds.some(id=>!sourceIds.has(id))||(term.pdfPage!==undefined&&(!Number.isInteger(term.pdfPage)||term.pdfPage<1)))throw new Error('Invalid regional term: '+term.id);
  termIds.add(term.id);names.add(normalized(term.term));
 }
 return data;
}
export function expandGlossary(html,data){
 validateRegionalGlossary(data);
 const sourceById=new Map(data.sources.map(s=>[s.id,s]));
 const body=html.match(/<tbody>([\s\S]*?)<\/tbody>/);
 if(!body)throw new Error('Existing glossary table not found');
 const rows=[...body[1].matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0]).filter(row=>!row.includes('data-regional-term='));
 const names=rows.map(row=>row.match(/class="term"[^>]*>([\s\S]*?)<\/button>/)?.[1]);
 if(names.some(name=>!name))throw new Error('Unexpected original glossary row');
 for(const entry of data.terms){
  if(names.some(name=>normalized(name)===normalized(h(entry.term))))throw new Error('Regional term duplicates existing entry: '+entry.term);
  const sources=entry.sourceIds.map(id=>{
   const source=sourceById.get(id),url=new URL(source.url);
   if(entry.pdfPage&&/\.pdf$/i.test(url.pathname))url.hash='page='+entry.pdfPage;
   return `<a href="${h(url.href)}" target="_blank" rel="noopener noreferrer">${h(source.publisher)} ↗</a>`;
  }).join(' · ');
  const related=entry.relatedTerms?.length?`<span class="regional-term-reference">English connections: ${h(entry.relatedTerms.join(' · '))}</span>`:'';
  const region=entry.regions.join(' · '),id='definition-regional-'+entry.id;
  const search=[entry.term,...entry.aliases,...entry.regions,entry.kind,...(entry.relatedTerms||[])].join(' ');
  rows.push(`<tr id="term-${entry.id}" data-regional-term="${entry.id}" data-search="${h(search)}"><th scope="row"><button class="term" aria-expanded="false" aria-controls="${id}">${h(entry.term)}</button><span class="term-region">${h(region)}</span><div class="definition" id="${id}" hidden><span class="regional-term-kind">${h(entry.kind)}</span>${h(entry.definition)}${related}<span class="regional-term-reference">Sources: ${sources}</span><span class="regional-term-reference">${h(entry.locator)} · Checked ${h(entry.checkedAt)}</span></div></th><td>${h(topic)}</td></tr>`);
 }
 rows.sort((a,b)=>a.match(/class="term"[^>]*>(.*?)<\/button>/)[1].localeCompare(b.match(/class="term"[^>]*>(.*?)<\/button>/)[1],'en',{sensitivity:'base'}));
 html=html.replace(body[0],'<tbody>'+rows.join('')+'</tbody>');
 if(!html.includes('<option>'+h(topic)+'</option>'))html=html.replace('</select></label></div><p id="term-count"','<option>'+h(topic)+'</option></select></label></div><p id="term-count"');
 html=html.replace(/(<p id="term-count" role="status">)[^<]+/,`$1${rows.length} terms`);
 html=html.replace(/placeholder="Try (?:bedrock, sluice, or snowmelt|fossicking, dolly pot, or Brazil)"/,'placeholder="Try fossicking, dolly pot, or Brazil"');
 html=html.replace(/<p class="regional-glossary-intro">[\s\S]*?<\/p>/,'');
 html=html.replace('<div class="glossary-tools">','<p class="regional-glossary-intro">Includes regional slang and tool names. Search a country, an English equivalent, or the original word.</p><div class="glossary-tools">');
 const bibliography=data.sources.map(s=>`<li><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)} ↗</a><span>${h(s.authors?.join('; ')||s.publisher)}${s.authors?.length?' · '+h(s.publisher):''}${s.publicationDate||s.year?' · '+h(s.publicationDate||s.year):''} · Checked ${h(s.checkedAt)}</span></li>`).join('');
 const references=`<!-- regional-glossary:start --><details class="regional-glossary-sources"><summary>Sources for regional words &amp; tools</summary><p>Country labels identify the usage documented by these sources; many words also travel between goldfields. Historical descriptions and tool names do not establish present-day collecting permission.</p><ol>${bibliography}</ol></details><!-- regional-glossary:end -->`;
 html=html.replace(/<!-- regional-glossary:start -->[\s\S]*?<!-- regional-glossary:end -->/,'');
 html=html.replace('<noscript><p>Enable JavaScript for search and sorting.',references+'<noscript><p>Enable JavaScript for search and sorting.');
 const styles='/* regional-glossary:start */.term-region,.regional-term-kind,.regional-term-reference{display:block;margin-top:7px;font:inherit;line-height:1.6}.term-region{color:#716045}.regional-term-kind{margin:0 0 7px}.glossary tbody th:hover .definition,.glossary tbody th:focus-within .definition{display:block}.glossary-interactive .definition[hidden]{display:none!important}.glossary .definition-close{display:block;margin:0 0 10px auto;padding:6px 12px;min-height:44px;max-width:100%;border:1px solid #d8bc78;border-radius:6px;background:transparent;color:inherit;font:inherit;line-height:1.5;cursor:pointer}.definition a{color:#ffe09b;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}.regional-glossary-sources{margin:24px 0 8px;border-top:1px solid var(--line);padding-top:18px;font:inherit;line-height:1.65}.regional-glossary-sources summary{cursor:pointer}.regional-glossary-sources ol{padding-left:22px}.regional-glossary-sources li{margin:14px 0}.regional-glossary-sources li>span{display:block}.regional-glossary-sources a{overflow-wrap:anywhere}.glossary tr:target{background:#f3e4bd}/* regional-glossary:end */';
 html=html.replace(/\/\* regional-glossary:start \*\/[\s\S]*?\/\* regional-glossary:end \*\//,'').replace('</style>',styles+'</style>');
 const inline=/<script>\s*\(\(\)=>\{const body=document\.querySelector\('\.glossary tbody'\)[\s\S]*?<\/script>/;
 if(inline.test(html))html=html.replace(inline,'<script src="/glossary.js" defer></script>');
 if(!/src="\/glossary\.js(?:\?[^" ]*)?"/.test(html))throw new Error('Glossary behavior script missing');
 return {html,total:rows.length,added:data.terms.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const path=new URL('../dist/glossary/index.html',import.meta.url);
 const data=JSON.parse(await readFile(new URL('../app/glossary/regional-terms.json',import.meta.url),'utf8'));
 const result=expandGlossary(await readFile(path,'utf8'),data);
 const version=createHash('sha256').update(await readFile(new URL('../dist/glossary.js',import.meta.url))).digest('hex').slice(0,12);
 await writeFile(path,result.html.replace(/src="\/glossary\.js(?:\?[^" ]*)?"/,'src="/glossary.js?v='+version+'"'));
 console.log(`Glossary: ${result.total} terms, including ${result.added} sourced regional words and tool names.`);
}

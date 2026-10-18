// Extend the existing word book with sourced research terms; retain its overlay markup.
const h=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const text=value=>typeof value==='string'&&Boolean(value.trim());
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'');
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};

export function validateResearchGlossary(data){
 if(data.version!==1||!date(data.checkedAt)||!Array.isArray(data.sources)||!Array.isArray(data.terms))throw new Error('Invalid research glossary');
 const sources=new Set(),ids=new Set(),names=new Set();
 for(const s of data.sources){
  if(!text(s.id)||sources.has(s.id)||!text(s.title)||!text(s.publisher)||!https(s.url)||!text(s.inspection)||!date(s.checkedAt))throw new Error('Invalid research glossary source');
  sources.add(s.id);
 }
 for(const t of data.terms){
  if(!/^[a-z]+(?:-[a-z]+)*$/.test(t.id)||ids.has(t.id)||!text(t.term)||names.has(normalized(t.term))||!text(t.topic)||!text(t.definition)||!text(t.locator)||!date(t.checkedAt)||!Array.isArray(t.aliases)||t.aliases.some(a=>!text(a))||!Array.isArray(t.sourceIds)||!t.sourceIds.length||t.sourceIds.some(id=>!sources.has(id))||(t.relatedTerms!==undefined&&(!Array.isArray(t.relatedTerms)||t.relatedTerms.some(a=>!text(a))))||(t.pdfPage!==undefined&&(!Number.isInteger(t.pdfPage)||t.pdfPage<1)))throw new Error('Invalid research glossary term: '+t.id);
  ids.add(t.id);names.add(normalized(t.term));
 }
 return data;
}

export function expandResearchGlossary(html,data){
 validateResearchGlossary(data);
 const body=html.match(/<tbody>([\s\S]*?)<\/tbody>/);
 if(!body)throw new Error('Existing glossary table not found');
 const rows=[...body[1].matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0]).filter(row=>!row.includes('data-research-term='));
 const names=rows.map(row=>row.match(/class="term"[^>]*>([\s\S]*?)<\/button>/)?.[1]);
 if(names.some(name=>!name))throw new Error('Unexpected existing glossary row');
 const sourceById=new Map(data.sources.map(s=>[s.id,s]));
 for(const t of data.terms){
  if(names.some(name=>normalized(name)===normalized(h(t.term))))throw new Error('Research term duplicates existing entry: '+t.term);
  const sources=t.sourceIds.map(id=>{const s=sourceById.get(id),url=new URL(s.url);if(t.pdfPage&&/\.pdf$/i.test(url.pathname))url.hash='page='+t.pdfPage;return `<a href="${h(url.href)}" target="_blank" rel="noopener noreferrer">${h(s.publisher)} ↗</a>`;}).join(' · ');
  const related=t.relatedTerms?.length?`<span class="regional-term-reference">Related terms: ${h(t.relatedTerms.join(' · '))}</span>`:'';
  const id='definition-research-'+t.id;
  rows.push(`<tr id="term-${t.id}" data-research-term="${t.id}" data-search="${h([t.term,...t.aliases,...(t.relatedTerms||[])].join(' '))}"><th scope="row"><button class="term" aria-expanded="false" aria-controls="${id}">${h(t.term)}</button><div class="definition" id="${id}" hidden>${h(t.definition)}${related}<span class="regional-term-reference">Sources: ${sources}</span><span class="regional-term-reference">${h(t.locator)} · Checked ${h(t.checkedAt)}</span></div></th><td>${h(t.topic)}</td></tr>`);
 }
 rows.sort((a,b)=>a.match(/class="term"[^>]*>(.*?)<\/button>/)[1].localeCompare(b.match(/class="term"[^>]*>(.*?)<\/button>/)[1],'en',{sensitivity:'base'}));
 html=html.replace(body[0],'<tbody>'+rows.join('')+'</tbody>').replace(/(<p id="term-count" role="status">)[^<]+/,`$1${rows.length} terms`);
 for(const topic of new Set(data.terms.map(t=>t.topic)))if(!html.includes('<option>'+h(topic)+'</option>'))html=html.replace('</select></label></div><p id="term-count"','<option>'+h(topic)+'</option></select></label></div><p id="term-count"');
 const bibliography=data.sources.map(s=>`<li><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)} ↗</a><span>${h(s.authors?.join('; ')||s.publisher)}${s.authors?.length?' · '+h(s.publisher):''}${s.publicationDate||s.year?' · '+h(s.publicationDate||s.year):''}${s.revisionDate?' · Revised '+h(s.revisionDate):''} · Checked ${h(s.checkedAt)}</span></li>`).join('');
 const references=`<!-- research-glossary:start --><details class="regional-glossary-sources"><summary>Sources for soil and bedrock map terms</summary><p>Definitions explain the cited source's terminology. Soil and geological maps use different bedrock boundaries; these terms do not establish gold content or permission to prospect. Practical implications are labeled as Gold Trails interpretations.</p><ol>${bibliography}</ol></details><!-- research-glossary:end -->`;
 html=html.replace(/<!-- research-glossary:start -->[\s\S]*?<!-- research-glossary:end -->/,'').replace('<noscript><p>Enable JavaScript for search and sorting.',references+'<noscript><p>Enable JavaScript for search and sorting.');
 html=html.replace('<p class="regional-glossary-intro">Includes regional slang and tool names. Search a country, an English equivalent, or the original word.</p>','<p class="regional-glossary-intro">Prospecting words, regional slang, tool names, and soil &amp; bedrock map terms. Select a term for its definition.</p>');
 return {html,total:rows.length,added:data.terms.length};
}

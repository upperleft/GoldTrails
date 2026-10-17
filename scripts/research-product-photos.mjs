// Public product-page images become review candidates, never automatic catalog imports.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
const output=resolve(process.argv[2]||'/tmp/gold-trails-product-photo-review');
await mkdir(output,{recursive:true});
const products=JSON.parse(await readFile(new URL('../app/product-catalog.json',import.meta.url))).tables.products;
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
const urlFor=(value,base)=>{try{const u=new URL(decode(value),base);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const imageValues=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(imageValues):value&&typeof value==='object'?imageValues(value.url||value.contentUrl||value.src||[]):[];
const results=[];
async function collect(p){
 const result={id:p.product_id,name:p.product_name,page:p.official_product_url,candidates:[]};
 if(!p.official_product_url){result.status='No official product URL';return result;}
 try{
  const r=await fetch(p.official_product_url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Product page HTTP '+r.status);
  const html=await r.text();result.title=decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'');result.page=r.url;
  const objects=[];
  const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(/Product/.test(String(v['@type'])))objects.push(v);for(const child of Object.values(v))if(child&&typeof child==='object')walk(child);}};
  for(const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{walk(JSON.parse(m[1]));}catch{}
  const variant=new URL(p.official_product_url).searchParams.get('variant');
  let selected=variant?objects.filter(o=>String(o['@id']||o.url||o.offers?.url||'').includes('variant='+variant)):objects;
  if(!selected.length&&!r.url.includes('gsioutdoors.com'))selected=objects;
  const candidates=selected.flatMap(o=>imageValues(o.image));
  if(!variant)for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));if(['og:image','og:image:secure_url'].includes(attrs.property))candidates.push(attrs.content);}
  // Older manufacturer sites often identify the real image only in its alt/title or SKU.
  const words=p.product_name.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter(w=>!['gold','with','keene','original','outdoors','stainless','steel'].includes(w))||[];
  const code=new URL(p.official_product_url).searchParams.get('Product_Code');
  const ranked=[];
  for(const tag of html.match(/<img\b[^>]*>/gi)||[]){const a=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),decode(m[2])]));const label=((a.alt||'')+' '+(a.title||'')).toLowerCase(),src=a['data-src']||a.src||'';let score=words.filter(w=>label.includes(w)).length*3;if(code&&(label.includes(code.toLowerCase())||src.toLowerCase().includes(code.toLowerCase())))score+=12;if(/product|gallery|wp-post-image/.test(a.class||''))score+=2;if(score>=5)ranked.push({score,src});}
  candidates.push(...ranked.sort((a,b)=>b.score-a.score).slice(0,5).map(a=>a.src));
  const seen=new Set();
  for(const value of candidates){if(result.candidates.length===2)break;const url=urlFor(value,r.url);if(!url||/logo|favicon|placeholder|payment|badge|unsplash/i.test(url))continue;const key=new URL(url).origin+new URL(url).pathname.replace(/_\d+x(?=\.)/,'');if(seen.has(key))continue;seen.add(key);
   try{const image=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!image.ok||!image.headers.get('content-type')?.startsWith('image/'))continue;const bytes=Buffer.from(await image.arrayBuffer());if(bytes.length>12000000)continue;const meta=await sharp(bytes).metadata();if(meta.width<180||meta.height<140)continue;
    const name=p.product_id+'-'+(result.candidates.length+1)+'.webp';await sharp(bytes).rotate().resize({width:1100,height:900,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(resolve(output,name));
    result.candidates.push({file:name,url,width:meta.width,height:meta.height,productNames:selected.map(o=>o.name).filter(Boolean).slice(0,5)});
   }catch{}
  }
  result.status=result.candidates.length?'Needs visual verification':'No usable product image in structured metadata';
 }catch(e){result.status=e.name==='TimeoutError'?'Product page timed out':String(e.message).slice(0,100);}
 return result;
}
let cursor=0;
await Promise.all(Array.from({length:5},async()=>{while(cursor<products.length){const p=products[cursor++],r=await collect(p);results.push(r);console.log(p.product_id+': '+r.candidates.length+' image candidates');}}));
results.sort((a,b)=>a.id.localeCompare(b.id));await writeFile(resolve(output,'candidates.json'),JSON.stringify(results,null,2)+'\n');
const candidates=results.flatMap(r=>r.candidates.map(c=>({...c,id:r.id,name:r.name})));
for(let start=0;start<candidates.length;start+=20){const group=candidates.slice(start,start+20),tiles=[];for(let i=0;i<group.length;i++){const c=group[i],photo=await sharp(resolve(output,c.file)).resize(210,135,{fit:'contain',background:'#ffffff'}).png().toBuffer(),text=(`${c.id} ${c.name}`).replace(/[&<>]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]));const label=Buffer.from(`<svg width="230" height="42"><rect width="230" height="42" fill="#fff"/><text x="6" y="15" font-family="Arial" font-size="11">${text.slice(0,33)}</text><text x="6" y="31" font-family="Arial" font-size="11">${text.slice(33,67)}</text></svg>`);tiles.push({input:photo,left:(i%4)*230+10,top:Math.floor(i/4)*180},{input:label,left:(i%4)*230,top:Math.floor(i/4)*180+136});}
 await sharp({create:{width:920,height:Math.ceil(group.length/4)*180,channels:3,background:'#eee8dd'}}).composite(tiles).png().toFile(resolve(output,'review-'+(Math.floor(start/20)+1)+'.png'));
}
console.log(JSON.stringify({reviewDirectory:output,products:results.length,withCandidates:results.filter(r=>r.candidates.length).length,images:candidates.length}));

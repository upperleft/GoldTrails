// Content-based stylesheet URLs prevent old browser/CDN styles surviving a deployment.
import { createHash } from 'node:crypto';
import { readFile,writeFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
const version=createHash('sha256').update(await readFile('dist/style.css')).digest('hex').slice(0,12);
const helpVersion=createHash('sha256').update(await readFile('dist/site-help.css')).update(await readFile('dist/site-help-content.js')).digest('hex').slice(0,12);
// Version the module dependency first so its new URL also changes the entry hash.
const helpPath='dist/site-help.js',helpSource=await readFile(helpPath,'utf8'),helpModule=helpSource.replace(/from '\.\/site-help-content\.js(?:\?[^']*)?'/,`from './site-help-content.js?v=${helpVersion}'`);
if(helpModule!==helpSource)await writeFile(helpPath,helpModule);
const scriptVersion=createHash('sha256').update(helpModule).digest('hex').slice(0,12);
const priceVersion=createHash('sha256').update(await readFile('dist/gold-price.js')).digest('hex').slice(0,12);
const photoVersion=createHash('sha256').update(await readFile('dist/article-photos.css')).digest('hex').slice(0,12);
const rockVersion=createHash('sha256').update(await readFile('dist/river-rocks.css')).digest('hex').slice(0,12);
const photoViewerVersion=createHash('sha256').update(await readFile('dist/article-photo-viewer.js')).digest('hex').slice(0,12);
const entryStyles=new Map(await Promise.all(['about.css','article-listing.css'].map(async name=>[name,createHash('sha256').update(await readFile('dist/'+name)).digest('hex').slice(0,12)])));
async function update(path){const source=await readFile(path,'utf8');let result=source.replace(/href="\/style\.css(?:\?[^" ]*)?"/g,`href="/style.css?v=${version}"`).replace(/href="\/site-help\.css(?:\?[^" ]*)?"/g,`href="/site-help.css?v=${helpVersion}"`).replace(/href="\/article-photos\.css(?:\?[^" ]*)?"/g,`href="/article-photos.css?v=${photoVersion}"`).replace(/href="\/river-rocks\.css(?:\?[^" ]*)?"/g,`href="/river-rocks.css?v=${rockVersion}"`).replace(/src="\/article-photo-viewer\.js(?:\?[^" ]*)?"/g,`src="/article-photo-viewer.js?v=${photoViewerVersion}"`).replace(/src="\/site-help\.js(?:\?[^" ]*)?"/g,`src="/site-help.js?v=${scriptVersion}"`).replace(/src="\/gold-price\.js(?:\?[^" ]*)?"/g,`src="/gold-price.js?v=${priceVersion}"`);for(const [name,hash]of entryStyles){const escaped=name.replace('.', '\\.');result=result.replace(new RegExp('href="/'+escaped+'(?:\\?[^" ]*)?"','g'),'href="/'+name+'?v='+hash+'"');}if(result!==source)await writeFile(path,result);}
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(entry.name.endsWith('.html'))await update(path);}}
await walk('dist');await update('app/page-shell.html');

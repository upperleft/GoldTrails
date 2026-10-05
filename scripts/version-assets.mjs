// Content-based stylesheet URLs prevent old browser/CDN styles surviving a deployment.
import { createHash } from 'node:crypto';
import { readFile,writeFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
const version=createHash('sha256').update(await readFile('dist/style.css')).digest('hex').slice(0,12);
async function update(path){const source=await readFile(path,'utf8');const result=source.replace(/href="\/style\.css(?:\?[^" ]*)?"/g,`href="/style.css?v=${version}"`);if(result!==source)await writeFile(path,result);}
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(entry.name.endsWith('.html'))await update(path);}}
await walk('dist');await update('app/page-shell.html');

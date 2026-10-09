import {readdir,readFile,access} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
// These routes are supplied by the server and covered by HTTP tests.
const serverRoutes=new Set(['/admin/login/','/creator-map/']);
const root=resolve('dist');let count=0,links=0;const errors=[];
async function walk(dir){for(const ent of await readdir(dir,{withFileTypes:true})){const file=join(dir,ent.name);if(ent.isDirectory())await walk(file);else if(ent.name.endsWith('.html')){
 count++;const html=await readFile(file,'utf8');
 for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
 const url=m[1];if(/^(?:[a-z]+:|\/\/|#)/i.test(url))continue;
 const path=url.split(/[?#]/)[0];let target=path.startsWith('/')?resolve(root,'.'+path):resolve(dirname(file),path);
 if(path.endsWith('/'))target=join(target,'index.html');links++;
 if(serverRoutes.has(path))continue;
 try{await access(target);}catch{errors.push(`${file}: missing ${url}`);}
 }
}}}
await walk(root);if(errors.length)throw new Error(errors.join('\n'));
console.log(`Gold Trails ready: ${count} HTML pages, ${links} local links/assets checked. Static output: dist/`);

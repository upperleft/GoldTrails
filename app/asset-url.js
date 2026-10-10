import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const versions=new Map();
export function assetUrl(name){
 if(!/^[a-z0-9-]+\.(css|js)$/.test(name))throw new Error('Unsupported asset');
 if(!versions.has(name))versions.set(name,createHash('sha256').update(readFileSync(new URL('../dist/'+name,import.meta.url))).digest('hex').slice(0,12));
 return '/'+name+'?v='+versions.get(name);
}

import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
// Local, pinned packages: no calendar CDN requests or third-party event traffic.
await mkdir('dist/calendar-vendor',{recursive:true});
for(const [source,target] of [
 ['node_modules/fullcalendar/index.global.min.js','fullcalendar.js'],
 ['node_modules/luxon/build/global/luxon.min.js','luxon.js'],
 ['node_modules/@fullcalendar/luxon3/index.global.min.js','luxon3.js'],
])await copyFile(source,'dist/calendar-vendor/'+target);
const license=[];
for(const name of ['fullcalendar','@fullcalendar/core','@fullcalendar/luxon3','luxon']){
 for(const file of ['LICENSE.md','LICENSE']){try{license.push(`${name}\n${await readFile('node_modules/'+name+'/'+file,'utf8')}`);break;}catch{}}
}
await writeFile('dist/calendar-vendor/LICENSE.txt',license.join('\n\n'));
console.log('Calendar browser assets prepared from pinned packages.');

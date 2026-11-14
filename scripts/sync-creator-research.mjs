import {createHash} from 'node:crypto';
import {readFile,rename,writeFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {reconcileCreatorResearch} from '../app/creator-sync.js';

const root=process.cwd();
const args=process.argv.slice(2);
const apply=args.includes('--apply');
const positional=args.filter(arg=>!arg.startsWith('--'));
if(args.some(arg=>arg!=='--apply'&&arg.startsWith('--'))||positional.length!==1){
 console.error('Usage: node scripts/sync-creator-research.mjs <normalized-input.json> [--apply]');
 process.exit(2);
}
const inputPath=resolve(root,positional[0]);
if(!inputPath.startsWith(root+'/')||basename(inputPath).startsWith('.'))throw new Error('Research input must be a named file inside the project.');
const [inputText,catalogText,libraryText]=await Promise.all([
 readFile(inputPath,'utf8'),
 readFile(resolve(root,'app/creator-catalog.json'),'utf8'),
 readFile(resolve(root,'app/creator-video-library.json'),'utf8')
]);
const input=JSON.parse(inputText),catalog=JSON.parse(catalogText),library=JSON.parse(libraryText);
const result=reconcileCreatorResearch(input,catalog,library);
const report={...result.summary,inputSha256:createHash('sha256').update(inputText).digest('hex'),mode:apply?'apply':'dry-run',exceptionDetails:result.exceptions};
if(apply&&(result.summary.addedCreators||result.summary.addedVideos)){
 const stamp=`.sync-${process.pid}-${Date.now()}`;
 const catalogPath=resolve(root,'app/creator-catalog.json'),libraryPath=resolve(root,'app/creator-video-library.json');
 const catalogTemp=catalogPath+stamp,libraryTemp=libraryPath+stamp;
 let catalogReplaced=false;
 try{
  await Promise.all([
   writeFile(catalogTemp,JSON.stringify(result.catalog,null,2)+'\n',{flag:'wx',mode:0o644}),
   writeFile(libraryTemp,JSON.stringify(result.library,null,2)+'\n',{flag:'wx',mode:0o644})
  ]);
  await rename(catalogTemp,catalogPath);
  catalogReplaced=true;
  await rename(libraryTemp,libraryPath);
 }catch(error){
  if(catalogReplaced){
   const rollbackPath=catalogPath+stamp+'.rollback';
   await writeFile(rollbackPath,catalogText,{flag:'wx',mode:0o644});
   await rename(rollbackPath,catalogPath);
  }
  await Promise.all([catalogTemp,libraryTemp].map(path=>import('node:fs/promises').then(fs=>fs.rm(path,{force:true}))));
  throw error;
 }
}
console.log(JSON.stringify(report));

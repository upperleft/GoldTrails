// Explicit development-only importer. Never runs during startup or deployment.
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../app/database.js';
import {importResearchBatch} from '../app/creator-research.js';
if(process.env.RESEARCH_DATABASE_MODE!=='development'||!['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST))throw Error('Use a local development database; production import is disabled');
const file=process.argv[2];if(!file)throw Error('Provide a reviewed batch JSON file');
const batch=JSON.parse(await readFile(file,'utf8'));const db=createDatabase();
try{console.log(await importResearchBatch(db,batch));}catch{console.error('Research import failed; no database credentials printed.');process.exitCode=1;}finally{await db.end();}

// Repeatable development-only migration. Backup first; MariaDB DDL auto-commits.
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../app/database.js';
if(process.env.RESEARCH_DATABASE_MODE!=='development'||!['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST))throw Error('Use a local development database; production migration is disabled');
const sql=await readFile(new URL('../database/migrations/005_creator_research.sql',import.meta.url),'utf8');
const db=createDatabase();let c;
try{c=await db.getConnection();for(const statement of sql.replace(/^--.*$/gm,'').split(';').filter(x=>x.trim()))await c.query(statement);console.log('Creator research migration complete. Reapplying preserves records.');}
catch{console.error('Migration failed. Inspect partial DDL before retrying; no tables were dropped and no credentials printed.');process.exitCode=1;}
finally{c?.release();await db.end();}

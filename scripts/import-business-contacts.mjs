// Explicit reviewed import only; never run by startup/build. Back up the DB first.
import {createDatabase} from '../app/database.js';
import {importBusinessContacts} from '../app/business-contacts.js';
if(process.env.CONTACT_IMPORT_CONFIRMED!=='true')throw Error('Back up and review the batch, then set CONTACT_IMPORT_CONFIRMED=true');
const db=createDatabase();if(!db)throw Error('Configure DB_* privately');
try{console.log(await importBusinessContacts(db,process.env.CONTACT_IMPORT_ACTOR||'site-owner'));}catch{console.error('Contact import failed; credentials and contact values were not logged.');process.exitCode=1;}finally{await db.end();}

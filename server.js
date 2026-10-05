import { createDatabase } from './app/database.js';
import { createDirectoryStore } from './app/directory-store.js';
import { createServer } from './app/server.js';

import { createAdminStore } from './app/admin-store.js';
import { createAdminHandler } from './app/admin.js';
import { adminConfig } from './app/admin-auth.js';

let db = null;
try { db = createDatabase(); }
catch { console.error('Gold Trails database settings need attention'); }
let config=null;
try { config=adminConfig(); } catch { console.error('Gold Trails administrator settings need attention'); }
const admin=createAdminHandler({store:db?createAdminStore(db,config?.passwordHash):null,config});
const server = createServer({ directory: db ? createDirectoryStore(db) : null, admin });
const port = Number(process.env.PORT || 3000);
server.listen(port,'0.0.0.0',() => console.log(`Gold Trails listening on port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,() => {
  server.close(async () => { if (db) await db.end(); process.exit(0); });
  setTimeout(() => process.exit(0),10000).unref();
});

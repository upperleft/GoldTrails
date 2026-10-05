import { createDatabase } from './app/database.js';
import { createDirectoryStore } from './app/directory-store.js';
import { createServer } from './app/server.js';

let db = null;
try { db = createDatabase(); }
catch { console.error('Gold Trails database settings need attention'); }
const server = createServer({ directory: db ? createDirectoryStore(db) : null });
const port = Number(process.env.PORT || 3000);
server.listen(port,'0.0.0.0',() => console.log(`Gold Trails listening on port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,() => {
  server.close(async () => { if (db) await db.end(); process.exit(0); });
  setTimeout(() => process.exit(0),10000).unref();
});

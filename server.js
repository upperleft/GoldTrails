import { createDatabase } from './app/database.js';
import { createDirectoryStore } from './app/directory-store.js';
import { createServer } from './app/server.js';

import { createAdminStore } from './app/admin-store.js';
import { createAdminHandler } from './app/admin.js';
import {createMemberStore} from './app/member-store.js';
import {createMemberHandler,memberConfig} from './app/members.js';
import {memberMail} from './app/member-mail.js';
import { adminConfig } from './app/admin-auth.js';

import {createCompassStore} from './app/compass/store.js';
import {createCompassContent} from './app/compass/content.js';
import {createCompassHandler} from './app/compass/handler.js';

let db = null;
try { db = createDatabase(); }
catch { console.error('Gold Trails database settings need attention'); }
let config=null;
try { config=adminConfig(); } catch { console.error('Gold Trails administrator settings need attention'); }
const admin=createAdminHandler({store:db?createAdminStore(db,config?.passwordHash):null,config});
const memberStore=db?createMemberStore(db):null, memberSettings=memberConfig();
const directory=db?createDirectoryStore(db):null, compassStore=db?createCompassStore(db):null;
const members=createMemberHandler({store:memberStore,config:memberSettings,mail:memberMail()});
const compass=createCompassHandler({members:memberStore,store:compassStore,config:memberSettings,content:createCompassContent({directory,store:compassStore})});
const server = createServer({ members, directory, admin, compass });
const port = Number(process.env.PORT || 3000);
server.listen(port,'0.0.0.0',() => console.log(`Gold Trails listening on port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,() => {
  server.close(async () => { if (db) await db.end(); process.exit(0); });
  setTimeout(() => process.exit(0),10000).unref();
});

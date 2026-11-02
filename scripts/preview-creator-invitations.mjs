// Standalone browser fixture: isolated /private/tmp MariaDB, fictional accounts only.
// Never imported by server.js. No real email, credentials or payments are used.
import mariadb from 'mariadb';
import {createServer} from '../app/server.js';
import {createAdminHandler} from '../app/admin.js';
import {createMemberHandler} from '../app/members.js';
import {createMemberStore} from '../app/member-store.js';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {createCreatorInvitationHandler} from '../app/creator-invitations/handler.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {randomUUID} from 'node:crypto';
import {hashPassword} from '../app/admin-auth.js';

const socket=process.env.CREATOR_INVITATIONS_DB_SOCKET||'';
if(process.env.RUN_CREATOR_INVITATION_PREVIEW!=='true'||!/^\/private\/tmp\/goldtrails-invitations-db-[A-Za-z0-9]+\/mysql\.sock$/.test(socket))throw Error('Use only the explicitly enabled isolated invitation test database.');
const db=mariadb.createPool({socketPath:socket,user:'root',database:'gold_creator_invitation_test',connectionLimit:4,dateStrings:true,timezone:'+00:00',initSql:["SET time_zone='+00:00'"]});
if((await db.query("SELECT version FROM schema_migrations WHERE version IN ('001_directory_foundation','002_creator_management','004_member_accounts','014_creator_invitations')")).length!==4){await db.end();throw Error('Apply isolated migrations 001, 002, 004 and 014 before the browser preview.');}
if(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n)!==0){await db.end();throw Error('The preview requires an empty isolated member database.');}
const origin='http://127.0.0.1:4345',csrf='a'.repeat(64),adminRaw='b'.repeat(64);
const memberStore=createMemberStore(db),invitations=createCreatorInvitationStore(db);
const passwordHash=await hashPassword('Fictional creator preview only');
const owner=await memberStore.signup({username:'PreviewOwner',email:'preview-owner@example.invalid',passwordHash,displayName:'Preview owner'});
const creator=await memberStore.signup({username:'PreviewCreator',email:'preview-creator@example.invalid',passwordHash,displayName:'River Teacher'});
for(const account of [owner,creator])await memberStore.consume(await memberStore.issue(account.id,'verify_email'),'verify_email');
const person=randomUUID();
await db.query("INSERT INTO people(id,slug,display_name,publication_status) VALUES(?,?,'River Teacher','published')",[person,'invitation-preview-river-teacher']);
await invitations.configureOwner(owner.email,'Preview owner');
const invite=await invitations.issue({personId:person,email:creator.email,actor:'Preview owner'});
const session=await memberStore.login(creator.id,0,csrf);
const ownerSessions={session:async raw=>raw===adminRaw?{authenticated:true,csrf_token:csrf}:null};
const config={origin,open:false,username:'Preview owner',passwordHash};
const admin=createAdminHandler({store:ownerSessions,config,creatorInvitations:invitations});
const server=createServer({canonicalOrigin:null,creatorInvitations:createCreatorInvitationHandler({store:invitations,members:memberStore,config}),members:createMemberHandler({store:memberStore,invitations,config}),memberSessions:memberStore,admin,almanac:createAlmanacHandler({members:memberStore}),goldPrice:async()=>({})});
const app=server.listeners('request')[0];server.removeAllListeners('request');let signedIn=false;
server.on('request',(req,res)=>{
 if(req.url==='/__preview__/anonymous/'||req.url==='/__preview__/creator/'){
  signedIn=req.url==='/__preview__/creator/';res.writeHead(303,{Location:'/creator-invitation/'});res.end();return;
 }
 // Safari's secure production cookies are verified by the HTTP tests. This HTTP
 // fixture supplies only the fictional test sessions so native forms can be checked.
 req.headers.cookie=`__Host-gold-form=${csrf}; __Host-gold-creator-invite=${invite.raw}; __Host-gold-admin=${adminRaw}`+(signedIn?`; __Host-gold-member=${session}`:'');
 return app(req,res);
});
server.listen(4345,'127.0.0.1',()=>console.log('Fictional creator preview ready at '+origin+'/creator-invitation/'));
async function close(){
 await new Promise(resolve=>server.close(resolve));
 await db.query('DELETE FROM creator_invitation_audit');await db.query('DELETE FROM creator_invitations');
 await db.query('UPDATE creator_invitation_settings SET owner_account_id=NULL,configured_by=\'\' WHERE id=1');
 for(const table of ['member_audit_log','member_creator_connections','member_sessions','member_tokens','member_memberships','member_profiles','member_role_grants'])await db.query(`DELETE FROM ${table} WHERE account_id IN (?,?)`,[owner.id,creator.id]);
 await db.query('DELETE FROM member_accounts WHERE id IN (?,?)',[owner.id,creator.id]);await db.query('DELETE FROM people WHERE id=?',[person]);await db.end();
}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>close().then(()=>process.exit(0)).catch(()=>process.exit(1)));

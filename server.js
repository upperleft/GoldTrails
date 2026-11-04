import {createHomepageHandler} from './app/homepage/handler.js';
import {processEventPhoto} from './app/connections/photos.js';
import {unsubscribeLinks} from './app/connections/notifications.js';
import {createConnectionsHandler} from './app/connections/handler.js';
import {createConnectionsStore} from './app/connections/store.js';
import {meetingVault} from './app/connections/model.js';
import {createAlmanacCreators} from './app/almanac/creators.js';
import {createSuggestionStore,createSuggestionsHandler} from './app/suggestions.js';
import {createCalendarHandler} from './app/calendar/handler.js';
import {createCalendarStore} from './app/calendar/store.js';
import {createAlmanacHandler} from './app/almanac/handler.js';
import {createAlmanacStore} from './app/almanac/store.js';
import { createDatabase } from './app/database.js';
import {createAnalyticsStore} from './app/analytics/store.js';
import {createAnalyticsHandler} from './app/analytics/handler.js';
import { createDirectoryStore } from './app/directory-store.js';
import { createServer } from './app/server.js';

import { createAdminStore } from './app/admin-store.js';
import { createAdminHandler } from './app/admin.js';
import {createMemberStore} from './app/member-store.js';
import {createMemberHandler,memberConfig} from './app/members.js';
import {memberMail} from './app/member-mail.js';
import {creatorInvitationMail} from './app/creator-invitations/mail.js';
import {createCreatorOutreachStore} from './app/creator-invitations/outreach.js';
import { adminConfig } from './app/admin-auth.js';
import {createCreatorInvitationStore} from './app/creator-invitations/store.js';
import {createCreatorInvitationHandler} from './app/creator-invitations/handler.js';
import {createCreatorRepliesStore} from './app/creator-replies/store.js';
import {createCreatorRepliesImportHandler} from './app/creator-replies/handler.js';
import {billingScope,stripeConfig} from './app/billing/config.js';
import {createBillingStore} from './app/billing/store.js';
import {createStripeProvider} from './app/billing/provider.js';
import {createBillingHandler} from './app/billing/handler.js';
import {createPlusHandler} from './app/plus/handler.js';


import {createProductWorkspace} from './app/product-workspace.js';
import {createProductsHandler} from './app/product-reports.js';

let db = null;
try { db = createDatabase(); }
catch { console.error('Gold Trails database settings need attention'); }
let config=null;
try { config=adminConfig(); } catch { console.error('Gold Trails administrator settings need attention'); }
const productWorkspace=db?createProductWorkspace(db):null;
const suggestionStore=db?createSuggestionStore(db):null;
const analyticsStore=db?createAnalyticsStore(db):null;
const ownerStore=db?createAdminStore(db,config?.passwordHash):null;
const invitationStore=db?createCreatorInvitationStore(db):null;
const creatorOutreach=db?createCreatorOutreachStore(db):null;
const creatorMail=creatorInvitationMail();
const creatorReplyMailbox=process.env.CREATOR_REPLY_MAILBOX;
const creatorReplies=db?createCreatorRepliesStore(db,{mailbox:creatorReplyMailbox}):null;
const creatorRepliesImport=createCreatorRepliesImportHandler({store:creatorReplies,mailbox:creatorReplyMailbox});
const admin=createAdminHandler({workspace:productWorkspace,store:ownerStore,config,analyticsStore,suggestionStore,creatorInvitations:invitationStore,creatorOutreach,creatorInvitationMail:creatorMail,creatorReplies,creatorRepliesSyncConfigured:creatorRepliesImport.configured});
const subscriptionScope=billingScope();
let stripeSettings=null;
try{stripeSettings=stripeConfig();}catch{console.error('Gold Trails billing settings need attention');}
const memberStore=db?createMemberStore(db,{billing:subscriptionScope}):null, memberSettings=memberConfig();
const billingStore=db&&subscriptionScope?createBillingStore(db,subscriptionScope):null;
const billing=createBillingHandler({store:billingStore,members:memberStore,provider:stripeSettings?createStripeProvider(stripeSettings):null,config:stripeSettings,invitations:invitationStore});
const directory=db?createDirectoryStore(db):null;
const members=createMemberHandler({store:memberStore,config:memberSettings,mail:memberMail(),invitations:invitationStore});
const creatorInvitations=createCreatorInvitationHandler({store:invitationStore,members:memberStore,config:memberSettings});
const products=createProductsHandler({store:productWorkspace,members:memberStore,config:memberSettings});
const connectionsVault=meetingVault(process.env.CONNECTIONS_ENCRYPTION_KEY);
const connections=createConnectionsHandler({store:db?createConnectionsStore(db,{vault:connectionsVault,billingProvider:'stripe',billing:subscriptionScope}):null,members:memberStore,owners:ownerStore,config:memberSettings,vault:connectionsVault,processPhoto:processEventPhoto,unsubscribe:unsubscribeLinks(process.env.CONNECTIONS_UNSUBSCRIBE_SECRET),calendarStore:db?createCalendarStore(db):null});
const calendar=createCalendarHandler({members:memberStore,store:db?createCalendarStore(db):null,config:memberSettings});
const server = createServer({ billing, plus:createPlusHandler({billing}), creatorRepliesImport, creatorInvitations, homepage:createHomepageHandler({members:memberStore,config:memberSettings,invitations:invitationStore}), connections, suggestions:createSuggestionsHandler({store:suggestionStore,origin:memberSettings?.origin||config?.origin}), analytics:createAnalyticsHandler({store:analyticsStore,origin:memberSettings?.origin||config?.origin}), calendar, members, memberSessions:memberStore, directory, admin, products, almanac:createAlmanacHandler({creators:createAlmanacCreators(directory),store:db?createAlmanacStore(db):null,members:memberStore,owners:ownerStore,log:console.error}) });
const port = Number(process.env.PORT || 3000);
server.listen(port,'0.0.0.0',() => console.log(`Gold Trails listening on port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,() => {
  server.close(async () => { if (db) await db.end(); process.exit(0); });
  setTimeout(() => process.exit(0),10000).unref();
});

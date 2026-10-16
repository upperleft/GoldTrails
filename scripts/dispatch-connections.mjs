// Nothing in the web server starts this worker. Run only after release approval.
import {createDatabase} from '../app/database.js';
import {createConnectionsStore} from '../app/connections/store.js';
import {meetingVault} from '../app/connections/model.js';
import {connectionsMail,unsubscribeLinks,dispatchNotifications} from '../app/connections/notifications.js';
if(process.argv.includes('--stripe-test')&&process.env.DB_NAME!=='gold_connections_test')throw Error('Stripe test notification delivery requires the isolated gold_connections_test database');
const send=connectionsMail(),unsubscribe=unsubscribeLinks(process.env.CONNECTIONS_UNSUBSCRIBE_SECRET);
if(process.argv[2]!=='--send'||!send||!unsubscribe){console.error('Delivery disabled. Requires --send, approved CONNECTIONS_EMAIL_ENABLED=true, existing mail settings and CONNECTIONS_UNSUBSCRIBE_SECRET.');process.exitCode=1;}
else{
 const db=createDatabase();if(!db)throw Error('Database unavailable');
 try{const store=createConnectionsStore(db,{vault:meetingVault(process.env.CONNECTIONS_ENCRYPTION_KEY),billingProvider:process.argv.includes('--stripe-test')?'stripe_test':'stripe'});if(!await store.ready())throw Error('Gold Connections migration not applied');console.log(JSON.stringify(await dispatchNotifications({store,send,unsubscribe,origin:process.env.MEMBER_ORIGIN})));}
 catch{console.error('Gold Connections worker unavailable. Inspect private delivery statuses; no recipient details are logged.');process.exitCode=1;}finally{await db.end();}
}

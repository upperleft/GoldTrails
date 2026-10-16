// Actual production homepage renderer; no real database, payments or email.
import {createServer} from '../app/server.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
const calibration=process.argv.includes('--calibrate');
createServer({homepage:createHomepageHandler({calibration}),connections:createConnectionsHandler(),goldPrice:async()=>({}),log:()=>{}}).listen(4332,'127.0.0.1',()=>console.log('Gold Trails illustrated homepage: http://127.0.0.1:4332/'));

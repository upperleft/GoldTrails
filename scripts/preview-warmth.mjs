// Production renderers, public catalog data only. No database, email or payments.
import {createServer} from '../app/server.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
createServer({directory,homepage:createHomepageHandler(),goldPrice:async()=>({}),log:console.error}).listen(4334,'127.0.0.1',()=>console.log('Gold Trails warmth and products preview: http://127.0.0.1:4334/'));

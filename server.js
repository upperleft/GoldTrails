import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
const server = http.createServer(async (req,res) => {
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  try {
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file = resolve(root,'.'+path);
    if(file !== root && !file.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
    const info = await stat(file);
    if(info.isDirectory()) {
      if(!path.endsWith('/')){res.writeHead(308,{'Location':encodeURI(path+'/')});res.end();return;}
      file=resolve(file,'index.html');
    }
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch(err) {
    const status=err instanceof URIError?400:404;
    res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(status===400?'Bad request':'Page not found');
  }
});
const port=Number(process.env.PORT||3000);
server.listen(port,'0.0.0.0',()=>console.log(`Gold Trails listening on port ${port}`));
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>process.exit(0)));

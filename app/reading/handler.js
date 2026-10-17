import{assetUrl}from'../asset-url.js';
const controls=`<details class="reading-options" data-reading-options hidden><summary><span aria-hidden="true">Aa</span> Reading options</summary><div class="reading-options-panel"><h2>Make yourself comfortable</h2><p id="reading-options-note">For this tab only. Change these anytime.</p><div class="reading-text-size" role="group" aria-label="Text size"><span>Text size</span><div><button type="button" data-reading-smaller aria-label="Smaller text">A−</button><output data-reading-size-label aria-live="polite" aria-atomic="true">100%</output><button type="button" data-reading-larger aria-label="Larger text">A+</button></div></div><label><input type="checkbox" data-reading-choice="dark"> Dark mode</label><label><input type="checkbox" data-reading-choice="bold"> Bolder text</label><label><input type="checkbox" data-reading-choice="contrast"> Stronger contrast</label><label><input type="checkbox" data-reading-choice="roomy"> More line spacing</label><label><input type="checkbox" data-reading-choice="font"> Simple font</label><div class="reading-options-footer"><button type="button" data-reading-reset>Reset</button><button type="button" data-reading-close>Done</button></div></div></details>`;
export function readingMarkup(html){
 if(typeof html!=='string'||html.includes('data-reading-options')||!html.includes('</head>')||!html.includes('</body>'))return html;
 const tools=/<div class="header-tools">/;
 if(!tools.test(html))return html;
 return html.replace(tools,match=>match+controls).replace('</head>',`<link rel="stylesheet" href="${assetUrl('reading-options.css')}"><link rel="stylesheet" href="${assetUrl('dark-mode.css')}"><script src="${assetUrl('reading-options.js')}"></script></head>`);
}
export function attachReadingMarkup(req,res,url){
 if(!['GET','HEAD'].includes(req.method)||/^\/(?:admin|api)(?:\/|$)/.test(url.pathname))return;
 const end=res.end.bind(res),head=res.writeHead.bind(res);let type='';
 res.writeHead=function(status,message,headers){const supplied=typeof message==='object'?message:headers;type=String(Object.entries(supplied||{}).find(([key])=>key.toLowerCase()==='content-type')?.[1]||res.getHeader('Content-Type')||'');if(type.includes('text/html')){res.removeHeader('Content-Length');if(supplied)for(const key of Object.keys(supplied))if(key.toLowerCase()==='content-length')delete supplied[key];}return typeof message==='string'?head(status,message,headers):head(status,message);};
 res.end=function(chunk,encoding,callback){if(type.includes('text/html')&&chunk)chunk=Buffer.from(readingMarkup(Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk)));return end(chunk,encoding,callback);};
}

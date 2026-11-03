import {assetUrl} from '../asset-url.js';

// Explicit HTML destinations keep labels off APIs, photos, downloads and account controls.
export function featureLabelPage(path=''){
 if(/^\/gold-almanac(?:\/[a-z-]+)?\/?$/.test(path))return 'almanac';
 if(/^\/connections\/$/.test(path)||/^\/connections\/(?:states\/(?:[a-z-]+\/)?|new\/|mine\/|preferences\/|events\/[a-f0-9-]{36}\/(?:edit\/|manage\/)?)$/.test(path))return 'connections';
 return null;
}
export async function featureLabelMember(req,members){
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)__Host-gold-member=([a-f0-9]{64})(?:;|$)/)?.[1];
 return token&&members?members.session(token):null;
}
export function featureLabelText({member=null,guest=null}={}){
 if(member?.effective_level==='subscriber')return member.grant_source==='complimentary'?'Complimentary access (normally $5/month)':'Included with your membership';
 if(guest)return 'Read-only guest preview (normally $5/month)';
 return '$5/month';
}
export function featureLabelMarkup(html,{feature=null,member=null,guest=null}={}){
 if(!['almanac','connections'].includes(feature)||typeof html!=='string'||html.includes('data-plus-feature-label')||!html.includes('</head>'))return html;
 const intro=/(<section\b[^>]*class="[^"]*\bcategory-intro\b[^"]*"[^>]*>[\s\S]*?)(<h1\b[^>]*>)/;
 if(!intro.test(html))return html;
 const label=`<p class="plus-feature-label" data-plus-feature-label><a href="/plus/"><strong>Gold Trails Plus</strong><span aria-hidden="true"> · </span><span>${featureLabelText({member,guest})}</span></a>${feature==='connections'?'<span class="plus-feature-label-context">Event participation · Public event browsing is free.</span>':''}</p>`;
 const result=html.replace(intro,(_match,before,heading)=>before+label+heading);
 return result.includes('/plus.css?')?result:result.replace('</head>',`<link rel="stylesheet" href="${assetUrl('plus.css')}"></head>`);
}
export function attachFeatureLabel(req,res,url,{feature=featureLabelPage(url.pathname),member=null,guest=null}={}){
 if(!feature||!['GET','HEAD'].includes(req.method))return;
 const end=res.end.bind(res),head=res.writeHead.bind(res);let type='';
 res.writeHead=function(status,message,headers){
  const supplied=typeof message==='object'?message:headers;
  type=String(Object.entries(supplied||{}).find(([key])=>key.toLowerCase()==='content-type')?.[1]||res.getHeader('Content-Type')||'');
  if(type.includes('text/html')){
   res.removeHeader('Content-Length');
   if(supplied)for(const key of Object.keys(supplied))if(key.toLowerCase()==='content-length')delete supplied[key];
   const current=String(Object.entries(supplied||{}).find(([key])=>key.toLowerCase()==='vary')?.[1]||res.getHeader('Vary')||'');
   const vary=[...new Set(current.split(',').map(value=>value.trim()).filter(Boolean).concat('Cookie'))].join(', ');
   if(supplied){for(const key of Object.keys(supplied))if(['cache-control','vary'].includes(key.toLowerCase()))delete supplied[key];supplied['Cache-Control']='private, no-store';supplied.Vary=vary;}
   else {res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary',vary);}
  }
  return typeof message==='string'?head(status,message,headers):head(status,message);
 };
 res.end=function(chunk,encoding,callback){
  if(type.includes('text/html')&&chunk)chunk=Buffer.from(featureLabelMarkup(Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk),{feature,member,guest}));
  return end(chunk,encoding,callback);
 };
}

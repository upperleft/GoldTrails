import {page,escapeHtml as h} from '../directory-views.js';
import {assetUrl} from '../asset-url.js';
import {readingMarkup} from '../reading/handler.js';

// The invitation and member handlers supply trusted forms and flow links as body HTML.
// Keep the shared head, fonts and reading tools without the public site navigation.
function creatorAccessHead(title){
 const shell=page(title,'Accept your complimentary Gold Trails creator membership.','','','',{eyebrow:null});
 return shell.slice(0,shell.indexOf('</head>')+7).replace('</head>',`<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="${assetUrl('member-auth.css')}"><link rel="stylesheet" href="${assetUrl('creator-access.css')}"></head>`);
}
export function focusedCreatorAccessPage(title,body){
 const head=creatorAccessHead(title);
 const html=`${head}<body class="category-page member-page member-auth-page creator-access-page" data-complimentary-invitation data-creator-access-flow><a class="skip-link" href="#main-content">Skip to membership</a><header class="creator-access-header"><div class="brand creator-access-brand"><span class="brand-star" aria-hidden="true">✦</span><span>Gold Trails<small>THE PROSPECTOR’S FIELD LIBRARY</small></span></div><div class="header-tools"></div></header><main class="creator-access-main" id="main-content"><section class="resource-placeholder member-card member-auth-card creator-access-card" aria-labelledby="member-access-title"><h1 id="member-access-title">${h(title)}</h1>${body}</section></main><footer class="creator-access-footer"><p>Gold Trails · A place for the people who share the trail.</p></footer></body></html>`;
 return readingMarkup(html);
}

// The pending homepage keeps its full scene and responsive text view, with no public wrappers.
export function focusedCreatorHomePage(title,body){
 const head=creatorAccessHead(title).replace('</head>',`<link rel="stylesheet" href="${assetUrl('home-art.css')}"><link rel="stylesheet" href="${assetUrl('design-refinements.css')}"></head>`);
 return readingMarkup(`${head}<body class="home-page category-page member-page creator-access-page creator-access-home-full" data-complimentary-invitation data-creator-access-flow data-creator-access-home><a class="skip-link" href="#main-content">Skip to invitation</a>${body}<footer class="creator-access-footer"><p>Gold Trails · A place for the people who share the trail.</p></footer></body></html>`);
}

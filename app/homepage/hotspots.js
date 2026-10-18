// Coordinates use the cleaned artwork's original 1672 × 941 canvas.
// Links stop before help icons: the two hit areas never share an anchor.
export const canvas={width:1672,height:941};
export const sections=[{id:'sidebar',rect:[0,0,312,941]},{id:'hero',rect:[312,0,1360,565]},{id:'destinations',rect:[312,565,315,376]},{id:'articles',rect:[627,565,315,376]},{id:'glossary',rect:[942,565,308,376]},{id:'plus',rect:[1250,565,422,376]}];
const link=(id,name,rect,href,section,extra={})=>({id,name,rect,href,section,type:'link',label:name,...extra});
const help=(id,name,rect,text,section,extra={})=>({id:id+'-help',name:name+' help',rect,text,section,type:'help',label:'About '+name,...extra});
const rows=[
 ['home','Home',210,'/','Return to the Gold Trails homepage.'],
 ['articles','Articles',259,'/articles/','Read sourced articles about prospecting, geology, equipment, techniques, and history.'],
 ['almanac','Almanac',307,'/gold-almanac/','Explore research, regulations, source links, and a creator map for all 50 states.'],
 ['destinations','Creators & Videos',355,'/prospectors/','Meet prospectors, visit their public profiles, and browse their linked videos. Creator profiles and videos are free to explore.'],
 ['glossary','Glossary',403,'/glossary/','Look up gold prospecting, geology, and mining terms, including regional words and tool names.'],
 ['connections','Gold Connections',451,'/connections/','Gold Trails Plus members can create events, RSVP, and join discussions with other members.'],
 ['products','Products',499,'/products/','Explore the free product catalog, photographs and linked demonstrations.'],
 ['search','Search',547,null,'Choose an existing Gold Trails library to search.'],
 ['about','About',595,'/about-the-camp/','Meet Gold Trails and learn about the research behind the library.'],
 ['signin','Sign In',643,'/login/','Sign in to your Gold Trails account, calendar, and membership features.']
];

// Members use the same card artwork; existing content becomes direct navigation.
export const memberPromotionHotspots=[
 link('panel-member-map','Open the Almanac map',[1266,655,167,181],'/gold-almanac/','plus'),
 link('panel-member-almanac','Open the Almanac',[1435,655,210,86],'/gold-almanac/','plus'),
 link('panel-member-connections','Open Gold Connections',[1435,743,210,90],'/connections/','plus'),
 link('panel-plus-button','Open Connections',[1285,848,309,46],'/connections/','plus'),
 help('panel-plus-button','Gold Connections',[1598,845,40,40],'Open Gold Connections to browse events, organize outings, RSVP, and join discussions. Guest previews can browse; participation requires your own paid account.','plus')
];
export const hotspots=[
 link('logo','Gold Trails home',[15,12,280,177],'/','sidebar'),
 ...rows.flatMap(([id,name,y,href,text])=>[href?link('nav-'+id,name,[34,y,204,43],href,'sidebar',{account:id==='signin'}):{id:'nav-search',name:'Search',label:'Search Gold Trails libraries',rect:[34,y,204,43],section:'sidebar',type:'search'},help('nav-'+id,name,[241,y+8,28,28],text,'sidebar',{premium:['almanac','connections'].includes(id)})]),
 link('old-timer','Gold Trails home — the Old-Timer',[319,8,477,550],'/','hero'),
 ...[
  ['destinations','Creators & Videos',312,315,580,'/prospectors/','Meet prospectors, browse their public profiles and linked videos, and find a new channel to enjoy. Creator profiles and videos stay free.'],
  ['articles','Articles',627,315,891,'/articles/','Find practical guides, techniques, and stories, with linked sources.'],
  ['glossary','Glossary',942,308,1203,'/glossary/','Find clear definitions of prospecting terms, rocks, tools, and techniques.']
 ].flatMap(([id,name,x,w,hx,href,text])=>[
  link('panel-'+id,name,[x+17,583,w-45,137],href,id),
  link('panel-'+id+'-heading',name,[x+24,735,w-84,49],href,id),
  help('panel-'+id,name,[hx-6,726,40,40],text,id),
  link('panel-'+id+'-button',id==='destinations'?'Browse Creators':id==='articles'?'Read Articles':'Browse the Glossary',[x+24,861,w-80,38],href,id),
  help('panel-'+id+'-button',name,[hx-4,858,40,40],text,id)
 ]),
 link('panel-plus','Gold Trails Plus',[1266,581,374,255],'/plus/','plus'),
 link('panel-plus-button','Learn More About Plus',[1285,848,309,46],'/plus/','plus'),
 help('panel-plus-button','Gold Trails Plus',[1598,845,40,40],'Explore the Plus Almanac and Gold Connections participation for $5/month. Creator profiles, videos, articles, and the glossary stay free.','plus')
];

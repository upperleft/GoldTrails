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
 ['destinations','Destinations',355,'/gold-almanac/','Find state-specific location research in the Plus Almanac. Always check current permission and land access before prospecting.'],
 ['glossary','Glossary',403,'/glossary/','Look up gold prospecting, geology, and mining terms, including regional words and tool names.'],
 ['connections','Gold Connections',451,'/connections/','Browse community gatherings free. Gold Trails Plus members can organize events, RSVP, and join discussions.'],
 ['plus','Gold Trails Plus',499,'/plus/','Explore the $5/month Plus plan: State Almanac, creator map, and Gold Connections participation.'],
 ['search','Search',547,null,'Choose an existing Gold Trails library to search.'],
 ['about','About',595,'/about-the-camp/','Meet Gold Trails and learn about the research behind the library.'],
 ['signin','Sign In',643,'/login/','Sign in to your Gold Trails account, calendar, and membership features.']
];
export const hotspots=[
 link('logo','Gold Trails home',[15,12,280,177],'/','sidebar'),
 ...rows.flatMap(([id,name,y,href,text])=>[href?link('nav-'+id,name,[34,y,204,43],href,'sidebar',{account:id==='signin'}):{id:'nav-search',name:'Search',label:'Search Gold Trails libraries',rect:[34,y,204,43],section:'sidebar',type:'search'},help('nav-'+id,name,[241,y+8,28,28],text,'sidebar',{premium:id==='almanac'})]),
 link('old-timer','Gold Trails home — the Old-Timer',[319,8,477,550],'/','hero'),
 link('hero-articles','Read Articles',[868,432,252,61],'/articles/','hero'),help('hero-articles','Articles',[1124,446,30,30],'Read practical, sourced articles from the Gold Trails library.','hero'),
 link('hero-glossary','Browse the Glossary',[1197,432,311,61],'/glossary/','hero'),help('hero-glossary','Glossary',[1513,446,30,30],'Open the searchable prospecting glossary.','hero'),
 ...[
  ['destinations','Find Gold',312,315,580,'/gold-almanac/','Explore destinations in the State Almanac. Detailed state research requires Gold Trails Plus.'],
  ['articles','Articles',627,315,891,'/articles/','Find practical guides, techniques, and stories, with linked sources.'],
  ['glossary','Glossary',942,308,1203,'/glossary/','Find clear definitions of prospecting terms, rocks, tools, and techniques.']
 ].flatMap(([id,name,x,w,hx,href,text])=>[
  link('panel-'+id,name,[x+17,583,w-45,137],href,id),
  link('panel-'+id+'-heading',name,[x+24,735,w-80,49],href,id),
  help('panel-'+id,name,[hx,732,28,28],text,id),
  link('panel-'+id+'-button',id==='destinations'?'Explore Destinations':id==='articles'?'Read Articles':'Browse the Glossary',[x+24,861,w-80,38],href,id),
  help('panel-'+id+'-button',name,[hx-4,864,28,28],text,id)
 ]),
 link('panel-plus','Gold Trails Plus',[1266,581,374,255],'/plus/','plus'),
 link('panel-plus-button','Learn More About Plus',[1285,848,309,46],'/plus/','plus'),
 help('panel-plus-button','Gold Trails Plus',[1603,850,30,30],'Explore the Plus Almanac and Gold Connections participation for $5/month. Creator profiles, videos, articles, and the glossary stay free.','plus')
];

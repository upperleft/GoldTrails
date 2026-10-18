// Coordinates use the cleaned artwork's original 1672 × 941 canvas.
// Links and the remaining help icons have separate hit areas.
export const canvas={width:1672,height:941};
export const sections=[{id:'sidebar',rect:[0,0,312,941]},{id:'hero',rect:[312,0,1360,565]},{id:'destinations',rect:[312,565,315,376]},{id:'articles',rect:[627,565,315,376]},{id:'glossary',rect:[942,565,308,376]},{id:'plus',rect:[1250,565,422,376]}];
const link=(id,name,rect,href,section,extra={})=>({id,name,rect,href,section,type:'link',label:name,...extra});
const help=(id,name,rect,text,section,extra={})=>({id:id+'-help',name:name+' help',rect,text,section,type:'help',label:'About '+name,...extra});
const almanacHelp='Explore state-by-state gold geology, discovery history and access research, with cited sources and a creator map. Coverage varies by state. Confirm current land access before prospecting.';
const rows=[
 ['signin','Sign In','/login/','Sign in to your Gold Trails account, calendar, and membership features.'],
 ['articles','Articles','/articles/','Read practical gold prospecting guides, geology, and mineral science, with linked sources.'],
 ['almanac','Almanac','/gold-almanac/',almanacHelp],
 ['destinations','Creators','/prospectors/','Explore public profiles and linked videos from gold prospecting creators. Profiles and videos are free to browse.'],
 ['glossary','Glossary','/glossary/','Look up gold prospecting, geology, and mining terms, including regional words and tool names.'],
 ['connections','Gold Connections','/connections/','Gold Trails Plus members can create events, RSVP, and join discussions with other members.'],
 ['products','Products','/products/','Explore the free product catalog, photographs and linked demonstrations.'],
 ['search','Search',null,'Choose an existing Gold Trails library to search.'],
 ['about','About','/about-the-camp/','Meet Gold Trails and learn about the research behind the library.']
];

// Members use the same card artwork; existing content becomes direct navigation.
export const memberPromotionHotspots=[
 link('panel-member-map','Open the Almanac map',[1266,655,167,181],'/gold-almanac/','plus'),
 link('panel-member-almanac','Open the Almanac',[1435,655,210,178],'/gold-almanac/','plus'),
 link('panel-plus-button','Open Almanac',[1285,848,309,46],'/gold-almanac/','plus'),
 help('panel-plus-button','Almanac',[1598,845,40,40],almanacHelp,'plus')
];
export const hotspots=[
 link('logo','Gold Trails home',[15,12,280,177],'/','sidebar'),
 ...rows.flatMap(([id,name,href,text],i)=>{const y=210+43*i;return [href?link('nav-'+id,name,[34,y,204,39],href,'sidebar',{account:id==='signin'}):{id:'nav-search',name:'Search',label:'Search Gold Trails libraries',rect:[34,y,204,39],section:'sidebar',type:'search'},help('nav-'+id,name,[241,y+4,28,28],text,'sidebar',{premium:['almanac','connections'].includes(id)})];}),
 link('old-timer','Gold Trails home — the Old-Timer',[319,8,477,550],'/','hero'),
 ...[
  ['destinations','Creators',312,315,580,'/prospectors/','Explore public profiles and linked videos from gold prospecting creators. Profiles and videos are free to browse.'],
  ['articles','Articles',627,315,891,'/articles/','Find practical gold prospecting guides, geology, and mineral science, with linked sources.'],
  ['glossary','Glossary',942,308,1203,'/glossary/','Find clear definitions of prospecting terms, rocks, tools, and techniques.']
 ].flatMap(([id,name,x,w,hx,href,text])=>[
  link('panel-'+id,name,[x+17,583,w-45,137],href,id),
  link('panel-'+id+'-heading',name,[x+24,735,w-84,49],href,id),
  help('panel-'+id,name,[hx-6,726,40,40],text,id),
  link('panel-'+id+'-button',id==='destinations'?'Browse Creators':id==='articles'?'Read Articles':'Browse the Glossary',[x+22,860,w-42,39],href,id,{fullButton:true})
 ]),
 link('panel-plus','Explore Almanac',[1266,581,374,255],'/plus/','plus'),
 link('panel-plus-button','Explore Almanac',[1285,848,309,46],'/plus/','plus'),
 help('panel-plus-button','Almanac',[1598,845,40,40],almanacHelp,'plus',{premium:true})
];

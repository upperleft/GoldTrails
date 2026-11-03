export const gameFormats = {board:'Board & Card Games',computer:'Computer & Console',browser:'Browser & Mobile',real:'Real-Life Games & Activities',print:'Print & Play'};
export const gamePlatforms = {windows:'Windows',mac:'Mac',linux:'Linux',ios:'iPhone / iPad',android:'Android',browser:'Browser',playstation:'PlayStation',xbox:'Xbox',switch:'Nintendo Switch',physical:'Physical'};
export const gameCosts = {free:'Free',freemium:'Free with ads / purchases',paid:'Paid',event:'Event fee',materials:'Materials required',unknown:'Not confirmed'};
export const gameStatuses = {available:'Available listing','early-access':'Early Access',upcoming:'Upcoming / demo',unconfirmed:'Availability not confirmed',older:'Older / used-market',unavailable:'Publisher unavailable',delisted:'Delisted'};
const archived = new Set(['upcoming','older','unavailable','delisted']);
const ages = new Set(['6','8','10','13','18','unknown']);
const playerChoices = new Set(['solo','two','group']);
const fold = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function gameFilters(params = new URLSearchParams()) {
 return {query:(params.get('q') || '').trim().slice(0,200),formats:[...new Set(params.getAll('format').filter(value=>Object.hasOwn(gameFormats,value)))],device:Object.hasOwn(gamePlatforms,params.get('device'))?params.get('device'):'',age:ages.has(params.get('age'))?params.get('age'):'',players:playerChoices.has(params.get('players'))?params.get('players'):'',cost:Object.hasOwn(gameCosts,params.get('cost'))?params.get('cost'):'',includeOlder:params.get('older')==='1'};
}
export function gameFilterUrl(filters) {
 const params=new URLSearchParams();
 if(filters.query)params.set('q',filters.query);
 for(const format of filters.formats || [])if(Object.hasOwn(gameFormats,format))params.append('format',format);
 for(const key of ['device','age','players','cost'])if(filters[key])params.set(key,filters[key]);
 if(filters.includeOlder)params.set('older','1');
 return '/gold-games/' + (params.size?'?'+params.toString():'');
}
export function matchesGame(game, filters) {
 if(!filters.includeOlder && archived.has(game.availability))return false;
 if(filters.formats.length && !filters.formats.some(format=>game.formats.includes(format)))return false;
 if(filters.device && !game.platforms.includes(filters.device))return false;
 if(filters.cost && game.cost!==filters.cost)return false;
 if(filters.age==='unknown' && game.age.minimum!==null)return false;
 if(filters.age && filters.age!=='unknown' && (game.age.minimum===null || game.age.minimum>Number(filters.age)))return false;
 if(filters.players){
  const {min,max}=game.players;
  if(min===null || max===null)return false;
  const target=filters.players==='solo'?1:filters.players==='two'?2:3;
  if(filters.players==='group'?max<target:min>target || max<target)return false;
 }
 const text=fold([game.title,...game.aliases,game.maker,game.summary,...game.mechanics,game.theme,...game.platforms].join(' '));
 return fold(filters.query).split(/\s+/).filter(Boolean).every(word=>text.includes(word));
}
export function filterGames(games, filters) { return games.filter(game=>matchesGame(game,filters)); }

export function initializeGoldGames(doc=document,view=window) {
 const form=doc.querySelector('#games-filters'),data=doc.querySelector('#gold-games-data');
 if(!form || !data)return;
 const games=JSON.parse(data.textContent),cards=new Map([...doc.querySelectorAll('[data-game-id]')].map(card=>[card.dataset.gameId,card]));
 const count=doc.querySelector('#games-count'),empty=doc.querySelector('#games-empty');
 const controls=key=>form.elements.namedItem(key);
 function apply(filters,{history=false,replace=false,keepHash=false}={}){
  controls('q').value=filters.query;
  for(const input of form.querySelectorAll('[name="format"]'))input.checked=filters.formats.includes(input.value);
  for(const key of ['device','age','players','cost'])controls(key).value=filters[key];
  controls('older').checked=filters.includeOlder;
  const matches=filterGames(games,filters),ids=new Set(matches.map(game=>game.id));
  for(const [id,card] of cards)card.hidden=!ids.has(id);
  count.textContent=`${matches.length} ${matches.length===1?'entry':'entries'} of ${games.length}`;
  empty.hidden=matches.length>0;
  if(history){const url=gameFilterUrl(filters)+(keepHash?view.location.hash:'');if(url!==view.location.pathname+view.location.search+view.location.hash)view.history[replace?'replaceState':'pushState'](null,'',url);}
 }
 function current(){
  const params=new URLSearchParams();
  params.set('q',controls('q').value);
  for(const input of form.querySelectorAll('[name="format"]:checked'))params.append('format',input.value);
  for(const key of ['device','age','players','cost'])params.set(key,controls(key).value);
  if(controls('older').checked)params.set('older','1');
  return gameFilters(params);
 }
 function revealHash(){
  const id=view.location.hash.slice(1),game=games.find(item=>'game-'+item.id===id);
  if(!game)return;
  if(cards.get(game.id)?.hidden){const params=new URLSearchParams();if(archived.has(game.availability))params.set('older','1');apply(gameFilters(params),{history:true,replace:true,keepHash:true});}
  cards.get(game.id)?.scrollIntoView?.({block:'start'});
 }
 form.hidden=false;
 apply(gameFilters(new URLSearchParams(view.location.search)));
 form.addEventListener('submit',event=>{event.preventDefault();apply(current(),{history:true});});
 form.addEventListener('input',event=>{if(event.target.name==='q')apply(current(),{history:true,replace:true});});
 form.addEventListener('change',()=>apply(current(),{history:true}));
 form.addEventListener('reset',event=>{event.preventDefault();apply(gameFilters(),{history:true});});
 doc.querySelector('#games-reset-empty')?.addEventListener('click',()=>{apply(gameFilters(),{history:true});controls('q').focus();});
 for(const link of doc.querySelectorAll('[data-game-format]'))link.addEventListener('click',event=>{
  if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
  event.preventDefault();apply(gameFilters(new URLSearchParams(link.search)),{history:true});doc.querySelector('#games-directory')?.scrollIntoView?.({block:'start'});
 });
 view.addEventListener('popstate',()=>{apply(gameFilters(new URLSearchParams(view.location.search)));revealHash();});
 view.addEventListener('hashchange',revealHash);
 const printButton=doc.querySelector('#games-print');
 if(printButton){printButton.hidden=false;printButton.addEventListener('click',()=>view.print());}
 revealHash();
}
if(typeof document!=='undefined')initializeGoldGames();

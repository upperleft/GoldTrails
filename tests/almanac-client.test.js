import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../dist/gold-almanac.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(clock={setTimeout,clearTimeout},initial='california'){
 const names={california:'California',maine:'Maine',hawaii:'Hawaii'};
 class Element{
  constructor(){this.attrs={};this.dataset={};this.events={};this.hidden=false;this.disabled=false;this.textContent='';this.classList={toggle:(name,value)=>{this.attrs[name]=value;}};}
  addEventListener(type,fn){this.events[type]=fn;}
  setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}getAttribute(key){return this.attrs[key];}
  append(){}focus(){document.activeElement=this;}select(){}
 }
 const panel=new Element(),map=new Element(),status=new Element(),retry=new Element(),share=new Element(),details=new Element(),label=new Element(),heading=new Element(),canonical=new Element();
 const markers=Object.keys(names).map(slug=>{const m=new Element();m.dataset.state=slug;m.closest=()=>m;m.attrs['aria-label']=names[slug];m.attrs['aria-pressed']=String(slug===initial);return m;});map.querySelectorAll=()=>markers;
 panel.hidden=!initial;details.hidden=!initial;label.textContent=initial?names[initial]:'None';
 const nodes={'state-details':panel,'almanac-status':status,'almanac-retry':retry,'almanac-share':share,'selected-state':label,'almanac-details':details,'state-heading':heading};
 const document={getElementById:id=>nodes[id],querySelector:selector=>selector==='.almanac-map'?map:canonical,createElement:()=>new Element()};
 const location={origin:'https://gold.test',pathname:initial?'/gold-almanac/'+initial+'/':'/gold-almanac/',hash:''};const history={pushState:(_s,_t,url)=>{const u=new URL(url,location.origin);location.pathname=u.pathname;location.hash=u.hash;},replaceState:(_s,_t,url)=>{const u=new URL(url,location.origin);location.pathname=u.pathname;location.hash=u.hash;}};
 const events={},window={addEventListener:(type,fn)=>{events[type]=fn;}};
 const calls=[],clipboard=[];
 // Intentionally allow aborted requests to resolve so the stale-response guard is tested as well.
 const fetch=(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}));
 const context={document,location,history,window,fetch,AbortController,URL,navigator:{clipboard:{writeText:async text=>clipboard.push(text)}},requestAnimationFrame:fn=>fn(),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,console};
 vm.runInNewContext(script,context);
 const response=slug=>({ok:true,json:async()=>({state:{id:'US-'+slug,slug,name:names[slug]},url:'/gold-almanac/'+slug+'/',html:'<h2>Gold in '+names[slug]+'</h2>'})});
 const choose=slug=>map.events.click({target:markers.find(m=>m.dataset.state===slug),button:0,preventDefault(){}});
 const selected=()=>markers.find(m=>m.attrs['aria-pressed']==='true')?.dataset.state||null;
 return {panel,map,markers,status,retry,share,location,history,events,calls,response,choose,selected,clipboard,document,details};
}
test('rapid selections cannot let a stale response overwrite the latest state or URL',async()=>{
 const ui=setup();ui.choose('maine');ui.choose('hawaii');assert.equal(ui.calls[0].options.signal.aborted,true);
 ui.calls[1].resolve(ui.response('hawaii'));await tick();assert.equal(ui.selected(),'hawaii');assert.match(ui.panel.innerHTML,/Hawaii/);
 ui.calls[0].resolve(ui.response('maine'));await tick();assert.match(ui.panel.innerHTML,/Hawaii/);assert.equal(ui.location.pathname,'/gold-almanac/hawaii/');assert.equal(ui.panel.attrs['aria-busy'],undefined);
});
test('failed selection preserves old guide, exposes retry, and recovers without a false success',async()=>{
 const ui=setup();ui.panel.innerHTML='Original guide';ui.choose('maine');ui.calls[0].reject(new Error('network error'));await tick();
 assert.equal(ui.panel.innerHTML,'Original guide');assert.equal(ui.selected(),'california');assert.equal(ui.location.pathname,'/gold-almanac/california/');assert.match(ui.status.textContent,/Could not load/);assert.equal(ui.retry.hidden,false);
 ui.retry.events.click();ui.calls[1].resolve(ui.response('maine'));await tick();assert.match(ui.panel.innerHTML,/Maine/);assert.equal(ui.retry.hidden,true);assert.equal(ui.share.disabled,false);
});
test('Back to the already displayed state cancels pending data and does not let it change history',async()=>{
 const ui=setup();ui.choose('maine');ui.events.popstate();assert.equal(ui.calls[0].options.signal.aborted,true);
 ui.calls[0].resolve(ui.response('maine'));await tick();assert.equal(ui.selected(),'california');assert.equal(ui.location.pathname,'/gold-almanac/california/');assert.equal(ui.panel.innerHTML,undefined);
});
test('arrow keys move focus without selecting; Space commits and sharing keeps the state identity',async()=>{
 const ui=setup();ui.map.events.keydown({target:ui.markers[0],key:'ArrowRight',preventDefault(){}});assert.equal(ui.document.activeElement,ui.markers[1]);assert.equal(ui.calls.length,0);assert.equal(ui.selected(),'california');
 ui.map.events.keydown({target:ui.markers[1],key:' ',preventDefault(){}});ui.calls[0].resolve(ui.response('maine'));await tick();
 ui.location.hash='#history';await ui.share.events.click();assert.deepEqual(ui.clipboard,['https://gold.test/gold-almanac/maine/']);assert.equal(ui.location.hash,'#history');
});

test('a stalled request times out with a retry while preserving the previous state',async()=>{
 let deadline,cleared=false;const ui=setup({setTimeout:(fn,ms)=>{assert.equal(ms,15000);deadline=fn;return 1;},clearTimeout:()=>{cleared=true;}});
 ui.choose('maine');deadline();assert.equal(ui.calls[0].options.signal.aborted,true);const error=new Error('Aborted');error.name='AbortError';ui.calls[0].reject(error);await tick();
 assert.equal(ui.selected(),'california');assert.equal(ui.retry.hidden,false);assert.match(ui.status.textContent,/Could not load/);assert.equal(cleared,true);assert.equal(ui.panel.attrs['aria-busy'],undefined);
});


test('the unselected map loads a chosen state and Back clears it without reviving pending results',async()=>{
 const ui=setup(undefined,null);assert.equal(ui.selected(),null);assert.equal(ui.calls.length,0);assert.equal(ui.share.hidden,true);assert.equal(ui.details.hidden,true);assert.equal(ui.panel.hidden,true);
 ui.choose('maine');assert.match(ui.status.textContent,/Loading Maine/);ui.calls[0].resolve(ui.response('maine'));await tick();
 assert.equal(ui.selected(),'maine');assert.equal(ui.panel.hidden,false);assert.equal(ui.details.hidden,false);assert.equal(ui.share.hidden,false);
 ui.location.pathname='/gold-almanac/';ui.events.popstate();assert.equal(ui.selected(),null);assert.equal(ui.panel.hidden,true);assert.equal(ui.panel.innerHTML,'');assert.equal(ui.share.hidden,true);assert.equal(ui.document.title,'Gold Almanac — Gold Trails');
 ui.choose('hawaii');ui.events.popstate();assert.equal(ui.calls[1].options.signal.aborted,true);ui.calls[1].resolve(ui.response('hawaii'));await tick();
 assert.equal(ui.selected(),null);assert.equal(ui.panel.hidden,true);assert.equal(ui.location.pathname,'/gold-almanac/');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../dist/gold-almanac.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(clock={setTimeout,clearTimeout}){
 const names={california:'California',maine:'Maine',hawaii:'Hawaii'};
 class Element{
  constructor(){this.attrs={};this.dataset={};this.events={};this.hidden=false;this.disabled=false;this.textContent='';this.classList={toggle:(name,value)=>{this.attrs[name]=value;}};}
  addEventListener(type,fn){this.events[type]=fn;}
  setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}getAttribute(key){return this.attrs[key];}
  append(){}focus(){document.activeElement=this;}select(){}
 }
 const panel=new Element(),form=new Element(),picker=new Element(),map=new Element(),status=new Element(),retry=new Element(),share=new Element(),details=new Element(),label=new Element(),heading=new Element(),canonical=new Element();
 picker.value='california';picker.form=form;picker.querySelector=selector=>({textContent:names[selector.match(/value="([a-z]+)"/)[1]]});Object.defineProperty(picker,'selectedOptions',{get:()=>[{textContent:names[picker.value]}]});
 const markers=Object.keys(names).map(slug=>{const m=new Element();m.dataset.state=slug;m.closest=()=>m;m.attrs['aria-label']=names[slug];return m;});map.querySelectorAll=()=>markers;
 const nodes={'state-details':panel,'almanac-state':picker,'almanac-status':status,'almanac-retry':retry,'almanac-share':share,'selected-state':label,'almanac-details':details,'state-heading':heading};
 const document={getElementById:id=>nodes[id],querySelector:selector=>selector==='.almanac-map'?map:canonical,createElement:()=>new Element()};
 const location={origin:'https://gold.test',pathname:'/gold-almanac/california/',hash:''};const history={pushState:(_s,_t,url)=>{const u=new URL(url,location.origin);location.pathname=u.pathname;location.hash=u.hash;},replaceState:(_s,_t,url)=>{const u=new URL(url,location.origin);location.pathname=u.pathname;location.hash=u.hash;}};
 const events={},window={addEventListener:(type,fn)=>{events[type]=fn;}};
 const calls=[],clipboard=[];
 // Intentionally allow aborted requests to resolve so the stale-response guard is tested as well.
 const fetch=(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}));
 const context={document,location,history,window,fetch,AbortController,URL,navigator:{clipboard:{writeText:async text=>clipboard.push(text)}},requestAnimationFrame:fn=>fn(),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,console};
 vm.runInNewContext(script,context);
 const response=slug=>({ok:true,json:async()=>({state:{id:'US-'+slug,slug,name:names[slug]},url:'/gold-almanac/'+slug+'/',html:'<h2>Gold in '+names[slug]+'</h2>'})});
 const choose=slug=>{picker.value=slug;picker.events.change();};
 return {panel,picker,form,map,markers,status,retry,share,location,history,events,calls,response,choose,clipboard,document};
}
test('rapid selections cannot let a stale response overwrite the latest state or URL',async()=>{
 const ui=setup();ui.choose('maine');ui.choose('hawaii');assert.equal(ui.calls[0].options.signal.aborted,true);
 ui.calls[1].resolve(ui.response('hawaii'));await tick();assert.equal(ui.picker.value,'hawaii');assert.match(ui.panel.innerHTML,/Hawaii/);
 ui.calls[0].resolve(ui.response('maine'));await tick();assert.match(ui.panel.innerHTML,/Hawaii/);assert.equal(ui.location.pathname,'/gold-almanac/hawaii/');assert.equal(ui.panel.attrs['aria-busy'],undefined);
});
test('failed selection preserves old guide, exposes retry, and recovers without a false success',async()=>{
 const ui=setup();ui.panel.innerHTML='Original guide';ui.choose('maine');ui.calls[0].reject(new Error('network error'));await tick();
 assert.equal(ui.panel.innerHTML,'Original guide');assert.equal(ui.picker.value,'california');assert.equal(ui.location.pathname,'/gold-almanac/california/');assert.match(ui.status.textContent,/Could not load/);assert.equal(ui.retry.hidden,false);
 ui.retry.events.click();ui.calls[1].resolve(ui.response('maine'));await tick();assert.match(ui.panel.innerHTML,/Maine/);assert.equal(ui.retry.hidden,true);assert.equal(ui.share.disabled,false);
});
test('Back to the already displayed state cancels pending data and does not let it change history',async()=>{
 const ui=setup();ui.choose('maine');ui.events.popstate();assert.equal(ui.calls[0].options.signal.aborted,true);
 ui.calls[0].resolve(ui.response('maine'));await tick();assert.equal(ui.picker.value,'california');assert.equal(ui.location.pathname,'/gold-almanac/california/');assert.equal(ui.panel.innerHTML,undefined);
});
test('arrow keys move focus without selecting; Space commits and sharing keeps the state identity',async()=>{
 const ui=setup();ui.map.events.keydown({target:ui.markers[0],key:'ArrowRight',preventDefault(){}});assert.equal(ui.document.activeElement,ui.markers[1]);assert.equal(ui.calls.length,0);assert.equal(ui.picker.value,'california');
 ui.map.events.keydown({target:ui.markers[1],key:' ',preventDefault(){}});ui.calls[0].resolve(ui.response('maine'));await tick();
 ui.location.hash='#history';await ui.share.events.click();assert.deepEqual(ui.clipboard,['https://gold.test/gold-almanac/maine/']);assert.equal(ui.location.hash,'#history');
});

test('a stalled request times out with a retry while preserving the previous state',async()=>{
 let deadline,cleared=false;const ui=setup({setTimeout:(fn,ms)=>{assert.equal(ms,15000);deadline=fn;return 1;},clearTimeout:()=>{cleared=true;}});
 ui.choose('maine');deadline();assert.equal(ui.calls[0].options.signal.aborted,true);const error=new Error('Aborted');error.name='AbortError';ui.calls[0].reject(error);await tick();
 assert.equal(ui.picker.value,'california');assert.equal(ui.retry.hidden,false);assert.match(ui.status.textContent,/Could not load/);assert.equal(cleared,true);assert.equal(ui.panel.attrs['aria-busy'],undefined);
});

import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
import{readingMarkup}from'../app/reading/handler.js';import{createServer}from'../app/server.js';import{createMemberHandler}from'../app/members.js';import{createCalendarHandler}from'../app/calendar/handler.js';
const script=readFileSync(new URL('../dist/reading-options.js',import.meta.url),'utf8');
const key='gold-trails-reading-session-v1';
function fixture({saved=null,blocked=false,loading=false}={}){
 const events={},windowEvents={},attributes={},stored=new Map(saved?[[key,JSON.stringify(saved)]]:[]);let focus=false,resize=0;
 const element=extra=>({listeners:{},disabled:false,checked:false,...extra,addEventListener(name,fn){this.listeners[name]=fn;}});
 const inputs=['bold','contrast','roomy','font','dark'].map(name=>element({dataset:{readingChoice:name}})),summary=element({focus:()=>focus=true}),smaller=element(),larger=element(),label=element(),reset=element(),done=element();
 const panel=element({hidden:true,open:false,contains:target=>target===panel,querySelector:selector=>({'summary':summary,'[data-reading-smaller]':smaller,'[data-reading-larger]':larger,'[data-reading-size-label]':label,'[data-reading-reset]':reset,'[data-reading-close]':done})[selector],querySelectorAll:()=>inputs});
 const root={dataset:{},setAttribute:(name,value)=>attributes[name]=value,removeAttribute:name=>delete attributes[name]};
 const storage={getItem:k=>{if(blocked)throw Error();return stored.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error();stored.set(k,v);},removeItem:k=>{if(blocked)throw Error();stored.delete(k);}};
 runInNewContext(script,{document:{documentElement:root,readyState:loading?'loading':'complete',querySelector:()=>panel,addEventListener:(name,fn)=>events[name]=fn},window:{sessionStorage:storage,addEventListener:(name,fn)=>windowEvents[name]=fn,dispatchEvent:()=>resize++},Event:class{constructor(type){this.type=type;}}});
 return{root,panel,inputs,label,smaller,larger,reset,done,summary,stored,attributes,events,windowEvents,focus:()=>focus,resize:()=>resize};
}
test('reading choices restore before DOM readiness and validate untrusted stored settings',()=>{
 const f=fixture({saved:{version:1,size:3,bold:true,contrast:true,roomy:true,font:true,dark:true},loading:true});assert.equal(f.root.dataset.readingSize,'3');assert.equal(f.attributes['data-reading-bold'],'');assert.equal(f.attributes['data-reading-dark'],'');assert.equal(f.panel.hidden,true);f.events.DOMContentLoaded();assert.equal(f.panel.hidden,false);assert.equal(f.label.textContent,'150%');assert.ok(f.inputs.every(i=>i.checked));
 for(const saved of [{version:2,size:5,bold:true},{version:1,size:999,bold:'true'},{version:1,size:-1},{version:1,size:1.3}]){const f=fixture({saved});assert.equal(f.root.dataset.readingSize,'0');assert.equal(f.inputs[0].checked,false);}
});
test('text controls stay bounded, reset clears session settings and blocked storage leaves controls usable',()=>{
 for(const blocked of [false,true]){const f=fixture({blocked});assert.equal(f.smaller.disabled,true);for(let n=0;n<10;n++)f.larger.listeners.click();assert.equal(f.label.textContent,'200%');assert.equal(f.larger.disabled,true);f.inputs[0].checked=true;f.inputs[0].listeners.change();assert.equal(f.attributes['data-reading-bold'],'');f.reset.listeners.click();assert.equal(f.label.textContent,'100%');assert.ok(f.inputs.every(i=>!i.checked));assert.equal(f.attributes['data-reading-bold'],undefined);assert.equal(f.stored.has(key),false);assert.ok(f.resize()>0);}
});
test('session settings carry to another page but do not become permanent local-storage preferences',()=>{
 const f=fixture();f.larger.listeners.click();f.inputs[2].checked=true;f.inputs[2].listeners.change();const saved=JSON.parse(f.stored.get(key)),next=fixture({saved});assert.equal(next.label.textContent,'115%');assert.equal(next.inputs[2].checked,true);
 next.stored.delete(key);next.windowEvents.pageshow();assert.equal(next.label.textContent,'100%');assert.equal(next.inputs[2].checked,false);
 const fresh=fixture();assert.equal(fresh.label.textContent,'100%');
});
test('dark mode survives navigation, coexists with contrast, and Reset restores light mode',()=>{
 for(const blocked of [false,true]){
  const f=fixture({blocked});const dark=f.inputs.find(i=>i.dataset.readingChoice==='dark');dark.checked=true;dark.listeners.change();assert.equal(f.attributes['data-reading-dark'],'');
  f.inputs[1].checked=true;f.inputs[1].listeners.change();assert.equal(f.attributes['data-reading-contrast'],'');assert.equal(f.attributes['data-reading-dark'],'');
  if(!blocked){const next=fixture({saved:JSON.parse(f.stored.get(key))});assert.equal(next.attributes['data-reading-dark'],'');assert.equal(next.inputs.find(i=>i.dataset.readingChoice==='dark').checked,true);}
  f.reset.listeners.click();assert.equal(f.attributes['data-reading-dark'],undefined);assert.equal(f.attributes['data-reading-contrast'],undefined);assert.equal(f.stored.has(key),false);
 }
 // Existing tab preferences predate dark mode; preserve them without opting in.
 const old=fixture({saved:{version:1,size:2,bold:true}});assert.equal(old.label.textContent,'130%');assert.equal(old.attributes['data-reading-bold'],'');assert.equal(old.attributes['data-reading-dark'],undefined);
 const malformed=fixture({saved:{version:1,dark:'true'}});assert.equal(malformed.attributes['data-reading-dark'],undefined);
});
test('Escape and Done close the native disclosure and return keyboard focus; outside clicks preserve their action',()=>{
 const f=fixture();f.panel.open=true;let prevented=false;f.panel.listeners.keydown({key:'Escape',preventDefault:()=>prevented=true});assert.equal(f.panel.open,false);assert.equal(f.focus(),true);assert.equal(prevented,true);f.panel.open=true;f.events.pointerdown({target:f.panel});assert.equal(f.panel.open,true);f.events.pointerdown({target:{}});assert.equal(f.panel.open,false);f.panel.open=true;f.done.listeners.click();assert.equal(f.panel.open,false);
});
test('markup is idempotent, progressively enhanced, and preserves existing login controls',()=>{
 const input='<html><head><title>Example</title></head><body><header><div class="header-tools"><a href="/login/">Login</a></div></header><main>Content</main></body></html>',html=readingMarkup(input);
 assert.equal((html.match(/data-reading-options hidden/g)||[]).length,1);assert.match(html,/Larger text/);assert.match(html,/Bolder text/);assert.match(html,/data-reading-choice="dark"> Dark mode/);assert.match(html,/dark-mode\.css\?v=/);assert.match(html,/reading-options\.js\?v=/);assert.match(html,/<a href="\/login\/">Login<\/a>/);assert.equal(readingMarkup(html),html);assert.equal(readingMarkup('<p>API fragment</p>'),'<p>API fragment</p>');
});
test('public and member pages get the same controls without adding them to admin, JSON or access gates',async t=>{
 const members=createMemberHandler({}),calendar=createCalendarHandler({members:null,store:null,config:null});const server=createServer({members,calendar,goldPrice:async()=>({}),log:()=>{}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base='http://127.0.0.1:'+server.address().port;
 for(const path of ['/','/articles/where-gold-settles/','/products/','/clubs-groups/','/plus/','/login/','/signup/','/forgot-password/','/calendar/','/gold-almanac/']){const r=await fetch(base+path);const html=await r.text();assert.equal(r.status,200,path);assert.equal((html.match(/data-reading-options hidden/g)||[]).length,1,path);if(path==='/login/')assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);}
 const denied=await fetch(base+'/api/gold-almanac/california/');assert.equal(denied.status,403);assert.doesNotMatch(await denied.text(),/reading-options/);const admin=await fetch(base+'/admin/');assert.doesNotMatch(await admin.text(),/reading-options/);
});

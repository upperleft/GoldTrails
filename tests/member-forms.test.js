import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync(new URL('../dist/member-forms.js',import.meta.url),'utf8');
function fixture(values={},options={}){
 const fields=Object.entries({username:'trailmember',email:'member@example.com',password:'an example long password',...values}).map(([name,value])=>({name,value,required:true,type:name.includes('assword')?'password':'text',validity:{valid:true},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},focus(){this.focused=true;}}));
 const button={textContent:'Create free account',attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 const element=()=>({children:[],attrs:{},append(...children){this.children.push(...children);},setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;}});
 const feedback={...element(),hidden:true,dataset:{},querySelector(){return this.children.find(child=>child?.href)||null;}};
 const card={...element(),replaceChildren(...children){this.children=children;}};
 const events={},windowEvents={};
 const toggle={textContent:'Show password',hidden:true,attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener:(name,fn)=>events.toggle=fn};
 const form={action:'https://gold.example/signup/',hasAttribute:name=>options.direct&&name==='data-async-signup',attrs:{},elements:{namedItem:name=>fields.find(f=>f.name===name)},closest:selector=>selector==='.member-card'?card:null,querySelector:s=>s.includes('feedback')?feedback:s.includes('data-password-toggle')?toggle:button,querySelectorAll:()=>fields,addEventListener:(name,fn)=>events[name]=fn,setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 const timers=new Map();let timerId=0;
 class TestFormData{constructor(){this.entries=[['csrf','a'.repeat(64)],...fields.map(f=>[f.name,f.value])];}*[Symbol.iterator](){yield* this.entries;}}
 runInNewContext(script,{document:{querySelectorAll:()=>[form],createElement:element,createTextNode:text=>({textContent:text})},fetch:options.fetch,AbortController,URLSearchParams,FormData:TestFormData,window:{addEventListener:(name,fn)=>windowEvents[name]=fn,setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)}});
 return{fields,button,feedback,form,toggle,card,timers,togglePassword:()=>events.toggle(),submit:()=>{let prevented=false;events.submit({preventDefault:()=>prevented=true});return prevented;},restore:()=>windowEvents.pageshow()};
}
test('signup feedback blocks short autofilled passwords and mismatched confirmation with visible errors',()=>{
 for(const values of [{password:'short',confirmPassword:'short'},{confirmPassword:'a different long password'}]){
  const ui=fixture(values);assert.equal(ui.submit(),true);assert.equal(ui.feedback.hidden,false);assert.equal(ui.feedback.dataset.state,'error');assert.ok(ui.fields.some(f=>f.focused&&f.attrs['aria-invalid']==='true'));assert.equal(ui.button.textContent,'Create free account');
 }
});
test('valid form submits once, shows honest pending feedback, and resets on browser Back',()=>{
 const ui=fixture();assert.equal(ui.submit(),false);assert.equal(ui.feedback.hidden,false);assert.match(ui.feedback.textContent,/Sending your request/);assert.equal(ui.form.attrs['aria-busy'],'true');assert.equal(ui.submit(),true);
 ui.restore();assert.equal(ui.button.textContent,'Create free account');assert.equal(ui.feedback.hidden,true);assert.equal(ui.submit(),false);
});

test('eight-character autofilled passwords submit without a confirmation field',()=>{
 const ui=fixture({password:'12345678'});assert.equal(ui.submit(),false);assert.equal(ui.fields.some(f=>f.name==='confirmPassword'),false);
 assert.equal(fixture({password:'1234567'}).submit(),true);
 assert.equal(fixture({password:'x'.repeat(128)}).submit(),false);assert.equal(fixture({password:'x'.repeat(129)}).submit(),true);
});
test('show/hide keeps the original password and cannot bypass length validation',()=>{
 const ui=fixture({password:'short'}),field=ui.fields.find(f=>f.name==='password');
 assert.equal(ui.toggle.hidden,false);ui.togglePassword();assert.equal(field.type,'text');assert.equal(field.value,'short');assert.equal(ui.toggle.attrs['aria-pressed'],'true');assert.equal(ui.submit(),true);
 ui.togglePassword();assert.equal(field.type,'password');assert.equal(field.value,'short');
 ui.togglePassword();ui.restore();assert.equal(field.type,'password');assert.equal(ui.toggle.attrs['aria-pressed'],'false');
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
const response=(status,result,type='application/json')=>({ok:status>=200&&status<300,status,headers:{get:()=>type},json:async()=>result});
test('direct signup submits the actual form once and renders confirmation only after the server responds',async()=>{
 let finish,calls=0;
 const ui=fixture({password:'12345678'},{direct:true,fetch:async(url,request)=>{calls++;assert.equal(url,'https://gold.example/signup/');assert.equal(request.credentials,'same-origin');assert.equal(request.headers.Accept,'application/json');assert.equal(request.body.get('password'),'12345678');assert.equal(request.body.get('csrf'),'a'.repeat(64));return new Promise(resolve=>finish=resolve);}});
 assert.equal(ui.submit(),true);assert.equal(ui.submit(),true);assert.equal(calls,1);assert.equal(ui.card.children.length,0);
 finish(response(200,{outcome:'email_requested',title:'Check your email',message:'Your request was received. Check your inbox.'}));await settle();
 assert.equal(ui.card.children[0].textContent,'Check your email');assert.equal(ui.card.focused,true);assert.equal(ui.button.attrs['aria-disabled'],undefined);assert.equal(ui.timers.size,0);
});
test('direct signup shows server validation and expiry errors without throwing away the form',async()=>{
 for(const status of [400,403,429,503]){
  const ui=fixture({password:'12345678'},{direct:true,fetch:async()=>response(status,{outcome:'error',title:'Request unavailable',message:'Try again.'})});
  ui.submit();await settle();assert.equal(ui.card.children.length,0);assert.match(ui.feedback.textContent,/Request unavailable/);assert.equal(ui.feedback.hidden,false);assert.equal(ui.button.textContent,'Create free account');assert.equal(ui.timers.size,0);
  if(status===403)assert.equal(ui.feedback.children.find(child=>child.href)?.href,'/signup/');
 }
});
test('network timeout and unexpected responses restore signup and offer email recovery without claiming success',async()=>{
 for(const mode of ['timeout','html']){
  const ui=fixture({password:'12345678'},{direct:true,fetch:async(url,request)=>mode==='html'?response(502,null,'text/html'):new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(Error('timeout'))))});
  ui.submit();if(mode==='timeout'){const deadline=[...ui.timers.values()].find(timer=>timer.ms===30000);deadline.fn();}
  await settle();assert.equal(ui.card.children.length,0);assert.match(ui.feedback.textContent,/could not confirm/);assert.equal(ui.button.textContent,'Create free account');assert.equal(ui.feedback.children.find(child=>child.href)?.href,'/resend-verification/');assert.equal(ui.timers.size,0);
 }
});

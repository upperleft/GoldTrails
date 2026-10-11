import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explainControl,helpPreferenceKey} from '../dist/site-help-content.js';
import {page} from '../app/directory-views.js';
import {runInNewContext} from 'node:vm';

test('navigation tips distinguish local resources, external sources and previews',()=>{
 assert.match(explainControl({tag:'a',href:'/prospectors/'}),/same creator directory/);
 assert.match(explainControl({tag:'a',href:'https://www.youtube.com/watch?v=real&t=42s'}),/new tab or window/);
 assert.match(explainControl({tag:'a',href:'/compass/demo/'}),/does not activate membership/);
 assert.match(explainControl({tag:'a',href:'/compass/'}),/requires an active subscriber/);
 assert.match(explainControl({tag:'a',href:'#sampling',permalink:true}),/address bar/);
 assert.doesNotMatch(explainControl({tag:'a',href:'#sampling',permalink:true}),/clipboard/);
});
test('descriptions never expose typed password, email or location values',()=>{
 for(const field of [{type:'password',name:'password'},{type:'email',name:'email'},{type:'text',name:'region'}]){
  const tip=explainControl({tag:'input',...field,value:'PRIVATE-TEST-VALUE',label:'Account field'});
  assert.ok(tip);assert.doesNotMatch(tip,/PRIVATE-TEST-VALUE/);
 }
 assert.match(explainControl({tag:'input',type:'password',newPassword:true}),/8–128/);
 assert.match(explainControl({tag:'input',name:'discoveries'}),/private/);
});
test('dashboard tips describe persistence, actual completion and preview limits',()=>{
 assert.match(explainControl({move:'up'}),/Save layout/);
 assert.match(explainControl({tag:'button',name:'intent',value:'save',demo:true}),/browser only/);
 assert.match(explainControl({tag:'button',formAction:'/compass/feedback/',value:'complete'}),/completed/);
 assert.match(explainControl({tag:'input',type:'checkbox',ephemeral:true}),/not saved/);
 assert.match(explainControl({explicit:'Future feature preview: nothing is stored.'}),/nothing is stored/);
});
test('static pages and server-rendered shell load versioned optional help',()=>{
 for(const path of ['dist/index.html','dist/articles/index.html','dist/glossary/index.html','dist/products/index.html']){
  const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(html,/href="\/site-help.css\?v=/);assert.match(html,/type="module" src="\/site-help.js\?v=/);
 }
 assert.match(page('Test','Test','<p>Test</p>','','Test'),/\/site-help.js\?v=/);
 assert.equal(helpPreferenceKey,'gold-trails-explanations-v1');
});

// Exercise the actual delegated event handlers with a small DOM fixture.
function helpFixture({stored=null,blocked=false}={}) {
 const events=new Map(),timers=new Map(),elements=[],saved=new Map();let timerId=0;
 const element=(tag='div')=>{
  const attrs=new Map(),classes=new Set(),el={tagName:tag.toUpperCase(),dataset:{},textContent:'',hidden:false,isConnected:true,style:{},children:[],matches:s=>s==='button'&&tag==='button',querySelectorAll:()=>[],cloneNode:()=>({textContent:el.textContent,querySelectorAll:()=>[]}),getAttribute:k=>attrs.get(k)||null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getBoundingClientRect:()=>({left:30,top:80,bottom:110,width:260,height:95}),contains:node=>node===el,hasAttribute:k=>attrs.has(k),append:(...nodes)=>el.children.push(...nodes),addEventListener:(name,fn)=>el.events.set(name,fn),events:new Map(),classList:{contains:k=>classes.has(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k)}};
  el.closest=s=>s.startsWith('a[href]')?el:null;elements.push(el);return el;
 };
 const toggle=element('input'),menu={prepend:()=>{}},body=element(),doc={activeElement:null,body,querySelector:()=>menu,querySelectorAll:()=>[],createElement:tag=>{const e=element(tag);e.querySelector=()=>toggle;return e;},addEventListener:(name,fn)=>events.set(name,fn)};
 const runtime=readFileSync(new URL('../dist/site-help.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
 runInNewContext(runtime,{explainControl,helpPreferenceKey,document:doc,window:{addEventListener:()=>{}},location:{href:'https://gold-trails.invalid/',origin:'https://gold-trails.invalid'},innerWidth:390,innerHeight:844,URL,Set,Math,localStorage:{getItem:()=>{if(blocked)throw Error();return stored;},setItem:(k,v)=>{if(blocked)throw Error();saved.set(k,v);}},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)});
 const bubble=elements.find(e=>e.id==='site-help-tooltip'),link=element('a');link.setAttribute('href','/articles/');link.textContent='Articles';
 const fire=(name,options={})=>{const e={target:link,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...options};events.get(name)?.(e);return e;};
 const tick=ms=>{for(const[id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
 const enable=value=>{toggle.checked=value;toggle.events.get('change')();};
 return{bubble,link,fire,tick,enable,toggle,saved};
}
test('help starts off, preserves existing descriptions, closes with Escape and remembers its setting',()=>{
 const f=helpFixture();assert.equal(f.toggle.checked,false);
 f.fire('focusin');assert.equal(f.bubble.hidden,true);
 f.link.setAttribute('aria-describedby','existing-note');f.enable(true);f.fire('focusin');
 assert.equal(f.bubble.hidden,false);assert.equal(f.link.getAttribute('aria-describedby'),'existing-note site-help-tooltip');
 f.fire('keydown',{key:'Escape'});assert.equal(f.bubble.hidden,true);assert.equal(f.link.getAttribute('aria-describedby'),'existing-note');
 assert.equal(f.saved.get(helpPreferenceKey),'on');f.enable(false);f.fire('focusin');assert.equal(f.bubble.hidden,true);
 assert.equal(helpFixture({stored:'on'}).toggle.checked,true);
});
test('help remains usable when browser preference storage is blocked',()=>{
 const f=helpFixture({blocked:true});f.enable(true);f.fire('focusin');assert.equal(f.bubble.hidden,false);
 f.enable(false);assert.equal(f.bubble.hidden,true);
});
test('mouse tips are delayed and can remain open while the pointer enters the bubble',()=>{
 const f=helpFixture({stored:'on'});f.fire('pointerover',{pointerType:'mouse'});assert.equal(f.bubble.hidden,true);f.tick(220);assert.equal(f.bubble.hidden,false);
 f.fire('pointerout',{pointerType:'mouse',relatedTarget:f.bubble});f.tick(220);assert.equal(f.bubble.hidden,false);
});
test('a touch hold explains without navigating; a normal subsequent tap still activates',()=>{
 const f=helpFixture({stored:'on'});f.fire('pointerdown',{pointerType:'touch',clientX:20,clientY:20});f.tick(550);assert.equal(f.bubble.hidden,false);
 f.fire('pointerup');const held=f.fire('click');assert.equal(held.prevented,true);assert.equal(held.stopped,true);
 f.fire('pointerdown',{pointerType:'touch',clientX:20,clientY:20});f.fire('pointerup');const tap=f.fire('click');assert.equal(tap.prevented,false);
});
test('touch scrolling cancels the hold and does not activate a help bubble',()=>{
 const f=helpFixture({stored:'on'});f.fire('pointerdown',{pointerType:'touch',clientX:20,clientY:20});f.fire('pointermove',{pointerType:'touch',clientX:20,clientY:50});f.tick(550);assert.equal(f.bubble.hidden,true);assert.equal(f.fire('click').prevented,false);
});

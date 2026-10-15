import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../dist/site-analytics.js',import.meta.url),'utf8');
function fixture({gpc=false,dnt=false,choice=null,storageBlocked=false}={}){
 const elements=[],docEvents={},windowEvents={},beacons=[];
 class Element{constructor(tag){this.tag=tag;this.children=[];this.events={};elements.push(this);}append(...children){this.children.push(...children);}setAttribute(){}addEventListener(key,fn){this.events[key]=fn;}focus(){}querySelector(name){return elements.find(e=>e.tag===name&&this.contains(e));}querySelectorAll(name){return elements.filter(e=>e.tag===name&&this.contains(e));}contains(e){return this.children.includes(e)||this.children.some(c=>c.contains?.(e));}}
 const makeStore=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>{if(storageBlocked)throw Error('blocked');map.set(k,v);},removeItem:k=>map.delete(k)};};
 const localStorage=makeStore(),sessionStorage=makeStore();if(choice)localStorage.setItem('gold-trails-usage-choice-v1',JSON.stringify({value:choice,at:Date.now()}));
 const footer=new Element('footer'),body=new Element('body');body.append(footer);const document={readyState:'complete',visibilityState:'visible',referrer:'https://www.youtube.com/private?email=SECRET',activeElement:null,body,querySelector:s=>s==='footer'?footer:null,createElement:s=>new Element(s),addEventListener:(k,f)=>docEvents[k]=f};
 const window={localStorage,sessionStorage,addEventListener:(k,f)=>windowEvents[k]=f};if(storageBlocked)Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});
 vm.runInNewContext(source,{document,window,navigator:{globalPrivacyControl:gpc,doNotTrack:dnt?'1':undefined,sendBeacon:(url,data)=>{beacons.push({url,data});return true;}},location:{pathname:'/articles/',origin:'https://gold.test'},crypto:webcrypto,innerWidth:1200,Date,URL,Blob,fetch:()=>{throw Error('Unexpected fallback');}});
 const click=label=>{const b=elements.find(e=>e.tag==='button'&&e.textContent===label);assert(b,label);if(!b.disabled)b.events.click();};
 const outbound=(url='https://www.youtube.com/watch?v=9Sldm-Eqz6o&t=40s&email=SECRET')=>docEvents.click({button:0,isTrusted:true,target:{closest:()=>({href:url,hasAttribute:()=>false})}});
 return{elements,beacons,click,outbound,localStorage,sessionStorage,windowEvents,docEvents};
}
test('client sends nothing until explicit consent; sends a scrubbed pageview and outbound click afterwards',async()=>{
 const f=fixture();assert.equal(f.elements.find(e=>e.tag==='section').hidden,true);assert.equal(f.beacons.length,0);f.outbound();assert.equal(f.beacons.length,0);f.click('Allow statistics');assert.equal(f.beacons.length,1);f.outbound();assert.equal(f.beacons.length,2);
 const [view,click]=await Promise.all(f.beacons.map(b=>b.data.text().then(JSON.parse)));assert.equal(view.type,'pageview');assert.equal(click.type,'outbound');assert.equal(view.visitor,click.visitor);assert.equal(view.session,click.session);assert.equal(view.referrer,'https://www.youtube.com');assert.equal(click.target,'https://www.youtube.com/watch?v=9Sldm-Eqz6o&t=40s');assert(!JSON.stringify([view,click]).includes('SECRET'));
});
test('declining or withdrawing stops measurement and removes browser codes',()=>{
 const f=fixture();f.click('No thanks');f.outbound();assert.equal(f.beacons.length,0);f.click('Visitor statistics');f.click('Allow statistics');assert.equal(f.beacons.length,1);assert(f.localStorage.getItem('gold-trails-usage-browser-v1'));f.click('Visitor statistics');f.click('No thanks');f.outbound();assert.equal(f.beacons.length,1);assert.equal(f.localStorage.getItem('gold-trails-usage-browser-v1'),null);assert.equal(f.sessionStorage.getItem('gold-trails-usage-visit-v1'),null);
});
test('privacy signals and unavailable storage disable collection without breaking page controls',()=>{
 for(const options of [{gpc:true},{dnt:true},{storageBlocked:true}]){const f=fixture(options);f.click('Allow statistics');f.outbound();assert.equal(f.beacons.length,0);f.click('Visitor statistics');}
});
test('consent withdrawal in another tab supersedes an earlier in-memory allow choice',()=>{
 const f=fixture();f.click('Allow statistics');f.localStorage.setItem('gold-trails-usage-choice-v1',JSON.stringify({value:'decline',at:Date.now()}));f.windowEvents.storage({key:'gold-trails-usage-choice-v1'});f.outbound();assert.equal(f.beacons.length,1);assert.equal(f.localStorage.getItem('gold-trails-usage-browser-v1'),null);
});
test('middle-button resource navigation is counted once and clearing the consent record stops future events',()=>{
 const f=fixture();f.click('Allow statistics');const event={type:'auxclick',button:1,isTrusted:true,target:{closest:()=>({href:'https://example.org/article',hasAttribute:()=>false})}};f.docEvents.auxclick(event);assert.equal(f.beacons.length,2);f.docEvents.auxclick({...event,button:2});assert.equal(f.beacons.length,2);f.localStorage.removeItem('gold-trails-usage-choice-v1');f.windowEvents.storage({key:null});f.outbound();assert.equal(f.beacons.length,2);
});

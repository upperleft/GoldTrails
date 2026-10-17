import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync(new URL('../dist/glossary.js',import.meta.url),'utf8');
function fixture(){
 const element=extra=>({events:{},attributes:{},hidden:false,textContent:'',dataset:{},addEventListener(k,fn){this.events[k]=fn;},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},...extra});
 let doc;
 const entries=['Alluvium','Bedrock'].map(name=>{
  const definition=element({hidden:true,prepend(close){this.close=close;close.parent=this;}});
  const cell=element({querySelector:()=>definition,contains(target){return target===button||target===definition||target===definition.close;}});
  const button=element({textContent:name,closest:()=>cell,focus(){doc.activeElement=this;cell.events.focusin();}});
  const row=element({textContent:name+' sediment rocks',cells:[{querySelector:()=>button},{textContent:'Geology'}]});
  return {button,cell,definition,row};
 });
 const search=element({value:''}),category=element({value:''}),count=element(),empty=element();
 const body={rows:entries.map(e=>e.row)},glossary={classList:{add(){}}};
 const selectors={'.glossary tbody':body,'.glossary':glossary,'#term-search':search,'#term-category':category,'#term-count':count,'#no-terms':empty};
 doc=element({activeElement:null,querySelector:s=>selectors[s],querySelectorAll:s=>s==='.term'?entries.map(e=>e.button):[],createElement:()=>element()});
 runInNewContext(script,{document:doc,location:{search:''},URLSearchParams});return{entries,doc,search,count};
}
test('Close and Escape dismiss a focused definition without immediately reopening it',()=>{
 for(const action of ['close','escape']){
  const f=fixture(),e=f.entries[0];e.button.focus();e.button.events.click();assert.equal(e.definition.hidden,false);
  if(action==='close')e.definition.close.events.click();else {let prevented=false;f.doc.events.keydown({key:'Escape',preventDefault:()=>prevented=true});assert.equal(prevented,true);}
  assert.equal(e.definition.hidden,true);assert.equal(e.button.attributes['aria-expanded'],'false');assert.equal(f.doc.activeElement,e.button);
  e.button.events.click();assert.equal(e.definition.hidden,false);
 }
});
test('repeat clicks, outside taps and opening another term close the previous definition',()=>{
 const f=fixture(),[a,b]=f.entries;
 a.button.events.click();a.button.events.click();assert.equal(a.definition.hidden,true);
 a.button.events.click();f.doc.events.pointerdown({target:{}});assert.equal(a.definition.hidden,true);
 a.button.events.click();b.button.events.click();assert.equal(a.definition.hidden,true);assert.equal(b.definition.hidden,false);
});
test('hover definitions can reopen after leaving; search closes definitions without indexing Close labels',()=>{
 const f=fixture(),e=f.entries[0];
 for(let n=0;n<2;n++){e.cell.events.pointerenter({pointerType:'mouse'});assert.equal(e.definition.hidden,false);e.cell.events.pointerleave();assert.equal(e.definition.hidden,true);}
 e.button.events.click();f.search.value='close';f.search.events.input();assert.equal(e.definition.hidden,true);assert.ok(f.entries.every(e=>e.row.hidden));
 f.search.value='bedrock';f.search.events.input();assert.equal(f.entries[1].row.hidden,false);assert.equal(f.entries[0].row.hidden,true);
});

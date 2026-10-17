import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync(new URL('../dist/glossary.js',import.meta.url),'utf8');
function fixture(){
 let doc;
 const element=extra=>({events:{},attributes:{},hidden:false,textContent:'',dataset:{},childNodes:[],addEventListener(k,fn){this.events[k]=fn;},setAttribute(k,v){this.attributes[k]=v;},append(...nodes){this.childNodes.push(...nodes);},replaceChildren(...nodes){this.childNodes=nodes;},focus(options){doc.activeElement=this;this.focusOptions=options;},...extra});
 const classes=new Set();
 const entries=['Alluvium','Fossicking'].map(name=>{
  const source={textContent:name+' definition',href:'https://example.invalid/geological-source',cloneNode(){return {...this};}};
  const definition=element({hidden:true,childNodes:[source]});
  const button=element({textContent:name,closest:()=>({querySelector:()=>definition})});
  const row=element({textContent:name+' sediment rocks',cells:[{querySelector:()=>button},{textContent:'Geology'}]});
  return {button,definition,row};
 });
 const search=element({value:''}),category=element({value:''}),count=element(),empty=element(),body=element({rows:entries.map(e=>e.row)}),glossary={classList:{add(){}}};
 const selectors={'.glossary tbody':body,'.glossary':glossary,'#term-search':search,'#term-category':category,'#term-count':count,'#no-terms':empty};
 let overlay;
 doc=element({activeElement:null,body:element(),documentElement:{classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}},querySelector:s=>selectors[s],querySelectorAll:s=>s==='.term'?entries.map(e=>e.button):[],createElement:tag=>{
  const el=element();if(tag==='dialog'){overlay=el;el.open=false;el.showModal=()=>{el.open=true;};el.close=()=>{el.open=false;el.events.close();};el.getBoundingClientRect=()=>({left:100,right:500,top:100,bottom:400});}return el;
 }});
 runInNewContext(script,{document:doc,location:{search:''},URLSearchParams});
 return {entries,doc,search,classes,overlay,header:overlay.childNodes[0],content:overlay.childNodes[1],close:overlay.childNodes[0].childNodes[1]};
}
test('one overlay displays the selected title and citation while original table definitions stay hidden',()=>{
 const f=fixture(),[a,b]=f.entries;a.button.events.click();assert.equal(f.overlay.open,true);assert.equal(f.header.childNodes[0].textContent,'Alluvium');assert.equal(a.definition.hidden,true);assert.equal(a.button.attributes['aria-expanded'],'true');assert.equal(a.button.attributes['aria-haspopup'],'dialog');
 b.button.events.click();assert.equal(f.header.childNodes[0].textContent,'Fossicking');assert.equal(a.button.attributes['aria-expanded'],'false');assert.equal(f.content.childNodes[0].href,b.definition.childNodes[0].href);assert.notEqual(f.content.childNodes[0],b.definition.childNodes[0]);assert.equal(f.doc.body.childNodes.length,1);
});
test('Close and native dialog dismissal restore term focus without scrolling or reopening',()=>{
 for(const native of [false,true]){
  const f=fixture(),e=f.entries[0];e.button.events.click();assert.ok(f.classes.has('glossary-dialog-open'));
  if(native)f.overlay.close();else f.close.events.click();
  assert.equal(f.overlay.open,false);assert.equal(e.button.attributes['aria-expanded'],'false');assert.equal(f.doc.activeElement,e.button);assert.equal(e.button.focusOptions.preventScroll,true);assert.equal(f.classes.has('glossary-dialog-open'),false);
 }
});
test('clicking inside the overlay keeps it open; clicking its backdrop closes it',()=>{
 const f=fixture();f.entries[0].button.events.click();
 f.overlay.events.click({target:f.overlay,clientX:200,clientY:200});assert.equal(f.overlay.open,true);
 f.overlay.events.click({target:f.overlay,clientX:20,clientY:20});assert.equal(f.overlay.open,false);
});
test('filtering closes overlays and preserves definition-text searches without indexing dialog controls',()=>{
 const f=fixture();f.entries[0].button.events.click();f.search.value='close';f.search.events.input();assert.equal(f.overlay.open,false);assert.ok(f.entries.every(e=>e.row.hidden));
 f.search.value='fossicking';f.search.events.input();assert.equal(f.entries[1].row.hidden,false);assert.equal(f.entries[0].row.hidden,true);
});

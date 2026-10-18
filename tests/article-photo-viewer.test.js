import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script=readFileSync(new URL('../dist/article-photo-viewer.js',import.meta.url),'utf8');
function fixture({nativeDialog=true,missingArticle=false,missingDialog=false}={}){
 const element=extra=>({events:{},attributes:{},childNodes:[],textContent:'',addEventListener(name,handler){this.events[name]=handler;},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];if(name==='src')delete this.src;},replaceChildren(...nodes){this.childNodes=nodes;},...extra});
 const image=element(),title=element(),caption=element(),close=element(),shrink=element();
 const dialog=element({open:false,showModal:nativeDialog?function(){this.open=true;}:undefined,close(){this.open=false;this.events.close?.();},querySelector:selector=>({'[data-article-photo-image]':image,'#article-photo-title':title,'[data-article-photo-caption]':caption,'[data-article-photo-shrink]':shrink,'[data-article-photo-close]':close})[selector]});
 const article=element();
 const source={kind:'link',href:'https://example.org/specimen',textContent:'Museum specimen credit',cloneNode(deep){assert.equal(deep,true);return {...this};}};
 const original={alt:'Gray specimen showing pale and dark bands.'};
 const figure={querySelector:selector=>selector==='figcaption'?{childNodes:[source]}:null};
 const link=element({href:'http://example.test/assets/articles/river-rocks/gneiss.jpg',dataset:{photoTitle:'Gneiss'},closest:selector=>selector==='figure'?figure:null,querySelector:selector=>selector==='img'?original:null,focus(options){this.focused=true;this.focusOptions=options;}});
 const target={closest:selector=>selector==='[data-article-photo]'?link:null};
 const document={querySelector:selector=>selector==='#river-rocks-article'?(missingArticle?null:article):(missingDialog?null:dialog)};
 runInNewContext(script,{document});
 const click=(overrides={})=>{const event={target,button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,preventDefault(){this.prevented=true;},...overrides};article.events.click?.(event);return event;};
 return {article,dialog,image,title,caption,close,shrink,link,figure,original,source,click};
}

test('primary photograph click opens the full image with the original alt and cloned source-credit links',()=>{
 const f=fixture(),event=f.click();assert.equal(event.prevented,true);assert.equal(f.dialog.open,true);
 assert.equal(f.image.src,f.link.href);assert.equal(f.image.alt,f.original.alt);assert.equal(f.title.textContent,'Gneiss');
 assert.equal(f.link.attributes['aria-expanded'],'true');assert.equal(f.shrink.attributes['aria-label'],'Close enlarged photograph of Gneiss');
 assert.equal(f.caption.childNodes.length,1);assert.notEqual(f.caption.childNodes[0],f.source);assert.equal(f.caption.childNodes[0].href,f.source.href);
});

test('Close button, image click and native close event clear the photograph and return focus without scrolling',()=>{
 // Native Escape is supplied by HTML dialog, so exercise its resulting close event here.
 // Actual Escape key behavior belongs to the browser integration check.
 for(const dismissal of ['button','image','native']){
  const f=fixture();f.click();
  if(dismissal==='button')f.close.events.click();else if(dismissal==='image')f.shrink.events.click();else f.dialog.close();
  assert.equal(f.dialog.open,false);assert.equal(f.link.attributes['aria-expanded'],'false');assert.equal(f.link.focused,true);
  assert.equal(f.link.focusOptions.preventScroll,true);assert.equal(f.image.src,undefined);assert.equal(f.caption.childNodes.length,0);
 }
});

test('clicking a caption or controls keeps the modal open; backdrop click dismisses it',()=>{
 const f=fixture();f.click();f.dialog.events.click({target:f.caption});assert.equal(f.dialog.open,true);
 f.dialog.events.click({target:f.dialog});assert.equal(f.dialog.open,false);assert.equal(f.link.focused,true);
});

test('modifier clicks, other mouse buttons and unrelated links keep their ordinary browser navigation',()=>{
 for(const override of [{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{button:1},{button:2},{target:{closest:()=>null}}]){
  const f=fixture(),event=f.click(override);assert.equal(event.prevented,undefined);assert.equal(f.dialog.open,false);assert.equal(f.image.src,undefined);
 }
});

test('without native dialogs or article markup, the normal full-image links remain unmodified',()=>{
 for(const options of [{nativeDialog:false},{missingArticle:true},{missingDialog:true}]){
  const f=fixture(options);assert.equal(f.article.events.click,undefined);assert.equal(f.click().prevented,undefined);
 }
});

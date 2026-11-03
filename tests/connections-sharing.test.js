import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../dist/connections.js',import.meta.url),'utf8');
const publicUrl='https://goldtrails.org/connections/events/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/';

function shareFixture(clipboard){
 const clicks=new Map(),state={focused:false,selected:false};
 const input={value:publicUrl,focus:()=>state.focused=true,select:()=>state.selected=true};
 const button={hidden:true,addEventListener:(name,fn)=>clicks.set(name,fn)};
 const status={textContent:''};
 const fields={'[data-event-share-url]':input,'[data-event-share-copy]':button,'[data-event-share-status]':status};
 const section={querySelector:selector=>fields[selector]||null};
 const document={querySelector:()=>null,querySelectorAll:selector=>selector==='[data-event-share]'?[section]:[]};
 vm.runInNewContext(script,{document,navigator:clipboard?{clipboard}:{}});
 return {state,input,button,status,click:()=>clicks.get('click')()};
}

test('event sharing copies only the public URL after a deliberate click',async()=>{
 const copied=[];const f=shareFixture({writeText:async value=>copied.push(value)});
 assert.equal(f.button.hidden,false);assert.deepEqual(copied,[],'Loading an event never writes to the clipboard');
 await f.click();assert.deepEqual(copied,[publicUrl]);assert.equal(f.status.textContent,'Public event link copied.');
 assert.equal(f.state.selected,false);
});

test('unavailable or denied clipboard access keeps manual event-link copying usable',async()=>{
 for(const clipboard of [null,{writeText:async()=>{throw Error('Clipboard access denied');}}]){
  const f=shareFixture(clipboard);await f.click();
  assert.equal(f.input.value,publicUrl);assert.equal(f.state.focused,true);assert.equal(f.state.selected,true);
  assert.match(f.status.textContent,/Link selected/);assert.match(f.status.textContent,/Command-C|Ctrl-C/);
 }
});

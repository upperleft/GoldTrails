import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync(new URL('../dist/member-forms.js',import.meta.url),'utf8');
function fixture(values={}){
 const fields=Object.entries({username:'trailmember',email:'member@example.com',password:'an example long password',...values}).map(([name,value])=>({name,value,required:true,type:name.includes('assword')?'password':'text',validity:{valid:true},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},focus(){this.focused=true;}}));
 const button={textContent:'Create free account',attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 const feedback={hidden:true,dataset:{},setAttribute(){}};
 const events={},windowEvents={};
 const toggle={textContent:'Show password',hidden:true,attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener:(name,fn)=>events.toggle=fn};
 const form={attrs:{},elements:{namedItem:name=>fields.find(f=>f.name===name)},closest:()=>null,querySelector:s=>s.includes('feedback')?feedback:s.includes('data-password-toggle')?toggle:button,querySelectorAll:()=>fields,addEventListener:(name,fn)=>events[name]=fn,setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 runInNewContext(script,{document:{querySelectorAll:()=>[form]},window:{addEventListener:(name,fn)=>windowEvents[name]=fn,setTimeout:()=>1,clearTimeout:()=>{}}});
 return{fields,button,feedback,form,toggle,togglePassword:()=>events.toggle(),submit:()=>{let prevented=false;events.submit({preventDefault:()=>prevented=true});return prevented;},restore:()=>windowEvents.pageshow()};
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

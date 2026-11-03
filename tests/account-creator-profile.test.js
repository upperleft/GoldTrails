import test from 'node:test';
import assert from 'node:assert/strict';
import {accountView} from '../app/account-view.js';

const csrf='a'.repeat(64),profile={slug:'river-teacher',display_name:'River Teacher'};
const member={id:'11111111-1111-4111-8111-111111111111',username:'teacher',email:'teacher@example.invalid',account_number:42,effective_level:'subscriber',grant_source:'complimentary',ends_at:null};
test('accepted complimentary creators see their profile link before ordinary Camp content',()=>{
 const html=accountView(member,csrf,{creatorProfile:profile});
 assert.match(html,/Your creator account is ready/);assert.match(html,/complimentary Gold Trails Plus access is active/);
 assert.match(html,/<a class="gold-button" href="\/prospectors\/river-teacher\/">View your creator profile →<\/a>/);
 assert.ok(html.indexOf('camp-creator-welcome')<html.indexOf('class="camp-welcome"'));
 assert.doesNotMatch(html,/<a[^>]*href="\/prospectors\/river-teacher\/"[^>]*target=/);
});
test('ordinary and unaccepted accounts retain the existing Camp output',()=>{
 for(const value of [{...member,effective_level:'free',grant_source:'free'},{...member,grant_source:'payment'},{...member,effective_level:'free'}])assert.equal(accountView(value,csrf,{creatorProfile:profile}),accountView(value,csrf));
 assert.equal(accountView(member,csrf,{creatorProfile:null}),accountView(member,csrf));
 assert.doesNotMatch(accountView(member,csrf),/camp-creator-welcome|View your creator profile/);
});
test('creator names are escaped and profile destinations must be canonical local slugs',()=>{
 const html=accountView(member,csrf,{creatorProfile:{slug:'river-teacher',display_name:'River <script>alert(1)</script> & "Teacher"'}});
 assert.match(html,/River &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;Teacher&quot;/);assert.doesNotMatch(html,/<script>/);
 for(const invalid of [{slug:'https://evil.example/',display_name:'Creator'},{slug:'../admin',display_name:'Creator'},{slug:'river-teacher" onclick="bad()',display_name:'Creator'},{slug:'river-teacher',display_name:''},{slug:'river-teacher',display_name:'x'.repeat(181)}])assert.equal(accountView(member,csrf,{creatorProfile:invalid}),accountView(member,csrf));
});

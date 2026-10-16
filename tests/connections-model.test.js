import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateEvent,occurrenceInputs,meetingVault,publicEvent,eventFilters,states} from '../app/connections/model.js';
import {coverageStates,adjacency} from '../app/connections/geography.js';
import {allocateRsvp} from '../app/connections/store.js';
import {richText} from '../app/connections/views.js';
import {calendarIcs} from '../app/connections/ics.js';
export const eventInput=()=>({title:'A panning gathering',description:'Meet prospectors and compare pans.',state:'MA',category:'Outing',level:'All levels',mode:'in-person',visibility:'public',addressVisibility:'attendees',notificationRange:'1',timeZone:'America/New_York',startLocal:'2027-06-12T10:00',endLocal:'2027-06-12T12:00',capacity:'2',waitlist:'yes',status:'published'});
test('50 permanent state groups and symmetric shared-border geography preserve islands and corner exclusions',()=>{
 assert.equal(states.length,50);assert.equal(new Set(states.map(s=>s.code)).size,50);
 for(const[s,ns]of Object.entries(adjacency)){assert.ok(!ns.includes(s));for(const n of ns)assert.ok(adjacency[n].includes(s));}
 assert.deepEqual(coverageStates('MA',1).map(s=>s.code).sort(),['CT','MA','NH','NY','RI','VT']);
 assert.ok(coverageStates('MA',2).some(s=>s.code==='ME'));assert.ok(!coverageStates('MA',2).some(s=>s.code==='CA'));
 for(const s of ['AK','HI'])assert.deepEqual(coverageStates(s,2).map(s=>s.code),[s]);
 assert.ok(!adjacency.AZ.includes('CO'));assert.ok(!adjacency.UT.includes('NM'));assert.ok(!adjacency.MI.includes('IL'));
 assert.throws(()=>coverageStates('DC',1));assert.throws(()=>coverageStates('MA',3));
 const sql=readFileSync(new URL('../database/migrations/013_gold_connections.sql',import.meta.url),'utf8');assert.match(sql,/PRIMARY KEY\(event_id,account_id\)/);assert.match(sql,/connections_notification_once/);assert.ok(!/DROP TABLE/i.test(sql));
});
test('event validation converts time zones, rejects DST gaps, forged attributes and invalid boundaries',()=>{
 const e=validateEvent(eventInput());assert.equal(e.startUtc,'2027-06-12T14:00:00.000Z');assert.equal(e.capacity,2);
 for(const change of [{state:'DC'},{capacity:0},{capacity:2.5},{endLocal:'2027-06-12T09:00'},{timeZone:'Mars/Gold'},{mapUrl:'javascript:alert(1)'},{notificationRange:3},{zoomUrl:'https://zoom.us.evil.example/j/123'},{status:'deleted'},{recurrence:'weekly',occurrences:25},{deadlineLocal:'2027-06-13T10:00'},{startLocal:'2027-03-14T02:30',endLocal:'2027-03-14T04:00'},{startLocal:'2027-11-07T01:30',endLocal:'2027-11-07T04:00'},{mode:'online'}])assert.throws(()=>validateEvent({...eventInput(),...change}),JSON.stringify(change));
});
test('bounded recurrence preserves local clock time across DST and rejects ambiguous occurrences',()=>{
 const e=validateEvent({...eventInput(),startLocal:'2027-03-07T10:00',endLocal:'2027-03-07T12:00',recurrence:'weekly',occurrences:3});const rows=occurrenceInputs(e);assert.equal(rows.length,3);assert.equal(rows[1].startLocal,'2027-03-14T10:00:00');assert.equal(rows[0].startUtc.slice(11,16),'15:00');assert.equal(rows[1].startUtc.slice(11,16),'14:00');
 assert.throws(()=>occurrenceInputs(validateEvent({...eventInput(),startLocal:'2027-03-07T02:30',endLocal:'2027-03-07T04:00',recurrence:'weekly',occurrences:2})));
});
test('meeting credentials require authenticated encryption and never enter a public projection',()=>{
 const vault=meetingVault('ab'.repeat(32)),meeting={zoomUrl:'https://example.zoom.us/j/123',passcode:'secret'};const cipher=vault.seal(meeting);assert.ok(!cipher.includes('secret'));assert.deepEqual(vault.open(cipher),meeting);assert.throws(()=>meetingVault('cd'.repeat(32)).open(cipher));assert.throws(()=>meetingVault().seal(meeting));
 const p=publicEvent({...validateEvent(eventInput()),id:'id',organizerId:'private-member-id',meetingCipher:cipher,meeting,street:'private street',zip:'private ZIP',mapUrl:'https://maps.example/private'});for(const k of ['meeting','meetingCipher','organizerId','street','zip','mapUrl'])assert.ok(!Object.hasOwn(p,k),k);
});
test('RSVP allocation is idempotent, capacity bound, deadline aware and waitlist aware',()=>{
 const e=validateEvent(eventInput());assert.equal(allocateRsvp(e,null,1),'yes');assert.equal(allocateRsvp(e,null,2),'waitlisted');assert.equal(allocateRsvp(e,{status:'yes'},2),'yes');assert.throws(()=>allocateRsvp({...e,waitlist:false},null,2));assert.throws(()=>allocateRsvp({...e,status:'cancelled'},null,0));assert.throws(()=>allocateRsvp(e,null,0,Date.parse(e.startUtc)));assert.throws(()=>allocateRsvp({...e,deadlineUtc:'2026-01-01T00:00:00Z'},null,0));
});
test('rich text does not trust HTML and calendar exports omit private meeting and address information',()=>{
 const html=richText('**Hello**\n\n- A\n- B\n\n<script>alert(1)</script> [bad](javascript:alert(1)) [good](https://example.com)');assert.ok(html.includes('<strong>Hello</strong>'));assert.ok(!html.includes('<script>'));assert.match(html,/<ul>/);assert.ok(!html.includes('href="javascript:'));
 const e={...validateEvent(eventInput()),id:'example',revision:1,meeting:{passcode:'secret'},street:'private street'};const ics=calendarIcs(e,'https://goldtrails.org');assert.ok(!ics.includes('secret'));assert.ok(!ics.includes('private street'));assert.match(ics,/DTSTART:20270612T140000Z/);assert.match(ics,/UID:example@goldtrails.org/);
});
test('event discovery validates filters rather than interpolating arbitrary SQL choices',()=>{
 assert.equal(eventFilters(new URLSearchParams()).period,'upcoming');assert.throws(()=>eventFilters(new URLSearchParams('state=DC')));assert.throws(()=>eventFilters(new URLSearchParams('page=-1')));assert.throws(()=>eventFilters(new URLSearchParams('from=2027-02-31')));assert.throws(()=>eventFilters(new URLSearchParams('from=2027-06-10&to=2027-06-01')));
});

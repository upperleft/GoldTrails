import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturerOverview,manufacturerOutreachView,validateManufacturerBatch} from '../app/manufacturer-outreach.js';
import {contactSnapshots} from '../app/business-contacts.js';
const row=(extra={})=>({record_type:'manufacturer_outreach',record_id:'GT-O-11111111-1111-4111-8111-111111111111',name:'Example <maker>',website:'https://example.com/',linked_manufacturer_ids:['GT-M001'],linked_product_ids:[],linked_product_names:[],methods:[{kind:'email',value:'hello@example.com',purpose:'business',verification_status:'published',source_url:'https://example.com/contact/'}],outreach_events:[{status:'provider_accepted',at:'2026-11-22T12:00:00Z',to:'hello@example.com',subject:'Welcome',text:'Hello <script>bad</script>',source_url:'https://example.com/contact/'}],reply_references:[],mailbox_checked_at:'2026-11-22T14:00:00Z',...extra});
const batch=contacts=>({batch_id:'test-manufacturers',date_researched:'2026-11-22',contacts});
test('manufacturer history uses existing additive contact snapshot identities',()=>{
 const input=batch([row()]);validateManufacturerBatch(input);
 assert.deepEqual(contactSnapshots(input).map(r=>[r.id,r.hash]),contactSnapshots(input).map(r=>[r.id,r.hash]));
 assert.throws(()=>validateManufacturerBatch(batch([row({linked_manufacturer_ids:['UNKNOWN']})])));
 assert.throws(()=>validateManufacturerBatch(batch([row({outreach_events:[{status:'delivered'}]})])));
});
test('latest mailbox classification wins without discarding earlier contact history',()=>{
 const older=row();const newer=row({outreach_events:[],mailbox_checked_at:'2026-11-22T15:00:00Z',reply_references:[{message_id:'1',at:'2026-11-22T14:30:00Z',from:'hello@example.com',subject:'Thanks',kind:'reply'}]});
 const records=manufacturerOverview([{record:older},{record:newer},{record:older}]);
 assert.equal(records.length,1);assert.equal(records[0].outreach_events.length,1);
 const html=manufacturerOutreachView(records,'csrf');
 assert.match(html,/<dt>Contacted<\/dt><dd><strong>1/);assert.match(html,/<dt>Replied<\/dt><dd><strong>1/);
 assert.match(html,/Example &lt;maker&gt;/);assert.doesNotMatch(html,/<script>bad/);
});
test('automatic responses and possible replies do not inflate personal reply totals',()=>{
 for(const kind of ['automatic_acknowledgment','possible_reply']){
  const html=manufacturerOutreachView([row({reply_references:[{message_id:'1',at:'2026-11-22T14:30:00Z',from:'hello@example.com',subject:'Ticket',kind}]})],'csrf');
  assert.match(html,/<dt>Replied<\/dt><dd><strong>0/);assert.match(html,/Acknowledgment \/ possible reply/);
 }
 assert.doesNotMatch(manufacturerOutreachView([],'csrf'),/NaN|Infinity/);
});

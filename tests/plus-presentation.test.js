import test from 'node:test';
import assert from 'node:assert/strict';
import {plusPage} from '../app/plus/views.js';

const offer=(grant_source='payment')=>({enabled:true,csrf:'fixture-csrf',member:{effective_level:'subscriber',grant_source},state:{membership:{grant_source,status:'active'},subscription:grant_source==='payment'?{status:'active'}:null}});
const noSalesPrompt=html=>{
 assert.doesNotMatch(html,/Subscribe|Sign in|action="\/billing\/subscribe\/"|class="plus-offer-price"/);
 assert.match(html,/href="\/billing\/">Membership &amp; billing<\/a>/);
};

test('active paid members see included features and access actions even when new checkout is disabled',()=>{
 for(const enabled of [true,false]){
  const html=plusPage({...offer(),enabled});
  assert.match(html,/Both Plus features are included with your membership\./);
  assert.match(html,/<h3>Your Gold Trails Plus<\/h3>/);
  assert.match(html,/Included with your membership/);
  assert.match(html,/href="\/gold-almanac\/">Open your Almanac<\/a>/);
  noSalesPrompt(html);
 }
});

test('complimentary creators see their access, its normal value and no fee or card requirement',()=>{
 for(const member of [{effective_level:'subscriber',grant_source:'complimentary'},{effective_level:'subscriber'}]){
  const html=plusPage({...offer('complimentary'),member});
  assert.match(html,/Your complimentary Plus access includes both features\./);
  assert.match(html,/Complimentary access \(normally \$5\/month\)/);
  assert.match(html,/Your Plus access is complimentary\. No subscription fee or card is required\./);
  assert.match(html,/href="\/gold-almanac\/">Open your Almanac<\/a>/);
  assert.doesNotMatch(html,/renewing automatically|Cancel future renewals/);
  noSalesPrompt(html);
 }
});

test('an existing subscription without effective access leads to its status instead of another subscription',()=>{
 for(const member of [{effective_level:'free',level:'subscriber'},{level:'subscriber'}]){
  const html=plusPage({...offer(),member});
  assert.match(html,/Your Plus membership\. Review your current access below\./);
  assert.match(html,/Plus access is not currently active\./);
  assert.doesNotMatch(html,/Open your Almanac|Included with your membership|Your Plus access is active/);
  noSalesPrompt(html);
 }
});

test('inactive complimentary membership keeps no-fee details without claiming active access',()=>{
 const html=plusPage({...offer('complimentary'),member:{effective_level:'free',level:'subscriber'}});
 assert.match(html,/No subscription fee or card is required/);
 assert.match(html,/Review your current Plus access and membership status\./);
 assert.doesNotMatch(html,/Open your Almanac|Your Plus access is complimentary|Your complimentary Plus access includes/);
 noSalesPrompt(html);
});

test('anonymous and free members retain the regular five-dollar offer',()=>{
 const disabled=plusPage();
 assert.match(disabled,/Both Plus features\. <strong>\$5 \/ month<\/strong>/);
 assert.match(disabled,/disabled aria-describedby="plus-payment-status">Subscribe · \$5\/month/);
 const anonymous=plusPage({enabled:true});
 assert.match(anonymous,/Sign in to subscribe · \$5\/month/);
 assert.match(anonymous,/Already have access\? Sign in/);
 const free=plusPage({enabled:true,csrf:'fixture-csrf',member:{effective_level:'free'},state:{membership:{grant_source:'free'}}});
 assert.match(free,/action="\/billing\/subscribe\/"/);
 assert.match(free,/Subscribe · \$5\/month/);
 assert.match(free,/aria-label="5 US dollars per month"/);
 assert.doesNotMatch(free,/Already have access\? Sign in|Open your Almanac/);
});

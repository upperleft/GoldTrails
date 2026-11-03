import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {focusedCreatorAccessPage} from '../app/creator-invitations/access-page.js';
import {homepageMarkup} from '../app/homepage/handler.js';
import {readingMarkup} from '../app/reading/handler.js';
import {siteNavigationMarkup} from '../app/site-navigation.js';
import {plusMarkup} from '../app/plus/handler.js';

const links=html=>[...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match=>match[1]);

test('focused creator shell keeps only supplied membership content and accessible reading tools',()=>{
 const body='<p>Your complimentary membership is ready to accept.</p><form method="post" action="/creator-invitation/"><input type="hidden" name="csrf" value="fixture-csrf"><button class="gold-button" type="submit">Accept complimentary access</button></form>';
 const html=focusedCreatorAccessPage('Accept <your> membership',body);
 assert.match(html,/<title>Accept &lt;your&gt; membership — Gold Trails<\/title>/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/<h1 id="member-access-title">Accept &lt;your&gt; membership<\/h1>/);assert.ok(html.includes(body));
 assert.match(html,/class="category-page member-page member-auth-page creator-access-page" data-complimentary-invitation data-creator-access-flow/);
 assert.deepEqual(links(html),['#main-content'],'The shell adds only its internal accessibility skip link');
 assert.match(html,/<div class="brand creator-access-brand">/);assert.match(html,/<div class="header-tools"><details class="reading-options"/);
 assert.match(html,/data-reading-larger/);assert.match(html,/data-reading-choice="dark"/);assert.match(html,/src="\/reading-options\.js\?v=[a-f0-9]{12}"/);
 assert.doesNotMatch(html,/<nav\b|trail-menu|home-hotspot|href="\/prospectors|href="\/articles|src="\/site-help\.js|src="\/external-links\.js/);
 assert.equal(readingMarkup(html),html,'Later reading wrappers do not duplicate the controls');
 assert.equal(siteNavigationMarkup(html,{path:'/creator-invitation/'}),html,'Public navigation wrapper has no menu to attach');
 assert.equal(plusMarkup(html),html,'A pending creator does not receive a subscription promotion');
});

test('pending homepage keeps the full scene and text homepage with one Continue destination',async()=>{
 const original=await readFile('dist/index.html','utf8');
 for(const options of [{creatorInvitation:true},{creatorInvitation:true,member:{effective_level:'subscriber'}},{creatorInvitation:true,guest:true}]){
  const html=homepageMarkup(original,options);
  assert.deepEqual(links(html),['#main-content','/creator-invitation/']);
  assert.match(html,/Continue to your free creator account/);assert.match(html,/Accept your free membership first, then explore the site and your creator profile/);
  assert.match(html,/data-creator-access-home/);assert.match(html,/class="home-graphical/);assert.match(html,/class="home-classic creator-inert-classic"/);
  assert.match(html,/srcset="\/assets\/homepage\/full-home-critique-v4.webp"/);
  assert.match(html,/<span[^>]*data-home-id="nav-destinations"[^>]*role="link" aria-disabled="true"/);
  assert.doesNotMatch(html,/data-home-help=|data-home-search|src="\/home-art\.js|<button[^>]*data-home-|target="_blank"|\stabindex=/);
  assert.equal((html.match(/id="main-content"/g)||[]).length,1);
  assert.equal((html.match(/data-reading-options/g)||[]).length,1);
 }
});

test('ordinary homepage retains its artwork, public content and navigation',async()=>{
 const original=await readFile('dist/index.html','utf8'),html=homepageMarkup(original);
 assert.match(html,/class="home-graphical/);assert.match(html,/class="home-classic"/);assert.match(html,/data-home-id="nav-destinations"[^>]*href="\/prospectors\/"/);
 assert.ok(html.includes(original.match(/<section class="hero">[\s\S]*?<\/section>/)[0]));
 assert.doesNotMatch(html,/data-creator-access-flow|creator-access-home-preview/);assert.equal(homepageMarkup(html),html);
});

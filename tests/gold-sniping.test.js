import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {renderTabbedArticle, escape} from '../app/articles/tabbed-article.js';
import {traps, renderTrapDiagram} from '../app/articles/gold-sniping-traps.js';
import {createServer} from '../app/server.js';
import {publishedArticles} from '../app/compass/content.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const route = '/articles/gold-sniping/';
const html = read('dist' + route + 'index.html');
const evidence = JSON.parse(read('app/articles/gold-sniping-evidence.json'));
const sectionIds = ['where-to-look', 'techniques', 'equipment', 'evidence-behavior', 'safety-access'];
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const links = [...html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)].map(match => ({attrs:match[1], href:match[1].match(/\bhref="([^"]+)"/)?.[1]}));

test('sniping article keeps all five sections and six conceptual traps readable before JavaScript', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/data-article-tabs/g) || []).length, 2);
  assert.equal((html.match(/data-tab-panel/g) || []).length, 11);
  for (const id of [...sectionIds, ...traps.map(trap => 'trap-' + trap.id)]) {
    const panel = html.match(new RegExp('<section\\b[^>]*id="' + id + '"[^>]*>'))?.[0];
    assert.ok(panel, 'Static section exists: ' + id);
    assert.ok(!/\bhidden\b/.test(panel), 'Section is readable without JavaScript: ' + id);
    assert.ok(links.some(link => link.href === '#' + id), 'Ordinary section link exists: ' + id);
  }
  assert.equal(new Set(ids).size, ids.length, 'All HTML, SVG, and generated tab IDs are unique');
  for (const link of links.filter(link => link.href?.startsWith('#'))) assert.ok(ids.includes(decodeURIComponent(link.href.slice(1))), 'Anchor resolves: ' + link.href);
  for (const labelledBy of html.matchAll(/aria-labelledby="([^"]+)"/g)) for (const id of labelledBy[1].split(/\s+/)) assert.ok(ids.includes(id), 'Accessible label resolves: ' + id);
  assert.ok(html.indexOf('aria-label="Essential river safety"') < html.indexOf('id="sniping-field-guide"'), 'Essential safety precedes the tabbed sections');
  assert.match(html, /AI-generated illustration[^<]*not a documented discovery/);
  assert.match(html, /© 2026 Paul Shoemaker \| Upperleft Design/);
  assert.match(html, /Created with assistance from ChatGPT/);
});

test('generated article preserves reusable trap content and versions its interaction assets', () => {
  assert.equal(traps.length, 6);
  for (const trap of traps) {
    assert.ok(html.includes(renderTrapDiagram(trap.id, {prefix:'sniping'})), 'Generated diagram matches source: ' + trap.id);
    for (const field of ['title', 'why', 'position', 'flow', 'failure', 'test']) assert.ok(html.includes(escape(trap[field])), 'Rendered explanation matches source: ' + trap.id + '.' + field);
  }
  for (const asset of ['tabbed-article.js', 'gold-sniping.css']) {
    const hash = createHash('sha256').update(read('dist/' + asset)).digest('hex').slice(0, 12);
    assert.ok(html.includes('/' + asset + '?v=' + hash), 'Article references the current asset: ' + asset);
  }
  const log = read('dist/downloads/gold-sniping-sample-log.csv');
  assert.match(log, /Layer,Sample volume,Water conditions,Recovery method/);
  assert.match(log, /including zero/);
});

test('source ledger preserves identities and separates caption-derived reports from footage verification', () => {
  assert.equal(evidence.videos.length, 2);
  assert.equal(evidence.science.length, 3);
  assert.match(html, /Zero underwater recovery observations were independently verified/);
  assert.match(html, /Gold Behavior Matrix[^<]*not found in this checkout/);
  assert.match(html, /No paid transcript service was used/);
  assert.match(html, /Automatic chapters are viewing aids/);
  assert.equal(evidence.videos.flatMap(video=>video.observations).length,3);
  for (const video of evidence.videos) {
    assert.ok(ids.includes('evidence-' + video.id));
    for (const field of ['creator', 'title', 'setting', 'position', 'result', 'confidence', 'verification']) assert.ok(html.includes(escape(video[field])), 'Video provenance retained: ' + video.id + '.' + field);
    assert.ok(links.some(link => link.href === escape(video.url)));
    for (const observation of video.observations) {
      assert.ok(Number.isInteger(observation.seconds) && observation.seconds >= 0);
      const url = new URL(video.url); url.searchParams.set('t', observation.seconds + 's');
      assert.ok(links.some(link => link.href === escape(url.href)), 'Timestamp is sourced from the evidence record');
      assert.match(observation.status, /review pending/);
      for(const seconds of observation.supportingSeconds || []) {
        const context = new URL(video.url); context.searchParams.set('t', seconds + 's');
        assert.ok(links.some(link => link.href === escape(context.href)), 'Reported negative results and prior disturbance have context links');
      }
    }
  }
  for (const source of [...evidence.science, ...evidence.safety]) assert.ok(links.some(link => link.href === escape(source.url)), 'Reference is linked: ' + source.id);
  assert.equal(ids.filter(id => id.startsWith('source-')).length, evidence.science.length);
  for (const link of links.filter(link => /^https?:/.test(link.href || ''))) {
    assert.ok(link.href.startsWith('https://'));
    assert.match(link.attrs, /target="_blank"/);
    assert.match(link.attrs, /rel="noopener noreferrer"/);
  }
});

test('tab renderer rejects duplicate or invalid anchors and escapes visible labels', () => {
  const sections = [{id:'first', label:'A & B', html:'<h2>First section</h2>'}];
  const rendered = renderTabbedArticle({id:'guide', label:'Example & guide', sections});
  assert.match(rendered, /href="#first"/);
  assert.match(rendered, /aria-label="Example &amp; guide"/);
  assert.match(rendered, />A &amp; B<\/a>/);
  assert.ok(!rendered.includes('role="tab"'), 'ARIA tab behavior only appears with JavaScript enhancement');
  assert.throws(() => renderTabbedArticle({id:'bad id', label:'Example', sections}));
  assert.throws(() => renderTabbedArticle({id:'guide', label:'Example', sections:[...sections, ...sections]}));
  assert.throws(() => renderTabbedArticle({id:'guide', label:'Example', sections:[{...sections[0], id:'bad#anchor'}]}));
  assert.throws(() => renderTabbedArticle({id:'guide', label:'Example', sections:[{...sections[0], id:'guide'}]}), 'Wrapper and section cannot share an ID');
  assert.throws(() => renderTabbedArticle({id:'guide', label:'Example', sections:[...sections, {...sections[0], id:'guide-tab-first'}]}), 'A section cannot collide with a generated tab ID');
  assert.throws(() => renderTabbedArticle({id:'guide', label:'Example', sections:[]}), 'An empty guide is not a tabbed article');
  assert.throws(() => renderTrapDiagram('invented-deposit'));
});

test('anonymous HTTP route serves article, assets, and sample log through the existing server', async t => {
  const server = createServer({root:fileURLToPath(new URL('../dist/', import.meta.url)), guests:null, goldPrice:async () => ({}), log:() => {}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const response = await fetch(base + route);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const body = await response.text();
  assert.match(body, /id="sniping-field-guide"/);
  assert.match(body, /data-reading-options/);
  for (const path of ['/tabbed-article.js', '/gold-sniping.css', '/assets/articles/gold-sniping/hero-800.webp', '/downloads/gold-sniping-sample-log.csv']) {
    const asset = await fetch(base + path);
    assert.equal(asset.status, 200, 'Existing server serves ' + path);
    assert.ok((await asset.arrayBuffer()).byteLength > 0);
  }
  const entry = publishedArticles().find(article => article.id === 'article:gold-sniping');
  assert.equal(entry?.url, route);
  const listing = read('dist/articles/index.html');
  assert.ok(listing.includes('href="' + route + '"'));
  assert.ok(listing.includes('id="article-count" role="status">' + publishedArticles().length + ' articles'));
});

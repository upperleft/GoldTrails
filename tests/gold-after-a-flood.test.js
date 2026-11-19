import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from '../app/server.js';
import {publishedArticles, createCompassContent} from '../app/compass/content.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const route = '/articles/gold-after-a-flood/';
const evidence = JSON.parse(read('app/articles/gold-after-a-flood-evidence.json'));
const html = read('dist' + route + 'index.html');
const listing = read('dist/articles/index.html');

test('flood article is discoverable once through listing, published registry, and existing recommendations', async () => {
  const catalog = publishedArticles();
  const entries = catalog.filter(item => item.url === route);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'article:gold-after-a-flood');
  assert.equal(entries[0].title, evidence.title);
  assert.ok(entries[0].tags.includes('river'));
  assert.ok(entries[0].tags.includes('locations'));
  assert.ok(entries[0].goals.includes('learn'));
  assert.equal((listing.match(/href="\/articles\/gold-after-a-flood\/"/g) || []).length, 1);
  assert.equal((listing.match(/<li data-date=/g) || []).length, catalog.length);
  assert.ok(listing.includes('id="article-count" role="status">' + catalog.length + ' articles'));
  const content = await createCompassContent({directory:null, store:null})();
  assert.deepEqual(content.records.filter(item => item.id === entries[0].id), entries);
});

test('flood article retains one canonical identity and source-linked evidence with explicit limits', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.includes('<link rel="canonical" href="https://goldtrails.org' + route + '">'));
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema.headline, evidence.title);
  assert.equal(schema.datePublished, evidence.publishedAt);
  assert.equal(schema.dateModified, evidence.checkedAt);
  assert.equal(schema.mainEntityOfPage, 'https://goldtrails.org' + route);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), 'Anchor exists: ' + match[1]);
  assert.equal(new Set(evidence.sources.map(source => source.id)).size, evidence.sources.length);
  for (const source of evidence.sources) {
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.ok(source.verification && source.limits && source.locator);
    assert.ok(html.includes('href="#source-' + source.id + '"'), 'Inline citation exists: ' + source.id);
    const ref = html.match(new RegExp('<li id="source-' + source.id + '">([\\s\\S]*?)<\\/li>'))?.[1];
    assert.ok(ref?.includes('href="' + source.url + '"'), 'Reference links to its actual source: ' + source.id);
    assert.match(ref, /target="_blank" rel="noopener noreferrer"/);
  }
});

test('anonymous visitors can load flood article through existing reading shell and entry page', async t => {
  const server = createServer({root:fileURLToPath(new URL('../dist/', import.meta.url)), guests:null, goldPrice:async()=>({}), log:()=>{}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const path of [route, '/articles/']) {
    const response = await fetch(base + path, {redirect:'manual'});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const body = await response.text();
    assert.ok(body.includes(evidence.title));
    assert.equal((body.match(/data-reading-options hidden/g) || []).length, 1);
  }
});

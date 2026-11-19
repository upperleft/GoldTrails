import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {escape as e} from '../app/articles/tabbed-article.js';

const evidence = JSON.parse(await readFile('app/articles/gold-after-a-flood-evidence.json', 'utf8'));
const {title, route, summary} = evidence;
const cite = id => {
  const index = evidence.sources.findIndex(source => source.id === id);
  if (index < 0) throw new Error('Unknown flood article source: ' + id);
  return ` <a class="source-cite" href="#source-${id}" aria-label="Source ${index + 1}: ${e(evidence.sources[index].title)}">[${index + 1}]</a>`;
};
const external = (url, label) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`;
const references = `<ol class="reference-list">${evidence.sources.map(item => `<li id="source-${item.id}">${external(item.url, item.title)} — ${e(item.creator)}.<small>${e(item.kind)}. ${e(item.locator)}. ${e(item.limits)}</small></li>`).join('')}</ol>`;
const content = (await readFile('app/articles/gold-after-a-flood-content.html', 'utf8'))
  .replace(/\{\{cite:([\w-]+)\}\}/g, (_, id) => cite(id))
  .replace('{{references}}', references);
if (content.includes('{{')) throw new Error('Unresolved flood article placeholder');

let template = await readFile('dist/articles/classification-basics/index.html', 'utf8');
if (!template.includes('<article class="reading"') || !template.includes('</article>')) throw new Error('Reading-page template changed; review the article shell.');
let html = template.replace(/<article class="reading"[\s\S]*?<\/article>/, `<article class="reading tuning-article" aria-labelledby="article-title">${content}</article>`)
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${e(title)} — Gold Trails</title>`)
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${e(summary)}">`)
  .replace(/<script>document\.querySelectorAll\('\.source-marker'\)[\s\S]*?<\/script>/, '');
const version = createHash('sha256').update(await readFile('dist/sluice-tuning.css')).digest('hex').slice(0, 12);
const schema = {'@context':'https://schema.org','@type':'Article',headline:title,description:summary,
  datePublished:evidence.publishedAt,dateModified:evidence.checkedAt,creativeWorkStatus:'Published',
  author:{'@type':'Person',name:'Paul Shoemaker'},publisher:{'@type':'Organization',name:'Gold Trails'},
  mainEntityOfPage:'https://goldtrails.org'+route};
html = html.replace('</head>', `<link rel="stylesheet" href="/sluice-tuning.css?v=${version}"><link rel="canonical" href="https://goldtrails.org${route}"><meta property="og:type" content="article"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(summary)}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head>`);
await mkdir('dist' + route, {recursive:true});
await writeFile('dist' + route + 'index.html', html);

const indexPath = 'dist/articles/index.html';
let index = await readFile(indexPath, 'utf8');
const item = `<li data-date="${e(evidence.publishedAt)}" data-title="${e(title)}"><h2><a href="${e(route)}">${e(title)}</a></h2><p>${e(summary)}</p><p class="article-meta"><span class="article-category">RIVERS · FLOODS · FIELD SAMPLING</span><span class="article-byline">By Paul Shoemaker · November 19, 2026</span></p></li>`;
const existing = new RegExp('<li[^>]*><h2><a href="' + route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '">[\\s\\S]*?<\\/li>');
if (existing.test(index)) index = index.replace(existing, item);
else {
  if (!index.includes('<ul class="article-list" id="article-list">')) throw new Error('Article index structure changed');
  index = index.replace('<ul class="article-list" id="article-list">', '<ul class="article-list" id="article-list">' + item);
}
const list = index.match(/<ul class="article-list" id="article-list">([\s\S]*?)<\/ul>/)?.[1];
if (!list) throw new Error('Article list not found');
const count = (list.match(/<li\b/g) || []).length;
index = index.replace(/(<p id="article-count" role="status">)[^<]*/, '$1' + count + ' articles');
await writeFile(indexPath, index);
console.log(`Flood article built: ${evidence.sources.length} sources; ${count} articles in index.`);

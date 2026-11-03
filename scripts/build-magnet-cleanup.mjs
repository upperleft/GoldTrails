import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {escape as e} from '../app/articles/tabbed-article.js';

const evidence = JSON.parse(await readFile('app/articles/magnet-cleanup-evidence.json', 'utf8'));
const {title, route, sources} = evidence;
const publicationDate = evidence.publishedAt || evidence.checkedAt;
const publicationLabel = new Intl.DateTimeFormat('en-US', {dateStyle:'long', timeZone:'UTC'}).format(new Date(publicationDate));
const allSources = [...sources, ...(evidence.contextSources || [])];
const summary = 'Compare six creators on wet and dry magnetic black-sand cleanup, see where the advice differs, and learn what the selected evidence can establish.';
const external = (url, label) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`;
const cite = id => {
  const index = allSources.findIndex(source => source.id === id);
  if (index < 0) throw new Error('Unknown magnet-cleanup source: ' + id);
  return ` <a class="source-cite" href="#source-${id}" aria-label="Source ${index + 1}: ${e(allSources[index].creator)}">[${index + 1}]</a>`;
};
const source = id => sources.find(item => item.id === id);
const moments = id => `<p class="article-meta">${source(id).moments.map(moment => external(source(id).url + '&t=' + moment.seconds + 's', moment.label)).join(' · ')}</p>`;
const sections = [
  ['one-question', 'One question, three moisture conditions'],
  ['creator-comparison', 'The six-creator comparison'],
  ['creator-accounts', 'How the six sources differ'],
  ['predominant-method', 'Which approach is most represented?'],
  ['fair-comparison', 'Make your own comparison useful'],
  ['sources', 'Sources and research limits']
];

const content = `<span class="eyebrow">CREATOR COMPARISON · FINE-GOLD CLEANUP</span>
<h1 id="article-title">${e(title)}</h1>
<p class="article-deck">Should you remove magnetic black sand while the concentrate is dry, or lift it through water? Six creator sources give a useful disagreement to examine—and a reason to look closely at what “wet” means.</p>
<p class="article-meta">By Paul Shoemaker · Research and writing with assistance from ChatGPT · Published <time datetime="${publicationDate}">${publicationLabel}</time></p>
<p>A magnet can make a dark concentrate easier to work with. The disputed step is how to use it without taking gold away with the magnetic material. That is a smaller and more useful question than asking which creator has the best complete cleanup system.</p>
<p>We selected six creators with accessible written instructions or newly reviewed automatic captions. Each counts once. Their advice includes wet pickup, dry-only instructions, a choice between dry and submerged material, and an experiment with magnets beneath a pan. Those are related approaches, but not identical tests.</p>
<aside class="takeaways" aria-label="What this comparison found"><h2>Four sources describe or allow using water.</h2><p>The six accounts include three wet methods, Hurd’s choice of dry or submerged material, a dry-only tool instruction, and a dry-pan experiment. <strong>This is a count of this selected evidence, not a poll or proof that wet cleanup recovers more gold.</strong></p></aside>
<nav class="article-contents" aria-label="In this article"><h2>In this article</h2>${sections.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav>

<section id="one-question"><h2>One question, three moisture conditions</h2>
<p>Our question is precise: <strong>when removing the magnetic fraction from a fine-gold concentrate, should the material be dry or under water?</strong> The magnetic fraction means what the magnet removes, not everything that looks black. The other fraction still needs examination; a magnet does not certify that it is clean gold.</p>
<p>Keep three conditions separate in your notes: loose dry material, damp material without a covering water layer, and material submerged beneath water. Dan Hurd’s caption-supported explanation specifically distinguishes dry or fully underwater handling from the awkward damp state. Calling all three “wet versus dry” conceals that distinction.${cite('hurd')}</p>
<p>Also distinguish a magnet held above a layer from one pushed into it, and both from magnets beneath the pan. Those placements change the job being attempted. We can compare the explanations without pretending that every creator used the same tool on the same gravel.</p></section>

<section id="creator-comparison"><h2>The six-creator comparison</h2>
<div class="table-scroll" role="region" aria-label="Six creators and their magnetic cleanup approaches" tabindex="0"><table class="material-table"><caption>One creator per row; categories describe the reviewed source</caption><thead><tr><th scope="col">Creator</th><th scope="col">Approach in this source</th><th scope="col">Important distinction</th></tr></thead><tbody>${sources.map(item => `<tr><th scope="row"><a href="#creator-${item.id}">${e(item.creator)}</a></th><td>${e(item.tableMethod)}</td><td>${e(item.tableDetail)}</td></tr>`).join('')}</tbody></table></div>
<p>The table is a reading aid. It does not assign a recovery score, turn a commercial instruction into independent test evidence, or count several videos from one creator as several supporters.</p></section>

<section id="creator-accounts"><h2>How the six sources differ</h2>
<div id="creator-ralph"><h3>Chris Ralph: lift through water before disturbing the bed</h3><p>Ralph describes a thin submerged layer and a magnet held above it, initially without touching or stirring. He later works closer to the remaining material and calls for inspecting what the magnet removed because gold can accompany it. The useful point is controlled pickup followed by a check, rather than an assumption that the lifted fraction contains no gold.${cite('ralph')}</p></div>
<div id="creator-mccracken"><h3>Dave McCracken: wash the magnetic fraction again</h3><p>McCracken explains that gold can become caught among magnetic grains. His response is to drop the removed sand into a second plastic pan, swish it in water, and use the magnet again, repeating according to the gold left behind. His account adds a reject-checking step to wet magnetic cleanup.${cite('mccracken')}</p></div>
<div id="creator-singel"><h3>Kevin Singel: wet separation, then a separate reject check</h3><p>Singel’s article draws classified magnetic sands up through water. An authored April 6, 2016 comment expands the technique and says he later dries the removed magnetic material to check it again. That final dry check should not be misread as an instruction to begin with dry feed. The wet step and later inspection have different jobs.${cite('singel')}</p></div>
<div id="creator-hurd"><h3>Dan Hurd: dry or submerged, with a warning about carryover</h3><p>The newly reviewed automatic captions from his 2018 demonstration describe thoroughly dry or fully submerged material, then through-water pickup. Later he reports gold carried with the magnetic material and describes re-washing. This supports a conditional method, not a categorical ban on water. It is a creator’s caption-supported account, not our measurement of the loss.${cite('hurd')}</p>${moments('hurd')}</div>
<div id="creator-klesh"><h3>Klesh: a dry-only instruction that directly differs</h3><p>Klesh’s current commercial tool page says <q>only use with dry material</q> and warns broadly that wet use traps gold. It is genuine advice to record, rather than soften into agreement. The wording extends beyond merely describing his particular tool. The page does not supply a matched recovery trial that resolves the difference with the wet methods above.${cite('klesh')}</p></div>
<div id="creator-au77"><h3>Au77: dry material in an under-pan experiment</h3><p>In the newly reviewed automatic captions, Au77 reports that the dry arrangement worked and wet material was harder to handle. The magnets are beneath the pan, rather than lifting sand out from above. That makes this a useful alternate experiment, but a poor substitute for a directly comparable handheld-magnet test. No controlled recovery advantage is established.${cite('au77')}</p>${moments('au77')}</div></section>

<section id="predominant-method"><h2>Which approach is most represented?</h2>
<p><strong>Wet lifting and re-washing form the most represented route in this selected group.</strong> Three creators describe wet methods; Hurd allows both dry and submerged handling. Together, that makes four accounts that describe or allow water out of six. It does not mean four exclusively prefer wet cleanup.</p>
<p>A narrower comparison is fairer for someone holding a cleanup magnet: Ralph, McCracken, Singel, and Hurd provide handheld guidance that permits using water, while Klesh’s tool instructions specify dry use. Au77’s different magnet placement is excluded from that five-creator handheld comparison. Keeping that denominator visible is more informative than calling either method the prospectors’ consensus.</p>
<p>There is still a real difference in advice. Klesh’s broad warning conflicts with the other sources’ willingness to use water. The reviewed evidence does not isolate moisture from magnet strength, pickup distance, layer thickness, particle sizes, or repeated washing. Any of those could help explain different experiences. We have not reviewed a controlled trial using the same feed and otherwise matched conditions.</p>
<p>EPA’s overview also describes magnets beneath a pan containing dried concentrate and cautions against losing gold. That recognizes a dry technique; it does not compare its recovery with wet pickup. This government context is separate from the six creator accounts.${cite('epa')}</p>
<p>Likewise, choosing a dry separator in another demonstration does not by itself retract a creator’s earlier wet method. Equipment choices, a reported result, and a universal recommendation are different claims. Keep each attached to its actual source.</p></section>

<section id="fair-comparison"><h2>Make your own comparison useful</h2>
<p>Gold Trails’ suggestion is a small, contained comparison using known, uncontaminated material, with the outputs retained. It is an editorial field exercise, not a standardized recovery test. Follow the instructions for your particular tool; a source comparison is not a reason to ignore its operating or strong-magnet precautions.</p>
<ol class="test-steps">
<li><strong>Describe the feed.</strong> Record the source, classification, approximate gold sizes, and moisture condition. Avoid comparing a dry coarse concentrate with a damp fine one and crediting the entire difference to the magnet.</li>
<li><strong>Prepare comparable portions.</strong> Mix a manageable batch and divide it with repeated small alternating scoops. Natural gold remains unevenly distributed, so use repeats rather than trusting equal starting volumes.</li>
<li><strong>Record the actual arrangement.</strong> Note the tool, placement, pickup distance, layer thickness, water coverage where applicable, and number of passes. Keep those details with the result.</li>
<li><strong>Keep both fractions.</strong> Label the magnetic pickup and the material left behind, along with washings and spills. Do not label either fraction waste before checking it.</li>
<li><strong>Check with another recovery step.</strong> Carefully pan or otherwise examine retained material using a method suitable for the gold size, keeping the checking rejects too. Record what that check may have missed.</li>
<li><strong>Compare accounted losses.</strong> When reliable masses are available, compare the fraction of accounted gold lost, not only raw gold amounts in the magnetic fraction. Repeat promising comparisons and retain unresolved material.</li>
</ol>
<p>A few visible flakes in the removed material establish carryover in that test. They do not establish its percentage. A blank check pan does not prove zero loss, either. For the broader sampling habits, read <a href="/articles/compare-test-pans/">How to Compare Test Pans Without Fooling Yourself</a>.</p>
<p>This question belongs to finishing a concentrate. <a href="/articles/black-sands/">Black Sands in Your Pan</a> explains why dark material is not a gold count. Our <a href="/articles/sluice-flow-and-angle/">sluice-tuning</a> and <a href="/articles/drywashing-for-gold/">drywashing</a> guides concern earlier recovery stages; their water or air settings do not decide this magnet step.</p></section>

<section id="sources"><h2>Sources and research limits</h2><p>Primary written pages and newly retrieved automatic captions were checked November 3, 2026. Video summaries are caption-supported reports; their audio, footage, gold identity, and recovery results were not independently verified. Captions can contain errors. Sources were selected for accessible, relevant explanations, not randomly sampled. No creator was contacted, no equipment test was performed, and no claim about all creators follows from this six-person comparison.</p><ol class="reference-list">${allSources.map(item => `<li id="source-${item.id}">${external(item.url, item.title)} — ${e(item.creator)}.<small>${e(item.kind)}. ${e(item.locator)}. ${e(item.limits)}</small></li>`).join('')}</ol></section>
<p class="article-endnote">The practical pattern is controlled separation followed by checking what was removed. Wet handling is well represented here; the best recovery method for your material still needs evidence from your own accounted test.</p>`;

let template = await readFile('dist/articles/classification-basics/index.html', 'utf8');
if (!template.includes('<article class="reading"') || !template.includes('</article>')) throw new Error('Reading-page template changed; review the article shell.');
let html = template.replace(/<article class="reading"[\s\S]*?<\/article>/, `<article class="reading tuning-article" aria-labelledby="article-title">${content}</article>`)
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${e(title)} — Gold Trails</title>`)
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${e(summary)}">`)
  .replace(/<script>document\.querySelectorAll\('\.source-marker'\)[\s\S]*?<\/script>/, '');
const version = createHash('sha256').update(await readFile('dist/sluice-tuning.css')).digest('hex').slice(0, 12);
const schema = {'@context':'https://schema.org','@type':'Article',headline:title,description:summary,datePublished:publicationDate,dateModified:evidence.checkedAt,creativeWorkStatus:'Published',author:{'@type':'Person',name:'Paul Shoemaker'},publisher:{'@type':'Organization',name:'Gold Trails'},mainEntityOfPage:'https://goldtrails.org'+route};
html = html.replace('</head>', `<link rel="stylesheet" href="/sluice-tuning.css?v=${version}"><link rel="canonical" href="https://goldtrails.org${route}"><meta property="og:type" content="article"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(summary)}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head>`);
await mkdir('dist' + route, {recursive:true});
await writeFile('dist' + route + 'index.html', html);
console.log('Magnet-cleanup article built: 6 creators, 7 primary sources, one focused comparison.');

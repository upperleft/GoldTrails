import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {escape as e} from '../app/articles/tabbed-article.js';

const evidence = JSON.parse(await readFile('app/articles/sluice-tuning-evidence.json', 'utf8'));
const {title, route} = evidence;
const publicationDate = evidence.publishedAt || evidence.checkedAt;
const publicationLabel = new Intl.DateTimeFormat('en-US', {dateStyle:'long', timeZone:'UTC'}).format(new Date(publicationDate));
const summary = 'Measure sluice slope and water delivery, prepare difficult gravel, and compare tailings tests to tune a stream sluice or highbanker.';
const cite = id => {
  const index = evidence.sources.findIndex(source => source.id === id);
  if (index < 0) throw new Error('Unknown sluice source: ' + id);
  return ` <a class="source-cite" href="#source-${id}" aria-label="Source ${index + 1}: ${e(evidence.sources[index].title)}">[${index + 1}]</a>`;
};
const external = (url, label) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`;
const table = (caption, headings, rows, className = '') => `<div class="table-scroll" role="region" aria-label="${e(caption)}" tabindex="0"><table class="${className}"><caption>${caption}</caption><thead><tr>${headings.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${row[0]}</th>${row.slice(1).map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const sections = [
  ['what-to-adjust', 'What flow, speed, and slope each mean'],
  ['measure-angle', 'Measure the recovery-box angle'],
  ['measure-water', 'Measure water delivery and observe the bed'],
  ['read-the-feed', 'Change the preparation when the gravel changes'],
  ['tailings-test', 'Run a useful recovery comparison'],
  ['troubleshooting', 'Diagnose losses before moving the legs'],
  ['sources', 'Sources and scope']
];

const content = `<span class="eyebrow">SLUICING · EQUIPMENT · FIELD TESTING</span>
<h1 id="article-title">${e(title)}</h1>
<p class="article-deck">The useful setting is the one that separates your gold from your gravel. Here is how to measure the setup, recognize a loading problem, and test the material leaving the box.</p>
<p class="article-meta">By Paul Shoemaker · Research and writing with assistance from ChatGPT · Published <time datetime="${publicationDate}">${publicationLabel}</time></p>
<p>A sluice can look busy and still lose gold. It can also look reassuringly slow while its capture spaces fill with sand. The job is to keep lighter material moving while gold reaches a place where it can be retained. Too little transport, too much scour, and too much feed can all upset that balance.${cite('silva')}${cite('hog-tuning')}</p>
<p>A stream sluice uses the current available at its intake. A highbanker supplies water through a pump and usually washes gravel in a hopper before it reaches the recovery box. Both need tuning under load. The pump gives you another control; it does not remove the importance of the gravel, gold size, or mat design.</p>
<p>Working away from water? An air-powered <strong>drywasher</strong> uses a different process and needs dry, prepared feed. Our companion guide, <a href="/articles/drywashing-for-gold/">Drywashing for Gold</a>, explains the method and compares examples of bellows and blower-driven machines.</p>
<aside class="takeaways" aria-label="The field principle"><h2>Start with the maker. Finish with a test.</h2><p>Use the instructions for your exact sluice, mat, and pump as the starting point. Level the box across its width, establish steady water and feed, then compare labeled test batches. <strong>Change one control at a time and check the rejects.</strong> An angle reading is a setup record; a tailings check supplies evidence about losses.</p></aside>
<nav class="article-contents" aria-label="In this article"><h2>In this article</h2>${sections.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav>

<section id="what-to-adjust"><h2>What flow, speed, and slope each mean</h2>
${table('Five observations worth keeping separate', ['Control or measurement', 'What to record'], [
  ['Slope', 'Degrees from horizontal, or vertical drop divided by horizontal run. Record the recovery floor, not the hopper.'],
  ['Water delivery (discharge)', 'Volume per time: litres per minute, US gallons per minute, or US gallons per hour. Specify which gallon.'],
  ['Water speed (velocity)', 'Distance per time at a stated position. Surface speed and speed near the capture bed differ.'],
  ['Depth', 'Water depth at a marked location, with the same reference point each time. Riffle tops and the box floor are different references.'],
  ['Solids feed rate', 'Prepared gravel volume or mass per minute, including the screen opening and whether the measurement was wet or dry.']
])}
<p>Discharge is volume passing a section per unit time; velocity is its speed. In a simple channel, discharge equals wetted cross-sectional area multiplied by mean velocity. A riffled box has a changing bed, recirculating pockets, and uneven depths, so one surface timing cannot describe every capture zone.${cite('epa')}</p>
<p>Research by Poling and Hamilton found that slope and water could be adjusted together to maintain similar scour in their test sluice. Different riffles needed different scour conditions. That is evidence for tuning a system, rather than choosing an angle in isolation; it is not a setting chart for a modern hobby mat.${cite('poling')}</p></section>

<section id="measure-angle"><h2>Measure the recovery-box angle</h2>
<p>Put a straightedge along the recovery floor and use a level or calibrated inclinometer against it. Keep the phone dry and check its zero on a known level surface first. Measure crosswise as well: a low side can carry a disproportionate share of the slurry. On a highbanker, record the main recovery box and any adjustable extension separately.</p>
<figure class="slope-figure"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 255" role="img" aria-labelledby="slope-title slope-desc"><title id="slope-title">Measuring sluice slope using vertical drop and horizontal run</title><desc id="slope-desc">Side view of a recovery floor dropping four inches over a horizontal distance of four feet. This is a slope of one inch per foot, approximately 4.8 degrees. The length along the sloping floor is not the horizontal run.</desc><defs><marker id="slope-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#385b5d"/></marker></defs><path d="M90 95H670V143.33" fill="none" stroke="#93846b" stroke-width="2" stroke-dasharray="6 6"/><path d="M90 95L670 143.33" stroke="#8b5d2b" stroke-width="9"/><path d="M90 108V210M670 156V210" stroke="#93846b" stroke-width="1.5"/><path d="M98 200H662" stroke="#385b5d" stroke-width="2" marker-start="url(#slope-arrow)" marker-end="url(#slope-arrow)"/><path d="M695 100V138" stroke="#385b5d" stroke-width="2" marker-start="url(#slope-arrow)" marker-end="url(#slope-arrow)"/><path d="M654 69L695 88" stroke="#385b5d" fill="none"/><g fill="#352f25" font-family="sans-serif" font-size="19"><text x="90" y="64">High end</text><text x="550" y="178">Low end</text><text x="548" y="58">4 in drop</text><text x="267" y="233">4 ft horizontal run</text><text x="215" y="151">Recovery floor · about 4.8°</text></g></svg><figcaption>A side view of 1 inch of vertical drop per horizontal foot. Measure the horizontal run, or use an inclinometer directly on the recovery floor.</figcaption></figure>
<p><strong>One inch per foot is approximately 4.8°, not 10°.</strong> For vertical drop and horizontal run in the same units, <code>angle = arctan(drop ÷ run)</code>. These are geometric conversions, not recommended operating settings.</p>
${table('Drop and angle: conversions only', ['Vertical drop per horizontal foot', 'Angle from horizontal', 'Drop over 4 horizontal feet'], [0.5,1,1.5,2].map(drop => [drop + ' in', (Math.atan(drop / 12) * 180 / Math.PI).toFixed(2) + '°', (drop * 4) + ' in']), 'angle-table')}
<p>If the length was measured along the sloping floor instead, the exact relationship uses <code>arcsin(drop ÷ floor length)</code>. Write down which measurement you used. Ten degrees is about 2.12 inches of drop per horizontal foot.</p>
${table('Why an equipment-specific starting point matters', ['Equipment guidance', 'What the manufacturer actually specifies'], [
  ['Keene High Banker Sluice Conversion Kit', 'Start at approximately 10°, establish water flow, then readjust to prevent gravel buildup without excessive slope.' + cite('keene')],
  ['Dream Mat family FAQ', 'A 7–12° range depending on water and material, with attention to cell exchange. Consult the instructions for the particular mat and installation.' + cite('dream')]
])}
<p>These examples describe different recovery systems. Do not average them, or transfer either to a box with different riffles. For an unidentified or modified setup, identify its recovery surface and obtain the maker’s guidance before selecting a baseline.</p></section>

<section id="measure-water"><h2>Measure water delivery and observe the bed</h2>
<h3>At a highbanker: record what arrives</h3>
<p>The pump label is not a measurement at the sluice. Lift and hose resistance affect delivery; the same throttle position can produce a different result after moving the machine uphill or changing the hose.${cite('hog-pumps')}</p>
<p>For a small, manageable outlet that can safely be directed into a container, time a known volume while preserving the operating hose arrangement and outlet height as closely as possible. Repeat the measurement. <code>Litres per minute = litres collected × 60 ÷ seconds.</code> A hypothetical 10 litres in 12 seconds is 50 L/min, about 13.2 US gal/min. <strong>This is an arithmetic example, not a flow recommendation.</strong></p>
<p>Diverting water can change resistance and the division between hopper sprays and recovery water. Label a bucket result an estimate unless it represents the installed circuit. For larger or pressurized systems, use a suitable rated flow meter or the pump curve and operating head; follow the pump instructions. If delivery cannot be measured reliably, record the hose, lift, valve or throttle setting and observed depth instead of inventing a GPH figure.</p>
<h3>At a stream sluice: record repeatable conditions</h3>
<p>Note intake depth, box position, side-to-side level, outlet condition, and depth at marked positions. A slow-motion video of the same marked section can help compare runs. Timing naturally occurring foam across a known distance gives a surface travel speed, not the speed of a gold grain. EPA’s stream-float method also distinguishes surface from average motion; its stream correction factors should not be transplanted to a riffled box.${cite('epa')}</p>
<p>Check for leaks under the mat, obstructions, uneven entry, and a tailings pile or submerged outlet that changes the intended discharge. Some designs deliberately use submerged vents: Snake River Products, for example, specifies clear intake and exhaust passages for its fluidizing system. Follow that design’s instructions rather than a rule borrowed from an open riffled sluice.${cite('snake')}</p>
<h3>Watch while you feed</h3>
<p>Establish water first, then introduce prepared material steadily across the intended feed area. Compare the loaded bed with the maker’s examples. Dream Mat’s FAQ describes material exchanging within cells, rather than a box filling solid or cells being swept clear. That visual advice belongs to its cell system; other riffles can have different working patterns.${cite('dream')}</p>
<p>Appearance tells you where to investigate. It cannot establish a capture percentage. A full bed may be overloaded; a nearly bare bed may be scouring too hard, or may simply be receiving little feed. Check both the loading and the tailings before deciding.</p></section>

<section id="read-the-feed"><h2>Change the preparation when the gravel changes</h2>
<p>The important question is not just “How much gravel?” It is also “What is in it, and is the gold free to separate?” California’s recovery guide emphasizes that gold characteristics and the deposit affect equipment performance. The following are Gold Trails’ suggested comparisons, not fixed recipes.${cite('silva')}</p>
${table('Match the first test to the feed', ['Material or condition', 'What to investigate', 'A useful first comparison'], [
  ['Coarse, mixed gravel', 'Large stones can interrupt a small recovery bed; gold can remain on unwashed oversize.', 'Wash and classify to the equipment’s specified opening. Inspect the retained fraction; compare measured passing feed at a steady rate.'],
  ['Clay-bound gravel or soil', 'Gold may remain inside coherent lumps instead of becoming available to the mat.', 'Soak and scrub a contained batch before feeding. Retain washings and check the washed oversize and remaining lumps separately. Do not rely on more slope to break up intact clay balls.'],
  ['Black-sand-rich gravel', 'A high heavy-mineral load may occupy capture spaces; fine or flat gold adds another separation challenge.', 'Compare a lower solids feed rate at the same water and angle. Inspect loading during the run and compare shorter, recorded cleanup intervals.'],
  ['Fine sand, silt, or recirculated water', 'Heavy suspended-solids loading can change the slurry and make observation difficult.', 'Keep feed preparation consistent; compare lower feed or refreshed/settled water under otherwise similar conditions. Record water condition rather than treating color as a viscosity reading.'],
  ['Fine, flat gold mixed with coarse gold', 'Gold particles of different shape and size need not behave alike.', 'Record the size and shape of gold in both concentrate and tailings. Judge a fine-gold setting by the fine fraction, not only the visible larger pieces.']
], 'material-table')}
<p>Gold Hog’s slurry discussion suggests reducing solids relative to water when loading becomes troublesome. Dream Mat separately calls for processing clay to release the gold. Those are preparation and loading questions before they are angle questions.${cite('hog-slurry')}${cite('dream')}</p>
<aside class="field-note"><p><strong>Muddy does not automatically mean ineffective.</strong> Poling and Hamilton reported good recovery under some tested muddy-water conditions. Suspended fines, gold trapped in clay lumps, and a bed that packs over a long run are different problems. Their short trials do not settle every recirculating-water or long-run loading question.${cite('poling')}</p></aside>
<p>Choose the classifier opening for the equipment and the gold you might encounter. Keep the oversize identifiable and check it before discarding it. See <a href="/articles/classification-basics/">Classification: What Your Screen Separates</a> and <a href="/articles/black-sands/">Black Sands in Your Pan</a> for those separate tasks.</p></section>

<section id="tailings-test"><h2>Run a useful recovery comparison</h2>
<p>Yukon field research stresses representative tailings sampling and the “nugget effect”: a few gold particles can dominate a small result. A convenient pan from the pile below the sluice is not a representative sample of everything that left it.${cite('yukon-losses')}</p>
<p>The following is a practical small-batch comparison suggested by Gold Trails. It can reveal a repeatable problem; it is not a laboratory recovery certification.</p>
<ol class="test-steps">
<li><strong>Prepare comparable feed.</strong> Mix a manageable batch thoroughly and divide it into similar portions using repeated small alternating scoops. Record its source, screen opening, moisture convention, clay preparation, and amount. Natural gold remains unevenly distributed even after careful mixing.</li>
<li><strong>Write down baseline A.</strong> Record the exact box and mat, angle, crosswise level, water measurement or proxy, depth reference, feed rate, water condition, and starting bed condition. Begin each short comparison with the same cleanup and wetting procedure.</li>
<li><strong>Retain the discharge.</strong> For a small controlled trial, collect all discharged material, including fine solids in the water, in a suitable contained arrangement. Do not let the receiver back water up into the sluice. Larger operations require a planned representative sampling method; they cannot be replaced by one scoop from settled tailings.</li>
<li><strong>Keep each output separate.</strong> Label concentrate A, tailings A, hopper/oversize rejects, and any spills. Carefully pan or reprocess the tailings with a method suitable for the finest gold you are evaluating. Retain those rejects for a further check; the checking method can also lose gold.</li>
<li><strong>Change one control for B.</strong> For example, reduce solids feed while holding slope and water steady. In a separate comparison, test a small slope or water adjustment within the equipment’s operating guidance. Record what else changed: on a stream sluice, moving an end can also change intake and outlet conditions.</li>
<li><strong>Repeat A, then repeat the useful comparison.</strong> An A–B–A sequence helps expose changing water or feed. A promising B result deserves repeated batches. After finding a better short-run setting, test it over a longer representative load because a fresh mat does not reproduce an increasingly loaded bed.</li>
</ol>
<p><a class="gold-button" href="/downloads/sluice-tuning-test-log.csv" download>Download the sluice tuning test log (CSV)</a></p>
<h3>What would a recovery percentage require?</h3>
<p>For a fully accounted test, <code>recovery (%) = 100 × gold mass retained ÷ (gold mass retained + gold mass lost)</code>. The lost amount must include all relevant reject streams, not just visible flakes in one pan. If a test hypothetically retained 0.90 g and accounted for 0.10 g in all rejects, its measured recovery would be 90%. These are illustrative numbers, not a Gold Trails result.${cite('yukon-losses')}</p>
<p>Compare the fraction of accounted gold lost, not just the raw amount in each batch’s tailings: natural test portions may contain different total gold. A scale unable to resolve the fine-gold mass cannot support a precise percentage. Unrecovered gold in the check-pan rejects makes the apparent recovery too optimistic. Particle counts can help track a deliberately prepared, contained test using known gold sizes, but a count of mixed natural flakes is not a mass recovery: one large piece can outweigh many tiny ones.</p>
<p>“No visible gold in this checked sample” is a useful entry. It is not proof of 100% recovery. Likewise, a few specks in the tailings establish a loss, but do not by themselves tell you whether the box was too fast, too slow, overloaded, or receiving unwashed clay.</p></section>

<section id="troubleshooting"><h2>Diagnose losses before moving the legs</h2>
${table('Observation → question → comparison', ['What you observe', 'What to check first', 'Then test'], [
  ['Gravel blankets the recovery bed', 'Overfeeding, insufficient transport, side tilt, a blocked outlet, or capture spaces already loaded.', 'Reduce feed at unchanged water and slope. If accumulation persists, compare a modest water or slope adjustment within maker guidance.'],
  ['Cells or pockets scour clear under normal feed', 'Whether that appearance is abnormal for this mat; excessive local jets, uneven entry, or an aggressive setting.', 'Correct entry problems, then compare a modest water or slope reduction. Preserve enough transport to avoid packing.'],
  ['Gold turns up in the tailings', 'Feed preparation, mat seating, loading, water changes, particle size, and quality of the tailings check.', 'Use repeatable contained batches; do not assume the direction of the necessary adjustment.'],
  ['A good short run gets worse later', 'Heavy-mineral accumulation, recirculated-water changes, outlet burial, and changing feed.', 'Compare recorded cleanup intervals and longer tests at the otherwise best short-run setting.']
], 'material-table')}
<p>Gold Hog’s tuning discussion warns that slowing an already loaded box can worsen losses. Use that as a reason to test the diagnosis, not as an instruction to run every sluice steep or fast.${cite('hog-tuning')}</p>
<p>The setting worth keeping is repeatable with the gold sizes you care about and a manageable processing rate. Recheck it when the deposit, classifier, water supply, or recovery surface changes.</p>
<aside class="field-note"><p><strong>Before a field trial:</strong> confirm that the site permits your sluice or motorized highbanker, water withdrawal, and discharge method. Keep sediment out of protected habitat, use stable footing, and follow pump and electrical instructions. Make adjustments with the equipment secured; stop the feed before changing the setup. A contained tuning test is easier to account for and avoids deliberately releasing test gold or tracers.</p></aside>
<nav class="related-reading" aria-label="Related Gold Trails articles"><h2>Keep building the field method</h2><ul><li><a href="/articles/classification-basics/">Classification: keep both size fractions accountable</a></li><li><a href="/articles/black-sands/">Black sands: a clue, not a gold count</a></li><li><a href="/articles/compare-test-pans/">Compare test pans without fooling yourself</a></li></ul></nav></section>

<section id="sources"><h2>Sources and scope</h2><p>Primary sources checked November 2, 2026. Older research describes its own test systems; current manufacturer guidance describes the named equipment. The comparisons, notebook procedure, geometric examples, and troubleshooting sequence are Gold Trails’ editorial synthesis. No equipment was independently tested for this article, and no universal flow, angle, or recovery guarantee is offered.</p><ol class="reference-list">${evidence.sources.map(source => `<li id="source-${source.id}">${external(source.url, source.title)}. ${e(source.publisher)}.<small>${e(source.type)} · ${e(source.location)}. ${e(source.limits)}${source.id === 'keene' ? ' Official indexed instructions were available; direct PDF retrieval was blocked during research.' : ''}</small></li>`).join('')}</ol></section>
<p class="article-endnote">A measured setup makes an experiment repeatable. Accounting for the gold leaving it makes the experiment useful.</p>`;

// Reuse the established reading-page shell and navigation, without the old article's source-popover script.
let template = await readFile('dist/articles/classification-basics/index.html', 'utf8');
if (!template.includes('<article class="reading"') || !template.includes('</article>')) throw new Error('Reading-page template changed; review the article shell.');
let html = template.replace(/<article class="reading"[\s\S]*?<\/article>/, `<article class="reading tuning-article" aria-labelledby="article-title">${content}</article>`)
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${e(title)} — Gold Trails</title>`)
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${e(summary)}">`)
  .replace(/<script>document\.querySelectorAll\('\.source-marker'\)[\s\S]*?<\/script>/, '');
const version = createHash('sha256').update(await readFile('dist/sluice-tuning.css')).digest('hex').slice(0, 12);
html = html.replace('</head>', `<link rel="stylesheet" href="/sluice-tuning.css?v=${version}"><link rel="canonical" href="https://goldtrails.org${route}"><meta property="og:type" content="article"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(summary)}"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:title,description:summary,datePublished:publicationDate,dateModified:publicationDate,author:{'@type':'Person',name:'Paul Shoemaker'},publisher:{'@type':'Organization',name:'Gold Trails'},mainEntityOfPage:'https://goldtrails.org'+route}).replace(/</g, '\\u003c')}</script></head>`);
await mkdir('dist' + route, {recursive:true});
await writeFile('dist' + route + 'index.html', html);
await mkdir('dist/downloads', {recursive:true});
await writeFile('dist/downloads/sluice-tuning-test-log.csv', 'Date,Test ID,A or B repeat,Feed source,Box and mat,Screen opening and unit,Clay preparation,Feed amount,Feed amount unit,Wet or dry convention,Feed duration seconds,Main floor angle degrees,Extension angle degrees,Crosswise level,Water delivery,Water delivery unit,Water measurement method or proxy,Hose and lift,Depth and reference point,Water condition,Starting bed condition,Run duration,Concentrate ID,Full tailings retained,Other reject IDs,Gold retained mass g,Gold lost mass g,Mass measurement limit,Gold size and shape,Check method and its rejects retained,Spills or incomplete accounting,Observed loading,Single change made,Notes\n');
console.log('Sluice tuning guide built: 7 sections, 10 primary sources, angle diagram and test log.');

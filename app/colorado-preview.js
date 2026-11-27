import {assetUrl} from './asset-url.js';
import {coloradoSources} from './colorado-referrals.js';

export function coloradoPreview(source, member, csrf) {
  const path = '/co/' + source + '/', label = coloradoSources.get(source);
  let offer = `<a class="button" href="/signup/?via=${source}">Create a free account</a>
    <a class="text-link" href="/login/?next=${encodeURIComponent(path)}">Already a member? Sign in</a>`;
  if (member?.effective_level === 'subscriber') {
    offer = '<a class="button" href="/gold-almanac/colorado/">Read your Colorado chapter</a>';
  } else if (member) {
    offer = `<form method="post" action="${path}"><input type="hidden" name="csrf" value="${csrf}"><button class="button" type="submit">Explore Gold Trails Plus</button></form>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Colorado Gold Almanac · Welcome to Gold Trails</title>
    <meta name="description" content="Read a free Colorado gold prospecting field note and find the official sources for planning your outing.">
    <link rel="stylesheet" href="${assetUrl('colorado-preview.css')}"></head><body>
    <header><a class="brand" href="/">Gold Trails</a><a class="home" href="/">Visit the field library <span aria-hidden="true">↗</span></a></header>
    <main><section class="intro" aria-labelledby="welcome">
      <div class="portrait"><img src="/assets/colorado-welcome.webp" width="900" height="600" alt="Gold Trails’ illustrated prospector welcomes you from a mountain stream."></div>
      <div class="welcome"><p class="eyebrow">Colorado Gold Almanac</p><h1 id="welcome">Welcome to gold country.</h1>
      <p>Pull up a rock. Gold Trails is a field library for people who like to get a pan wet. Here’s a free page from our Colorado Almanac to help you plan a day by the water.</p>
      <a class="button" href="#field-note">Read the free sample <span aria-hidden="true">↓</span></a></div>
    </section>
    <article id="field-note" aria-labelledby="creeks"><p class="eyebrow">Field notes from Arvada, Colorado</p>
      <h2 id="creeks">Where two creeks meet</h2><p>On June 22, 1850, Lewis Ralston found gold near the junction of Ralston Creek and Clear Creek in present-day Arvada. Find the junction on a map and trace the two streams upstream. Those two lines mark the start of a local gold story you can still follow today.</p>
      <a class="source" href="https://www.arvadaco.gov/589/The-Founding-of-Our-Community">Read Arvada’s account of the discovery <span aria-hidden="true">↗</span></a>
      <h3>Before you pack a pan</h3><p>A historic find gives you a place to research. For an outing in nearby Clear Creek Canyon Park, check the county’s map, closures and prospecting guidance for the stretch you plan to visit. Access and permitted equipment vary by location.</p>
      <a class="source" href="https://www.jeffco.us/1196/Clear-Creek-Canyon-Park">Open the county’s Clear Creek Canyon Park guide <span aria-hidden="true">↗</span></a>
    </article>
    <section class="offer" aria-labelledby="chapter"><h2 id="chapter">Take the full Almanac along</h2>
      <p>Explore Colorado’s gold districts, geology, seasonal field notes and land-manager sources, along with the other state chapters. Gold Trails Plus is <strong>$5 USD a month</strong> and renews until canceled.</p>
      <div class="actions">${offer}</div><p class="credit">Through this offer, Gold Trails credits ${label} on your account and counts paid Plus months. ${source === 'goldputz' ? 'The creator may earn a one-time referral fee. ' : ''}<a href="/plus/">Explore Plus without referral credit</a>.</p>
    </section></main><footer><a href="/">Gold Trails</a><a href="/articles/">Browse more free articles <span aria-hidden="true">→</span></a></footer>
    </body></html>`;
}

// These are conceptual sampling hypotheses, never mapped or verified deposits.
// Keep all explanatory text in rendered HTML as well as the optional SVG layers.
export const traps = [
  {
    id: 'crevice', title: 'Bedrock crevices', short: 'Follow the crack, then test the fill.',
    why: 'A narrow opening can shelter dense particles when the surrounding bed is disturbed. A crack is a possible retaining structure, not evidence of gold.',
    position: 'Test retained sediment at the bottom, beneath small lodged stones, and along changes in the crack’s width. Visible surface flakes do not establish what lies below.',
    flow: 'An open crack may admit sediment during stronger flow and retain some as flow declines. Orientation, packing, and later floods change the outcome.',
    failure: 'The crack may be sealed, recently emptied, outside the gold-bearing transport path, or filled with barren recent sediment.',
    test: 'If permitted and safely reachable from a stable position, photograph the undisturbed fill. Sample the top and deeper fill separately, without prying apart bedrock; compare equal volumes with nearby loose sediment.'
  },
  {
    id: 'boulder', title: 'Boulder bases', short: 'Compare the shelter with the scour.',
    why: 'A stable boulder changes local flow. Its base and protected pockets may retain heavy particles while nearby accelerated flow removes sediment.',
    position: 'Compare accessible downstream pockets, side contacts, and sediment immediately against the base. Do not assume the downstream side always wins.',
    flow: 'Flow accelerates around an obstacle and can scour its sides or base; a changing wake can either deposit or remove sediment. Flood flow may differ from today’s gentle current.',
    failure: 'The boulder may have moved, its wake may be actively scouring, or the retained gravel may contain no gold supply.',
    test: 'Compare equal-volume samples from safely accessible side and downstream pockets. Never reach beneath an unstable boulder, shift it, or enter a constricted current.'
  },
  {
    id: 'pothole', title: 'Natural potholes', short: 'A bowl can collect—and empty.',
    why: 'A depression provides space for sediment to accumulate, but the same circulating water that forms a pothole may keep its contents moving.',
    position: 'Where access is safe and legal, compare loose upper fill with retained material near the bottom or under an existing rim. Gold can be absent at every level.',
    flow: 'Circulating flow can grind and scour a pothole during floods. Material preserved after falling flow need not represent a permanent trap.',
    failure: 'An apparently deep pocket may have been flushed clean, filled only recently, or isolated from gold-bearing sediment.',
    test: 'Observe from above. Sample only a small, shallow depression reachable without submerging your head or putting a hand into a blind opening. Keep layers separate; leave deep or obstructed holes alone.'
  },
  {
    id: 'ledge', title: 'Bedrock ledges & steps', short: 'Read the contact below the step.',
    why: 'A step interrupts the bed surface and may create a protected contact or a sediment pocket. Whether it retains gold depends on the local flow and sediment supply.',
    position: 'Compare the foot of the step, any accessible seam, and sediment farther downstream. A bare ledge is a feature to investigate, not a pay streak.',
    flow: 'A jet over the step can scour the landing area while quieter adjacent pockets retain material. Later floods may reverse what appears promising at low water.',
    failure: 'The step may focus erosive flow directly into the pocket, or the pocket may receive only recently deposited barren sand.',
    test: 'From a stable shallow position, compare small samples at the foot and beside the step. Avoid waterfalls, undercuts, hydraulic recirculation, and slippery drop-offs.'
  },
  {
    id: 'clay', title: 'Clay & false-bedrock contacts', short: 'Test the boundary, not the color.',
    why: 'A resistant layer can interrupt downward movement and provide a contact at which sediment is retained. Clay alone neither attracts gold nor proves a deposit.',
    position: 'Compare material immediately above the firm contact with overlying loose gravel. If allowed, keep any naturally exposed seam material separate.',
    flow: 'A firm surface may persist while looser material is reworked; erosion can also cut through or strip it. Today’s surface may not be the concentrating surface of an earlier flood.',
    failure: 'The clay may be recent or discontinuous, the contact may be barren, or fine gold may occur in a different layer. Firm material is not necessarily true bedrock.',
    test: 'Record texture and layer order. Compare equal volumes above the contact and higher in the gravel without cutting banks, excavating clay, or assuming the hard layer marks the end of the gold.'
  },
  {
    id: 'gravel', title: 'Submerged gravel pockets', short: 'Keep each layer’s story separate.',
    why: 'A hollow in bedrock can retain a patch of gravel after nearby material moves. Such pockets preserve a local sediment history rather than guaranteeing a concentrate.',
    position: 'Compare the exposed surface, material beneath existing small stones, and sediment at the bedrock contact. Do not mix these before recording them.',
    flow: 'Floods may load, sort, or flush the pocket. Coarse grains can armor finer sediment, while strong flow may remove the entire fill.',
    failure: 'The gravel may be too recently deposited, derived from a barren source, or repeatedly flushed without retaining gold.',
    test: 'Photograph the pocket, label small surface and contact samples, and compare equivalent volumes with a neighboring pocket. Log empty samples alongside positive results.'
  }
];

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stones = (items, fill = '#aea58a') => items.map(([x,y,r=7]) => `<path d="M${x-r} ${y}l${r*.4} ${-r*.7} ${r} ${-r*.18} ${r*.55} ${r*.68} ${-r*.4} ${r*.75} ${-r} ${r*.12}Z" fill="${fill}" stroke="#807b66" stroke-width="1.2"/>`).join('');
const gold = items => items.map(([x,y,r=4]) => `<path d="M${x-r} ${y}l${r*.5} ${-r*.7} ${r} ${r*.1} ${r*.5} ${r*.7} ${-r*.8} ${r*.6} ${-r*.9} ${-r*.1}Z" fill="#e9bc4c" stroke="#866019" stroke-width="1.1"/>`).join('');

const scenes = {
  crevice: {
    rock: 'M24 231L155 221 238 234 287 224 304 239 316 302 337 316 355 300 371 234 474 223 559 236 696 221V336H24Z',
    sediment: '<path d="M307 247Q331 260 365 246L353 298 335 311 321 299Z" fill="#a99470" opacity=".85"/>',
    detail: '<path d="M44 261L212 256 275 264M391 261L520 254 678 266M43 304L280 297M388 302L535 311 678 300"/><path d="M304 239L316 302 337 316 355 300 371 234" stroke-width="2.5"/>',
    pebbles: [[317,262,7],[346,278,8],[329,293,5]], gold: [[327,306,4],[338,308,5],[347,300,3]],
    flow: 'M77 128C182 127 232 130 296 130S411 129 492 128M506 128H625',
    scour: 'M402 219Q456 205 513 219', sample: [337,292],
    labels: '<text x="72" y="288">Solid bedrock</text><path d="M420 285L367 292"/><text x="427" y="290">Retained crack fill</text>',
    desc: 'Conceptual bedrock cross-section with a narrow sediment-filled crack. Hypothetical gold lies in retained fill near its base; scour is marked on an exposed nearby surface.'
  },
  boulder: {
    rock: 'M24 267L143 260 264 267 366 263 457 277 533 268 696 262V336H24Z',
    sediment: '<path d="M375 263Q425 240 485 269L457 277Z" fill="#b8a177"/><path d="M242 263C229 229 225 189 248 160C270 127 325 126 356 158C381 183 390 231 366 263Z" fill="#8c9385" stroke="#5b6d66" stroke-width="2.5"/><path d="M250 180L277 153 330 150M248 216L287 227 338 213 372 227M285 227L278 257" fill="none" stroke="#b2b9a5" stroke-width="2"/>',
    detail: '<path d="M44 295L210 291 368 299 528 292 679 298M45 321L188 316 380 324 594 318 676 322"/>',
    pebbles: [[392,259,6],[409,264,8],[433,266,5]], gold: [[379,266,4],[391,268,3],[404,269,4]],
    flow: 'M77 119C179 119 208 100 294 100S399 108 436 135S531 150 625 149',
    scour: 'M183 251Q210 239 238 251', sample: [397,254],
    labels: '<text x="81" y="305">Bedrock floor</text><path d="M487 223L419 249"/><text x="492" y="219">Possible sheltered fill</text>',
    desc: 'Conceptual boulder on bedrock with possible scouring on its upstream side and hypothetical retained sediment at its downstream base. Neither side is guaranteed to retain gold.'
  },
  pothole: {
    rock: 'M24 226L158 223 238 232 260 230Q271 303 327 314Q388 319 417 232L513 225 696 230V336H24Z',
    sediment: '<path d="M281 277Q342 288 396 274Q372 314 330 309Q299 305 281 277Z" fill="#a99470"/>',
    detail: '<path d="M44 262L200 257 251 267M434 263L561 255 676 267M45 301L230 305M425 305L543 297 677 305"/><path d="M260 230Q271 303 327 314Q388 319 417 232" stroke-width="2.5"/>',
    pebbles: [[308,289,10],[353,290,8],[374,286,6]], gold: [[326,305,4],[342,308,4],[357,303,3]],
    flow: 'M77 119H248C290 119 311 137 339 164C365 191 354 226 332 228C312 232 299 209 310 191M399 119H625',
    scour: 'M282 260Q275 231 289 214', sample: [342,289],
    labels: '<text x="65" y="295">Bedrock</text><path d="M462 285L396 288"/><text x="470" y="290">Layered pocket fill</text>',
    desc: 'Conceptual rounded pothole in bedrock, partly filled with sediment. Circulating flow and possible scour show why a bowl can empty as well as collect; gold at the bottom is hypothetical.'
  },
  ledge: {
    rock: 'M24 220L183 216 271 225 303 219 319 281 424 288 542 278 696 285V336H24Z',
    sediment: '<path d="M320 265Q350 255 400 286L325 282Z" fill="#ac9973"/>',
    detail: '<path d="M45 251L173 246 285 255M349 311L503 305 675 315M44 292L232 285 293 294"/><path d="M303 219L319 281 424 288" stroke-width="2.5"/>',
    pebbles: [[333,274,6],[350,278,7],[371,282,5]], gold: [[324,281,4],[335,282,3],[345,284,3]],
    flow: 'M77 123C200 122 274 127 310 151S346 200 393 207S530 207 625 207',
    scour: 'M415 276Q459 260 503 272', sample: [339,267],
    labels: '<text x="72" y="284">Bedrock step</text><path d="M518 246L365 267"/><text x="523" y="244">Possible foot pocket</text>',
    desc: 'Conceptual bedrock step with flow passing over a ledge. A small hypothetical sediment pocket is shown at the foot, and potential scour is shown farther downstream.'
  },
  clay: {
    rock: 'M24 303L192 299 362 306 527 297 696 303V336H24Z',
    sediment: '<path d="M24 243L164 238 320 249 500 239 696 245V303L527 297 362 306 192 299 24 303Z" fill="#b29b82"/><path d="M24 219L159 215 322 227 499 217 696 223V245L500 239 320 249 164 238 24 243Z" fill="#c5b58f"/><path d="M24 244L164 239 320 250 500 240 696 246" fill="none" stroke="#765a4c" stroke-width="3"/>',
    detail: '<path d="M44 270L169 265 322 278 479 266 676 273M45 289L230 284 408 293 610 286 677 289M50 319L218 316 414 322 665 317"/>',
    pebbles: [[105,224,8],[153,226,6],[204,230,9],[280,234,8],[362,233,7],[414,229,9],[487,226,6],[552,228,8],[613,231,6]], gold: [[293,244,4],[309,246,3],[331,246,4]],
    flow: 'M77 125C239 125 421 127 625 125',
    scour: 'M481 214Q529 204 580 218', sample: [312,234],
    labels: '<text x="66" y="283">Firm clay layer</text><path d="M443 285L355 249"/><text x="450" y="289">Contact to compare</text><text x="66" y="328" font-size="12">Deeper material not investigated</text>',
    desc: 'Conceptual loose gravel above a firm clay layer. Hypothetical gold occurs just above the contact. The layer is not labeled true bedrock and does not establish the depth of a deposit.'
  },
  gravel: {
    rock: 'M24 222L158 217 229 233Q303 306 410 284L496 226 581 220 696 229V336H24Z',
    sediment: '<path d="M229 233Q355 219 496 226L410 284Q303 306 229 233Z" fill="#b8a27b"/><path d="M255 256Q356 249 457 253" stroke="#8a795e" stroke-width="1.5" fill="none"/>',
    detail: '<path d="M45 264L195 257 230 271M472 278L569 268 677 279M45 308L197 300 290 315M431 316L583 306 678 313"/>',
    pebbles: [[262,236,10],[294,242,7],[325,234,10],[365,241,8],[399,233,10],[434,237,7],[467,231,8],[286,262,6],[326,273,8],[373,269,7],[410,263,6]], gold: [[325,284,4],[345,287,4],[368,285,3]],
    flow: 'M77 123C251 120 445 127 625 123',
    scour: 'M531 213Q578 201 628 216', sample: [351,273],
    labels: '<text x="65" y="292">Bedrock hollow</text><path d="M510 287L428 259"/><text x="518" y="291">Separate the layers</text>',
    desc: 'Conceptual bedrock hollow containing gravel in separate layers. Hypothetical gold lies in a lower retained layer; nearby exposed bedrock may be scoured.'
  }
};

export function renderTrapDiagram(id, {prefix = 'trap'} = {}) {
  const trap = traps.find(item => item.id === id);
  if (!trap) throw new RangeError(`Unknown gold trap: ${id}`);
  const scene = scenes[id];
  const uid = `${prefix}-${id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const [sx, sy] = scene.sample;
  return `<svg class="trap-diagram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 370" role="img" aria-labelledby="${uid}-title ${uid}-desc">
<title id="${uid}-title">${escape(trap.title)} — conceptual cross-section</title>
<desc id="${uid}-desc">${escape(scene.desc)} Dashed rust marks indicate possible scour; a numbered ring suggests a place to compare a small sample, only where safe and permitted. This is an illustration, not a verified gold deposit.</desc>
<defs>
<linearGradient id="${uid}-water" x2="0" y2="1"><stop stop-color="#dae8dc"/><stop offset="1" stop-color="#85b5ad"/></linearGradient>
<linearGradient id="${uid}-rock" x2="0" y2="1"><stop stop-color="#b3b09a"/><stop offset="1" stop-color="#898d7b"/></linearGradient>
<pattern id="${uid}-grain" width="31" height="24" patternUnits="userSpaceOnUse"><path d="M4 9l7-2M19 17l5 2" stroke="#5c6e64" opacity=".19" stroke-width="1"/></pattern>
<marker id="${uid}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l7 4-7 4" fill="none" stroke="#356d72" stroke-width="1.5"/></marker>
</defs>
<g font-family="'DM Sans',Arial,sans-serif" font-size="14" fill="#354b45">
<rect x="24" y="26" width="672" height="310" rx="5" fill="#f2eddb"/>
<path d="M24 66Q60 59 96 66T168 66T240 66T312 66T384 66T456 66T528 66T600 66T672 66L696 65V336H24Z" fill="url(#${uid}-water)"/>
<path d="M24 66Q60 59 96 66T168 66T240 66T312 66T384 66T456 66T528 66T600 66T672 66L696 65" fill="none" stroke="#7aa59c" stroke-width="1.5"/>
<text x="43" y="49" font-size="11" letter-spacing="1.5">CONCEPTUAL CROSS-SECTION · NOT TO SCALE</text>
<path d="${scene.rock}" fill="url(#${uid}-rock)" stroke="#606e60" stroke-width="2" stroke-linejoin="round"/>
<path d="${scene.rock}" fill="url(#${uid}-grain)"/>
${scene.sediment}
<g fill="none" stroke="#737f6c" stroke-width="1.3" opacity=".7">${scene.detail}</g>
${stones(scene.pebbles)}
<g data-layer="flow"><text x="78" y="102" fill="#255e64" font-size="13" font-weight="700">Water flow</text><path d="${scene.flow}" stroke="#356d72" stroke-width="2.3" fill="none" marker-end="url(#${uid}-arrow)" stroke-linecap="round"/></g>
<g data-layer="gold">${gold(scene.gold)}</g>
<g data-layer="scour"><path d="${scene.scour}" stroke="#9b5d43" stroke-width="2.5" stroke-dasharray="5 5" fill="none" stroke-linecap="round"/></g>
<g data-layer="samples"><circle cx="${sx}" cy="${sy}" r="23" fill="#f3e7c1" fill-opacity=".13" stroke="#765c31" stroke-width="1.7" stroke-dasharray="4 4"/><circle cx="${sx+22}" cy="${sy-19}" r="12" fill="#f4e4b5" stroke="#765c31" stroke-width="1.4"/><text x="${sx+22}" y="${sy-14}" text-anchor="middle" fill="#574326" font-size="13" font-weight="700">1</text></g>
<g stroke="#52685c" stroke-width="1.2" stroke-linecap="round" fill="#354b45">${scene.labels.replace(/<text /g,'<text stroke="none" ')}</g>
<rect x="24" y="26" width="672" height="310" rx="5" fill="none" stroke="#9ba99a"/>
<text x="360" y="358" text-anchor="middle" font-size="12" fill="#6b6a51">Gold marks show a hypothesis to test, not a documented discovery.</text>
</g></svg>`;
}

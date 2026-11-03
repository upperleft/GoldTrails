// Primary organizer, operator and public museum pages reviewed November 3, 2026.
// A listed program is not a checked booking, travel recommendation or played game.
const reviewedAt='2026-11-03';
const source=(url,note)=>({url,reviewedAt,note});
const real=record=>({
 aliases:[],formats:['real'],theme:'prospecting',
 age:{minimum:null,kind:'unconfirmed',label:'Age guidance not confirmed; check the organizer'},
 players:{min:null,max:null},minutes:{min:null,max:null},platforms:['physical'],
 ...record
});

export const realLifeGames=[
 real({
  id:'R01',title:'World Goldpanning Association competitions',
  aliases:['World Gold Panning Championships','WGA competitions'],maker:'World Goldpanning Association and local organizers',
  summary:'Pan seeded sand and gravel against the clock, with recovery accuracy affecting the result. Individual, junior and team classes make competitive panning a sport with several ways to take part.',
  mechanics:['Timed gold recovery','Accuracy penalties','Individual and team competition'],
  age:{minimum:null,kind:'unconfirmed',label:'Junior and adult classes; check the current category rules'},
  cost:'event',availability:'available',
  availabilityNote:'The WGA calendar lists the 2027 World Championships in Tankavaara, Finland, August 2–7. Confirm entries, categories and travel details with the organizer.',
  links:[
   {label:'See competition details',url:'https://www.worldgoldpanningassociation.com/competitions/'},
   {label:'Read official rules',url:'https://www.worldgoldpanningassociation.com/competition-rules/'},
   {label:'View event calendar',url:'https://www.worldgoldpanningassociation.com/calendar/'}
  ],
  sources:[
   source('https://www.worldgoldpanningassociation.com/competitions/','Organizer explains seeded material, timed recovery, individual/junior/team classes and three-minute penalties for each lost piece.'),
   source('https://www.worldgoldpanningassociation.com/competition-rules/','Organizer links its rules release dated August 16, 2025; follow the complete current rules rather than informal house rules.'),
   source('https://www.worldgoldpanningassociation.com/calendar/','Official calendar lists Tankavaara World Championships August 2–7, 2027 and advises checking with local organizers.')
  ],
  eventDates:{start:'2027-08-02',end:'2027-08-07',kind:'future'}
 }),
 real({
  id:'R02',title:'Fraser River Gold Panning Championships',aliases:['Yukon Dan panning championships','FRGPC'],maker:'Yukon Dan',
  summary:'A British Columbia panning program with conventional competition and playful variations such as hand-in-hand, blindfold and anything-but-a-gold-pan events. Mini-Miner, child, teen and adult divisions appear in the published program.',
  mechanics:['Timed gold recovery','Novelty panning formats','Age divisions'],
  age:{minimum:null,kind:'unconfirmed',label:'Mini-Miner, child, teen and adult divisions; ask the organizer'},
  cost:'event',availability:'older',
  availabilityNote:'The listed September 25–27, 2026 program at Boston Bar, British Columbia has passed. The next edition is not confirmed here; past fees and schedules do not establish future arrangements.',
  links:[{label:'See organizer and past program',url:'https://www.yukondan.com/frgpc.html'}],
  sources:[source('https://www.yukondan.com/frgpc.html','Organizer page lists September 25–27, 2026, age divisions, novelty events and edition-specific fees/rules. These dates are past as of review.')],
  eventDates:{start:'2026-09-25',end:'2026-09-27',kind:'past'}
 }),
 real({
  id:'R03',title:'Ohio Gold Rush Days',aliases:['Buckeye Chapter Gold Rush Days'],maker:'Buckeye Chapter of the GPAA',
  summary:'An Ohio prospecting gathering whose published program includes seeded-gold speed panning, children’s activities and gold-pan racing. Pan racing uses pans as small floating craft and is separate from gold-recovery competition.',
  mechanics:['Speed panning','Pan racing','Family learning activities'],
  age:{minimum:null,kind:'unconfirmed',label:'Age rules vary by activity; check the current chapter program'},
  cost:'event',availability:'older',
  availabilityNote:'The chapter’s September 5–6, 2026 schedule is past. Check the chapter for a new program; no future date or fee is established by this listing.',
  links:[{label:'See chapter and past program',url:'https://buckeyegold.com/gold-rush/'}],
  sources:[source('https://buckeyegold.com/gold-rush/','Chapter schedule lists September 5–6, 2026, seeded speed panning, children’s activities, and standard/modified pan racing. Activity charges differ; no future fee promise is carried forward.')],
  eventDates:{start:'2026-09-05',end:'2026-09-06',kind:'past'}
 }),
 real({
  id:'R04',title:'Finnish Open Gold Panning Championships',aliases:['Tankavaara Finnish Open'],maker:'Tankavaara Gold Village and Gold Prospectors Association of Finnish Lapland',
  summary:'Compete in gold recovery in Finnish Lapland, with a beginner category alongside experienced panners. The Finnish Open has its own registration and dates, separate from the World Championships.',
  mechanics:['Timed gold recovery','Beginner category','Competition classes'],
  age:{minimum:null,kind:'unconfirmed',label:'Children, junior and adult classes; see category rules'},
  cost:'event',availability:'available',
  availabilityNote:'The organizer’s registration page lists July 30–31, 2027 in Tankavaara. Confirm categories and available places directly; the World Championships follow on different dates.',
  links:[
   {label:'See competition details',url:'https://www.tankavaaragold.fi/language/en/goldpanningcompetitionsfinland/'},
   {label:'View Finnish Open registration',url:'https://www.tankavaaragold.fi/language/en/registration/'}
  ],
  sources:[
   source('https://www.tankavaaragold.fi/language/en/goldpanningcompetitionsfinland/','Organizer identifies its 2027 Finnish Open, beginner category and separate World Championships registration.'),
   source('https://www.tankavaaragold.fi/language/en/registration/','Registration page explicitly dates the Finnish Open July 30–31, 2027, with children, junior, beginner and adult categories; not the World Championship dates.')
  ],
  eventDates:{start:'2027-07-30',end:'2027-07-31',kind:'future'}
 }),
 real({
  id:'R05',title:'British Gold Panning Championships',aliases:['British Gold Panning Association Championships'],maker:'British Gold Panning Association / Museum of Lead Mining',
  summary:'An organized gold-panning competition hosted at the Museum of Lead Mining in Wanlockhead, Scotland. Its published 2026 invitation welcomed newcomers as well as experienced panners.',
  mechanics:['Gold-panning competition','Beginner participation'],
  age:{minimum:null,kind:'publisher',label:'2026 host welcomed all age groups; check the next event'},
  cost:'event',availability:'older',
  availabilityNote:'The host’s May 23–24, 2026 event has passed. A next-edition date is not confirmed here; follow the museum or association for updates.',
  links:[{label:'See host and past event',url:'https://www.leadminingmuseum.co.uk/events/british-gold-panning-association-championships-2026-at-museum-of-lead-mining/'}],
  sources:[source('https://www.leadminingmuseum.co.uk/events/british-gold-panning-association-championships-2026-at-museum-of-lead-mining/','Museum host page dates the event May 23–24, 2026 and says no experience necessary and all age groups welcome. It does not establish a future edition.')],
  eventDates:{start:'2026-05-23',end:'2026-05-24',kind:'past'}
 }),
 real({
  id:'R06',title:'Gold Rush — The Escape Game',aliases:['Gold Rush escape room'],maker:'The Escape Game',theme:'treasure',
  summary:'Work together through tactile puzzles and clues in a gold-rush cabin and mine setting to uncover a fictional hidden fortune before the hour ends.',
  mechanics:['Cooperative puzzles','Clue finding','Timed escape room'],
  age:{minimum:null,kind:'unconfirmed',label:'Age and adult-accompaniment rules depend on the venue'},
  players:{min:null,max:8},minutes:{min:60,max:60},cost:'paid',availability:'available',
  availabilityNote:'The operator lists this room; bookings, prices and locations must be checked for the chosen venue. Its 7/10 difficulty score is not an age rating, and no real-gold prize is implied.',
  compatibilityNote:'Ask the chosen venue about physical access and participation requirements.',
  links:[{label:'View operator and locations',url:'https://theescapegame.com/escape-rooms/gold-rush/'}],
  sources:[source('https://theescapegame.com/escape-rooms/gold-rush/','Operator lists up to eight players, a 60-minute room, tactile puzzles, and a 7/10 difficulty rating. Exact venue booking/access/age conditions were not established.')]
 }),
 real({
  id:'R07',title:'Gold Country geocaching and GeoTourism',aliases:['Gold Country GeoTour 2.0','Gold Country geocaching'],maker:'Gold Country tourism',theme:'treasure',
  summary:'Follow GPS locations or letterboxing clues to discover caches and regional heritage in British Columbia’s Gold Country. The activity seeks hidden containers and local stories rather than actual gold nuggets.',
  mechanics:['Outdoor clue hunting','GPS navigation','Heritage exploration'],
  age:{minimum:null,kind:'unconfirmed',label:'No numeric age guidance confirmed; plan routes for your group'},
  cost:'free',availability:'upcoming',
  availabilityNote:'The official tourism page still labels GeoTour 2.0 “Coming Soon.” Refreshed routes and rewards are not confirmed live; check the organizer before planning a specific cache hunt.',
  links:[{label:'View GeoTour updates',url:'https://exploregoldcountry.ca/geocaching'}],
  sources:[source('https://exploregoldcountry.ca/geocaching','Tourism page describes GPS/letterboxing heritage searches as free, but marks GeoTour 2.0 Coming Soon. No fixed count of currently active caches or current reward promise is published here.')]
 }),
 real({
  id:'R08',title:'GPAA Junior Prospector kit and program',aliases:['GPAA Junior Prospector Membership'],maker:'Gold Prospectors Association of America',
  summary:'A hands-on learning kit and membership with a pan, gold-bearing practice material and geology activities. It can support supervised family practice, but is not a standalone scored game.',
  mechanics:['Practice panning','Geology activities','Supervised learning'],
  age:{minimum:null,kind:'unconfirmed',label:'Junior program; confirm the applicable age range with GPAA'},
  cost:'paid',availability:'available',
  availabilityNote:'The official membership listing offers an initial kit and optional recurring quarterly shipments. Review the purchase and renewal terms; this is not simply a one-off boxed game.',
  links:[{label:'View program and purchase terms',url:'https://gpaastore.com/collections/discounted-items/products/gpaa-junior-prospector-membership'}],
  sources:[source('https://gpaastore.com/collections/discounted-items/products/gpaa-junior-prospector-membership','Current item text says ages 6–12 and lists a pan, paydirt and geology materials plus optional recurring quarterly shipments. Supplied research also noted conflicting age wording, so a settled numeric age is withheld.')]
 }),
 real({
  id:'R09',title:'Gold Rush Museum hands-on panning',aliases:['The Gold Rush Museum','Placer County Gold Rush Museum'],maker:'Placer County Museums',
  summary:'Explore gold-rush history and practice in the indoor panning stream at the Gold Rush Museum in Auburn, California. This is a museum learning experience rather than a timed or scored competition.',
  mechanics:['Hands-on panning','Museum learning'],
  age:{minimum:null,kind:'unconfirmed',label:'No general visitor minimum age confirmed'},
  cost:'free',availability:'available',
  availabilityNote:'The county lists free museum admission and an indoor panning stream. Confirm current opening hours and activity availability before visiting; separately booked educational programs may have their own fees.',
  compatibilityNote:'The county describes the indoor panning stream as wheelchair accessible; this does not establish access for every exhibit or program.',
  links:[{label:'View museum visitor details',url:'https://www.placer.ca.gov/Facilities/Facility/Details/Gold-Rush-Museum-81'}],
  sources:[source('https://www.placer.ca.gov/Facilities/Facility/Details/Gold-Rush-Museum-81','County facility page lists free admission, hands-on exhibits and a wheelchair-accessible indoor panning stream. Its separately arranged education program has distinct details and fees.')]
 })
];

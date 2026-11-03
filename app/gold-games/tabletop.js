// Edition-specific research, reviewed November 3, 2026. Listings and rules were
// inspected; games, purchases and browser play sessions were not play-tested.
const reviewedAt='2026-11-03';
const source=(url,note)=>({url,reviewedAt,note});
const age=(minimum,label=minimum===null?'Not confirmed':`${minimum}+ (publisher guidance)`)=>({minimum,kind:minimum===null?'unconfirmed':'publisher',label});
const range=(min,max=min)=>({min,max});
const board=record=>({aliases:[],formats:['board'],theme:'prospecting',age:age(null),players:range(null),minutes:range(null),platforms:['physical'],cost:'paid',...record});

export const tabletopGames=[
 board({
  id:'A01',title:'Gold Fever',maker:'Lautapelit.fi / Stronghold Games',
  summary:'Reach into a bag for nuggets and gravel, then decide whether another draw is worth the risk. Rival prospectors can make a promising bag less inviting.',
  mechanics:['Bag drawing','Push your luck'],age:age(7),players:range(2,5),minutes:range(10,15),
  availability:'available',availabilityNote:'Lautapelit.fi listed Finnish webshop stock when checked. Shipping and regional editions need checking; publisher versions use different winning thresholds.',
  links:[{label:'View publisher',url:'https://en.lautapelit.fi/product/23837/gold-fever'},{label:'See Stronghold edition',url:'https://strongholdgames.com/our-games/gold-fever/'}],
  sources:[source('https://en.lautapelit.fi/product/23837/gold-fever','Publisher lists ages 7+, 2–5 players, bag-drawing play and webshop stock.'),source('https://strongholdgames.com/our-games/gold-fever/','Publisher specifies 10–15 minutes. Its win threshold differs from the Lautapelit.fi description; no universal threshold is stated here.')]
 }),
 board({
  id:'A02',title:'Saboteur',aliases:['Saboteur 2','Saboteur anniversary editions'],maker:'Frederic Moyersoen / AMIGO / Pandasaurus Games',theme:'mining',
  summary:'Lay tunnel cards toward the gold while trying to discover which helpful-looking dwarves are secretly undermining the expedition.',
  mechanics:['Hidden roles','Route building','Hand management'],age:age(8),players:range(3,10),minutes:range(30),
  availability:'available',availabilityNote:'The U.S. Pandasaurus base-game listing offers purchase. Saboteur 2 is an expansion; anniversary bundles and their player ranges should be checked separately.',
  links:[{label:'View U.S. publisher',url:'https://pandasaurusgames.com/products/saboteur'},{label:'See family and editions',url:'https://blog.amigo-spiele.de/saboteur-reihe/'}],
  sources:[source('https://pandasaurusgames.com/products/saboteur','Current base-game listing specifies ages 8+, 3–10 players, 30 minutes and Add to cart.'),source('https://blog.amigo-spiele.de/saboteur-reihe/','Publisher distinguishes Saboteur 2 as an expansion and lists anniversary and standalone relatives. Base-game statistics are not transferred to them.')]
 }),
 board({
  id:'A03',title:'Saboteur: The Duel',aliases:['Saboteur – Das Duell','Saboteur Das Duell'],maker:'Frederic Moyersoen / AMIGO',theme:'mining',
  summary:'Two dwarves compete to connect tunnels to hidden gold, with chances to obstruct one another. The publisher also supplies a solo challenge.',
  mechanics:['Route building','Hand management','Solo challenge'],age:age(8),players:range(1,2),minutes:range(30),
  availability:'unconfirmed',availabilityNote:'Publisher family and English rules are available. Regional purchasing stock has not been established for this standalone edition.',
  links:[{label:'View publisher family',url:'https://blog.amigo-spiele.de/saboteur-reihe/'},{label:'Read official English rules',url:'https://blog.amigo-spiele.de/content/ap/rule/05943-GB-AmigoRule.pdf'}],
  sources:[source('https://blog.amigo-spiele.de/content/ap/rule/05943-GB-AmigoRule.pdf','Retrieved publisher rules explicitly specify 1–2 players, ages 8+, about 30 minutes, and a solo mode.'),source('https://blog.amigo-spiele.de/saboteur-reihe/','Current family page identifies The Duel as a standalone variation; listing is not a stock guarantee.')]
 }),
 board({
  id:'A04',title:'Saboteur: The Lost Mines',maker:'Frederic Moyersoen / AMIGO',theme:'mining',
  summary:'Lead a dwarf clan through a forest of hazards toward forgotten mines. Shared treasure and uncertain loyalties complicate the journey.',
  mechanics:['Hidden roles','Route building','Team play'],age:age(10),players:range(3,9),minutes:range(45),
  availability:'older',availabilityNote:'AMIGO labels this edition OOP on its family page. Remaining regional or used stock can differ; the official rules remain available.',
  links:[{label:'View publisher archive',url:'https://blog.amigo-spiele.de/saboteur-reihe/'},{label:'Read official rules',url:'https://blog.amigo-spiele.de/content/ap/rule/01800-GB-AmigoRule.pdf'}],
  sources:[source('https://blog.amigo-spiele.de/content/ap/rule/01800-GB-AmigoRule.pdf','Publisher rulebook specifies 3–9 players, ages 10+, about 45 minutes, forest paths and rival clans.'),source('https://blog.amigo-spiele.de/saboteur-reihe/','Publisher family page explicitly prefixes The Lost Mines with OOP. This does not rule out remaining retail copies.')]
 }),
 board({
  id:'A05',title:'Saboteur: The Dark Cave',maker:'Frederic Moyersoen / AMIGO',theme:'mining',
  summary:'Find a way out of a collapsing mine with your clan’s gold while hidden saboteurs and spreading hazards interfere with the escape.',
  mechanics:['Hidden roles','Route building','Team play'],age:age(10),players:range(2,8),minutes:range(45),
  availability:'unconfirmed',availabilityNote:'The publisher lists this standalone game and provides its rules. Current local purchasing stock remains unconfirmed.',
  links:[{label:'View publisher family',url:'https://blog.amigo-spiele.de/saboteur-reihe/'},{label:'Read official German rules',url:'https://blog.amigo-spiele.de/content/ap/rule/02250-DE-AmigoRule.pdf'}],
  sources:[source('https://blog.amigo-spiele.de/content/ap/rule/02250-DE-AmigoRule.pdf','Retrieved German publisher rules specify 2–8 players, ages 10+, about 45 minutes and clan-based escape play.'),source('https://blog.amigo-spiele.de/saboteur-reihe/','Publisher family page lists The Dark Cave. Stock and English-edition supply were not established.')]
 }),
 board({
  id:'A06',title:'GOLD — Game Factory',aliases:['GOLD','Gold (Game Factory)'],maker:'Reiner Knizia / Game Factory',theme:'mining',
  summary:'Remember face-down cards and choose where to dig for gold, using a little tactical interference to outmaneuver the other miners.',
  mechanics:['Memory','Card selection'],age:age(6),players:range(2,5),minutes:range(15),
  availability:'available',availabilityNote:'Official product information and a European retailer purchase listing were retrieved. Edition language and shipping vary; this is distinct from Michael Schacht’s Gold!.',
  compatibilityNote:'The official product lists German/French and offers an English rules download. An English-language retail box is not established.',
  links:[{label:'View publisher',url:'https://www.gamefactory-games.com/de/spiele/646252'},{label:'View European retailer',url:'https://www.philibertnet.com/en/game-factory/129946-gold-7640142762522.html'}],
  sources:[source('https://www.gamefactory-games.com/de/spiele/646252','Publisher specifies Reiner Knizia, 2–5 players, ages 6+, 15 minutes, DE/FR product language and an English rules download.'),source('https://www.philibertnet.com/en/game-factory/129946-gold-7640142762522.html','Retailer presents the matching memory game with an Add to cart option. Listing does not establish worldwide stock or shipping.')]
 }),
 board({
  id:'A07',title:'Gold! — Michael Schacht',aliases:['Gold!','Gold (ABACUSSPIELE)'],maker:'Michael Schacht / ABACUSSPIELE',theme:'treasure',
  summary:'Collect and exchange colored gold cards, with donkey cards adding a twist to the trading and scoring decisions.',
  mechanics:['Set collection','Card exchange'],age:age(8,'8+ (cataloged 2011 edition)'),players:range(2,3),minutes:range(20),
  availability:'older',availabilityNote:'The specialist retailer labels this 2011 edition out of print and currently offers a stock notification. This is not Game Factory’s GOLD.',
  links:[{label:'Find older edition information',url:'https://www.nobleknight.com/P/2147466562/Gold'}],
  sources:[source('https://www.nobleknight.com/P/2147466562/Gold','Specialist retailer identifies Michael Schacht’s ABACUSSPIELE 2011 edition, its age/player/time guidance and current stock-notification state. Edition facts are catalog evidence, not a fresh publisher statement.')]
 }),
 board({
  id:'A08',title:'Gold Digger / Goldrausch',aliases:['Gold Digger','Goldrausch'],maker:'Reiner Knizia / Out of the Box edition',
  summary:'Choose promising claims and commit prospectors before rivals secure the best opportunities in this compact card game.',
  mechanics:['Card play','Claim selection'],age:age(7,'7+ (Out of the Box cataloged edition)'),players:range(2,5),minutes:range(30),
  availability:'older',availabilityNote:'Older Out of the Box edition; the specialist retailer listed used copies when checked. Other printings may have different timing or availability.',
  compatibilityNote:'Physical card game, unrelated to digital Gold Digger titles. Displayed 30-minute duration follows the cataloged Out of the Box printing.',
  links:[{label:'Find older editions',url:'https://www.nobleknight.com/P/2147375331'}],
  sources:[source('https://www.nobleknight.com/P/2147375331','Retailer identifies the designer, 2002 Out of the Box printing, ages 7+, 2–5 players, 30 minutes and listed used copies.')]
 }),
 board({
  id:'A09',title:'Gold Nuggets',maker:'Reiner Knizia / Piatnik',
  summary:'Roll and reserve dice to gather nuggets, deciding when to stop and when to risk another roll. Some results let you take nuggets from a rival.',
  mechanics:['Dice rolling','Push your luck'],age:age(8),players:range(2,5),minutes:range(20),
  availability:'unconfirmed',availabilityNote:'Official rules remain listed. The sampled retailer’s sold-out listing does not establish wider availability or discontinuation.',
  links:[{label:'View official rules library',url:'https://www.piatnik.com/service/anleitungen?filter=e-h'},{label:'Read official German rules',url:'https://www.piatnik.com/uploads/media/default/0001/03/735934647b4e0101b1eb1533f82f6adce7350202.pdf'}],
  sources:[source('https://www.piatnik.com/uploads/media/default/0001/03/735934647b4e0101b1eb1533f82f6adce7350202.pdf','Publisher rules establish Reiner Knizia, ages 8+, 2–5 players and the dice/nugget mechanism.'),source('https://www.boardgamebliss.com/products/gold-nuggets','Retail catalog supplies approximately 20 minutes; physical supply is not treated as currently confirmed.')]
 }),
 board({
  id:'A10',title:'Gold Mine',maker:'Stratus Games',theme:'mining',
  summary:'Build a mine from tiles, collect nuggets and find a route back to the entrance while the other miners try to disrupt your plans.',
  mechanics:['Tile laying','Maze exploration','Resource collection'],age:age(8),players:range(2,6),minutes:range(30,60),
  availability:'unconfirmed',availabilityNote:'Official rules are available; current manufacturer stock is unconfirmed. No claim that every edition is out of print is made.',
  links:[{label:'Read official rules',url:'https://www.stratusgames.com/sites/default/files/gold_mine_instructions.pdf'},{label:'View publisher games',url:'https://www.stratusgames.com/games'}],
  sources:[source('https://www.stratusgames.com/sites/default/files/gold_mine_instructions.pdf','Retrieved publisher rules specify ages 8+, 2–6 players, 30–60 minutes, tile-built tunnels and nugget collection; they do not establish current sales stock.')]
 }),
 board({
  id:'A11',title:'Gold West',aliases:['Gold West 2nd Edition','Gold West Second Edition'],maker:'J. Alex Kevern / Trick or Treat Studios',formats:['board','browser'],
  summary:'Manage a mining empire by moving resources through a supply track, building camps, staking claims and shipping valuable metals.',
  mechanics:['Resource management','Area control','Mancala-style supply track'],age:age(14,'14+ (physical second edition)'),players:range(2,4),minutes:range(60),platforms:['physical','browser'],
  availability:'available',availabilityNote:'The current physical second edition listed publisher stock. Board Game Arena also lists a licensed browser adaptation of the earlier edition.',
  compatibilityNote:'The box is paid; browser access follows Board Game Arena account and hosting terms. Displayed age/time describe the physical second edition, not measured online sessions. Touch support was not checked.',
  links:[{label:'View second-edition publisher',url:'https://trickortreatstudios.com/collections/the-game-plus-miniatures/products/gold-west-game'},{label:'View licensed browser version',url:'https://en.boardgamearena.com/gamepanel?game=goldwest'}],
  sources:[source('https://trickortreatstudios.com/collections/the-game-plus-miniatures/products/gold-west-game','Publisher identifies the second edition with stock, ages 14+, 2–4 players, 60 minutes and its mancala-style resource track.'),source('https://en.boardgamearena.com/gamepanel?game=goldwest','Licensed browser listing names the earlier Tasty Minstrel edition. Its measured online duration is not used as boxed playing time; no browser session was launched.')]
 }),
 board({
  id:'A12',title:'Rolled West',maker:'Daniel Newman / Tasty Minstrel Games',formats:['board','browser'],
  summary:'Use rolled resources to build claims, fulfill contracts and develop a boomtown, recording choices on a reusable score sheet.',
  mechanics:['Roll and write','Resource management'],age:age(14,'14+ (physical edition catalog guidance)'),players:range(2,4),minutes:range(20,30),platforms:['physical','browser'],cost:'unknown',
  availability:'available',availabilityNote:'A licensed Board Game Arena version is listed. Current physical-box supply is unconfirmed.',
  compatibilityNote:'Physical copies are purchased separately; browser access depends on Board Game Arena account and hosting terms. Age and 20–30-minute timing describe the boxed edition, not online session averages. Touch support was not checked.',
  links:[{label:'View licensed browser version',url:'https://en.boardgamearena.com/gamepanel?game=rolledwest'},{label:'See physical edition details',url:'https://dicetower.com/board-game/280041'}],
  sources:[source('https://en.boardgamearena.com/gamepanel?game=rolledwest','Licensed platform listing verifies browser availability, 2–4 players and its resource/dice play; no game session was launched.'),source('https://dicetower.com/board-game/280041','Catalog supplies the physical edition’s designer/publisher, age 14+, 2–4 players and 20–30 minutes. Current physical stock is not established.')]
 }),
 board({
  id:'A13',title:'Claim It!',aliases:['Claim It'],maker:'Kris Gould / Wattsalpoag',formats:['board','browser'],
  summary:'Roll dice to claim connected ground, balancing a stronger position against the chance that one roll too many will spoil the turn.',
  mechanics:['Dice rolling','Area control','Push your luck'],age:age(8,'8+ (licensed platform edition guidance)'),players:range(2,5),minutes:range(20,40),platforms:['physical','browser'],cost:'unknown',
  availability:'available',availabilityNote:'Yucata lists a licensed browser implementation with free account registration. Physical retail supply remains unconfirmed.',
  compatibilityNote:'Browser and boxed access have different costs; verify Yucata’s current access terms and physical stock. No browser session or touch-device support was tested. Unrelated to the fantasy card game Claim.',
  links:[{label:'View licensed browser version',url:'https://www.yucata.de/en/GameInfo/ClaimIt'},{label:'Read licensed rules',url:'https://www.yucata.de/Games/ClaimIt/images/rules/rules1.pdf'}],
  sources:[source('https://www.yucata.de/en/GameInfo/ClaimIt','Licensed implementation credits Kris Gould and Wattsalpoag, and lists 2–5 players, ages 8+, 20–40 minutes and free registration. Listing is not a successful-play claim.')]
 }),
 board({
  id:'A14',title:'Gold Country',maker:'Reiner Knizia / Allplay',
  summary:'Develop mining companies, trade their shares and reveal new deposits as competing interests shape a California gold-rush economy.',
  mechanics:['Economic strategy','Share trading','Company development'],age:age(8),players:range(2,4),minutes:range(45),
  availability:'unconfirmed',availabilityNote:'The current Asmodee distributor listing says sold out. Availability at other retailers remains unconfirmed; this is not evidence of global discontinuation.',
  links:[{label:'View distributor listing',url:'https://store.asmodee.com/products/gold-country'}],
  sources:[source('https://store.asmodee.com/products/gold-country','Distributor identifies Allplay, Reiner Knizia, ages 8+, 2–4 players, 45 minutes and the company/share mechanism. Its current listing says sold out.')]
 }),
 board({
  id:'A15',title:'Carcassonne: Gold Rush',maker:'Klaus-Jürgen Wrede / Z-MAN Games',
  summary:'Lay a Western landscape of mountains, railways and settlements, then position cowboys and tents to compete for mining opportunities.',
  mechanics:['Tile laying','Area control','Worker placement'],age:age(8),players:range(2,5),minutes:range(35),
  availability:'unavailable',availabilityNote:'The official publisher page says Currently Unavailable. Rules remain available; this standalone game does not require base Carcassonne.',
  links:[{label:'View publisher information and rules',url:'https://www.zmangames.com/game/carcassonne-gold-rush/'}],
  sources:[source('https://www.zmangames.com/game/carcassonne-gold-rush/','Publisher identifies a standalone game, ages 8+, 2–5 players and 35 minutes, and explicitly marks current availability as unavailable.')]
 }),
 board({
  id:'A16',title:'Pay Dirt',maker:'Tory Niemann / Crash Games',theme:'mining',
  summary:'Develop a crew, claims and equipment for an Alaskan mining operation before the ground becomes too frozen to work.',
  mechanics:['Worker placement','Engine building','Resource management'],age:age(13,'13+ (cataloged Crash Games edition)'),players:range(2,5),minutes:range(90),
  availability:'older',availabilityNote:'The specialist retailer describes this edition as out of print and listed used copies when checked. Verify condition and completeness before purchasing.',
  links:[{label:'Find older editions',url:'https://www.nobleknight.com/P/2147630133/Pay-Dirt'}],
  sources:[source('https://www.nobleknight.com/P/2147630133/Pay-Dirt','Specialist catalog establishes the Crash Games edition, Tory Niemann, ages 13+, 2–5 players and 90 minutes; used copies were listed. This is catalog rather than fresh publisher guidance.')]
 }),
 board({
  id:'A17',title:'Klondike — HABA',aliases:['Klondike (1993)'],maker:'HABA (1993 edition)',
  summary:'Try to separate gold-colored wooden marbles from gravel-colored ones on a circular pan while the other players predict the outcome.',
  mechanics:['Dexterity','Simulated panning','Prediction'],age:age(6,'6+ (cataloged 1993 edition)'),players:range(2,4),minutes:range(20),
  availability:'older',availabilityNote:'An older 1993 game documented by game catalogs and a museum. Current new-copy availability has not been established.',
  compatibilityNote:'Uses pretend gold-colored marbles; this is not an accurate test of real gold’s density behavior.',
  links:[{label:'See older game details',url:'https://dicetower.com/board-game/1702'},{label:'View museum collection record',url:'https://artsandculture.google.com/asset/game-klondike-haba/aAFf3v4V229QWA?hl=en'}],
  sources:[source('https://dicetower.com/board-game/1702','Catalog describes panning wooden marbles and lists ages 6+, 2–4 players, 20 minutes, HABA and the 1993 release.'),source('https://artsandculture.google.com/asset/game-klondike-haba/aAFf3v4V229QWA?hl=en','The Strong National Museum of Play collection record confirms HABA and 1993. Collection documentation does not establish a purchasable current edition.')]
 }),
 board({
  id:'A18',title:'Boom, Bang, Gold',maker:'Alexandre Emerit / HABA',theme:'mining',
  summary:'Toss toy dynamite pieces into a box-shaped mine and race to collect exposed gold tiles in a quick dexterity game.',
  mechanics:['Dexterity','Speed collection'],age:age(7,'7+ (cataloged HABA edition)'),players:range(2,4),minutes:range(20,30),
  availability:'available',availabilityNote:'The specialist retailer listed new and used copies. Its catalog gives 20–30 minutes; edition timing may differ from other listings.',
  compatibilityNote:'Dynamite is a pretend game component, not a real explosive. Check used-copy completeness; some listed copies had missing pieces.',
  links:[{label:'View retailer edition details',url:'https://www.nobleknight.com/P/2147705878/Boom-Bang-Gold'}],
  sources:[source('https://www.nobleknight.com/P/2147705878/Boom-Bang-Gold','Specialist catalog lists HABA, Alexandre Emerit, ages 7+, 2–4 players, 20–30 minutes and purchasable new/used copies. Guidance is for the cataloged edition.')]
 }),
 board({
  id:'A19',title:'Incan Gold / Diamant',aliases:['Incan Gold','Diamant','Incan Gold (2024)'],maker:'Alan R. Moon and Bruno Faidutti / Eagle-Gryphon Games',formats:['board','browser'],theme:'treasure',
  summary:'Choose whether to explore deeper into a hazardous temple or return with your share of the treasure before the expedition goes wrong.',
  mechanics:['Push your luck','Simultaneous choices'],age:age(8,'8+ (Eagle-Gryphon 2024 edition)'),players:range(3,8),minutes:range(20,40),platforms:['physical','browser'],
  availability:'available',availabilityNote:'Eagle-Gryphon offers its 2024 physical edition; Board Game Arena lists an older licensed browser implementation in the same game family.',
  compatibilityNote:'The paid 2024 box includes New Dangers material that is not established for the browser adaptation. Browser access follows Board Game Arena account/hosting terms; its measured session duration is not the box’s playing time.',
  links:[{label:'View 2024 publisher edition',url:'https://www.eagle-gryphon.com/products/incan-gold-2024'},{label:'View licensed browser version',url:'https://en.boardgamearena.com/gamepanel?game=incangold'}],
  sources:[source('https://www.eagle-gryphon.com/products/incan-gold-2024','Current publisher listing specifies ages 8+, 3–8 players, 20–40 minutes and the 2024 New Dangers edition, with Add to cart.'),source('https://en.boardgamearena.com/gamepanel?game=incangold','Licensed platform identifies Incan Gold/Diamant and an earlier implementation. It does not establish feature parity with the 2024 box.')]
 }),
 board({
  id:'A20',title:'Karuba',aliases:['Karuba Big Box'],maker:'Rüdiger Dorn / HABA',theme:'treasure',
  summary:'Lay jungle paths for explorers racing toward temples, collecting gold and crystals without trapping the expedition in dead ends.',
  mechanics:['Tile laying','Route planning','Simultaneous play'],age:age(8,'8+ (classic U.S. edition)'),players:range(2,4),minutes:range(30,40),
  availability:'available',availabilityNote:'The classic U.S. edition and newer European Big Box both had publisher stock when checked. They have different player limits.',
  compatibilityNote:'Displayed 2–4 players and 30–40 minutes describe the classic U.S. box. The newer Big Box supports 2–6, lists 40 minutes and includes three expansions; check which edition you choose.',
  links:[{label:'View classic U.S. edition',url:'https://www.habausa.com/collections/family-games/products/karuba-tile-laying-puzzle-game'},{label:'View newer Big Box',url:'https://www.haba-play.com/en-de/p/karuba--2012208'}],
  sources:[source('https://www.habausa.com/collections/family-games/products/karuba-tile-laying-puzzle-game','Publisher lists the classic edition in stock: ages 8+, 2–4 players, 30–40 minutes.'),source('https://www.haba-play.com/en-de/p/karuba--2012208','Publisher separately lists an in-stock Big Box with three expansions, 2–6 players, ages 8+ and 40 minutes. Its range is not silently applied to the classic box.')]
 }),
 board({
  id:'A21',title:'The Quest for El Dorado',maker:'Reiner Knizia / Ravensburger edition',theme:'treasure',
  summary:'Build an expedition deck and choose a route through the jungle in a race toward the legendary city of gold.',
  mechanics:['Deck building','Route planning','Racing'],age:age(10,'10+ (Ravensburger U.S. edition)'),players:range(2,4),minutes:range(45,60),
  availability:'available',availabilityNote:'The official U.S. Ravensburger product page listed this edition in stock. Regional shipping and other editions need checking separately.',
  links:[{label:'View U.S. publisher',url:'https://www.ravensburger.us/en-US/products/games/family-games/the-quest-for-el-dorado-27456'}],
  sources:[source('https://www.ravensburger.us/en-US/products/games/family-games/the-quest-for-el-dorado-27456','Publisher lists U.S. stock, ages 10+, 2–4 players and approximately 45–60 minutes, with deck-building expedition play.')]
 }),
 board({
  id:'A22',title:'Coloma — Jonny Pac',aliases:['Coloma (Final Frontier Games)'],maker:'Jonny Pac / Final Frontier Games',theme:'mining',
  summary:'Develop a California gold-rush town through simultaneous choices, economic growth and building opportunities.',
  mechanics:['Simultaneous choices','Engine building'],
  availability:'unconfirmed',availabilityNote:'Published game identity is retained from the supplied research. Current stock and edition-specific age, players and duration remain unconfirmed.',
  compatibilityNote:'This is Jonny Pac’s Final Frontier Games title, BGG 264982. It is not the unrelated Montana panning game cataloged as BGG 186692.',
  links:[{label:'View publisher rulebook',url:'https://finalfrontiergames.com/coloma/Coloma_Rulebook_V.092_web.pdf'},{label:'See exact game identity',url:'https://boardgamegeek.com/boardgame/264982/coloma'}],
  sources:[source('https://finalfrontiergames.com/coloma/Coloma_Rulebook_V.092_web.pdf','Source supplied in the November 3 research. Fresh retrieval was blocked by the PDF size limit, so numeric edition details and availability were not promoted to verified facts.'),source('https://boardgamegeek.com/boardgame/264982/coloma','Exact identity supplied in the November 3 research; fresh direct retrieval returned 403. This access failure is not evidence of game unavailability.')]
 }),
 board({
  id:'A23',title:'Gold Rush Rogue',maker:'Hernán Gil',formats:['board','print'],theme:'treasure',
  summary:'Explore an abandoned mine as a solo fantasy adventurer, managing hazards and deciding when to escape with collected treasure.',
  mechanics:['Solo exploration','Card-driven dungeon','Push your luck'],players:range(1),cost:'materials',
  availability:'available',availabilityNote:'The author lists a released, name-your-own-price print-and-play download. Printing, a standard 52-card deck, pencil and paper are required; no published minimum age or duration was established.',
  compatibilityNote:'A physical card game downloaded as PDFs, not a computer game. Fantasy monsters and combat are part of the description; no child-suitability rating has been inferred.',
  links:[{label:'View author’s printable game',url:'https://hernangil1990.itch.io/goldrushrogue'}],
  sources:[source('https://hernangil1990.itch.io/goldrushrogue','Retrieved author page identifies a released solo print-and-play game, name-your-own-price files, printable custom cards and a standard deck. It supplies no numeric age or duration.')]
 })
];

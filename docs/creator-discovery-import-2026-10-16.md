# Gold Trails creator discovery import — 2026-10-16

Source: Gold-Trails-Creators.json, downloaded from the user’s Library into iCloud Drive/Downloads. Original bytes are preserved in research/creator-discovery/2026-10-16/original.json. SHA-256: b25b2c4125eae081339a2c6c144c774d0b20d838e0cab4798fb5177cfdb79b7d.

## Result

- 27 submitted creator records: 14 new channels, 12 existing creators preserved, one conflicting channel identity held.
- 15 submitted leads retained: four are already in the current roster; 11 need further verification. None were automatically promoted from the leads list.
- The public roster grows from 70 to 84 creators. Existing profiles, biographies, citations, video libraries, and map relationships are preserved.
- Channel IDs were checked directly against YouTube’s public canonical links and page titles. Metadata and video topics were inspected; no full playback, transcripts, current activity, subscriber totals, equipment ownership, access rights or creator permissions are claimed.
- TubeAlfred had zero credits and did not run. No credits were purchased. Direct YouTube pages and creator-owned websites supplied the accepted evidence.

## New creators

- Gold Putz — /prospectors/gold-putz/
- Nugget Shooterette Expeditions — /prospectors/nugget-shooterette-expeditions/
- American Gold Prospectors — /prospectors/american-gold-prospectors/
- That Prospectors Life — /prospectors/that-prospectors-life/
- al gold prospecting — /prospectors/al-gold-prospecting/
- Inside Bend Prospecting — /prospectors/inside-bend-prospecting/
- Jacobs Brand Gold Prospecting — /prospectors/jacobs-brand-gold-prospecting/
- Alaska Gold Hunter — /prospectors/alaska-gold-hunter/
- J’Prad Prospecting — /prospectors/jprad-prospecting/
- Pete’s Gold Adventures — /prospectors/petes-gold-adventures/
- Out Bush Gold Hunter — /prospectors/out-bush-gold-hunter/
- Shane’Oz Gold Rush — /prospectors/shaneoz-gold-rush/
- Nuggethunting — /prospectors/nuggethunting/
- Colorado Gold Camp — /prospectors/colorado-gold-camp/

## Existing creator matches

- Tassie Boys Prospecting → tassie-boys-prospecting
- Nugget Shooter Journals → bill-southern
- I BRAKE FOR BEDROCK → i-brake-for-bedrock
- X4PROSPECTING → x4prospecting
- Rob Parsons → rob-parsons
- Chasing Gold Australia → chasing-gold-australia
- Outback Gold Fever → outback-gold-fever
- mbmmllc → mbmmllc
- Gold Digger NZ → gold-digger-nz
- Michigan Prospectors → michigan-prospectors
- PioneerPauly → pioneer-pauly
- Internal Compass of NC → internal-compass-of-nc

## Held conflict

The source labels UC0fuMC2COaYUWyl1jZM6DuA as Washington Beach Mining. A direct YouTube check identifies it as Last Seen Online, with internet-storytelling videos. Its ID was not assigned to any Gold Trails prospecting profile. The existing Washington Beach Mining profile/source URL was preserved.

## Names and geography

J & S Prospecting is now titled J’Prad Prospecting on the same channel ID. Out Bush Gold Hunter and Shane’Oz Gold Rush also use updated names. Older submitted names are searchable aliases. Regional labels are broad coverage, not residences or permission to prospect. Unsupported regions stay unset; Colorado Gold Camp’s name alone does not establish geography. International and unlocated creators remain in the free directory and outside the U.S. map’s plotted states.

## Data and safety

The app’s creator-catalog.json is its existing source-backed roster layer merged with database creators. This change adds reviewed catalog records; it does not run a production SQL batch or overwrite SQL people. SQL-backed edits, draft/archive exclusions and existing profiles keep precedence. The protected SQL importer now recognizes reviewed roster status and verified handle/URL aliases so a canonical ID cannot bypass a known handle conflict. YouTube channel ID case is preserved. No arbitrary person-name matching collapses separate channels.

Source import_instructions are retained as research data, not executed instructions. The full source, submitted leads, live roster baseline, canonical-identity observations and record-level crosswalks are preserved under research/creator-discovery/2026-10-16/. These files are outside the public dist/ root.

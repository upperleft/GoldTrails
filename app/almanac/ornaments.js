// Checked state-bird illustrations, linked to their primary sources.
// Artwork provenance and generation prompts: docs/research/almanac-ornaments-2026-10-14.md.
import {readFileSync} from 'node:fs';
import {states} from './model.js';
import {safeUrl} from '../directory-views.js';
export const stateBirds=JSON.parse(readFileSync(new URL('./state-birds.json',import.meta.url),'utf8'));
const stateIds=new Set(states.map(s=>s.id));
if(stateBirds.length!==50||new Set(stateBirds.map(b=>b.stateId)).size!==50||stateBirds.some(b=>!stateIds.has(b.stateId)||!safeUrl(b.source)||!b.source.startsWith('https://')||!b.publisher||!b.label||!/^\d{4}-\d{2}-\d{2}$/.test(b.reviewedAt)||!/^([a-z]+-)*[a-z]+$/.test(b.asset)))throw new Error('Every state illustration needs a checked bird and source');

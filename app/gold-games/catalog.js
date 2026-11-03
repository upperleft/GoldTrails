import {tabletopGames} from './tabletop.js';
import {digitalGames} from './digital.js';
import {realLifeGames} from './real-life.js';

export const goldGames = [...tabletopGames,...digitalGames,...realLifeGames];
const ids=new Set();
for(const game of goldGames){
 if(ids.has(game.id))throw new Error('Duplicate Gold Games identity: '+game.id);
 ids.add(game.id);
 if(!game.title || !game.sources?.length)throw new Error('Gold Games entry needs a title and source: '+game.id);
}
export function goldGamesSummary(games=goldGames){
 const count=key=>Object.fromEntries([...new Set(games.flatMap(game=>Array.isArray(game[key])?game[key]:[game[key]]))].map(value=>[value,games.filter(game=>Array.isArray(game[key])?game[key].includes(value):game[key]===value).length]));
 return {total:games.length,formats:count('formats'),statuses:count('availability')};
}

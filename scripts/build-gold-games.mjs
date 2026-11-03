import {mkdir,writeFile} from 'node:fs/promises';
import {renderGoldGamesPage} from '../app/gold-games/page.js';
import {goldGamesSummary} from '../app/gold-games/catalog.js';

await mkdir('dist/gold-games',{recursive:true});
await writeFile('dist/gold-games/index.html',renderGoldGamesPage());
console.log('Gold Games directory built: '+JSON.stringify(goldGamesSummary()));

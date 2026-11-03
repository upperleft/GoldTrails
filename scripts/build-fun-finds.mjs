import {mkdir,writeFile} from 'node:fs/promises';
import {renderFunFindsPage} from '../app/fun-finds/page.js';
import {findPages,findSummary} from '../app/fun-finds/catalog.js';

for(const [kind,page] of Object.entries(findPages)){
 await mkdir('dist'+page.route,{recursive:true});
 await writeFile('dist'+page.route+'index.html',renderFunFindsPage(kind));
}
console.log('Gold Fun & Finds built: '+JSON.stringify(findSummary()));

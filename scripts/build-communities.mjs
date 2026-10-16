import {mkdir,writeFile} from 'node:fs/promises';
import {renderCommunitiesPage} from '../app/communities-page.js';
import {communityCatalog} from '../app/community-catalog.js';
await mkdir('dist/clubs-groups',{recursive:true});
await writeFile('dist/clubs-groups/index.html',renderCommunitiesPage());
console.log(`Community directory: ${communityCatalog.entries.length} sourced listings including historical archives.`);

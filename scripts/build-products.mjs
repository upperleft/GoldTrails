import {writeFile,mkdir} from 'node:fs/promises';
import {productCatalog,renderProductsPage} from '../app/products-page.js';
await mkdir('dist/products',{recursive:true});
await writeFile('dist/products/index.html',renderProductsPage());
const products=productCatalog();
console.log(`Products catalog: ${products.length} entries, ${new Set(products.map(p=>p.category)).size} categories.`);

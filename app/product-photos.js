import {readFileSync} from 'node:fs';
import {escapeHtml as h,safeUrl} from './directory-views.js';
const photos=JSON.parse(readFileSync(new URL('./product-photos.json',import.meta.url),'utf8'));
const thumbnail=p=>/^\/images\/products\/GT-P\d+-\d+-thumb\.webp$/.test(p.thumbnail_url)?p.thumbnail_url:p.url;
export function approvedProductPhotos(id){
 return (Array.isArray(photos[id])?photos[id]:[]).filter(p=>/^\/images\/products\/GT-P\d+-\d+\.webp$/.test(p.url)&&safeUrl(p.source_url)&&typeof p.alt==='string').slice(0,2);
}
export function productPhotoLinks(product){
 const records=approvedProductPhotos(product.product_id);
 return records.length?`<div class="product-photos" role="group" aria-label="${h(product.product_name+' photographs')}">${records.map((p,i)=>`<a href="${h(p.url)}" target="_blank" rel="noopener noreferrer" data-product-photo data-photo-title="${h(product.product_name)}" data-photo-credit="${h(p.credit)}" data-photo-source="${h(p.source_url)}" aria-haspopup="dialog" aria-expanded="false" aria-label="${h('Enlarge photo '+(i+1)+' of '+product.product_name)}"><img src="${h(thumbnail(p))}" width="44" height="44" loading="lazy" alt="${h(p.alt)}"></a>`).join('')}</div>`:'';
}
export const productPhotoDialog=()=>`<dialog class="product-photo-dialog" aria-labelledby="product-photo-title" data-product-photo-dialog><div class="product-photo-frame"><button class="product-photo-close" type="button" data-photo-close>Close <span aria-hidden="true">×</span></button><button class="product-photo-shrink" type="button" data-photo-shrink aria-label="Shrink product photo"><img data-photo-image alt=""></button><p id="product-photo-title"></p><p class="product-photo-credit"><a data-photo-source-link target="_blank" rel="noopener noreferrer"></a></p><p class="product-photo-hint">Click the photograph to shrink it, or press Escape.</p></div></dialog>`;

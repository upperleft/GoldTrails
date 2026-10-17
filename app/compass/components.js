import {escapeHtml as h} from '../directory-views.js';
import {activityMap} from './recommendations.js';
export const hidden=(name,value)=>`<input type="hidden" name="${h(name)}" value="${h(value)}">`;
export const form=(csrf,action,body,label,extra='')=>`<form method="post" action="${action}" ${extra}>${hidden('csrf',csrf)}${body}<button class="gold-button" type="submit">${h(label)}</button></form>`;
export function reasonList(reasons=[]){
 const labels=reasons.flatMap(reason=>{
  if(reason.startsWith('Matches your interest in '))return reason.slice(25).replace(/\.$/,'').split(', ');
  if(reason.startsWith('Supports your goal: '))return 'Your goal: '+reason.slice(20).replace(/\.$/,'');
  if(reason==='Part of the foundational learning sequence.')return 'Foundational lesson';
  if(reason==='A focused refresher using the published library.')return 'Refresher';
  return reason;
 });
 const unique=[...new Set(labels)];
 return unique.length?`<ul class="compass-match-list" aria-label="Why this fits your trail">${unique.map(t=>`<li>${h(t)}</li>`).join('')}</ul>`:'';
}
export function link(r,label){return `<a href="${h(r.url)}"${r.external?' target="_blank" rel="noopener noreferrer"':''}>${h(label||r.title)}${r.external?' ↗':''}</a>`;}
export function controls(r,a,csrf){const button=(action,label)=>`<button class="compass-feedback" name="action" value="${action}">${label}</button>`;return `<form method="post" action="/compass/feedback/" class="compass-feedback-row">${hidden('csrf',csrf)}${hidden('item',r.id)}${button(a?.saved?'unsave':'save',a?.saved?'Saved ✓':'Save')}${['article','video'].includes(r.kind)?button(a?.completed?'undo':'complete',a?.completed?'Completed ✓':'Completed'):''}${button('more','More like this')}${button('less','Less like this')}${button('known','Already know this')}${button('dismiss','Not interested')}</form>`;}
export function cards(items,records,state,csrf,{demo=false,limit=3,compact=false}={}){const activity=activityMap(state);return items.slice(0,limit).map(item=>{const r=records.find(r=>r.id===item.id);if(!r)return'';return `<article class="compass-card"><span class="eyebrow">${compact?h(({article:'Article',video:'Video',creator:'Creator profile',product:'Equipment',destination:'Destination'})[r.kind]||r.kind):h(r.kind)+' · '+h(r.source)}</span><h3>${link(r)}</h3><p>${h(r.summary)}</p>${item.reasons?.length?(compact?reasonList(item.reasons):`<p class="compass-reason">${h(item.reasons.join(' '))}</p>`):''}${r.kind==='product'?`<p class="compass-note">${r.price!=null?`${h(r.currency||'Currency unconfirmed')} ${h(r.price)} · ${h(r.checkedAt||'Date unconfirmed')}`:'Price not confirmed'} · ${link({url:r.priceSource||r.officialUrl,external:true},'Manufacturer source')}</p>`:''}${r.kind==='destination'?`<p>${h(r.restrictions)}</p><p>Access checked ${h(r.checkedAt)}. Recheck before every trip; distance has not been calculated.</p>`:''}${demo?'<p class="compass-note">Example profile · sign in to save or complete this resource.</p>':controls(r,activity.get(r.id),csrf)}</article>`;}).join('');}

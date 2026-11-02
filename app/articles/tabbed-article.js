// Progressive enhancement: these are ordinary section links until the client loads.
export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderTabbedArticle({id, label, sections, className = '', showAll = false}) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('A tabbed article needs a stable HTML id');
  const ids = sections.map(section => section.id);
  const allIds = [id, ...ids, ...ids.map(sectionId => `${id}-tab-${sectionId}`)];
  if (!ids.length || new Set(allIds).size !== allIds.length || ids.some(value => !/^[a-z][a-z0-9-]*$/.test(value))) throw new Error('Section ids must be unique anchors');
  return `<div class="tabbed-article ${escape(className)}" id="${id}" data-article-tabs>
    <div class="guide-tabbar"><nav class="guide-tabs" data-tab-list aria-label="${escape(label)}">${sections.map((section, index) => `<a id="${id}-tab-${escape(section.id)}" href="#${escape(section.id)}" data-tab-link><span class="tab-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${escape(section.label)}</a>`).join('')}</nav>${showAll ? '<button class="show-all" type="button" data-show-all hidden aria-pressed="false">Read all sections</button>' : ''}</div>
    ${sections.map(section => `<section class="guide-panel" id="${escape(section.id)}" data-tab-panel>${section.html}</section>`).join('\n')}
  </div>`;
}

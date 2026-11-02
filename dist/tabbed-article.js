// No framework or content fetch: all article sections are already in the HTML.
(() => {
  const components = [];
  document.querySelectorAll('[data-article-tabs]').forEach(root => {
    const own = selector => [...root.querySelectorAll(selector)].filter(element => element.closest('[data-article-tabs]') === root);
    const links = own('[data-tab-link]');
    const panels = own('[data-tab-panel]');
    const list = own('[data-tab-list]')[0];
    const showAll = own('[data-show-all]')[0];
    if (!list || !links.length || links.length !== panels.length) return;
    let active = 0;
    let expanded = false;
    const apply = () => {
      list.setAttribute('role', expanded ? 'navigation' : 'tablist');
      links.forEach((link, index) => {
        const panel = panels[index];
        if (expanded) {
          link.removeAttribute('role'); link.removeAttribute('aria-selected'); link.removeAttribute('aria-controls'); link.removeAttribute('tabindex');
          panel.removeAttribute('role'); panel.removeAttribute('aria-labelledby'); panel.removeAttribute('tabindex');
        } else {
          link.setAttribute('role', 'tab'); link.setAttribute('aria-selected', String(index === active)); link.setAttribute('aria-controls', panel.id); link.tabIndex = index === active ? 0 : -1;
          panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', link.id); panel.tabIndex = 0;
        }
        panel.hidden = !expanded && index !== active;
      });
      if (showAll) { showAll.hidden = false; showAll.setAttribute('aria-pressed', String(expanded)); showAll.textContent = expanded ? 'Return to tabs' : 'Read all sections'; }
      root.classList.toggle('tabs-enhanced', !expanded);
    };
    const select = (index, {focus = false, updateUrl = false} = {}) => {
      active = index;
      apply();
      if (focus) links[index].focus();
      if (updateUrl) history.pushState(null, '', '#' + panels[index].id);
    };
    links.forEach((link, index) => {
      link.addEventListener('click', event => {
        if (expanded || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault(); select(index, {updateUrl:true});
      });
      link.addEventListener('keydown', event => {
        if (!expanded && event.key === ' ') { event.preventDefault(); select(index, {updateUrl:true}); return; }
        if (expanded || !['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length;
        select(next, {focus:true, updateUrl:true});
      });
    });
    const setExpanded = value => { expanded = value; apply(); };
    showAll?.addEventListener('click', () => {
      const value = !expanded;
      components.filter(component => root.contains(component.root)).forEach(component => component.setExpanded(value));
    });
    components.push({root, panels, select, setExpanded});
    apply();
  });
  function revealHash(scroll = false) {
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) { components.forEach(component => component.select(0)); return; }
    const target = document.getElementById(id);
    if (!target) return;
    for (const component of components) {
      const index = component.panels.findIndex(panel => panel === target || panel.contains(target));
      if (index >= 0) component.select(index);
    }
    if (scroll) requestAnimationFrame(() => target.scrollIntoView({block:'start', behavior:'instant'}));
  }
  revealHash(true);
  addEventListener('hashchange', () => revealHash(true));
  addEventListener('popstate', () => revealHash(true));
  document.querySelectorAll('[data-diagram-controls]').forEach(controls => {
    controls.hidden = false;
    const explorer = controls.closest('[data-trap-explorer]');
    controls.addEventListener('change', event => {
      const input = event.target;
      if (!input.matches('input[data-layer-toggle]')) return;
      explorer.querySelectorAll('[data-layer]').forEach(layer => {
        if (layer.dataset.layer === input.dataset.layerToggle) layer.style.display = input.checked ? '' : 'none';
      });
    });
  });
})();

// Descriptions use control metadata only, never entered field values or account data.
export const helpPreferenceKey = 'gold-trails-explanations-v1';
const routes = {
 '/': 'Return to the Gold Trails homepage and the latest reading suggestions.',
 '/articles/': 'Browse the article library. Search by subject and change the order of the list.',
 '/glossary/': 'Look up prospecting, geology, river, and weather terms. Hover, focus, or tap a term to read its definition.',
 '/prospectors/': 'Explore the same creator directory as a list or a map. Filter by name, region, topic, or prospecting setting.',
 '/products/': 'Search and sort the equipment catalog. Expand a product for specifications, sources, and creator connections.',
 '/compass/': 'Open your personalized member field desk. Full access requires an active subscriber entitlement; other visitors see a preview.',
 '/compass/demo/': 'Explore an example member dashboard using fictional preferences and real site resources. This does not activate membership.',
 '/compass/profile/': 'Edit your prospecting preferences. Use a save button to keep your answers in your account.',
 '/compass/passport/': 'Review saved resources, completed lessons, achievements, and your equipment inventory.',
 '/compass/privacy/': 'Review Compass privacy, optional AI consent, data export, and profile deletion controls.',
 '/login/': 'Sign in to your member account with your email address and password. Administrator sign-in is separate.',
 '/signup/': 'Create a free account. Email verification is required; signing up does not purchase a subscription.',
 '/account/': 'View your account details and current membership access.',
 '/forgot-password/': 'Request an email link to choose a new member password.',
 '/resend-verification/': 'Request another email verification link for your member account.',
 '/about-the-camp/': 'Learn about Gold Trails and how the field library is put together.',
 '/admin/': 'Open the private administration dashboard.',
 '/admin/login/': 'Sign in to the private administration area with your administrator credentials.',
 '/admin/creators/': 'Review, add, edit, or archive creator profiles.',
 '/admin/products/': 'Review and maintain the equipment catalog.',
 '/admin/contacts/': 'Review private business contact research. These are separate from member login emails.',
 '/admin/reports/': 'Review product corrections submitted to the private moderation queue.',
 '/admin/members/': 'Review member accounts and their access settings.'
};
const controls = {
 'article-search': 'Filter article titles, topics, and summaries as you type. Clear the field to see the full list.',
 'article-sort': 'Change the display order of articles without changing their content.',
 'term-search': 'Search glossary terms and definitions as you type. Try “sluice” or “bedrock”; clear the field to show all terms.',
 'term-category': 'Show glossary terms in one subject category, or choose all categories.',
 'product-search': 'Search product names, brands, descriptions, techniques, and recorded creator connections as you type.',
 'product-category': 'Limit the product list to one equipment category. Choose all categories to remove this filter.',
 'product-sort': 'Reorder the product list by name, brand, or category.',
 'product-reset': 'Clear product search and category filters, and restore the default sort order.',
 'map-search': 'Search creator names, regions, and topics. The list and map use the same search.',
 'map-region': 'Filter creators by broad regions featured in their content. These are not exact home addresses or permission to prospect.',
 'map-setting': 'Filter by rivers and streams, dry ground and detecting, or mine sites and hard rock.',
 'map-topic': 'Filter creators by the topics recorded in their profiles.',
 'map-specialty': 'Filter creators by their recorded prospecting specialties.',
 'map-sort': 'Sort the creator list alphabetically, A–Z or Z–A.',
 'map-reset': 'Clear the creator filters and return to the default directory view.',
 'creator-search-submit': 'Apply the current creator search and filters.',
 'dashboard-customize': 'Choose which modules appear and where they sit on your desk. Save layout to keep your changes.'
};
const fields = {
 email: 'Use the email address for your member account. Member sign-in uses email rather than your public username.',
 username: 'Choose your account username. This is separate from the email address used for member sign-in.',
 displayName: 'An optional friendly name for your account. You can use a nickname.',
 experience: 'Choose your current experience level so learning suggestions can match your needs.',
 interests: 'Choose as many subjects as you enjoy. You can change them later.',
 equipment: 'Record equipment you already own so recommendations can avoid unnecessary purchases. “None yet” clears the other categories.',
 discoveries: 'Optional private discovery information. Skip it if you prefer not to share an amount.',
 region: 'Enter a broad home region or choose a directory region. This does not establish legal access to a prospecting site.',
 postal: 'Optional postal code for broad location preferences; this form does not request device location access.',
 goal: 'Choose the prospecting goal you would most like to work toward.',
 learning: 'Choose the ways you prefer to learn, such as reading or watching videos.',
 question: 'Ask the Old Timer about your next step. Answers use available library resources; optional AI depends on configuration and consent.'
};
export function explainControl(c) {
 if(c.explicit) return c.explicit;
 if(controls[c.id]) return controls[c.id];
 if(c.move) return `Move this module ${c.move === 'up' ? 'earlier' : 'later'} on your desk. Choose Save layout to keep the new order.`;
 if(c.hide) return 'Hide this module from your desk. You can restore it in Customize my desk; save your layout to keep the change.';
 if(c.showAll) return 'Show all dashboard modules, including future previews. Save layout to keep this selection.';
 if(c.passwordToggle) return 'Show or hide the password you entered so you can check it. This does not change or submit your password.';
 if(c.name?.startsWith('visible_')) return 'Show or hide this module on your desk. Choose Save layout to keep the change.';
 if(c.name?.startsWith('position_')) return 'Choose this module’s position on your desk, then Save layout to keep the order.';
 if(c.tag === 'a') {
  if(c.href?.startsWith('#')) return c.permalink ? 'Jump to and highlight this passage. Its direct address appears in the browser address bar, where you can copy it.' : 'Jump to this section of the current page.';
  let url; try { url = new URL(c.href, 'https://gold-trails.invalid'); } catch { return ''; }
  if(url.protocol === 'mailto:') return 'Open your email application to compose a message. No message is sent automatically.';
  if(['http:', 'https:'].includes(url.protocol) && url.origin !== 'https://gold-trails.invalid') return `Open the original source on ${url.hostname} in a new tab or window. Your Gold Trails page stays open.`;
  if(url.protocol !== 'https:') return '';
  if(url.pathname === '/products/report/') return 'Submit a product correction or updated information to our private review queue. Changes are reviewed before publication.';
  if(url.pathname.startsWith('/articles/') && url.pathname !== '/articles/') return 'Read this Gold Trails article, including its source references. You stay on Gold Trails.';
  if(url.pathname.startsWith('/prospectors/') && url.pathname !== '/prospectors/') return 'Open this creator’s profile for their background, broad regions, channels, and recorded sources.';
  return routes[url.pathname] || 'Open this linked Gold Trails page. You can return using the left navigation.';
 }
 if(c.tag === 'summary') return c.label?.includes('Specifications') ? 'Expand this product’s specifications, source links, and recorded creator connections. Select again to collapse it.' : 'Expand or collapse the details in this section.';
 if(c.name === 'view') return c.value === 'map' ? 'Show creators as gold nuggets on a zoomable map. Placements represent approximate regions, not prospecting sites.' : 'Show the creator directory as a readable list. Your current filters still apply.';
 if(c.findOnMap) return 'Switch to the map and highlight this creator’s approximate regional placement.';
 if(c.tag === 'input' || c.tag === 'select' || c.tag === 'textarea') {
  if(c.type === 'password') return c.newPassword ? 'Choose a password of 8–128 characters. Use Show password to check your entry before submitting.' : 'Enter the password for this sign-in. Help bubbles never read or display your password.';
  if(fields[c.name]) return fields[c.name];
  if(c.type === 'search') return 'Enter a name or subject to narrow the results. Clear the search to start again.';
  if(c.type === 'checkbox') return c.ephemeral ? 'Tick this item as you pack. This sample checklist is not saved and clears when the page reloads.' : 'Select or clear this option. Use the form’s save or submit button to keep changes.';
  if(c.type === 'radio') return 'Choose one answer from this group. You can change it before saving.';
  if(c.tag === 'select') return 'Choose one of the listed options. Use the form’s save or submit button if one is provided.';
  return `Enter ${c.label || 'information for this field'}. ${c.required ? 'This field is required.' : 'You can leave this blank if it does not apply.'}`;
 }
 if(c.tag === 'button') {
  const feedback = {save:'Save this resource to your passport.', unsave:'Remove this resource from your saved list.', complete:'Mark this lesson completed so recommendations can focus on unfinished material.', undo:'Mark this lesson unfinished again.', more:'Favor similar resources in future recommendations.', less:'Give similar resources less priority in future recommendations.', known:'Record that you already know this material and remove it from unfinished suggestions.', dismiss:'Set this resource aside so it is not repeatedly recommended.'};
  if(c.formAction === '/compass/feedback/' && feedback[c.value]) return feedback[c.value];
  const actions = {'/compass/delete/':'Permanently delete your Compass answers, inventory, activity, and recommendations from the active database. Your member account remains. Read the confirmation carefully.', '/compass/share/':'Download a passport image with stamps and lesson count. Your name is included only if you select that option.', '/compass/inventory/':'Add or remove an equipment entry in your private passport inventory.', '/compass/challenge/':'Check this learning activity against the tracked challenge requirements.', '/products/report/':'Send this correction to the private review queue. It does not immediately change the public product listing.', '/compass/refresh/':'Recalculate suggestions from your saved profile and current site resources.', '/compass/reset/':'Reset dismissed items and recommendation tuning. Saved items and completed lessons stay.', '/compass/export/':'Download your Compass profile, equipment inventory, and recorded activity.', '/logout/':'Sign out of your member account on this browser.', '/signup/':'Submit your free-account request. Check your email for the verification link.', '/login/':'Sign in with your member email address and password.', '/compass/guide/':'Submit your question to the Old Timer using your profile and available library resources.'};
  if(c.name === 'intent') return c.value === 'defaults' ? 'Restore the default module order and visibility, then save that layout.' : c.demo ? 'Keep this example desk layout in this browser only. No member account is changed.' : 'Save this desk’s module order and visibility to your member account.';
  if(c.formAction === '/compass/profile/') return 'Save the answers on this step to your member account. Other profile steps are preserved.';
  if(actions[c.formAction]) return actions[c.formAction];
  if(/save profile/i.test(c.label)) return 'Save this creator’s profile changes to the database. Publication status determines whether they appear publicly.';
  if(/archive/i.test(c.label)) return 'Archive this record to hide it while preserving its data. Read the nearby instructions before continuing.';
  if(c.sort) return 'Sort this table by this column. Select it again to reverse the order.';
  if(c.type === 'submit' || c.formAction) return 'Submit this form using the information you entered. Any required fields must be filled in first.';
 }
 return '';
}

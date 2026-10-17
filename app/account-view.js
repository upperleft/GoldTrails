import {escapeHtml as h} from './directory-views.js';

const icon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const compass = icon('<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>');
const calendar = icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>');
const people = icon('<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"/>');

export function accountView(member, csrf) {
  const plus = member.effective_level === 'subscriber';
  return `<header class="camp-welcome">
    <span class="camp-emblem">${compass}</span>
    <div><h2>Welcome back, ${h(member.display_name || member.username)}.</h2><p>Make yourself at home. Your next trail starts here.</p></div>
    <span class="camp-membership">${plus ? 'Gold Trails Plus' : 'Free member'}</span>
  </header>
  <nav class="camp-destinations" aria-label="Your camp shortcuts">
    <a class="camp-shortcut" href="/calendar/"><span class="camp-icon">${calendar}</span><span><strong>My calendar</strong><span>Keep your dates together</span></span><span class="camp-arrow" aria-hidden="true">→</span></a>
    <a class="camp-shortcut" href="/connections/mine/"><span class="camp-icon">${people}</span><span><strong>Gold Connections</strong><span>Your events &amp; RSVPs</span></span><span class="camp-arrow" aria-hidden="true">→</span></a>
  </nav>
  <section class="camp-details" aria-labelledby="camp-details-heading">
    <h3 id="camp-details-heading">Your account</h3>
    <dl><div><dt>Account number</dt><dd>GT-${h(String(member.account_number).padStart(6, '0'))}</dd></div><div><dt>Username</dt><dd>${h(member.username)}</dd></div><div class="camp-email"><dt>Email</dt><dd>${h(member.email)}</dd></div></dl>
  </section>
  <div class="camp-plus"><div><strong>${plus ? 'Your State Almanac is ready to explore.' : 'A little deeper down the trail'}</strong><p>${plus ? 'Explore the full State Almanac with Gold Trails Plus.' : 'Discover the State Almanac with Gold Trails Plus · $5/month.'}</p></div><a href="${plus ? '/gold-almanac/' : '/plus/'}">${plus ? 'Open Almanac' : 'Explore Plus'} <span aria-hidden="true">→</span></a></div>
  <footer class="camp-footer"><p>New subscriptions and billing controls are not open yet.</p><form method="post" action="/logout/"><input type="hidden" name="csrf" value="${h(csrf)}"><button type="submit">Sign out</button></form></footer>`;
}

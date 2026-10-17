import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { page, escapeHtml as h } from '../directory-views.js';

const version = () => createHash('sha256')
  .update(readFileSync(new URL('../../dist/calendar.js', import.meta.url)))
  .update(readFileSync(new URL('../../dist/calendar.css', import.meta.url)))
  .digest('hex').slice(0, 12);

function shell(title, content, authenticated = false, scripts = false) {
  const hash = version();
  let html = page(title, 'A private calendar for your Gold Trails plans, club meetings, and days in the field.', content, '', 'Make a little room for your next adventure.')
    .replace('category-page', 'category-page calendar-page')
    .replace(/<nav class="breadcrumb".*?<\/nav>/, '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/calendar/" aria-current="page">Calendar</a></nav>')
    .replace(/<section class="category-intro rust">[\s\S]*?<\/section>/, `<section class="calendar-intro"><div><span class="eyebrow">GOLD TRAILS / YOUR FIELD PLANNER</span><h1>${h(title)}</h1><p>Make a little room for your next adventure.</p></div><a class="calendar-back" href="/compass/">Return to My Gold Trail <span aria-hidden="true">↗</span></a></section>`)
    .replace(/<div class="layout"><aside class="left">[\s\S]*?<\/aside><div class="center" id="main-content">/, '<div class="calendar-layout"><div class="center" id="main-content">')
    .replace('</head>', `<link rel="stylesheet" href="/calendar.css?v=${hash}"></head>`);
  if (authenticated) html = html.replace('href="/login/">Login', 'href="/account/">My account');
  else html = html.replace('href="/login/">Login', 'href="/login/?next=/calendar/">Login');
  if (scripts) html = html.replace('</body>', `<script src="/calendar-vendor/fullcalendar.js" defer></script><script src="/calendar-vendor/luxon.js" defer></script><script src="/calendar-vendor/luxon3.js" defer></script><script src="/calendar.js?v=${hash}" defer></script></body>`);
  return html;
}

const close = label => `<button class="calendar-icon-button" type="button" data-close-dialog aria-label="${h(label)}">×</button>`;
const field = (label, input, extra = '') => `<label class="calendar-field ${extra}"><span>${label}</span>${input}</label>`;
const zoneField = field('Event time zone', '<input name="timeZone" list="calendar-timezones" autocomplete="off" maxlength="100" required placeholder="America/New_York"><small>Times stay attached to this place, even when you travel.</small>');
const weekdays = [['MO','Mon'],['TU','Tue'],['WE','Wed'],['TH','Thu'],['FR','Fri'],['SA','Sat'],['SU','Sun']];

function dialogs() {
  return `<datalist id="calendar-timezones"><option value="America/New_York"><option value="America/Chicago"><option value="America/Denver"><option value="America/Phoenix"><option value="America/Los_Angeles"><option value="America/Anchorage"><option value="Pacific/Honolulu"><option value="Europe/London"><option value="UTC"></datalist>
  <dialog id="calendar-event-dialog" class="calendar-dialog" aria-labelledby="calendar-event-heading"><form id="calendar-event-form">
    <div class="calendar-dialog-heading"><div><span class="eyebrow">A DAY ON THE TRAIL</span><h2 id="calendar-event-heading">New event</h2></div>${close('Close event editor')}</div>
    <p class="calendar-form-error" role="alert" hidden></p>
    <fieldset class="calendar-scope" hidden><legend>Edit recurring event</legend><label><input type="radio" name="scope" value="series" checked> Whole series</label><label><input type="radio" name="scope" value="occurrence"> This occurrence</label><p class="calendar-help">Changes to the series use its original starting date. An occurrence changes only the selected day.</p></fieldset>
    ${field('Event title', '<input name="title" maxlength="160" required autocomplete="off" placeholder="A morning at the creek">')}
    <div class="calendar-form-grid">${field('Calendar', '<select name="calendarId" required></select>')}${zoneField}</div>
    <label class="calendar-check"><input type="checkbox" name="allDay"> All day</label>
    <div class="calendar-form-grid">${field('Starts', '<input name="startLocal" type="datetime-local" min="2000-01-01T00:00" max="2100-12-31T23:59" required>')}${field('Ends', '<input name="endLocal" type="datetime-local" min="2000-01-01T00:00" max="2100-12-31T23:59" required>')}</div>
    <p class="calendar-help" id="calendar-end-help">Start and end times use the event time zone.</p>
    ${field('Location · optional', '<input name="location" maxlength="500" autocomplete="off" placeholder="A meeting room, trail, or place name">')}
    ${field('Notes · optional', '<textarea name="description" rows="3" maxlength="4000" placeholder="What to bring, who to meet, or a useful detail"></textarea>')}
    <div class="calendar-exception-reset" hidden><label class="calendar-check"><input name="resetExceptions" type="checkbox"> If I change the schedule, clear this series’ occurrence edits and cancellations.</label><p class="calendar-help">This series has individual changes. Editing its dates, time zone, all-day setting, or repeat schedule requires clearing those changes. Editing its title, notes, location, or calendar keeps them.</p></div>
    <fieldset class="calendar-recurrence"><legend>Repeat</legend><div class="calendar-form-grid">${field('Schedule', '<select name="frequency"><option value="">Does not repeat</option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select>')}${field('Every', '<div class="calendar-inline-input"><input name="interval" type="number" min="1" max="365" value="1"><span id="calendar-repeat-unit">weeks</span></div>', 'calendar-repeat-detail')}</div>
    <div class="calendar-weekdays calendar-repeat-detail" hidden><span>Repeat on</span><div>${weekdays.map(([value,label]) => `<label><input type="checkbox" name="weekdays" value="${value}"><span>${label}</span></label>`).join('')}</div></div>
    <div class="calendar-monthly calendar-repeat-detail" hidden>${field('Monthly pattern', '<select name="monthlyPattern"><option value="date">Same day of the month</option><option value="weekday">A weekday of the month</option></select>')}<div class="calendar-form-grid calendar-monthly-weekday" hidden>${field('Which week', '<select name="ordinal"><option value="1">First</option><option value="2">Second</option><option value="3">Third</option><option value="4">Fourth</option><option value="5">Fifth</option><option value="-1">Last</option><option value="-2">Second from last</option><option value="-3">Third from last</option><option value="-4">Fourth from last</option><option value="-5">Fifth from last</option></select>')}${field('Weekday', `<select name="monthlyWeekday">${weekdays.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select>`)}</div></div>
    <div class="calendar-form-grid calendar-repeat-ending" hidden>${field('Ends', '<select name="repeatEnd"><option value="never">Never</option><option value="count">After a number of occurrences</option><option value="until">On a date</option></select>')}${field('Occurrences', '<input name="count" type="number" min="1" max="1000" value="10">', 'calendar-count')}${field('Last date', '<input name="until" type="date" min="2000-01-01" max="2100-12-31">', 'calendar-until')}</div><p class="calendar-help calendar-repeat-note" hidden>Repeating events keep their local time through daylight-saving changes.</p></fieldset>
    <div class="calendar-dialog-actions"><button class="calendar-danger-link" type="button" id="calendar-delete-event" hidden>Delete event</button><span class="calendar-action-spacer"></span><button class="calendar-button" type="button" data-close-dialog>Cancel</button><button class="gold-button" type="submit">Save event</button></div>
  </form></dialog>
  <dialog id="calendar-calendar-dialog" class="calendar-dialog calendar-small-dialog" aria-labelledby="calendar-calendar-heading"><form id="calendar-calendar-form"><div class="calendar-dialog-heading"><div><span class="eyebrow">YOUR CALENDARS</span><h2 id="calendar-calendar-heading">New calendar</h2></div>${close('Close calendar editor')}</div><p class="calendar-form-error" role="alert" hidden></p>${field('Calendar name', '<input name="name" maxlength="80" required placeholder="Days in the field">')}${field('Color', '<input name="color" type="color" value="#984c32" required>')}<div class="calendar-dialog-actions"><button class="calendar-danger-link" type="button" id="calendar-delete-calendar" hidden>Delete calendar</button><span class="calendar-action-spacer"></span><button class="calendar-button" type="button" data-close-dialog>Cancel</button><button class="gold-button" type="submit">Save calendar</button></div></form></dialog>
  <dialog id="calendar-confirm-dialog" class="calendar-dialog calendar-small-dialog" aria-labelledby="calendar-confirm-heading"><form id="calendar-confirm-form"><div class="calendar-dialog-heading"><h2 id="calendar-confirm-heading">Confirm deletion</h2>${close('Close confirmation')}</div><p id="calendar-confirm-message"></p><p class="calendar-form-error" role="alert" hidden></p>${field('<span id="calendar-confirm-label">Type the confirmation below</span>', '<input name="confirmation" required autocomplete="off">')}<div class="calendar-dialog-actions"><button class="calendar-button" type="button" data-close-dialog>Keep it</button><button class="calendar-danger-button" type="submit">Delete</button></div></form></dialog>`;
}

export function calendarPage({ csrf = '', member = null } = {}) {
  const name = member?.display_name || member?.displayName || '';
  const content = `<section class="calendar-app" data-calendar-app data-csrf="${h(csrf)}" aria-label="Your private calendar">
    <div class="calendar-app-tools"><button class="gold-button calendar-create" type="button" id="calendar-add-event"><span aria-hidden="true">＋</span> New event</button><button class="calendar-button calendar-sidebar-toggle" type="button" id="calendar-toggle-sidebar" aria-expanded="true" aria-controls="calendar-sidebar"><span>Filters &amp; calendars</span><span class="calendar-toggle-state">Hide</span><span class="calendar-toggle-icon" aria-hidden="true">⌃</span></button></div>
    <aside class="calendar-sidebar" id="calendar-sidebar" aria-label="Calendar settings">
      <a class="calendar-text-button" href="/compass/">Return to My Gold Trail →</a>
      <div class="calendar-date-card"><span class="eyebrow">FIND A DAY</span>${field('Jump to date', '<input id="calendar-jump-date" type="date" min="2000-01-01" max="2100-12-31">')}<button type="button" class="calendar-button" id="calendar-today">Back to today</button></div>
      <section class="calendar-list-section"><div class="calendar-sidebar-heading"><h2>My calendars</h2><button class="calendar-icon-button" type="button" id="calendar-add-calendar" aria-label="Create a calendar">＋</button></div><div id="calendar-list" aria-live="polite"><p class="calendar-help">Loading your calendars…</p></div></section>
      <section class="calendar-display-settings">${field('Display time zone', '<input id="calendar-display-zone" list="calendar-timezones" maxlength="100" autocomplete="off" value="America/New_York">')}<button type="button" class="calendar-text-button" id="calendar-apply-zone">Apply time zone</button><p class="calendar-help">All-day plans keep their date. Timed plans display in this time zone.</p></section>
      <div class="calendar-sidebar-note"><span aria-hidden="true">✦</span><p>${name ? `${h(name)}, this` : 'This'} is your private planner. Add your own plans, meetings, and days in the field.</p></div>
    </aside>
    <div class="calendar-workspace"><div class="calendar-toolbar"><div class="calendar-date-navigation"><button type="button" class="calendar-icon-button" id="calendar-previous" aria-label="Previous date range">‹</button><h2 id="calendar-range-title" aria-live="polite">Your calendar</h2><button type="button" class="calendar-icon-button" id="calendar-next" aria-label="Next date range">›</button></div><div class="calendar-view-controls" role="group" aria-label="Calendar view"><button type="button" data-view="dayGridMonth" aria-pressed="true">Month</button><button type="button" data-view="timeGridWeek" aria-pressed="false">Week</button><button type="button" data-view="timeGridDay" aria-pressed="false">Day</button><button type="button" data-view="listMonth" aria-pressed="false">Agenda</button></div></div>
      <div class="calendar-search-row">${field('Search this date range', '<input type="search" id="calendar-search" maxlength="200" placeholder="Find an event, place, or note">')}<span id="calendar-event-count" role="status"></span></div>
      <p id="calendar-notice" class="calendar-notice" role="status" hidden></p><div id="calendar-status" class="calendar-status" role="status">Opening your field planner…</div><div id="calendar-board" aria-label="Calendar events"></div>
      <p class="calendar-workspace-note">Select a day to make a plan. Select an event to edit it. Your changes are saved to your Gold Trails account.</p>
    </div></section>${dialogs()}<noscript><p class="calendar-notice">The interactive calendar needs JavaScript. You can still <a href="/account/">visit your account</a> or <a href="/articles/">explore the field library</a>.</p></noscript>`;
  return shell('Your trail calendar', content, true, true);
}

export function calendarPreview() {
  const days=Array.from({length:35},(_,i)=>`<div class="calendar-preview-day"><span>${i<31?i+1:''}</span>${[3,10,18,25].includes(i)?'<i></i>':''}</div>`).join('');
  return shell('Your trail calendar', `<section class="calendar-gate" aria-labelledby="calendar-gate-title"><div class="calendar-gate-sketch" aria-hidden="true" inert><div class="calendar-preview-toolbar"><span>‹ &nbsp; Your trail calendar &nbsp; ›</span><span>Month · Week · Day</span></div><div class="calendar-preview-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-preview-month">${days}</div></div><div class="calendar-gate-overlay"><div class="calendar-gate-message"><span class="eyebrow">MAKE ROOM FOR ADVENTURE</span><h2 id="calendar-gate-title">Register and log in to access the calendar.</h2><p>Keep your outings, meetings, and personal plans together. Your calendar is included with a free Gold Trails account.</p><div class="calendar-gate-actions"><a class="gold-button" href="/signup/">Register free</a><a class="calendar-button" href="/login/?next=/calendar/">Sign in</a></div></div></div></section>`);
}

export function calendarUnavailable(message = 'Your calendar is temporarily unavailable. Please try again in a little while.') {
  return shell('Your trail calendar', `<section class="calendar-preview"><span class="eyebrow">THE FIELD DESK</span><h2>We couldn’t open your calendar.</h2><p role="alert">${h(message)}</p><a class="gold-button" href="/calendar/">Try again</a><p><a href="/account/">Visit your account</a></p></section>`, true);
}

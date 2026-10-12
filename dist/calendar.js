/* Gold Trails private planner. Durable changes go to the authenticated API. */
(() => {
  'use strict';
  const app = document.querySelector('[data-calendar-app]');
  if (!app) return;
  const $ = selector => document.querySelector(selector);
  const eventDialog = $('#calendar-event-dialog');
  const eventForm = $('#calendar-event-form');
  const calendarDialog = $('#calendar-calendar-dialog');
  const calendarForm = $('#calendar-calendar-form');
  const confirmDialog = $('#calendar-confirm-dialog');
  const confirmForm = $('#calendar-confirm-form');
  const noticeElement = $('#calendar-notice');
  const status = $('#calendar-status');
  const csrf = app.dataset.csrf;
  const state = { calendars: [], view: 'dayGridMonth', timeZone: 'America/New_York', visible: new Set(), events: [], rangeKey: '', invalidated: true, editingEvent: null, editingCalendar: null, pendingNewDate: null, pendingNewEvent: false, confirmation: null, loadedRule: null, loadedRecurrence: '', loadedRuleZone: '', loadedAllDay: false };
  let board;
  let preferenceQueue = Promise.resolve();
  let searchTimer;
  let sidebarUserChoice = false;
  const narrowViewport = window.matchMedia('(max-width: 700px)');
  const DateTime = window.luxon?.DateTime;

  function notice(message = '', error = false) {
    noticeElement.textContent = message;
    noticeElement.hidden = !message;
    noticeElement.dataset.error = String(error);
    noticeElement.setAttribute('role', error ? 'alert' : 'status');
  }
  function formError(form, message = '') {
    const element = form.querySelector('.calendar-form-error');
    element.textContent = message;
    element.hidden = !message;
    if (message) element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function busy(form, value) { form.querySelectorAll('button').forEach(button => { button.disabled = value; }); }
  function zoneValid(value) {
    try { return Boolean(value && DateTime?.now().setZone(value).isValid); } catch { return false; }
  }
  async function api(path, body) {
    const response = await fetch(`/calendar/api/${path}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', 'Accept': 'application/json' } : { 'Accept': 'application/json' },
      ...(body ? { body: JSON.stringify({ ...body, csrf }) } : {})
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('The calendar did not return a usable response. Try again in a moment.'); }
    if (!response.ok) {
      const error = new Error(data.error || (response.status === 401 ? 'Please sign in again to save your calendar.' : 'Your change could not be saved. Please try again.'));
      error.status = response.status; throw error;
    }
    return data;
  }
  function savePreferences() {
    const save = preferenceQueue.catch(() => {}).then(() => api('preferences', {
      view: state.view, timeZone: state.timeZone, visibleCalendarIds: [...state.visible]
    }));
    preferenceQueue = save;
    return save;
  }
  function colorText(hex) {
    const values = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1).match(/../g).map(value => parseInt(value, 16)) : [152,76,50];
    const luminance = values.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126,0.7152,0.0722][i], 0);
    return luminance > 0.179 ? '#241b15' : '#ffffff';
  }
  function renderCalendars() {
    const list = $('#calendar-list');
    list.replaceChildren();
    if (!state.calendars.length) {
      const text = document.createElement('p'); text.className = 'calendar-help'; text.textContent = 'Create your first calendar to start planning.'; list.append(text); return;
    }
    for (const calendar of state.calendars) {
      const row = document.createElement('div'); row.className = 'calendar-list-item';
      if (/^#[0-9a-f]{6}$/i.test(calendar.color)) row.style.setProperty('--calendar-color', calendar.color);
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = state.visible.has(calendar.id); checkbox.setAttribute('aria-label', `Show ${calendar.name}`);
      const name = document.createElement('span'); name.textContent = calendar.name;
      label.append(checkbox, name);
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'calendar-icon-button'; edit.textContent = '⋯'; edit.setAttribute('aria-label', `Edit ${calendar.name}`);
      edit.addEventListener('click', () => openCalendar(calendar));
      checkbox.addEventListener('change', async () => {
        const wasVisible = state.visible.has(calendar.id);
        checkbox.checked ? state.visible.add(calendar.id) : state.visible.delete(calendar.id);
        checkbox.disabled = true;
        board.refetchEvents();
        try { await savePreferences(); refreshEvents(); notice(); }
        catch (error) { wasVisible ? state.visible.add(calendar.id) : state.visible.delete(calendar.id); checkbox.checked = wasVisible; board.refetchEvents(); notice(error.message, true); }
        finally { checkbox.disabled = false; }
      });
      row.append(label, edit); list.append(row);
    }
  }
  async function loadCalendars(initial = false) {
    const data = await api('calendars');
    state.calendars = data.calendars || [];
    state.visible = new Set(state.calendars.filter(calendar => calendar.visible !== false).map(calendar => calendar.id));
    const preferences = data.preferences || {};
    if (initial) {
      state.view = ['dayGridMonth','timeGridWeek','timeGridDay','listMonth'].includes(preferences.view) ? preferences.view : 'dayGridMonth';
      if (!data.hasSavedPreferences && !preferences.hasSavedPreferences && window.matchMedia('(max-width: 700px)').matches) state.view = 'listMonth';
      if (zoneValid(preferences.timeZone)) state.timeZone = preferences.timeZone;
    }
    if (Array.isArray(preferences.visibleCalendarIds)) state.visible = new Set(preferences.visibleCalendarIds.filter(id => state.calendars.some(calendar => calendar.id === id)));
    $('#calendar-display-zone').value = state.timeZone;
    renderCalendars();
  }
  function filteredEvents() {
    const term = $('#calendar-search').value.trim().toLocaleLowerCase();
    const result = state.events.filter(event => state.visible.has(event.calendarId) && (!term || [event.title,event.description,event.location].join(' ').toLocaleLowerCase().includes(term)));
    $('#calendar-event-count').textContent = `${result.length} event${result.length === 1 ? '' : 's'}`;
    return result.map(event => {
      const color = state.calendars.find(calendar => calendar.id === event.calendarId)?.color || event.color || '#984c32';
      return { ...event, color, textColor: colorText(color) };
    });
  }
  async function fetchEvents(info, success, failure) {
    const key = `${info.startStr}|${info.endStr}`;
    if (state.rangeKey === key && !state.invalidated) { success(filteredEvents()); return; }
    status.textContent = 'Loading your plans…';
    try {
      const data = await api(`events?${new URLSearchParams({ start: info.startStr, end: info.endStr })}`);
      state.events = data.events || []; state.rangeKey = key; state.invalidated = false;
      success(filteredEvents()); status.textContent = ''; notice();
    } catch (error) {
      status.textContent = ''; $('#calendar-event-count').textContent = ''; notice(`${error.message} Use the next or previous arrow to retry loading this range.`, true); failure(error);
    }
  }
  function refreshEvents() { state.invalidated = true; board.refetchEvents(); }
  function setViewButtons() { document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view))); }
  function setSidebarExpanded(expanded) {
    const sidebar = $('#calendar-sidebar'), toggle = $('#calendar-toggle-sidebar');
    if (!expanded && sidebar.contains(document.activeElement)) toggle.focus();
    sidebar.hidden = !expanded;
    app.classList.toggle('calendar-sidebar-collapsed', !expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.querySelector('.calendar-toggle-state').textContent = expanded ? 'Hide' : 'Show';
    toggle.querySelector('.calendar-toggle-icon').textContent = expanded ? '⌃' : '⌄';
    if (board) window.requestAnimationFrame(() => board.updateSize());
  }
  const addDays = (value, days) => DateTime.fromISO(value, { zone: 'UTC' }).plus({ days }).toISODate();
  const asLocal = (value, zone, allDay) => {
    if (!value) return '';
    const text = String(value);
    if (allDay) return text.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return text;
    return DateTime.fromISO(text, { zone, setZone: true }).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm");
  };
  function eventFields(event) {
    const props = event.extendedProps;
    return { ...props, eventId: props.eventId || event.id, title: event.title, allDay: event.allDay,
      startLocal: props.startLocal || asLocal(event.startStr, props.timeZone || state.timeZone, event.allDay),
      endLocal: props.endLocal || asLocal(event.endStr, props.timeZone || state.timeZone, event.allDay) };
  }
  function recurrenceFields(rule, zone, allDay) {
    const parts = Object.fromEntries(String(rule || '').replace(/^RRULE:/i, '').split(';').filter(Boolean).map(part => { const [key,...value] = part.split('='); return [key.toUpperCase(),value.join('=')]; }));
    eventForm.elements.frequency.value = parts.FREQ || '';
    eventForm.elements.interval.value = parts.INTERVAL || 1;
    eventForm.querySelectorAll('[name=weekdays]').forEach(input => { input.checked = (parts.BYDAY || '').split(',').includes(input.value); });
    eventForm.elements.monthlyPattern.value = 'date';
    const monthlyDay = /^([+-]?[1-5])(MO|TU|WE|TH|FR|SA|SU)$/.exec(parts.BYDAY || '');
    if (parts.FREQ === 'MONTHLY' && monthlyDay) { eventForm.elements.monthlyPattern.value = 'weekday'; eventForm.elements.ordinal.value = String(Number(monthlyDay[1])); eventForm.elements.monthlyWeekday.value = monthlyDay[2]; }
    eventForm.elements.repeatEnd.value = parts.COUNT ? 'count' : parts.UNTIL ? 'until' : 'never';
    eventForm.elements.count.value = parts.COUNT || 10;
    eventForm.elements.until.value = '';
    if (parts.UNTIL) {
      const parsed = DateTime.fromFormat(parts.UNTIL, allDay ? 'yyyyMMdd' : "yyyyMMdd'T'HHmmss'Z'", { zone: allDay ? zone : 'UTC' });
      if (parsed.isValid) eventForm.elements.until.value = parsed.setZone(zone).toISODate();
    }
    updateRecurrence();
    state.loadedRule = rule || null; state.loadedRecurrence = recurrenceSignature(); state.loadedRuleZone = zone; state.loadedAllDay = allDay;
  }
  function recurrenceSignature() {
    return JSON.stringify(['frequency','interval','monthlyPattern','ordinal','monthlyWeekday','repeatEnd','count','until'].map(name => eventForm.elements[name].value).concat([...eventForm.querySelectorAll('[name=weekdays]:checked')].map(input => input.value)));
  }
  function updateRecurrence() {
    const frequency = eventForm.elements.frequency.value;
    const occurrence = state.editingEvent?.rrule && eventForm.elements.scope.value === 'occurrence';
    const repeating = Boolean(frequency && !occurrence);
    eventForm.querySelector('.calendar-recurrence').hidden = Boolean(occurrence);
    eventForm.querySelector('.calendar-exception-reset').hidden = Boolean(occurrence) || !state.editingEvent?.series?.hasExceptions;
    eventForm.elements.calendarId.disabled = Boolean(occurrence);
    eventForm.querySelector('.calendar-repeat-detail').hidden = !repeating;
    eventForm.querySelector('.calendar-weekdays').hidden = !repeating || frequency !== 'WEEKLY';
    eventForm.querySelector('.calendar-monthly').hidden = !repeating || frequency !== 'MONTHLY';
    eventForm.querySelector('.calendar-monthly-weekday').hidden = eventForm.elements.monthlyPattern.value !== 'weekday';
    eventForm.querySelector('.calendar-repeat-ending').hidden = !repeating;
    eventForm.querySelector('.calendar-repeat-note').hidden = !repeating;
    eventForm.querySelector('.calendar-count').hidden = !repeating || eventForm.elements.repeatEnd.value !== 'count';
    eventForm.querySelector('.calendar-until').hidden = !repeating || eventForm.elements.repeatEnd.value !== 'until';
    eventForm.elements.count.required = repeating && eventForm.elements.repeatEnd.value === 'count';
    eventForm.elements.until.required = repeating && eventForm.elements.repeatEnd.value === 'until';
    $('#calendar-repeat-unit').textContent = ({ DAILY: 'days', WEEKLY: 'weeks', MONTHLY: 'months', YEARLY: 'years' })[frequency] || 'weeks';
  }
  function updateAllDay(convert = true) {
    const allDay = eventForm.elements.allDay.checked;
    for (const name of ['startLocal','endLocal']) {
      const input = eventForm.elements[name]; const oldValue = input.value; const wasDate = input.type === 'date';
      input.type = allDay ? 'date' : 'datetime-local';
      input.min = allDay ? '2000-01-01' : '2000-01-01T00:00'; input.max = allDay ? '2100-12-31' : '2100-12-31T23:59';
      if (convert && oldValue) input.value = allDay ? oldValue.slice(0,10) : wasDate ? `${oldValue}T${name === 'startLocal' ? '09:00' : '10:00'}` : oldValue;
    }
    $('#calendar-end-help').textContent = allDay ? 'Ends is the last day of your plan. A one-day event starts and ends on the same date.' : 'Start and end times use the event time zone.';
  }
  function fillEvent(values) {
    const fields = eventForm.elements;
    fields.title.value = values.title || ''; fields.calendarId.value = values.calendarId || state.calendars.find(calendar => state.visible.has(calendar.id))?.id || state.calendars[0]?.id || '';
    fields.timeZone.value = values.timeZone || state.timeZone; fields.allDay.checked = Boolean(values.allDay); updateAllDay(false);
    fields.startLocal.value = asLocal(values.startLocal || values.start, fields.timeZone.value, fields.allDay.checked);
    const end = asLocal(values.endLocal || values.end, fields.timeZone.value, fields.allDay.checked);
    fields.endLocal.value = fields.allDay.checked ? end ? addDays(end, -1) : fields.startLocal.value : end;
    fields.location.value = values.location || ''; fields.description.value = values.description || '';
    recurrenceFields(values.rrule, fields.timeZone.value, fields.allDay.checked);
  }
  function openEvent(event = null, date = null) {
    if (!state.calendars.length) { state.pendingNewDate = date; state.pendingNewEvent = true; openCalendar(); return; }
    eventForm.reset(); formError(eventForm);
    state.editingEvent = event ? eventFields(event) : null;
    eventForm.elements.calendarId.replaceChildren(...state.calendars.map(calendar => { const option = document.createElement('option'); option.value = calendar.id; option.textContent = calendar.name; return option; }));
    const current = state.editingEvent;
    const recurring = Boolean(current?.rrule || current?.series?.rrule);
    if (recurring) current.rrule ||= current.series.rrule;
    eventForm.querySelector('.calendar-scope').hidden = !recurring;
    eventForm.elements.scope.value = 'series';
    $('#calendar-event-heading').textContent = event ? 'Edit event' : 'New event';
    $('#calendar-delete-event').hidden = !event;
    const chosen = date ? DateTime.fromISO(date, { zone: state.timeZone }).setZone(state.timeZone) : DateTime.now().setZone(state.timeZone).plus({ hours: 1 }).startOf('hour');
    const start = date && date.length === 10 ? chosen.set({ hour: 9 }) : chosen;
    fillEvent(current ? recurring ? current.series || current : current : { startLocal: start.toFormat("yyyy-MM-dd'T'HH:mm"), endLocal: start.plus({ hours: 1 }).toFormat("yyyy-MM-dd'T'HH:mm"), timeZone: state.timeZone });
    eventDialog.showModal(); eventForm.elements.title.focus();
  }
  function openCalendar(calendar = null) {
    state.editingCalendar = calendar; calendarForm.reset(); formError(calendarForm);
    calendarForm.elements.name.value = calendar?.name || ''; calendarForm.elements.color.value = calendar?.color || '#984c32';
    $('#calendar-calendar-heading').textContent = calendar ? 'Edit calendar' : 'New calendar';
    $('#calendar-delete-calendar').hidden = !calendar;
    calendarDialog.showModal(); calendarForm.elements.name.focus();
  }
  function serializeRecurrence(startLocal, timeZone, allDay) {
    const fields = eventForm.elements;
    const unchanged = state.loadedRule && state.loadedRecurrence === recurrenceSignature();
    if (unchanged && allDay === state.loadedAllDay && (timeZone === state.loadedRuleZone || !state.loadedRule.includes('UNTIL='))) return state.loadedRule;
    if (!fields.frequency.value) return null;
    const interval = Number(fields.interval.value);
    if (!Number.isInteger(interval) || interval < 1 || interval > 365) throw new Error('Choose a repeat interval between 1 and 365.');
    const parts = [`FREQ=${fields.frequency.value}`, `INTERVAL=${interval}`];
    if (fields.frequency.value === 'WEEKLY') {
      const days = [...eventForm.querySelectorAll('[name=weekdays]:checked')].map(input => input.value);
      if (!days.length) throw new Error('Choose at least one weekday for this weekly event.');
      parts.push(`BYDAY=${days.join(',')}`);
    }
    if (fields.frequency.value === 'MONTHLY' && fields.monthlyPattern.value === 'weekday') parts.push(`BYDAY=${fields.ordinal.value}${fields.monthlyWeekday.value}`);
    // Keep advanced saved rules intact when only their time zone or all-day
    // setting changes, while converting UNTIL into the appropriate date type.
    if (unchanged) {
      const original = state.loadedRule.split(';').filter(part => /^(BYDAY|BYMONTH|BYMONTHDAY|WKST)=/.test(part));
      for (const part of original) { const key = part.split('=')[0]; const existing = parts.findIndex(value => value.startsWith(`${key}=`)); if (existing === -1) parts.push(part); else parts[existing] = part; }
    }
    if (fields.repeatEnd.value === 'count') {
      const count = Number(fields.count.value);
      if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Choose between 1 and 1,000 occurrences.');
      parts.push(`COUNT=${count}`);
    } else if (fields.repeatEnd.value === 'until') {
      if (!fields.until.value || fields.until.value < startLocal.slice(0,10)) throw new Error('The last repeat date must be on or after the first event.');
      const until = allDay ? fields.until.value.replaceAll('-', '') : DateTime.fromISO(fields.until.value, { zone: timeZone }).endOf('day').toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
      parts.push(`UNTIL=${until}`);
    }
    return parts.join(';');
  }
  function serializeEvent() {
    const fields = eventForm.elements;
    const allDay = fields.allDay.checked, timeZone = fields.timeZone.value.trim();
    if (!zoneValid(timeZone)) throw new Error('Enter a valid time zone, such as America/New_York or America/Denver.');
    const startLocal = fields.startLocal.value, endLocal = allDay ? addDays(fields.endLocal.value, 1) : fields.endLocal.value;
    // The server resolves repeated-hour endpoints when daylight saving ends.
    // Their local strings can be equal while their UTC instants are ordered.
    if (allDay && endLocal <= startLocal) throw new Error('The last day must be on or after the first day.');
    for (const value of [startLocal,endLocal]) {
      const parsed = DateTime.fromISO(value, { zone: timeZone });
      if (!parsed.isValid || (!allDay && parsed.toFormat("yyyy-MM-dd'T'HH:mm") !== value)) throw new Error('That local time does not exist because the clocks change. Choose another time.');
    }
    return { calendarId: fields.calendarId.value, title: fields.title.value.trim(), location: fields.location.value.trim(), description: fields.description.value.trim(), startLocal, endLocal, timeZone, allDay, rrule: fields.scope.value === 'occurrence' && state.editingEvent?.rrule ? null : serializeRecurrence(startLocal, timeZone, allDay) };
  }
  function openConfirmation({ title, message, phrase, button, action }) {
    state.confirmation = { phrase, action }; confirmForm.reset(); formError(confirmForm);
    $('#calendar-confirm-heading').textContent = title; $('#calendar-confirm-message').textContent = message;
    $('#calendar-confirm-label').textContent = `Type ${phrase} to confirm`;
    confirmForm.querySelector('[type=submit]').textContent = button;
    confirmDialog.showModal(); confirmForm.elements.confirmation.focus();
  }
  function bindUI() {
    setSidebarExpanded(!narrowViewport.matches);
    $('#calendar-toggle-sidebar').addEventListener('click', () => {
      sidebarUserChoice = true;
      setSidebarExpanded($('#calendar-toggle-sidebar').getAttribute('aria-expanded') !== 'true');
    });
    narrowViewport.addEventListener('change', event => { if (!sidebarUserChoice) setSidebarExpanded(!event.matches); });
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => { button.closest('dialog').close(); if (button.closest('dialog') === calendarDialog) { state.pendingNewDate = null; state.pendingNewEvent = false; } }));
    calendarDialog.addEventListener('cancel', () => { state.pendingNewDate = null; state.pendingNewEvent = false; });
    $('#calendar-add-event').addEventListener('click', () => openEvent());
    $('#calendar-add-calendar').addEventListener('click', () => openCalendar());
    $('#calendar-previous').addEventListener('click', () => board.prev()); $('#calendar-next').addEventListener('click', () => board.next()); $('#calendar-today').addEventListener('click', () => board.today());
    $('#calendar-jump-date').addEventListener('change', event => { if (event.target.value) board.gotoDate(event.target.value); });
    $('#calendar-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => board.refetchEvents(), 180); });
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', async () => {
      const previous = state.view; state.view = button.dataset.view; board.changeView(state.view); setViewButtons();
      try { await savePreferences(); notice(); } catch (error) { state.view = previous; board.changeView(previous); setViewButtons(); notice(error.message, true); }
    }));
    $('#calendar-apply-zone').addEventListener('click', async () => {
      const zone = $('#calendar-display-zone').value.trim();
      if (!zoneValid(zone)) { notice('Enter a valid display time zone, such as America/New_York.', true); return; }
      const previous = state.timeZone; state.timeZone = zone; state.invalidated = true; board.setOption('timeZone', zone);
      try { await savePreferences(); notice('Display time zone saved.'); } catch (error) { state.timeZone = previous; $('#calendar-display-zone').value = previous; board.setOption('timeZone', previous); notice(error.message, true); }
    });
    eventForm.elements.allDay.addEventListener('change', () => updateAllDay());
    for (const name of ['frequency','repeatEnd','monthlyPattern']) eventForm.elements[name].addEventListener('change', updateRecurrence);
    eventForm.elements.frequency.addEventListener('change', () => {
      if (eventForm.elements.frequency.value === 'WEEKLY' && !eventForm.querySelector('[name=weekdays]:checked')) {
        const day = DateTime.fromISO(eventForm.elements.startLocal.value, { zone: eventForm.elements.timeZone.value }).weekday;
        const input = eventForm.querySelector(`[name=weekdays][value="${['MO','TU','WE','TH','FR','SA','SU'][day - 1]}"]`); if (input) input.checked = true;
      }
    });
    eventForm.querySelectorAll('[name=scope]').forEach(input => input.addEventListener('change', () => { formError(eventForm); fillEvent(input.value === 'series' ? state.editingEvent.series || state.editingEvent : state.editingEvent); updateRecurrence(); }));
    eventForm.addEventListener('submit', async event => {
      event.preventDefault(); if (!eventForm.reportValidity()) return; formError(eventForm); busy(eventForm, true);
      try {
        const fields = serializeEvent(), current = state.editingEvent;
        if (current?.rrule && eventForm.elements.scope.value === 'occurrence') {
          const { rrule, ...override } = fields;
          await api(`events/${encodeURIComponent(current.eventId)}/occurrence`, { revision: current.revision, occurrenceStart: current.occurrenceStart, override });
        } else await api(current ? `events/${encodeURIComponent(current.eventId)}` : 'events', { ...fields, ...(current ? { revision: current.revision, resetExceptions: eventForm.elements.resetExceptions.checked } : {}) });
        eventDialog.close(); refreshEvents(); notice('Your event was saved.');
      } catch (error) { if (error.status === 409) refreshEvents(); formError(eventForm, error.status === 409 ? `${error.message} Close and reopen this event to load its latest changes.` : error.message); }
      finally { busy(eventForm, false); }
    });
    calendarForm.addEventListener('submit', async event => {
      event.preventDefault(); if (!calendarForm.reportValidity()) return; formError(calendarForm); busy(calendarForm, true);
      try {
        const current = state.editingCalendar;
        await api(current ? `calendars/${encodeURIComponent(current.id)}` : 'calendars', { name: calendarForm.elements.name.value.trim(), color: calendarForm.elements.color.value, ...(current ? { revision: current.revision } : {}) });
        calendarDialog.close(); await loadCalendars(); refreshEvents(); notice('Your calendar was saved.');
        if (state.pendingNewEvent) { const date = state.pendingNewDate; state.pendingNewDate = null; state.pendingNewEvent = false; openEvent(null, date); }
      } catch (error) { formError(calendarForm, error.message); }
      finally { busy(calendarForm, false); }
    });
    $('#calendar-delete-calendar').addEventListener('click', () => {
      const current = state.editingCalendar;
      openConfirmation({ title: 'Delete this calendar?', message: `“${current.name}” and all its events will be removed from your account. This cannot be undone.`, phrase: 'DELETE CALENDAR', button: 'Delete calendar', action: async () => { await api(`calendars/${encodeURIComponent(current.id)}/delete`, { revision: current.revision, confirmation: 'DELETE CALENDAR' }); calendarDialog.close(); await loadCalendars(); refreshEvents(); notice('Calendar deleted.'); } });
    });
    $('#calendar-delete-event').addEventListener('click', () => {
      const current = state.editingEvent;
      const occurrence = current.rrule && eventForm.elements.scope.value === 'occurrence';
      openConfirmation({ title: occurrence ? 'Cancel this occurrence?' : current.rrule ? 'Delete the whole series?' : 'Delete this event?', message: occurrence ? `Only this occurrence of “${current.title}” will be removed. The rest of the series will stay in your calendar.` : `“${current.title}”${current.rrule ? ' and every occurrence in its series' : ''} will be removed. This cannot be undone.`, phrase: occurrence ? 'CANCEL OCCURRENCE' : 'DELETE EVENT', button: occurrence ? 'Cancel occurrence' : 'Delete event', action: async () => {
        await api(`events/${encodeURIComponent(current.eventId)}/${occurrence ? 'occurrence' : 'delete'}`, { revision: current.revision, ...(occurrence ? { occurrenceStart: current.occurrenceStart, cancelled: true } : { confirmation: 'DELETE EVENT' }) });
        eventDialog.close(); refreshEvents(); notice(occurrence ? 'This occurrence was cancelled.' : 'Event deleted.');
      } });
    });
    confirmForm.addEventListener('submit', async event => {
      event.preventDefault(); formError(confirmForm);
      if (confirmForm.elements.confirmation.value.trim() !== state.confirmation.phrase) { formError(confirmForm, `Type ${state.confirmation.phrase} exactly to confirm.`); return; }
      busy(confirmForm, true);
      try { await state.confirmation.action(); confirmDialog.close(); }
      catch (error) { formError(confirmForm, error.message); }
      finally { busy(confirmForm, false); }
    });
  }
  async function initialize() {
    if (!window.FullCalendar || !DateTime || !window.FullCalendar.Luxon3) { status.textContent = ''; notice('The calendar tools could not load. Refresh this page to try again.', true); return; }
    try {
      await loadCalendars(true);
      board = new FullCalendar.Calendar($('#calendar-board'), {
        initialView: state.view, timeZone: state.timeZone, headerToolbar: false, height: 'auto',
        firstDay: 0, dayMaxEvents: 3, nowIndicator: true, editable: false, selectable: false,
        eventSources: [{ events: fetchEvents }],
        noEventsContent: 'No plans in this range. Make room for a little adventure.',
        datesSet(info) { $('#calendar-range-title').textContent = info.view.title; $('#calendar-jump-date').value = DateTime.fromJSDate(board.getDate(), { zone: state.timeZone }).toISODate(); setViewButtons(); },
        dateClick(info) { openEvent(null, info.dateStr); }, eventClick(info) { info.jsEvent.preventDefault(); openEvent(info.event); },
        eventDidMount(info) {
          info.el.setAttribute('title', [info.event.title, info.event.extendedProps.location].filter(Boolean).join(' · '));
          // In agenda view the mount element is a table row; its title anchor
          // already has FullCalendar's Enter/Space handler and remains the
          // focus target. Do not add a second keyboard handler.
          const target = info.el.matches('a') ? info.el : info.el.querySelector('.fc-list-event-title a') || info.el;
          const date = info.event.allDay ? DateTime.fromISO(info.event.startStr.slice(0, 10), { zone: 'UTC' }) : DateTime.fromISO(info.event.startStr, { setZone: true }).setZone(state.timeZone);
          const dateLabel = date.isValid ? date.toLocaleString(DateTime.DATE_MED) : '';
          target.setAttribute('role', 'button');
          target.setAttribute('aria-label', ['Edit event', info.event.title, dateLabel, info.event.allDay ? 'all day' : info.timeText].filter(Boolean).join(', '));
        }
      });
      bindUI(); board.render(); status.textContent = '';
    } catch (error) { status.textContent = ''; notice(error.message, true); }
  }
  setSidebarExpanded(!narrowViewport.matches);
  initialize();
})();

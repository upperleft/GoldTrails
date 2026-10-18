/* Read-only friends tour. All events are fictional and stay in memory. */
(() => {
  'use strict';
  const app = document.querySelector('[data-calendar-guest]');
  if (!app) return;
  const $ = selector => document.querySelector(selector);
  const DateTime = window.luxon?.DateTime;
  const status = $('#calendar-status'), notice = $('#calendar-notice');
  const dialog = $('#calendar-guest-event-dialog');
  const zone = 'America/New_York';
  const views = new Set(['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listMonth']);
  let view = window.matchMedia('(max-width: 700px)').matches ? 'listMonth' : 'dayGridMonth';
  let board, searchTimer, restoreFocus;
  const samples = [
    {day:5, title:'Example: a morning of panning', location:'A fictional creek visit', description:'An imaginary morning beside the water, used to show a timed calendar entry. This is not an organized outing or an access recommendation.', color:'#984c32', hour:9, minutes:90},
    {day:12, title:'Example: club catch-up', location:'A fictional meeting room', description:'An example club get-together. No real club, host, meeting, or RSVP is associated with this entry.', color:'#315c58', hour:18, minutes:60},
    {day:19, title:'Example: sort the gear', location:'An imaginary day at home', description:'A fictional all-day reminder to organize a pan, classifier, and boots. Your own calendar can hold personal reminders like this.', color:'#715326', allDay:true},
    {day:26, title:'Example: research an outing', location:'An imaginary afternoon at the desk', description:'A fictional planning session to read sources and check land access. Nothing in this preview establishes permission to prospect.', color:'#315c58', hour:14, minutes:60}
  ];
  function report(message) {
    notice.textContent = message;
    notice.hidden = !message;
    notice.dataset.error = 'true';
    notice.setAttribute('role', 'alert');
  }
  function exampleEvents(info) {
    const rangeStart = DateTime.fromISO(info.startStr, {setZone:true}).setZone(zone);
    const rangeEnd = DateTime.fromISO(info.endStr, {setZone:true}).setZone(zone);
    const events = [];
    for (let month=rangeStart.startOf('month'), count=0; month < rangeEnd && count < 4; month=month.plus({months:1}), count++) {
      for (const sample of samples) {
        const day = month.set({day:sample.day, hour:sample.hour || 0});
        const end = sample.allDay ? day.plus({days:1}) : day.plus({minutes:sample.minutes});
        if (day >= rangeEnd || end <= rangeStart) continue;
        events.push({id:'example-'+month.toFormat('yyyy-MM')+'-'+sample.day, title:sample.title, allDay:Boolean(sample.allDay), start:sample.allDay?day.toISODate():day.toISO(), end:sample.allDay?end.toISODate():end.toISO(), color:sample.color, textColor:'#ffffff', editable:false, extendedProps:{location:sample.location, description:sample.description}});
      }
    }
    const term = $('#calendar-search').value.trim().toLocaleLowerCase();
    const filtered = events.filter(event => !term || [event.title, event.extendedProps.description, event.extendedProps.location].join(' ').toLocaleLowerCase().includes(term));
    $('#calendar-event-count').textContent = filtered.length+' example event'+(filtered.length===1?'':'s');
    return filtered;
  }
  function setViewButtons() {
    app.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  }
  function showEvent(info) {
    info.jsEvent?.preventDefault();
    restoreFocus = info.el.matches('a') ? info.el : info.el.querySelector('.fc-list-event-title a') || info.el;
    const event = info.event, start = DateTime.fromISO(event.startStr, {setZone:true}).setZone(zone);
    $('#calendar-guest-event-heading').textContent = event.title;
    $('#calendar-guest-event-when').textContent = event.allDay ? 'All day · '+DateTime.fromISO(event.startStr.slice(0,10), {zone}).toLocaleString(DateTime.DATE_FULL) : start.toLocaleString(DateTime.DATETIME_MED)+' · Eastern time';
    $('#calendar-guest-event-location').textContent = event.extendedProps.location;
    $('#calendar-guest-event-description').textContent = event.extendedProps.description;
    dialog.showModal();
    dialog.querySelector('[data-guest-event-close]').focus();
  }
  if (!window.FullCalendar || !DateTime || !window.FullCalendar.Luxon3) {
    status.textContent = '';
    report('The example calendar could not load. Refresh the page to try again.');
    return;
  }
  try {
    board = new window.FullCalendar.Calendar($('#calendar-board'), {
      initialView:view, timeZone:zone, headerToolbar:false, height:'auto', firstDay:0,
      dayMaxEvents:3, nowIndicator:true, editable:false, selectable:false, eventInteractive:true,
      events(info, success) { success(exampleEvents(info)); },
      noEventsContent:'No example events in this range. Try another date or clear the search.',
      datesSet(info) {
        $('#calendar-range-title').textContent = info.view.title;
        $('#calendar-jump-date').value = DateTime.fromJSDate(info.view.calendar.getDate(), {zone}).toISODate();
        setViewButtons();
      },
      eventClick:showEvent,
      eventDidMount(info) {
        info.el.setAttribute('title', info.event.title+' · Fictional example');
        const target = info.el.matches('a') ? info.el : info.el.querySelector('.fc-list-event-title a') || info.el;
        target.setAttribute('role', 'button');
        target.setAttribute('aria-label', 'View example event, '+info.event.title+', '+(info.event.allDay?'all day':info.timeText));
      }
    });
    $('#calendar-previous').addEventListener('click', () => board.prev());
    $('#calendar-next').addEventListener('click', () => board.next());
    $('#calendar-today').addEventListener('click', () => board.today());
    $('#calendar-jump-date').addEventListener('change', event => {
      const date = DateTime.fromISO(event.target.value, {zone});
      if (date.isValid && date.year >= 2000 && date.year <= 2100) board.gotoDate(event.target.value);
    });
    $('#calendar-search').addEventListener('input', () => {clearTimeout(searchTimer); searchTimer=setTimeout(() => board.refetchEvents(),180);});
    app.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      if (!views.has(button.dataset.view)) return;
      view = button.dataset.view;
      board.changeView(view);
      setViewButtons();
    }));
    dialog.querySelectorAll('[data-guest-event-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => {if (restoreFocus?.isConnected) restoreFocus.focus(); restoreFocus=null;});
    board.render();
    status.textContent = '';
    app.dataset.guestCalendarReady = 'true';
  } catch {
    status.textContent = '';
    report('The example calendar could not open. Refresh the page to try again.');
  }
})();

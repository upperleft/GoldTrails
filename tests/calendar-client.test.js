import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DateTime} from 'luxon';
import {calendarPage} from '../app/calendar/views.js';

const source = readFileSync(new URL('../dist/calendar.js', import.meta.url), 'utf8');

async function planner({calendars = [], failCreate = false} = {}) {
  const nodes = new Map(), writes = [];
  class Element {
    constructor() {
      this.value = ''; this.type = ''; this.checked = false; this.hidden = false;
      this.textContent = ''; this.dataset = {}; this.children = []; this.listeners = new Map();
      this.classList = {toggle() {}}; this.style = {setProperty() {}};
    }
    addEventListener(type, callback) {
      const listeners = this.listeners.get(type) || []; listeners.push(callback); this.listeners.set(type, listeners);
    }
    async emit(type, extra = {}) {
      for (const callback of this.listeners.get(type) || []) await callback({target: this, preventDefault() {}, ...extra});
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this[name] = value; }
    getAttribute(name) { return this[name]; }
    contains() { return false; }
    focus() { this.focused = true; }
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    querySelector(selector) { return node(`${this.key} ${selector}`); }
    querySelectorAll() { return []; }
    reset() { for (const field of Object.values(this.elements)) { field.value = ''; field.checked = false; } }
    reportValidity() { return true; }
  }
  function node(key) {
    if (!nodes.has(key)) { const element = new Element(); element.key = key; nodes.set(key, element); }
    return nodes.get(key);
  }
  for (const [id, names] of [
    ['event', 'title calendarId timeZone allDay startLocal endLocal location description frequency interval monthlyPattern ordinal monthlyWeekday repeatEnd count until scope resetExceptions'],
    ['calendar', 'name color'], ['confirm', 'confirmation']
  ]) {
    const form = node(`#calendar-${id}-form`);
    form.elements = Object.fromEntries(names.split(' ').map(name => [name, new Element()]));
  }
  let calendarOptions;
  class Board {
    constructor(element, options) { calendarOptions = options; }
    render() {} updateSize() {} refetchEvents() {}
  }
  const media = {matches: false, addEventListener() {}};
  const fullCalendar = {Calendar: Board, Luxon3: {}};
  runInNewContext(source, {
    document: {querySelector: node, querySelectorAll: () => [], createElement: () => new Element()},
    window: {luxon: {DateTime}, FullCalendar: fullCalendar, matchMedia: () => media, requestAnimationFrame: callback => callback()},
    FullCalendar: fullCalendar, URLSearchParams, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      if (options.method === 'POST') {
        const body = JSON.parse(options.body); writes.push({url, body});
        if (failCreate) return {ok: false, status: 503, json: async () => ({error: 'Calendar could not be saved.'})};
        calendars = [...calendars, {id: 'new-calendar', name: body.name, color: body.color}];
        return {ok: true, json: async () => ({calendar: calendars.at(-1)})};
      }
      assert.equal(url, '/calendar/api/calendars');
      return {ok: true, json: async () => ({calendars, preferences: {}})};
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(node('#calendar-add-event').listeners.has('click'), 'Planner initialized successfully');
  return {node, writes, dateClick: dateStr => calendarOptions.dateClick({dateStr})};
}

test('New event opens the event editor directly when a calendar exists', async () => {
  const {node, writes} = await planner({calendars: [{id: 'existing', name: 'My plans', color: '#984c32'}]});
  await node('#calendar-add-event').emit('click');
  assert.equal(node('#calendar-event-dialog').open, true);
  assert.equal(node('#calendar-event-heading').textContent, 'New event');
  assert.equal(node('#calendar-event-form').elements.calendarId.value, 'existing');
  assert.equal(node('#calendar-event-form').elements.title.focused, true);
  assert.notEqual(node('#calendar-calendar-dialog').open, true);
  assert.deepEqual(writes, []);
});

for (const action of ['New event', 'selected day']) test(`${action} explains first-calendar setup and continues to the event editor`, async () => {
  const {node, writes, dateClick} = await planner();
  if (action === 'New event') await node('#calendar-add-event').emit('click');
  else dateClick('2026-11-12');
  assert.equal(node('#calendar-calendar-dialog').open, true);
  assert.equal(node('#calendar-calendar-heading').textContent, 'First, create a calendar');
  assert.match(node('#calendar-calendar-help').textContent, /Events belong to a calendar.*then you can add your event/);
  assert.equal(node('#calendar-calendar-help').hidden, false);
  assert.equal(node('#calendar-save-calendar').textContent, 'Continue to new event');
  assert.notEqual(node('#calendar-event-dialog').open, true);
  const form = node('#calendar-calendar-form');
  form.elements.name.value = 'Days in the field';
  await form.emit('submit');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, '/calendar/api/calendars');
  assert.equal(node('#calendar-calendar-dialog').open, false);
  assert.equal(node('#calendar-event-dialog').open, true);
  assert.equal(node('#calendar-event-heading').textContent, 'New event');
  assert.equal(node('#calendar-event-form').elements.calendarId.value, 'new-calendar');
  if (action === 'selected day') assert.equal(node('#calendar-event-form').elements.startLocal.value, '2026-11-12T09:00');
});

test('cancelling setup keeps ordinary calendar creation separate from event creation', async () => {
  const {node} = await planner();
  await node('#calendar-add-event').emit('click');
  await node('#calendar-calendar-dialog').emit('cancel');
  node('#calendar-calendar-dialog').close();
  await node('#calendar-add-calendar').emit('click');
  assert.equal(node('#calendar-calendar-heading').textContent, 'New calendar');
  assert.equal(node('#calendar-calendar-help').hidden, true);
  assert.equal(node('#calendar-calendar-help').textContent, '');
  assert.equal(node('#calendar-save-calendar').textContent, 'Save calendar');
  node('#calendar-calendar-form').elements.name.value = 'Trips';
  await node('#calendar-calendar-form').emit('submit');
  assert.notEqual(node('#calendar-event-dialog').open, true);
});

test('failed first-calendar save retains setup and does not pretend an event can be saved', async () => {
  const {node} = await planner({failCreate: true});
  await node('#calendar-add-event').emit('click');
  node('#calendar-calendar-form').elements.name.value = 'Trips';
  await node('#calendar-calendar-form').emit('submit');
  assert.equal(node('#calendar-calendar-dialog').open, true);
  assert.equal(node('#calendar-save-calendar').textContent, 'Continue to new event');
  assert.equal(node('#calendar-calendar-form .calendar-form-error').textContent, 'Calendar could not be saved.');
  assert.notEqual(node('#calendar-event-dialog').open, true);
});

test('first-calendar guidance is connected to the rendered dialog for assistive technology', () => {
  const html = calendarPage();
  assert.match(html, /id="calendar-calendar-dialog"[^>]*aria-describedby="calendar-calendar-help"/);
  assert.match(html, /id="calendar-calendar-help"/);
  assert.match(html, /id="calendar-save-calendar"/);
});

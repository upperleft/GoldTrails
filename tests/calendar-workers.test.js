import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createRecurrencePool} from '../app/calendar/worker-pool.js';
import {CalendarError, validateEvent} from '../app/calendar/model.js';

const calendarId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const event = (changes = {}) => ({id: eventId, revision: 3, ...validateEvent({calendarId, title: 'River lesson', description: '', location: '', timeZone: 'America/New_York', allDay: false, startLocal: '2026-03-01T09:00', endLocal: '2026-03-01T10:00', rrule: 'FREQ=WEEKLY;COUNT=3', ...changes})});
const range = {start: '2026-03-01T00:00:00Z', end: '2026-03-25T00:00:00Z'};
const errorStatus = status => error => error instanceof CalendarError && error.status === status;

test('isolated expansion preserves DST wall times and occurrence identities', async t => {
  const pool = createRecurrencePool();
  t.after(() => pool.close());
  const result = await pool.run('expand', {events: [event()], range});
  assert.equal(result.length, 1);
  assert.equal(result[0].eventId, eventId);
  assert.deepEqual(result[0].occurrences.map(item => item.start), ['2026-03-01T14:00:00.000Z', '2026-03-08T13:00:00.000Z', '2026-03-15T13:00:00.000Z']);
  assert.equal(await pool.run('occurrence', {event: event(), occurrenceStart: '2026-03-08T09:00'}), true);
  assert.equal(await pool.run('occurrence', {event: event(), occurrenceStart: '2026-03-09T09:00'}), false);
});

test('worker validation errors remain CalendarErrors and the worker stays reusable', async t => {
  const pool = createRecurrencePool({maxWorkers: 1});
  t.after(() => pool.close());
  await assert.rejects(pool.run('expand', {events: [{...event(), title: ''}], range}), errorStatus(400));
  await assert.rejects(pool.run('execute', {text: 'untrusted code'}), errorStatus(400));
  assert.equal(await pool.run('occurrence', {event: event(), occurrenceStart: '2026-03-15T09:00'}), true);
});

test('hard timeouts terminate busy workers without wedging their queued replacement', async t => {
  const pool = createRecurrencePool({maxWorkers: 1, maxQueued: 1, timeoutMs: 1});
  t.after(() => pool.close());
  const started = performance.now();
  const first = pool.run('expand', {events: [event()], range}).catch(error => error);
  const queued = pool.run('occurrence', {event: event(), occurrenceStart: '2026-03-08T09:00'}).catch(error => error);
  assert.ok(errorStatus(429)(await first));
  assert.ok(errorStatus(429)(await queued));
  assert.ok(performance.now() - started < 2000, 'termination and replacement stay bounded');
});

test('queue overload is bounded and accepted tasks still finish', async t => {
  const pool = createRecurrencePool({maxWorkers: 1, maxQueued: 1});
  t.after(() => pool.close());
  const payload = {event: event(), occurrenceStart: '2026-03-08T09:00'};
  const first = pool.run('occurrence', payload);
  const second = pool.run('occurrence', payload);
  await assert.rejects(pool.run('occurrence', payload), errorStatus(429));
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
});

test('close rejects active and queued work and is idempotent', async () => {
  const pool = createRecurrencePool({maxWorkers: 1, maxQueued: 1});
  const payload = {event: event(), occurrenceStart: '2026-03-08T09:00'};
  const active = pool.run('occurrence', payload).catch(error => error);
  const queued = pool.run('occurrence', payload).catch(error => error);
  await pool.close();
  assert.ok(errorStatus(500)(await active));
  assert.ok(errorStatus(500)(await queued));
  await assert.rejects(pool.run('occurrence', payload), errorStatus(500));
  await pool.close();
});

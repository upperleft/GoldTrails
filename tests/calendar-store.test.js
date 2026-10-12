import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCalendarStore} from '../app/calendar/store.js';

const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const calendarId = '33333333-3333-4333-8333-333333333333';
const eventId = '44444444-4444-4444-8444-444444444444';
const calendar = {id: calendarId, name: 'Trips', color: '#755316', visible: 1, revision: 3};
const event = {
  calendarId, title: 'Private title', description: 'Private notes', location: 'Private location',
  startLocal: '2026-10-11T09:00', endLocal: '2026-10-11T10:00', timeZone: 'America/New_York',
  allDay: false, startUtc: '2026-10-11T13:00:00.000Z', endUtc: '2026-10-11T14:00:00.000Z', rrule: null,
};
const eventRow = {
  id: eventId, calendar_id: calendarId, title: event.title, description: event.description,
  location: event.location, start_local: event.startLocal, end_local: event.endLocal, time_zone: event.timeZone,
  all_day: 0, start_utc: '2026-10-11 13:00:00.000000', end_utc: '2026-10-11 14:00:00.000000',
  rrule: null, revision: 5,
};
const exceptionRow = {event_id: eventId, occurrence_start: event.startLocal, cancelled: 1, override_json: null};

function fixture(onQuery = () => undefined) {
  const calls = [], state = {begins: 0, commits: 0, rollbacks: 0, releases: 0};
  const query = async (sql, args = []) => {
    calls.push({sql, args});
    const result = await onQuery(sql, args);
    if (result !== undefined) return result;
    if (sql.startsWith('SELECT id FROM member_accounts')) return [{id: args[0]}];
    if (sql.startsWith('SELECT COUNT(*)')) return [{n: 0, existing: 0}];
    if (sql.startsWith('SELECT id,name,color,visible,revision FROM calendar_calendars')) return args[0] === owner ? [calendar] : [];
    if (sql.startsWith('SELECT id FROM calendar_calendars')) return args[0] === owner ? [{id: calendarId}] : [];
    if (sql.startsWith('SELECT e.*')) return args[0] === owner ? [eventRow] : [];
    if (sql.startsWith('SELECT x.event_id')) return [];
    if (sql.startsWith('SELECT ')) return [];
    return {affectedRows: 1};
  };
  const connection = {
    query, beginTransaction: async () => {state.begins++;}, commit: async () => {state.commits++;},
    rollback: async () => {state.rollbacks++;}, release: () => {state.releases++;},
  };
  const store = createCalendarStore({query, getConnection: async () => connection});
  return {store, calls, state};
}
const status = expected => error => error.status === expected;

test('calendar readiness is read-only; owner-bound calendars return saved or default display preferences', async () => {
  const a = fixture((sql, args) => {
    if (sql.startsWith('SELECT version')) return [{version: '009_native_calendar'}];
    if (sql.startsWith('SELECT view_name')) {
      assert.deepEqual(args, [owner]);
      return [{view_name: 'timeGridWeek', time_zone: 'America/Denver'}];
    }
  });
  assert.equal(await a.store.ready(), true);
  const saved = await a.store.listCalendars(owner);
  assert.equal(saved.hasSavedPreferences, true);
  assert.deepEqual(saved.preferences, {view: 'timeGridWeek', timeZone: 'America/Denver'});
  assert.deepEqual(saved.calendars, [{...calendar, visible: true}]);
  assert.ok(a.calls.every(({sql}) => sql.startsWith('SELECT ')));
  const empty = await fixture().store.listCalendars(otherOwner);
  assert.equal(empty.hasSavedPreferences, false);
  assert.deepEqual(empty.calendars, []);
  assert.deepEqual(empty.preferences, {view: 'dayGridMonth', timeZone: 'America/New_York'});
});

test('every calendar write locks the authenticated account first and uses metadata-only audit records', async () => {
  const {store, calls, state} = fixture();
  const created = await store.createCalendar(owner, {name: 'Private calendar name', color: '#123456', ownerId: otherOwner});
  assert.equal(created.revision, 1);
  assert.equal(created.visible, true);
  assert.equal(calls[0].sql, 'SELECT id FROM member_accounts WHERE id=? FOR UPDATE');
  assert.deepEqual(calls[0].args, [owner]);
  const insert = calls.find(({sql}) => sql.startsWith('INSERT INTO calendar_calendars'));
  assert.equal(insert.args[1], owner);
  const audit = calls.find(({sql}) => sql.startsWith('INSERT INTO calendar_audit_log'));
  assert.doesNotMatch(JSON.stringify(audit), /Private calendar name/);
  assert.deepEqual(state, {begins: 1, commits: 1, rollbacks: 0, releases: 1});
});

test('cross-owner event reads and deletes return 404 without private payloads or mutation', async () => {
  const {store, calls, state} = fixture();
  await assert.rejects(store.loadEvent(otherOwner, eventId), status(404));
  await assert.rejects(store.deleteEvent(otherOwner, eventId, 5), status(404));
  for (const {sql, args} of calls.filter(({sql}) => sql.startsWith('SELECT e.*'))) {
    assert.match(sql, /JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=\? AND e.id=\?/);
    assert.deepEqual(args, [otherOwner, eventId]);
  }
  assert.ok(!calls.some(({sql}) => /^(DELETE|UPDATE|INSERT)/.test(sql)));
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
});

test('stale calendar and event revisions roll back before writes; SQL revision guards also reject races', async () => {
  const a = fixture();
  await assert.rejects(a.store.saveCalendar(owner, calendarId, {name: 'New', color: '#123456', revision: 2}), status(409));
  await assert.rejects(a.store.saveEvent(owner, eventId, event, 4), status(409));
  assert.ok(!a.calls.some(({sql}) => /^(DELETE|UPDATE|INSERT)/.test(sql)));
  assert.equal(a.state.rollbacks, 2);
  const b = fixture(sql => sql.startsWith('UPDATE calendar_calendars') ? {affectedRows: 0} : undefined);
  await assert.rejects(b.store.saveCalendar(owner, calendarId, {name: 'New', color: '#123456', revision: 3}), status(409));
  const update = b.calls.find(({sql}) => sql.startsWith('UPDATE calendar_calendars'));
  assert.match(update.sql, /WHERE owner_id=\? AND id=\? AND revision=\?/);
  assert.deepEqual(update.args.slice(-3), [owner, calendarId, 3]);
  assert.equal(b.state.commits, 0);
  assert.equal(b.state.rollbacks, 1);
});

test('event create validates destination ownership and serializes owner quotas; audit never includes appointment text', async () => {
  const a = fixture();
  const created = await a.store.createEvent(owner, {...event, ownerId: otherOwner});
  assert.equal(created.revision, 1);
  assert.deepEqual(a.calls[0].args, [owner]);
  const owned = a.calls.find(({sql}) => sql.startsWith('SELECT id,name,color'));
  assert.deepEqual(owned.args, [owner, calendarId]);
  assert.match(owned.sql, /FOR UPDATE$/);
  const audit = a.calls.find(({sql}) => sql.startsWith('INSERT INTO calendar_audit_log'));
  assert.doesNotMatch(JSON.stringify(audit), /Private title|Private notes|Private location/);
  const b = fixture(sql => sql.startsWith('SELECT COUNT(*) AS n FROM calendar_events ') ? [{n: 10_000}] : undefined);
  await assert.rejects(b.store.createEvent(owner, event), status(429));
  assert.ok(!b.calls.some(({sql}) => sql.startsWith('INSERT INTO calendar_events')));
  const c = fixture((sql, args) => sql.startsWith('SELECT id,name,color') && args[1] === 'foreign-calendar' ? [] : undefined);
  await assert.rejects(c.store.createEvent(owner, {...event, calendarId: 'foreign-calendar'}), status(404));
  assert.ok(!c.calls.some(({sql}) => sql.startsWith('INSERT INTO calendar_events')));
});

test('all database operations roll back and release on a mid-transaction storage failure', async () => {
  const {store, state} = fixture(sql => {
    if (sql.startsWith('INSERT INTO calendar_audit_log')) throw new Error('Fixture disk failure');
  });
  await assert.rejects(store.createEvent(owner, event), /Fixture disk failure/);
  assert.deepEqual(state, {begins: 1, commits: 0, rollbacks: 1, releases: 1});
});

test('visible event queries are owner scoped, fetch moved exceptions independently and reject overflow explicitly', async () => {
  const a = fixture(sql => sql.startsWith('SELECT x.event_id') ? [{...exceptionRow, cancelled: 0, override_json: JSON.stringify({...event, title: 'Moved'})}] : undefined);
  const results = await a.store.listEvents(owner, {start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z'});
  assert.equal(results[0].exceptions[0].override.title, 'Moved');
  assert.equal(results[0].startLocal, event.startLocal);
  const query = a.calls.find(({sql}) => sql.startsWith('SELECT e.*'));
  assert.match(query.sql, /WHERE c.owner_id=\? AND c.visible=TRUE/);
  assert.match(query.sql, /OR EXISTS\(SELECT 1 FROM calendar_event_exceptions x/);
  assert.match(query.sql, /override_start_utc<\? AND x.override_end_utc>\?/);
  assert.match(query.sql, /LIMIT 1001$/);
  assert.equal(query.args[0], owner);
  assert.ok(query.args.includes('2026-09-30'));
  assert.ok(query.args.includes('2026-11-02'));
  const exceptions = a.calls.find(({sql}) => sql.startsWith('SELECT x.event_id'));
  assert.match(exceptions.sql, /WHERE c.owner_id=\? AND e.id IN\(\?\)/);
  assert.deepEqual(exceptions.args, [owner, eventId]);
  const b = fixture(sql => sql.startsWith('SELECT e.*') ? Array.from({length: 1001}, () => eventRow) : undefined);
  await assert.rejects(b.store.listEvents(owner, {start: event.startUtc, end: event.endUtc}), status(429));
  assert.ok(!b.calls.some(({sql}) => sql.startsWith('SELECT x.event_id')));
});

test('calendar display preferences reject foreign calendar IDs and scope visibility changes to the owner', async () => {
  const a = fixture();
  await assert.rejects(a.store.savePreferences(owner, {view: 'dayGridMonth', timeZone: 'America/New_York', visibleCalendarIds: ['foreign-calendar']}), status(404));
  assert.ok(!a.calls.some(({sql}) => /^(UPDATE|INSERT)/.test(sql)));
  const b = fixture();
  await b.store.savePreferences(owner, {view: 'listMonth', timeZone: 'America/Denver', visibleCalendarIds: [calendarId]});
  const visibility = b.calls.find(({sql}) => sql.startsWith('UPDATE calendar_calendars'));
  assert.match(visibility.sql, /visible=IF\(id IN\(\?\),TRUE,FALSE\) WHERE owner_id=\?/);
  assert.deepEqual(visibility.args, [calendarId, owner]);
  const c = fixture();
  await c.store.savePreferences(owner, {view: 'listMonth', timeZone: 'UTC', visibleCalendarIds: []});
  const hidden = c.calls.find(({sql}) => sql.startsWith('UPDATE calendar_calendars'));
  assert.equal(hidden.sql, 'UPDATE calendar_calendars SET visible=FALSE WHERE owner_id=?');
  assert.deepEqual(hidden.args, [owner]);
});

test('series metadata edits preserve cancellations; schedule edits require explicit reset confirmation', async () => {
  const withExceptions = sql => sql.startsWith('SELECT x.event_id') ? [exceptionRow] : undefined;
  const a = fixture(withExceptions);
  const edited = await a.store.saveEvent(owner, eventId, {...event, title: 'Updated notes'}, 5);
  assert.equal(edited.exceptions[0].cancelled, true);
  assert.ok(!a.calls.some(({sql}) => sql.startsWith('DELETE x')));
  const b = fixture(withExceptions);
  await assert.rejects(b.store.saveEvent(owner, eventId, {...event, startLocal: '2026-10-11T08:00'}, 5), status(409));
  assert.ok(!b.calls.some(({sql}) => /^(DELETE|UPDATE|INSERT)/.test(sql)));
  const c = fixture(withExceptions);
  const reset = await c.store.saveEvent(owner, eventId, {...event, startLocal: '2026-10-11T08:00'}, 5, {resetExceptions: true});
  assert.deepEqual(reset.exceptions, []);
  const deleted = c.calls.find(({sql}) => sql.startsWith('DELETE x'));
  assert.match(deleted.sql, /WHERE c.owner_id=\? AND e.id=\?/);
  assert.deepEqual(deleted.args, [owner, eventId]);
});

test('occurrence writes are unique and owner scoped, bound to the source calendar and increment series revision', async () => {
  const a = fixture(sql => {
    if (sql.startsWith('SELECT e.*')) return [{...eventRow, rrule: 'FREQ=WEEKLY'}];
    if (sql.startsWith('INSERT INTO calendar_event_exceptions')) return {affectedRows: 0};
  });
  const changed = await a.store.saveOccurrence(owner, eventId, {revision: 5, occurrenceStart: event.startLocal, cancelled: false, override: {...event, calendarId: 'foreign-calendar'}});
  assert.equal(changed.revision, 6);
  const insert = a.calls.find(({sql}) => sql.startsWith('INSERT INTO calendar_event_exceptions'));
  assert.match(insert.sql, /WHERE c.owner_id=\? AND e.id=\?/);
  assert.match(insert.sql, /ON DUPLICATE KEY UPDATE/);
  assert.equal(JSON.parse(insert.args[3]).calendarId, calendarId);
  assert.deepEqual(insert.args.slice(-2), [owner, eventId]);
  const revision = a.calls.find(({sql}) => sql.startsWith('UPDATE calendar_events'));
  assert.match(revision.sql, /WHERE c.owner_id=\? AND e.id=\? AND e.revision=\?/);
  assert.deepEqual(revision.args, [owner, eventId, 5]);
  const b = fixture(sql => {
    if (sql.startsWith('SELECT e.*')) return [{...eventRow, rrule: 'FREQ=WEEKLY'}];
    if (sql.startsWith('SELECT COUNT(*)')) return [{n: 1000, existing: 0}];
  });
  await assert.rejects(b.store.saveOccurrence(owner, eventId, {revision: 5, occurrenceStart: event.startLocal, cancelled: true, override: null}), status(429));
  assert.ok(!b.calls.some(({sql}) => sql.startsWith('INSERT INTO calendar_event_exceptions')));
});

test('calendar and event deletion require owner and revision; calendar FK cascades remain confined to its children', async () => {
  const a = fixture();
  await a.store.deleteCalendar(owner, calendarId, 3);
  await a.store.deleteEvent(owner, eventId, 5);
  for (const {sql, args} of a.calls.filter(({sql}) => sql.startsWith('DELETE '))) {
    assert.match(sql, /owner_id=\? AND (?:e\.)?id=\? AND (?:e\.)?revision=\?/);
    assert.equal(args[0], owner);
  }
  const migration = await readFile(new URL('../database/migrations/009_native_calendar.sql', import.meta.url), 'utf8');
  assert.match(migration, /FOREIGN KEY\(calendar_id\) REFERENCES calendar_calendars\(id\) ON DELETE CASCADE/);
  assert.match(migration, /FOREIGN KEY\(event_id\) REFERENCES calendar_events\(id\) ON DELETE CASCADE/);
  assert.match(migration, /UNIQUE calendar_exception_occurrence\(event_id,occurrence_start\)/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 6);
  assert.doesNotMatch(migration, /\b(?:DROP TABLE|TRUNCATE TABLE|ALTER TABLE)\b/i);
});

test('shared write quota locks owner before checking and rejects the 121st attempt without raising the counter', async () => {
  const a = fixture(sql => sql.startsWith('SELECT attempts,') ? [{attempts: 120, active: 1}] : undefined);
  assert.equal(await a.store.allowWrite(owner), false);
  assert.equal(a.calls[0].sql, 'SELECT id FROM member_accounts WHERE id=? FOR UPDATE');
  assert.ok(!a.calls.some(({sql}) => sql.startsWith('INSERT INTO calendar_write_limits')));
  const b = fixture(sql => sql.startsWith('SELECT attempts,') ? [{attempts: 120, active: 0}] : undefined);
  assert.equal(await b.store.allowWrite(owner), true);
  const insert = b.calls.find(({sql}) => sql.startsWith('INSERT INTO calendar_write_limits'));
  assert.deepEqual(insert.args, [owner]);
  assert.match(insert.sql, /INTERVAL 1 MINUTE/);
});

test('events read quota blocks the 61st range request and keeps navigation counters independent of edits', async () => {
  const blocked = fixture(sql => sql.startsWith('SELECT read_attempts,') ? [{read_attempts: 60, active: 1}] : undefined);
  assert.equal(await blocked.store.allowRead(owner), false);
  assert.equal(blocked.calls[0].sql, 'SELECT id FROM member_accounts WHERE id=? FOR UPDATE');
  assert.deepEqual(blocked.calls[0].args, [owner]);
  assert.ok(!blocked.calls.some(({sql}) => sql.startsWith('INSERT INTO calendar_write_limits')));
  assert.deepEqual(blocked.state, {begins: 1, commits: 1, rollbacks: 0, releases: 1});
  const allowed = fixture(sql => sql.startsWith('SELECT read_attempts,') ? [{read_attempts: 59, active: 1}] : undefined);
  assert.equal(await allowed.store.allowRead(owner), true);
  const readCounter = allowed.calls.find(({sql}) => sql.startsWith('INSERT INTO calendar_write_limits'));
  assert.deepEqual(readCounter.args, [owner]);
  assert.match(readCounter.sql, /read_attempts=IF\(read_window_started_at/);
  assert.doesNotMatch(readCounter.sql, /(?:\(|,)attempts|[^_]window_started_at=/);
  const expired = fixture(sql => sql.startsWith('SELECT read_attempts,') ? [{read_attempts: 60, active: 0}] : undefined);
  assert.equal(await expired.store.allowRead(owner), true);
  await expired.store.allowWrite(owner);
  const writeCounter = expired.calls.find(({sql}) => sql.startsWith('INSERT INTO calendar_write_limits(owner_id,window_started_at'));
  assert.doesNotMatch(writeCounter.sql, /read_attempts|read_window_started_at/);
  const migration = await readFile(new URL('../database/migrations/009_native_calendar.sql', import.meta.url), 'utf8');
  assert.match(migration, /read_window_started_at DATETIME\(6\) NOT NULL DEFAULT CURRENT_TIMESTAMP\(6\)/);
  assert.match(migration, /read_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0/);
});

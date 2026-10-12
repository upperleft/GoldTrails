import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {CalendarError, validateCalendar, validateEvent, validateRange} from '../app/calendar/model.js';
import {expandEvent, isOccurrence} from '../app/calendar/recurrence.js';

const calendarId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const base = {calendarId, title: 'River lesson', description: 'Bring a pan', location: 'Visitor center', timeZone: 'America/New_York', allDay: false, startLocal: '2026-03-01T09:00', endLocal: '2026-03-01T10:00'};
const event = (changes = {}) => ({id: eventId, revision: 7, ...validateEvent({...base, ...changes})});
const range = (start, end) => ({start: `${start}T00:00:00Z`, end: `${end}T00:00:00Z`});

test('calendar and event validation produces canonical safe bounded fields', () => {
  assert.deepEqual(validateCalendar({name: '  Field trips  ', color: '#AB12EF'}), {name: 'Field trips', color: '#ab12ef'});
  const checked = validateEvent({...base, title: '  Lesson  ', rrule: 'rrule:freq=weekly;count=3;byday=su'});
  assert.equal(checked.title, 'Lesson');
  assert.equal(checked.startUtc, '2026-03-01T14:00:00.000Z');
  assert.equal(checked.rrule, 'FREQ=WEEKLY;BYDAY=SU;COUNT=3');
  assert.throws(() => validateCalendar({name: '', color: 'red'}), CalendarError);
  assert.throws(() => validateEvent({...base, calendarId: '1'}), /calendar/);
  assert.throws(() => validateEvent({...base, timeZone: 'Mars/Crater'}), /time zone/);
  assert.throws(() => validateEvent({...base, allDay: 'false'}), /all day/);
  assert.throws(() => validateEvent({...base, startLocal: '2026-02-30T09:00'}), /valid local/);
  assert.throws(() => validateEvent({...base, startLocal: '2026-03-01T09:00Z'}), /local times/);
  assert.throws(() => validateEvent({...base, endLocal: base.startLocal}), /end must follow/);
  assert.throws(() => validateEvent({...base, endLocal: '2026-07-01T10:00'}), /93 days/);
});

test('range validation accepts explicit offsets and enforces time and size bounds', () => {
  assert.deepEqual(validateRange('2026-10-01T00:00:00-04:00', '2026-11-01T00:00:00-04:00'), {start: '2026-10-01T04:00:00.000Z', end: '2026-11-01T04:00:00.000Z'});
  for (const args of [['2026-01-01', '2026-02-01'], ['2026-01-01T00:00:00Z', '2026-05-01T00:00:00Z'], ['2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z'], ['1999-12-31T00:00:00Z', '2000-01-01T00:00:00Z']]) {
    assert.throws(() => validateRange(...args), CalendarError);
  }
  for (const offset of ['+99:99', '+25:00', '+14:60']) assert.throws(() => validateRange(`2026-01-01T00:00:00${offset}`, `2026-01-02T00:00:00${offset}`), /ISO timestamps/);
});

test('weekly 09:00 recurrences preserve wall time across spring and fall DST', () => {
  const spring = expandEvent(event({rrule: 'FREQ=WEEKLY;COUNT=3'}), range('2026-03-01', '2026-03-25'));
  assert.deepEqual(spring.map(x => x.start), ['2026-03-01T14:00:00.000Z', '2026-03-08T13:00:00.000Z', '2026-03-15T13:00:00.000Z']);
  assert.ok(spring.every(x => x.startLocal.endsWith('T09:00') && x.endLocal.endsWith('T10:00')));
  const fall = expandEvent(event({startLocal: '2026-10-25T09:00', endLocal: '2026-10-25T10:00', rrule: 'FREQ=WEEKLY;COUNT=3'}), range('2026-10-20', '2026-11-15'));
  assert.deepEqual(fall.map(x => x.start), ['2026-10-25T13:00:00.000Z', '2026-11-01T14:00:00.000Z', '2026-11-08T14:00:00.000Z']);
});

test('nonexistent local starts reject anchors and do not consume recurrence count', () => {
  assert.throws(() => validateEvent({...base, startLocal: '2026-03-08T02:30', endLocal: '2026-03-08T03:30'}), /Daylight-saving gaps/);
  const gapSeries = event({startLocal: '2026-03-07T02:30', endLocal: '2026-03-07T03:30', rrule: 'FREQ=DAILY;COUNT=3'});
  const list = expandEvent(gapSeries, range('2026-03-06', '2026-03-12'));
  assert.deepEqual(list.map(x => x.occurrenceStart), ['2026-03-07T02:30', '2026-03-09T02:30', '2026-03-10T02:30']);
  assert.equal(isOccurrence(gapSeries, '2026-03-08T02:30'), false);
  assert.equal(isOccurrence(gapSeries, '2026-03-10T02:30'), true);
  assert.equal(isOccurrence(gapSeries, '2026-03-11T02:30'), false);
});

test('ambiguous fall-back wall times select the first offset deterministically', () => {
  const folded = event({startLocal: '2026-11-01T01:30', endLocal: '2026-11-01T02:30'});
  assert.equal(folded.startUtc, '2026-11-01T05:30:00.000Z');
  const list = expandEvent(folded, range('2026-11-01', '2026-11-02'));
  assert.equal(list.length, 1);
  assert.equal(list[0].start, folded.startUtc);
  assert.equal(list[0].end, '2026-11-01T07:30:00.000Z');
});

test('fold endpoints use a later offset only when necessary to keep a positive duration', () => {
  const same = event({startLocal: '2026-11-01T01:45', endLocal: '2026-11-01T01:45'});
  assert.equal(same.startUtc, '2026-11-01T05:45:00.000Z');
  assert.equal(same.endUtc, '2026-11-01T06:45:00.000Z');
  const earlier = event({startLocal: '2026-11-01T01:50', endLocal: '2026-11-01T01:10'});
  assert.equal(Date.parse(earlier.endUtc) - Date.parse(earlier.startUtc), 20 * 60000);
  assert.throws(() => event({startLocal: '2026-11-02T01:45', endLocal: '2026-11-02T01:45'}), /end must follow/);
  assert.throws(() => event({startLocal: '2026-11-02T01:50', endLocal: '2026-11-02T01:10'}), /end must follow/);
  const series = event({startLocal: '2026-10-31T01:45', endLocal: '2026-10-31T02:45', rrule: 'FREQ=DAILY;COUNT=2'});
  const folded = expandEvent(series, range('2026-11-01', '2026-11-02'))[0];
  assert.equal(folded.startLocal, folded.endLocal);
  const edited = validateEvent({...folded, title: 'Changed during the repeated hour', rrule: null});
  assert.equal(edited.startUtc, folded.start);
  assert.equal(edited.endUtc, folded.end);
  const saved = expandEvent(series, range('2026-11-01', '2026-11-02'), [{occurrenceStart: folded.occurrenceStart, cancelled: false, override: edited}]);
  assert.equal(saved[0].end, folded.end);
});

test('monthly day 31 and leap-day yearly rules skip invalid calendar dates', () => {
  const month = event({startLocal: '2026-01-31T09:00', endLocal: '2026-01-31T10:00', rrule: 'FREQ=MONTHLY;COUNT=3'});
  assert.deepEqual(expandEvent(month, range('2026-02-01', '2026-05-01')).map(x => x.occurrenceStart), ['2026-03-31T09:00']);
  assert.equal(isOccurrence(month, '2026-05-31T09:00'), true);
  assert.equal(isOccurrence(month, '2026-07-31T09:00'), false);
  const leap = event({startLocal: '2024-02-29T09:00', endLocal: '2024-02-29T10:00', rrule: 'FREQ=YEARLY;COUNT=2'});
  assert.equal(isOccurrence(leap, '2025-02-28T09:00'), false);
  assert.equal(isOccurrence(leap, '2028-02-29T09:00'), true);
  assert.equal(isOccurrence(leap, '2032-02-29T09:00'), false);
});

test('monthly ordinal weekdays and weekly selected days use the supported rule subset', () => {
  const monthly = event({startLocal: '2026-03-10T09:00', endLocal: '2026-03-10T10:00', rrule: 'FREQ=MONTHLY;BYDAY=2TU;COUNT=3'});
  assert.deepEqual(expandEvent(monthly, range('2026-03-01', '2026-06-01')).map(x => x.occurrenceStart), ['2026-03-10T09:00', '2026-04-14T09:00', '2026-05-12T09:00']);
  const weekly = event({startLocal: '2026-03-02T09:00', endLocal: '2026-03-02T10:00', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4'});
  assert.deepEqual(expandEvent(weekly, range('2026-03-01', '2026-03-20')).map(x => x.occurrenceStart), ['2026-03-02T09:00', '2026-03-04T09:00', '2026-03-09T09:00', '2026-03-11T09:00']);
});

test('UNTIL is inclusive in true UTC for timed rules and date-only for all-day rules', () => {
  const until = event({rrule: 'FREQ=WEEKLY;UNTIL=20260308T130000Z'});
  assert.deepEqual(expandEvent(until, range('2026-03-01', '2026-03-25')).map(x => x.occurrenceStart), ['2026-03-01T09:00', '2026-03-08T09:00']);
  const day = event({allDay: true, startLocal: '2026-03-01', endLocal: '2026-03-02', rrule: 'FREQ=DAILY;UNTIL=20260303'});
  assert.deepEqual(expandEvent(day, range('2026-03-01', '2026-03-10')).map(x => x.start), ['2026-03-01', '2026-03-02', '2026-03-03']);
  const foldUntil = event({startLocal: '2026-10-31T01:45', endLocal: '2026-10-31T02:45', rrule: 'FREQ=DAILY;UNTIL=20261101T061500Z'});
  assert.deepEqual(expandEvent(foldUntil, range('2026-10-30', '2026-11-03')).map(x => x.start), ['2026-10-31T05:45:00.000Z', '2026-11-01T05:45:00.000Z']);
  assert.equal(isOccurrence(foldUntil, '2026-11-01T01:45'), true);
});

test('skipped and edited occurrences retain original identity and moved exceptions enter new ranges', () => {
  const series = event({rrule: 'FREQ=WEEKLY;COUNT=3'});
  const moved = validateEvent({...base, title: 'Moved lesson', startLocal: '2026-05-02T15:00', endLocal: '2026-05-02T16:00'});
  const changes = [{occurrenceStart: '2026-03-08T09:00', cancelled: true, override: null}, {occurrenceStart: '2026-03-15T09:00', cancelled: false, override: moved}];
  const march = expandEvent(series, range('2026-03-01', '2026-03-25'), changes);
  assert.deepEqual(march.map(x => x.occurrenceStart), ['2026-03-01T09:00']);
  const may = expandEvent(series, range('2026-05-01', '2026-05-10'), changes);
  assert.equal(may.length, 1);
  assert.equal(may[0].id, `${eventId}:2026-03-15T09:00`);
  assert.equal(may[0].occurrenceStart, '2026-03-15T09:00');
  assert.equal(may[0].startLocal, '2026-05-02T15:00');
  assert.equal(may[0].title, 'Moved lesson');
  assert.equal(may[0].revision, 7);
});

test('all-day output remains date-only with exclusive end across DST and viewer offsets', () => {
  const day = event({allDay: true, timeZone: 'America/New_York', startLocal: '2026-03-07', endLocal: '2026-03-10', rrule: 'FREQ=WEEKLY;COUNT=2'});
  const list = expandEvent(day, {start: '2026-03-01T00:00:00+14:00', end: '2026-03-20T00:00:00+14:00'});
  assert.deepEqual(list.map(x => [x.start, x.end]), [['2026-03-07', '2026-03-10'], ['2026-03-14', '2026-03-17']]);
  const edge = event({allDay: true, timeZone: 'Pacific/Honolulu', startLocal: '2026-03-31', endLocal: '2026-04-01'});
  assert.equal(expandEvent(edge, {start: '2026-03-01T00:00:00+14:00', end: '2026-04-01T00:00:00+14:00'}).length, 1);
});

test('moving a series to another calendar rebinds retained occurrence overrides', () => {
  const targetCalendarId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const series = event({calendarId: targetCalendarId, rrule: 'FREQ=WEEKLY;COUNT=3'});
  const originalOverride = validateEvent({...base, title: 'Edited lesson', startLocal: '2026-03-15T15:00', endLocal: '2026-03-15T16:00'});
  const list = expandEvent(series, range('2026-03-01', '2026-03-25'), [{occurrenceStart: '2026-03-15T09:00', cancelled: false, override: originalOverride}]);
  assert.ok(list.every(item => item.calendarId === targetCalendarId));
  const edited = list.find(item => item.occurrenceStart === '2026-03-15T09:00');
  assert.equal(edited.title, 'Edited lesson');
  assert.equal(edited.startLocal, '2026-03-15T15:00');
  assert.equal(originalOverride.calendarId, calendarId);
});

test('timed overlaps are strict and recurrence identities reject foreign starts', () => {
  const one = event();
  assert.equal(expandEvent(one, {start: one.endUtc, end: '2026-03-02T00:00:00Z'}).length, 0);
  assert.equal(expandEvent(one, {start: '2026-03-01T14:30:00Z', end: '2026-03-01T14:45:00Z'}).length, 1);
  assert.equal(isOccurrence(one, one.startLocal), true);
  assert.equal(isOccurrence(one, '2026-03-02T09:00'), false);
});

test('old infinite daily and weekly rules preserve interval and weekday phase near the requested range', () => {
  const daily = event({timeZone: 'UTC', startLocal: '2000-01-01T09:00', endLocal: '2000-01-01T10:00', rrule: 'FREQ=DAILY;INTERVAL=3;BYDAY=MO,TU,WE,TH,FR'});
  assert.deepEqual(expandEvent(daily, range('2026-03-01', '2026-03-15')).map(item => item.startLocal), ['2026-03-03T09:00', '2026-03-06T09:00', '2026-03-09T09:00', '2026-03-12T09:00']);
  const weekly = event({timeZone: 'UTC', startLocal: '2000-01-02T09:00', endLocal: '2000-01-02T10:00', rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;WKST=SU'});
  assert.deepEqual(expandEvent(weekly, range('2026-03-01', '2026-03-15')).map(item => item.startLocal), ['2026-03-09T09:00', '2026-03-11T09:00']);
  assert.equal(isOccurrence(weekly, '2026-03-09T09:00'), true);
  assert.equal(isOccurrence(weekly, '2026-03-02T09:00'), false);
  const impossible = event({timeZone: 'UTC', startLocal: '2000-01-01T09:00', endLocal: '2000-01-01T10:00', rrule: 'FREQ=DAILY;INTERVAL=14;BYDAY=MO,WE'});
  assert.deepEqual(expandEvent(impossible, range('2099-01-01', '2099-02-01')), []);
  assert.equal(isOccurrence(impossible, '2099-01-01T09:00'), false);
  assert.deepEqual(expandEvent(event({rrule: 'FREQ=DAILY;BYMONTH=2;BYMONTHDAY=31'}), range('2099-01-01', '2099-02-01')), []);
});

test('expansion and occurrence validation enforce a recoverable monotonic time budget', () => {
  const series = event({rrule: 'FREQ=DAILY'});
  const run = operation => {
    let calls = 0;
    const clock = mock.method(performance, 'now', () => ++calls === 1 ? 0 : 300);
    try {
      assert.throws(operation, error => error instanceof CalendarError && error.status === 429 && /simplify/.test(error.message));
    } finally {
      clock.mock.restore();
    }
  };
  run(() => expandEvent(series, range('2026-03-01', '2026-03-10')));
  run(() => isOccurrence(series, '2026-03-02T09:00'));
});

test('unsafe rules, excessive bounds, and duplicate exceptions are rejected', () => {
  for (const rrule of ['FREQ=SECONDLY', 'FREQ=DAILY;COUNT=1001', 'FREQ=DAILY;COUNT=3;UNTIL=20260401T000000Z', 'FREQ=DAILY;INTERVAL=0', 'FREQ=DAILY;INTERVAL=366', 'FREQ=DAILY;BYHOUR=1', 'FREQ=WEEKLY;BYDAY=2TU', 'FREQ=MONTHLY;BYDAY=0TU', 'FREQ=DAILY;COUNT=1;COUNT=2', 'FREQ=DAILY\nRRULE:FREQ=WEEKLY', 'FREQ=DAILY;UNTIL=20260230T000000Z', 'FREQ=DAILY;UNTIL=20260301']) {
    assert.throws(() => validateEvent({...base, rrule}), CalendarError, rrule);
  }
  assert.throws(() => validateEvent({...base, startLocal: '1999-12-31T09:00'}), CalendarError);
  assert.throws(() => validateEvent({...base, startLocal: '2101-01-01T09:00'}), CalendarError);
  const one = event();
  const change = {occurrenceStart: one.startLocal, cancelled: true};
  assert.throws(() => expandEvent(one, range('2026-03-01', '2026-03-10'), [change, change]), /duplicate/);
  assert.throws(() => expandEvent(one, range('2026-03-01', '2026-03-10'), Array(1001).fill(change)), /Too many/);
  // Impossible month/day combinations still terminate at the supported year cap.
  assert.deepEqual(expandEvent(event({rrule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=31'}), range('2099-01-01', '2099-03-01')), []);
});

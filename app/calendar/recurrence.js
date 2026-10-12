import {DateTime} from 'luxon';
import {performance} from 'node:perf_hooks';
import rrulePackage from 'rrule';
import {CalendarError, floatingDate, localString, parseLocal, parseRecurrenceRule, validateEvent, validateRange} from './model.js';

const {RRule} = rrulePackage;
const DAY = 86400000;
const MAX_CANDIDATES = 40000;
const MAX_RESULTS = 1200;
const LAST_WALL_INSTANT = Date.UTC(2100, 11, 31, 23, 59);
const EXPANSION_BUDGET_MS = 250;

function checkBudget(deadline) {
  if (performance.now() > deadline) throw new CalendarError('This series takes too long to expand. Hide its calendar or simplify the repeat rule and try again.', 429);
}

function normalized(event) {
  return {...event, ...validateEvent(event)};
}

function rangeBounds(range, allDay) {
  const checked = validateRange(range.start, range.end);
  const start = Date.parse(checked.start), end = Date.parse(checked.end);
  // Date-only events have no viewer offset. A boundary margin lets FullCalendar
  // apply its own date filtering without dropping a day in UTC+14 or UTC-12.
  return {start: start - (allDay ? DAY : 0), end: end + (allDay ? DAY : 0)};
}

function occurrence(event, local, originalLocal = local) {
  const start = parseLocal(local, event.timeZone, event.allDay, {skipInvalid: true});
  if (!start) return null;
  let end, endLocal;
  if (event.allDay) {
    const days = (floatingDate(event.endLocal, true) - floatingDate(event.startLocal, true)) / DAY;
    endLocal = DateTime.fromISO(local, {zone: 'UTC'}).plus({days}).toISODate();
    // Exclusive end dates remain date-only even if the local offset changes.
    end = DateTime.fromISO(endLocal, {zone: event.timeZone});
  } else {
    // RFC 5545 DTEND gives each repeated event the same exact duration. The
    // recurrence start remains a wall time, so 09:00 stays 09:00 across DST.
    end = start.plus({milliseconds: Date.parse(event.endUtc) - Date.parse(event.startUtc)});
    endLocal = localString(end, false);
  }
  return {
    id: `${event.id}:${originalLocal}`,
    eventId: event.id,
    calendarId: event.calendarId,
    title: event.title,
    description: event.description,
    location: event.location,
    timeZone: event.timeZone,
    allDay: event.allDay,
    start: event.allDay ? local : start.toUTC().toISO(),
    end: event.allDay ? endLocal : end.toUTC().toISO(),
    occurrenceStart: originalLocal,
    revision: event.revision ?? 1,
    rrule: event.rrule,
    startLocal: local,
    endLocal,
  };
}

function overlaps(item, bounds) {
  const start = item.allDay ? floatingDate(item.start, true).getTime() : Date.parse(item.start);
  const end = item.allDay ? floatingDate(item.end, true).getTime() : Date.parse(item.end);
  return start < bounds.end && end > bounds.start;
}

function possibleCalendarFilters(options, anchor) {
  if (options.freq === RRule.DAILY && options.byweekday) {
    const weekday = (new Date(anchor).getUTCDay() + 6) % 7;
    const reachable = new Set(Array.from({length: 7}, (_, n) => (weekday + n * options.interval) % 7));
    if (!options.byweekday.some(day => reachable.has(day.weekday))) return false;
  }
  let months = options.bymonth || Array.from({length: 12}, (_, n) => n + 1);
  if (options.freq === RRule.MONTHLY) {
    const month = new Date(anchor).getUTCMonth();
    const reachable = new Set(Array.from({length: 12}, (_, n) => (month + n * options.interval) % 12 + 1));
    months = months.filter(value => reachable.has(value));
  } else if (options.freq === RRule.YEARLY && !options.bymonth && !options.bymonthday && !options.byweekday) {
    months = [new Date(anchor).getUTCMonth() + 1];
  }
  if (!months.length) return false;
  let monthDays = options.bymonthday;
  if (!monthDays && !options.byweekday && [RRule.MONTHLY, RRule.YEARLY].includes(options.freq)) monthDays = [new Date(anchor).getUTCDate()];
  if (!monthDays) return true;
  // February can have 29 days. This is a necessary-condition check, so it never
  // rejects a potentially valid leap-year or negative-month-day occurrence.
  const longestMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return months.some(month => monthDays.some(day => Math.abs(day) <= longestMonth[month - 1]));
}

function candidates(event, latest, earliest = null, deadline = performance.now() + EXPANSION_BUDGET_MS) {
  checkBudget(deadline);
  const spec = parseRecurrenceRule(event.rrule, event);
  if (!spec.options) return [event.startLocal];
  let cutoff = Math.min(latest, LAST_WALL_INSTANT);
  if (spec.until) {
    const lastLocal = event.allDay ? spec.until.local : localString(DateTime.fromMillis(spec.until.utc, {zone: event.timeZone}), false);
    // A UTC UNTIL can fall in the second offset of a fall-back fold. Keep a
    // wall-day margin here; the exact UTC comparison below remains definitive.
    cutoff = Math.min(cutoff, floatingDate(lastLocal, event.allDay).getTime() + (event.allDay ? 0 : DAY));
  }
  const anchor = floatingDate(event.startLocal, event.allDay).getTime();
  if (cutoff < anchor || (earliest !== null && cutoff < earliest)) return [];
  if (!possibleCalendarFilters(spec.options, anchor)) return [];
  let dtstart = new Date(anchor);
  // With no COUNT, daily and weekly periods can jump close to the range. An
  // integer number of original periods preserves INTERVAL, WKST and weekday
  // phase. Calendar-month/year rules retain their anchor and inferred dates.
  if (spec.count === null && earliest !== null && earliest > anchor && [RRule.DAILY, RRule.WEEKLY].includes(spec.options.freq)) {
    const period = DAY * spec.options.interval * (spec.options.freq === RRule.WEEKLY ? 7 : 1);
    dtstart = new Date(anchor + Math.floor((earliest - anchor) / period) * period);
  }
  const rule = new RRule({...spec.options, dtstart, until: new Date(cutoff)}, true);
  let inspected = 0, accepted = 0;
  const locals = [];
  const visit = date => {
    if (++inspected > MAX_CANDIDATES) throw new CalendarError('This repeat rule exceeds the expansion limit.', 422);
    if ((inspected & 15) === 1) checkBudget(deadline);
    const local = localString(DateTime.fromJSDate(date, {zone: 'UTC'}), event.allDay);
    const actual = parseLocal(local, event.timeZone, event.allDay, {skipInvalid: true});
    // Invalid dates are skipped by rrule; invalid DST starts are skipped here.
    // Neither consumes COUNT, as required by RFC 5545 recurrence semantics.
    if (!actual) return true;
    if (spec.until && (event.allDay ? local > spec.until.local : actual.toMillis() > spec.until.utc)) return false;
    accepted++;
    if (earliest === null || date.getTime() >= earliest) locals.push(local);
    return spec.count === null || accepted < spec.count;
  };
  if (spec.count !== null || earliest === null) rule.all(visit);
  else rule.between(new Date(earliest), new Date(cutoff), true, visit);
  checkBudget(deadline);
  return locals;
}

export function isOccurrence(input, occurrenceStart) {
  const deadline = performance.now() + EXPANSION_BUDGET_MS;
  const event = normalized(input);
  const target = parseLocal(occurrenceStart, event.timeZone, event.allDay, {skipInvalid: true});
  if (!target || occurrenceStart < event.startLocal) return false;
  if (!event.rrule) return occurrenceStart === event.startLocal;
  const instant = floatingDate(occurrenceStart, event.allDay).getTime();
  return candidates(event, instant, instant, deadline).includes(occurrenceStart);
}

export function expandEvent(input, range, exceptions = []) {
  const deadline = performance.now() + EXPANSION_BUDGET_MS;
  const event = normalized(input);
  if (!Array.isArray(exceptions) || exceptions.length > 1000) throw new CalendarError('Too many occurrence exceptions.', 422);
  const bounds = rangeBounds(range, event.allDay);
  const changes = new Map();
  for (const change of exceptions) {
    if ((changes.size & 15) === 0) checkBudget(deadline);
    if (!change || typeof change !== 'object' || !parseLocal(change.occurrenceStart, event.timeZone, event.allDay, {skipInvalid: true}) || changes.has(change.occurrenceStart)) throw new CalendarError('Invalid or duplicate occurrence exception.');
    changes.set(change.occurrenceStart, change);
  }
  const result = [], seen = new Set();
  const alternateBounds = rangeBounds(range, !event.allDay);
  const add = item => {
    if ((result.length & 15) === 0) checkBudget(deadline);
    if (!item || seen.has(item.occurrenceStart) || !overlaps(item, item.allDay === event.allDay ? bounds : alternateBounds)) return;
    if (result.length >= MAX_RESULTS) throw new CalendarError('This calendar range contains too many occurrences.', 422);
    seen.add(item.occurrenceStart);
    result.push(item);
  };
  const duration = event.allDay ? floatingDate(event.endLocal, true) - floatingDate(event.startLocal, true) : Date.parse(event.endUtc) - Date.parse(event.startUtc);
  // UTC offsets can differ from the wall container by up to fourteen hours;
  // the margin also covers exact-duration events crossing a DST transition.
  const earliest = bounds.start - duration - 2 * DAY;
  const latest = bounds.end + 2 * DAY;
  for (const local of candidates(event, latest, earliest, deadline)) {
    const change = changes.get(local);
    if (!change || (!change.cancelled && !change.override)) add(occurrence(event, local));
    // Overrides are evaluated independently below, including moved-in ones.
  }
  for (const change of changes.values()) {
    checkBudget(deadline);
    if (change.cancelled || !change.override) continue;
    // A series move changes its owning calendar. Stored occurrence overrides
    // keep their dates and content, but inherit the current parent calendar.
    const replacement = validateEvent({...change.override, calendarId: event.calendarId});
    if (replacement.rrule) throw new CalendarError('An occurrence override cannot repeat.');
    add(occurrence({...event, ...replacement, rrule: event.rrule}, replacement.startLocal, change.occurrenceStart));
  }
  checkBudget(deadline);
  return result.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

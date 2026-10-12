import {DateTime, IANAZone} from 'luxon';
import rrulePackage from 'rrule';

const {RRule} = rrulePackage;
const DAY = 86400000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export class CalendarError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CalendarError';
    this.status = status;
  }
}

function record(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CalendarError('Calendar data must be an object.');
}

function text(value, label, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw new CalendarError(`${label} must be text.`);
  const result = value.trim();
  if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    throw new CalendarError(`${label} must contain ${required ? '1' : '0'}–${max} characters.`);
  }
  return result;
}

export function validateCalendar(input) {
  record(input);
  const name = text(input.name, 'Calendar name', 80, true);
  const color = input.color === undefined ? '#ca8a04' : input.color;
  if (typeof color !== 'string' || !/^#[a-f\d]{6}$/i.test(color)) throw new CalendarError('Choose a six-digit calendar color.');
  return {name, color: color.toLowerCase()};
}

export function localString(value, allDay) {
  return value.toFormat(allDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm");
}

// Luxon normalizes a nonexistent wall time into the next valid time. Round-trip
// the requested components to reject it; folds always use the earliest instant.
export function parseLocal(value, timeZone, allDay, {skipInvalid = false} = {}) {
  if (typeof value !== 'string' || !(allDay ? LOCAL_DATE : LOCAL_TIME).test(value)) {
    if (skipInvalid) return null;
    throw new CalendarError(allDay ? 'Use YYYY-MM-DD for all-day dates.' : 'Use YYYY-MM-DDTHH:mm for local times.');
  }
  const dt = DateTime.fromISO(value, {zone: timeZone});
  if (!dt.isValid || localString(dt, allDay) !== value || dt.year < 2000 || dt.year > 2100) {
    if (skipInvalid) return null;
    throw new CalendarError('Choose a valid local date and time between 2000 and 2100. Daylight-saving gaps are unavailable.');
  }
  const choices = dt.getPossibleOffsets().sort((a, b) => a.toMillis() - b.toMillis());
  return choices[0] || dt;
}

// rrule receives UTC containers for wall components, never the host timezone.
export function floatingDate(local, allDay) {
  return DateTime.fromISO(allDay ? `${local}T00:00` : local, {zone: 'UTC'}).toJSDate();
}

function integer(value, min, max, label) {
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new CalendarError(`${label} must be ${min}–${max}.`);
  return Number(value);
}

export function parseRecurrenceRule(value, event) {
  if (value === undefined || value === null || value === '') return {text: null, options: null, count: null, until: null};
  if (typeof value !== 'string' || value.length > 500 || /[\r\n\s]/.test(value)) throw new CalendarError('Enter a single supported recurrence rule.');
  const raw = value.toUpperCase().replace(/^RRULE:/, '');
  const parts = new Map();
  const allowed = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL', 'BYMONTH', 'BYMONTHDAY', 'WKST']);
  for (const part of raw.split(';')) {
    const pair = part.split('=');
    if (pair.length !== 2 || !allowed.has(pair[0]) || parts.has(pair[0]) || !pair[1]) throw new CalendarError('Unsupported or duplicate recurrence option.');
    parts.set(pair[0], pair[1]);
  }
  const freq = parts.get('FREQ');
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) throw new CalendarError('Repeat daily, weekly, monthly, or yearly.');
  const options = {freq: RRule[freq], interval: integer(parts.get('INTERVAL') || '1', 1, 365, 'Repeat interval')};
  if (parts.has('COUNT') && parts.has('UNTIL')) throw new CalendarError('Choose an occurrence count or an end date, not both.');
  const count = parts.has('COUNT') ? integer(parts.get('COUNT'), 1, 1000, 'Occurrence count') : null;
  if (parts.has('BYDAY')) {
    const days = parts.get('BYDAY').split(',');
    if (days.length > 7 || new Set(days).size !== days.length) throw new CalendarError('Choose each repeat weekday only once.');
    options.byweekday = days.map(day => {
      const match = /^([+-]?[1-5])?(MO|TU|WE|TH|FR|SA|SU)$/.exec(day);
      if (!match || (match[1] && freq !== 'MONTHLY')) throw new CalendarError('Weekday ordinals are supported only for monthly repeats.');
      return match[1] ? RRule[match[2]].nth(Number(match[1])) : RRule[match[2]];
    });
  }
  if (parts.has('WKST')) {
    if (!WEEKDAYS.includes(parts.get('WKST'))) throw new CalendarError('Invalid first weekday.');
    options.wkst = RRule[parts.get('WKST')];
  }
  for (const [key, target, max] of [['BYMONTH', 'bymonth', 12], ['BYMONTHDAY', 'bymonthday', 31]]) {
    if (!parts.has(key)) continue;
    if (key === 'BYMONTHDAY' && freq === 'WEEKLY') throw new CalendarError('Month days cannot be used with weekly repeats.');
    const list = parts.get(key).split(',');
    if (list.length > max || new Set(list).size !== list.length) throw new CalendarError('Invalid repeated month or month day.');
    options[target] = list.map(item => {
      if (key === 'BYMONTHDAY' && /^-\d+$/.test(item)) return -integer(item.slice(1), 1, max, key);
      return integer(item, 1, max, key);
    });
  }
  let until = null;
  if (parts.has('UNTIL')) {
    const ending = parts.get('UNTIL');
    if (event.allDay) {
      if (!/^\d{8}$/.test(ending)) throw new CalendarError('All-day repeat end dates must use YYYYMMDD.');
      const local = `${ending.slice(0, 4)}-${ending.slice(4, 6)}-${ending.slice(6, 8)}`;
      parseLocal(local, event.timeZone, true);
      if (local < event.startLocal) throw new CalendarError('The repeat end date precedes the event.');
      until = {local};
    } else {
      if (!/^\d{8}T\d{6}Z$/.test(ending)) throw new CalendarError('Timed repeat end dates must use UTC YYYYMMDDTHHmmssZ.');
      const dt = DateTime.fromFormat(ending, "yyyyMMdd'T'HHmmss'Z'", {zone: 'UTC'});
      if (!dt.isValid || dt.toFormat("yyyyMMdd'T'HHmmss'Z'") !== ending || dt.year < 2000 || dt.year > 2100 || dt.toMillis() < DateTime.fromISO(event.startUtc).toMillis()) throw new CalendarError('Choose a valid repeat end at or after the event.');
      until = {utc: dt.toMillis()};
    }
  }
  // Stable key ordering makes stored rules and optimistic edits comparable.
  const canonical = ['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTH', 'BYMONTHDAY', 'WKST', 'COUNT', 'UNTIL'].filter(k => parts.has(k)).map(k => `${k}=${parts.get(k)}`).join(';');
  return {text: canonical, options, count, until};
}

export function validateEvent(input) {
  record(input);
  if (typeof input.calendarId !== 'string' || !UUID.test(input.calendarId)) throw new CalendarError('Choose a valid calendar.');
  const title = text(input.title, 'Event title', 160, true);
  const description = text(input.description, 'Description', 4000);
  const location = text(input.location, 'Location', 500);
  if (typeof input.timeZone !== 'string' || input.timeZone.length > 100 || !IANAZone.isValidZone(input.timeZone)) throw new CalendarError('Choose a valid IANA time zone.');
  if (typeof input.allDay !== 'boolean') throw new CalendarError('Specify whether the event is all day.');
  const start = parseLocal(input.startLocal, input.timeZone, input.allDay);
  let end = parseLocal(input.endLocal, input.timeZone, input.allDay);
  if (!input.allDay && end.toMillis() <= start.toMillis()) {
    // During fall-back, a positive event may end at the same or an earlier wall
    // time in the repeated hour. Prefer the first offset unless a later one is
    // necessary to make the end follow the start.
    end = end.getPossibleOffsets().sort((a, b) => a.toMillis() - b.toMillis()).find(candidate => candidate.toMillis() > start.toMillis()) || end;
  }
  const wallDuration = floatingDate(input.endLocal, input.allDay) - floatingDate(input.startLocal, input.allDay);
  if ((input.allDay && wallDuration <= 0) || end.toMillis() <= start.toMillis()) throw new CalendarError('The event end must follow its start.');
  if (Math.abs(wallDuration) > 93 * DAY) throw new CalendarError('An event may last at most 93 days.');
  const event = {calendarId: input.calendarId, title, description, location, timeZone: input.timeZone, allDay: input.allDay, startLocal: input.startLocal, endLocal: input.endLocal, startUtc: start.toUTC().toISO(), endUtc: end.toUTC().toISO()};
  event.rrule = parseRecurrenceRule(input.rrule, event).text;
  return event;
}

export function validateRange(start, end) {
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) throw new CalendarError('Calendar ranges need ISO timestamps with UTC or an explicit offset.');
    const dt = DateTime.fromISO(value, {setZone: true});
    if (!dt.isValid || dt.toMillis() < Date.UTC(2000, 0, 1) || dt.toMillis() > Date.UTC(2101, 0, 1)) throw new CalendarError('Calendar range must be between 2000 and 2100.');
    return dt.toUTC();
  };
  const from = parse(start), to = parse(end);
  if (to.toMillis() <= from.toMillis() || to.toMillis() - from.toMillis() > 93 * DAY) throw new CalendarError('Request a calendar range of at most 93 days.');
  return {start: from.toISO(), end: to.toISO()};
}

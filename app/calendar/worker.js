import {parentPort} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {CalendarError, validateRange} from './model.js';
import {expandEvent, isOccurrence} from './recurrence.js';

const unavailable = 'Calendar calculations are temporarily unavailable. Please try again.';
const deadlineError = () => new CalendarError('This calendar calculation took too long. Choose a shorter date range or display fewer calendars.', 429);

function calculate(operation, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new CalendarError('Use the calendar controls to request a calculation.');
  if (operation === 'occurrence') return isOccurrence(payload.event, payload.occurrenceStart);
  if (operation !== 'expand') throw new CalendarError('Unsupported calendar calculation.');
  if (!Array.isArray(payload.events) || payload.events.length > 1000) throw new CalendarError('Choose a shorter date range or display fewer calendars.', 429);
  if (!payload.range || typeof payload.range !== 'object') throw new CalendarError('Choose a valid calendar date range.');
  const range = validateRange(payload.range.start, payload.range.end);
  const deadline = performance.now() + 1500;
  const results = [];
  let count = 0;
  for (const event of payload.events) {
    if (performance.now() > deadline) throw deadlineError();
    const occurrences = expandEvent(event, range, event.exceptions || []);
    if (performance.now() > deadline) throw deadlineError();
    count += occurrences.length;
    if (count > 5000) throw new CalendarError('Choose a shorter date range or display fewer calendars.', 422);
    results.push({eventId: event.id, occurrences});
  }
  return results;
}

parentPort.on('message', message => {
  const id = message?.id;
  try {
    const result = calculate(message?.operation, message?.payload);
    parentPort.postMessage({id, ok: true, result});
  } catch (error) {
    const safe = error instanceof CalendarError && [400, 422, 429].includes(error.status);
    parentPort.postMessage({id, ok: false, error: {status: safe ? error.status : 500, message: safe ? error.message : unavailable}});
  }
});

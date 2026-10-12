import {Worker} from 'node:worker_threads';
import {CalendarError} from './model.js';

const unavailable = () => new CalendarError('Calendar calculations are temporarily unavailable. Please try again.', 500);
const overloaded = () => new CalendarError('The calendar is busy. Please try again in a moment.', 429);
const timedOut = () => new CalendarError('This calendar calculation took too long. Choose a shorter date range or simplify the repeat rule.', 429);
const operations = new Set(['expand', 'occurrence']);

// A worker remains counted while termination is pending, so replacing a timed
// out calculation never temporarily exceeds the configured concurrency bound.
export function createRecurrencePool({maxWorkers = 2, maxQueued = 8, timeoutMs = 2000} = {}) {
  if (!Number.isInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > 2 || !Number.isInteger(maxQueued) || maxQueued < 0 || maxQueued > 100 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new RangeError('Use 1–2 recurrence workers, a bounded queue, and a positive timeout.');
  }
  const slots = new Set();
  const queue = [];
  let sequence = 0;
  let closed = false;
  let closing = null;

  function clearTask(slot) {
    const task = slot.task;
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    slot.task = null;
    return task;
  }

  function retire(slot, error = unavailable()) {
    if (slot.retiring) return slot.termination;
    slot.retiring = true;
    const task = clearTask(slot);
    if (task) task.reject(error);
    // terminate interrupts even an rrule scan that never reaches a cooperative
    // deadline check. Nothing from a worker error is logged or exposed.
    slot.termination = slot.worker.terminate().catch(() => {}).finally(() => {
      slots.delete(slot);
      pump();
    });
    return slot.termination;
  }

  function start(slot, task) {
    slot.task = task;
    slot.worker.ref();
    slot.timer = setTimeout(() => retire(slot, timedOut()), timeoutMs);
    try {
      slot.worker.postMessage({id: task.id, operation: task.operation, payload: task.payload});
    } catch {
      retire(slot, unavailable());
    }
  }

  function createSlot() {
    const worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'});
    const slot = {worker, task: null, timer: null, retiring: false, termination: null};
    slots.add(slot);
    worker.on('message', message => {
      if (slot.retiring) return;
      if (!slot.task || !message || message.id !== slot.task.id || typeof message.ok !== 'boolean') {
        retire(slot, unavailable());
        return;
      }
      const task = clearTask(slot);
      if (message.ok) task.resolve(message.result);
      else {
        const status = message.error?.status;
        const safe = [400, 422, 429].includes(status) && typeof message.error?.message === 'string' && message.error.message.length <= 500;
        task.reject(safe ? new CalendarError(message.error.message, status) : unavailable());
      }
      worker.unref();
      pump();
    });
    worker.on('error', () => retire(slot, unavailable()));
    worker.on('exit', () => {
      if (!slot.retiring) retire(slot, unavailable());
    });
    worker.unref();
    return slot;
  }

  function availableSlot() {
    for (const slot of slots) if (!slot.retiring && !slot.task) return slot;
    return slots.size < maxWorkers ? createSlot() : null;
  }

  function pump() {
    if (closed) return;
    while (queue.length) {
      let slot;
      try { slot = availableSlot(); }
      catch {
        queue.shift().reject(unavailable());
        continue;
      }
      if (!slot) break;
      start(slot, queue.shift());
    }
  }

  function run(operation, payload) {
    if (closed) return Promise.reject(unavailable());
    if (!operations.has(operation)) return Promise.reject(new CalendarError('Unsupported calendar calculation.', 400));
    return new Promise((resolve, reject) => {
      const task = {id: ++sequence, operation, payload, resolve, reject};
      let slot;
      try { slot = availableSlot(); }
      catch { reject(unavailable()); return; }
      if (slot) start(slot, task);
      else if (queue.length < maxQueued) queue.push(task);
      else reject(overloaded());
    });
  }

  function close() {
    if (closing) return closing;
    closed = true;
    for (const task of queue.splice(0)) task.reject(unavailable());
    closing = Promise.all([...slots].map(slot => retire(slot, unavailable()))).then(() => {});
    return closing;
  }

  return {run, close};
}

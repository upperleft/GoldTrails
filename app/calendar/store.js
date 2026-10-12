import {randomUUID} from 'node:crypto';
import {CalendarError} from './model.js';

const MAX_CALENDARS = 20;
const MAX_EVENTS = 10_000;
const MAX_CANDIDATES = 1000;
const MAX_EXCEPTIONS_PER_EVENT = 1000;
const MAX_LOADED_EXCEPTIONS = 10_000;
const DEFAULT_PREFERENCES = Object.freeze({view: 'dayGridMonth', timeZone: 'America/New_York'});
const parseJson = value => typeof value === 'string' ? JSON.parse(value) : value;
const sqlInstant = value => new Date(value).toISOString().replace('T', ' ').replace('Z', '');
const isoInstant = value => value instanceof Date ? value.toISOString() : new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
const missing = () => new CalendarError('Calendar or event not found.', 404);
const stale = () => new CalendarError('This item changed on another screen. Reload before saving.', 409);
const checkRevision = (row, revision) => {if (Number(row.revision) !== revision) throw stale();};

function calendarFromRow(row) {
  return {id: row.id, name: row.name, color: row.color, visible: Boolean(row.visible), revision: Number(row.revision)};
}

function eventFromRow(row) {
  return {
    id: row.id, calendarId: row.calendar_id, title: row.title, description: row.description,
    location: row.location, startLocal: row.start_local, endLocal: row.end_local, timeZone: row.time_zone,
    allDay: Boolean(row.all_day), startUtc: isoInstant(row.start_utc), endUtc: isoInstant(row.end_utc),
    rrule: row.rrule || null, revision: Number(row.revision), exceptions: [], ...(row.color ? {color: row.color} : {}),
  };
}

function exceptionFromRow(row) {
  return {occurrenceStart: row.occurrence_start, cancelled: Boolean(row.cancelled), override: row.override_json ? parseJson(row.override_json) : null};
}

// Only the authenticated account ID supplied by the server enters this store.
// MariaDB has no application-user RLS, so every read and write repeats the
// owner scope. All writes lock the account first, in a consistent order, which
// serializes quota checks and changes made from different browser sessions.
export function createCalendarStore(db) {
  const transaction = async fn => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const result = await fn(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
  const lockOwner = async (connection, owner) => {
    const rows = await connection.query('SELECT id FROM member_accounts WHERE id=? FOR UPDATE', [owner]);
    if (!rows.length) throw missing();
  };
  const ownedCalendar = async (connection, owner, id, lock = true) => {
    const row = (await connection.query(`SELECT id,name,color,visible,revision FROM calendar_calendars WHERE owner_id=? AND id=?${lock ? ' FOR UPDATE' : ''}`, [owner, id]))[0];
    if (!row) throw missing();
    return row;
  };
  const ownedEvent = async (connection, owner, id, lock = true) => {
    const row = (await connection.query(`SELECT e.*,c.color FROM calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=? AND e.id=?${lock ? ' FOR UPDATE' : ''}`, [owner, id]))[0];
    if (!row) throw missing();
    return row;
  };
  const audit = (connection, owner, action, entityType, entityId, revision = null) => connection.query(
    'INSERT INTO calendar_audit_log(id,owner_id,action,entity_type,entity_id,revision) VALUES(?,?,?,?,?,?)',
    [randomUUID(), owner, action, entityType, entityId, revision],
  );
  const loadExceptions = async (connection, owner, ids) => {
    if (!ids.length) return [];
    const rows = await connection.query(`SELECT x.event_id,x.occurrence_start,x.cancelled,x.override_json FROM calendar_event_exceptions x JOIN calendar_events e ON e.id=x.event_id JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=? AND e.id IN(${ids.map(() => '?').join(',')}) ORDER BY x.occurrence_start LIMIT ${MAX_LOADED_EXCEPTIONS + 1}`, [owner, ...ids]);
    if (rows.length > MAX_LOADED_EXCEPTIONS) throw new CalendarError('Too many occurrence changes in this range. Hide a calendar or choose a smaller range.', 429);
    return rows;
  };
  const attachExceptions = (events, rows) => {
    const byId = new Map(events.map(event => [event.id, event]));
    for (const row of rows) byId.get(row.event_id)?.exceptions.push(exceptionFromRow(row));
    return events;
  };
  const eventValues = event => [
    event.calendarId, event.title, event.description, event.location || '', event.startLocal, event.endLocal,
    event.timeZone, event.allDay ? 1 : 0, sqlInstant(event.startUtc), sqlInstant(event.endUtc), event.rrule || null,
  ];

  return {
    async ready() {
      return (await db.query("SELECT version FROM schema_migrations WHERE version='009_native_calendar'")).length > 0;
    },

    async listCalendars(owner) {
      const [rows, preferences] = await Promise.all([
        db.query('SELECT id,name,color,visible,revision FROM calendar_calendars WHERE owner_id=? ORDER BY created_at,id', [owner]),
        db.query('SELECT view_name,time_zone FROM calendar_preferences WHERE owner_id=?', [owner]),
      ]);
      return {calendars: rows.map(calendarFromRow), preferences: preferences[0] ? {view: preferences[0].view_name, timeZone: preferences[0].time_zone} : {...DEFAULT_PREFERENCES}, hasSavedPreferences: Boolean(preferences[0])};
    },

    async createCalendar(owner, {name, color}) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const count = (await connection.query('SELECT COUNT(*) AS n FROM calendar_calendars WHERE owner_id=?', [owner]))[0];
        if (Number(count.n) >= MAX_CALENDARS) throw new CalendarError('You can keep up to 20 calendars.', 429);
        const id = randomUUID();
        await connection.query('INSERT INTO calendar_calendars(id,owner_id,name,color,visible,revision) VALUES(?,?,?,?,TRUE,1)', [id, owner, name, color]);
        await audit(connection, owner, 'calendar.create', 'calendar', id, 1);
        return {id, name, color, visible: true, revision: 1};
      });
    },

    async saveCalendar(owner, id, {name, color, revision}) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const row = await ownedCalendar(connection, owner, id);
        checkRevision(row, revision);
        const result = await connection.query('UPDATE calendar_calendars SET name=?,color=?,revision=revision+1 WHERE owner_id=? AND id=? AND revision=?', [name, color, owner, id, revision]);
        if (Number(result.affectedRows) !== 1) throw stale();
        await audit(connection, owner, 'calendar.update', 'calendar', id, revision + 1);
        return {...calendarFromRow(row), name, color, revision: revision + 1};
      });
    },

    async deleteCalendar(owner, id, revision) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const row = await ownedCalendar(connection, owner, id);
        checkRevision(row, revision);
        // Foreign keys remove only events and exceptions under this owned calendar.
        const result = await connection.query('DELETE FROM calendar_calendars WHERE owner_id=? AND id=? AND revision=?', [owner, id, revision]);
        if (Number(result.affectedRows) !== 1) throw stale();
        await audit(connection, owner, 'calendar.delete', 'calendar', id, revision);
      });
    },

    async savePreferences(owner, {view, timeZone, visibleCalendarIds}) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const rows = await connection.query('SELECT id FROM calendar_calendars WHERE owner_id=? FOR UPDATE', [owner]);
        const ids = new Set(rows.map(row => row.id));
        if (visibleCalendarIds.some(id => !ids.has(id))) throw missing();
        await connection.query('INSERT INTO calendar_preferences(owner_id,view_name,time_zone) VALUES(?,?,?) ON DUPLICATE KEY UPDATE view_name=VALUES(view_name),time_zone=VALUES(time_zone)', [owner, view, timeZone]);
        const placeholders = visibleCalendarIds.map(() => '?').join(',');
        await connection.query(`UPDATE calendar_calendars SET visible=${placeholders ? `IF(id IN(${placeholders}),TRUE,FALSE)` : 'FALSE'} WHERE owner_id=?`, [...visibleCalendarIds, owner]);
        await audit(connection, owner, 'preferences.update', 'preferences', null);
        return {view, timeZone};
      });
    },

    async listEvents(owner, {start, end}) {
      const startUtc = sqlInstant(start), endUtc = sqlInstant(end);
      // Visible-range requests can arrive as UTC even when the viewer's first
      // day starts on the prior/following UTC date. Pad only the candidate
      // query for all-day rows; the recurrence model applies date boundaries.
      const startDate = new Date(new Date(start).valueOf() - 86_400_000).toISOString().slice(0, 10);
      const endDate = new Date(new Date(end).valueOf() + 86_400_000).toISOString().slice(0, 10);
      // A moved exception can bring a parent into the range even when the base
      // series starts after the range. UTC indexes narrow timed candidates;
      // all-day dates are compared as dates and never shifted by viewer zone.
      const rows = await db.query(`SELECT e.*,c.color FROM calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id
        WHERE c.owner_id=? AND c.visible=TRUE AND (
          (e.rrule IS NULL AND ((e.all_day=FALSE AND e.start_utc<? AND e.end_utc>?) OR (e.all_day=TRUE AND e.start_local<? AND e.end_local>?)))
          OR (e.rrule IS NOT NULL AND ((e.all_day=FALSE AND e.start_utc<?) OR (e.all_day=TRUE AND e.start_local<?)))
          OR EXISTS(SELECT 1 FROM calendar_event_exceptions x WHERE x.event_id=e.id AND x.cancelled=FALSE AND ((x.override_all_day=FALSE AND x.override_start_utc<? AND x.override_end_utc>?) OR (x.override_all_day=TRUE AND x.override_start_local<? AND x.override_end_local>?)))
        ) ORDER BY e.start_utc,e.id LIMIT ${MAX_CANDIDATES + 1}`, [owner, endUtc, startUtc, endDate, startDate, endUtc, endDate, endUtc, startUtc, endDate, startDate]);
      if (rows.length > MAX_CANDIDATES) throw new CalendarError('Too many event series in this range. Hide a calendar or choose a smaller range.', 429);
      return attachExceptions(rows.map(eventFromRow), await loadExceptions(db, owner, rows.map(row => row.id)));
    },

    async loadEvent(owner, id) {
      const row = await ownedEvent(db, owner, id, false);
      return attachExceptions([eventFromRow(row)], await loadExceptions(db, owner, [id]))[0];
    },

    async createEvent(owner, event) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        await ownedCalendar(connection, owner, event.calendarId);
        const count = (await connection.query('SELECT COUNT(*) AS n FROM calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=?', [owner]))[0];
        if (Number(count.n) >= MAX_EVENTS) throw new CalendarError('You can keep up to 10,000 events. Delete older events before adding more.', 429);
        const id = randomUUID();
        await connection.query('INSERT INTO calendar_events(id,calendar_id,title,description,location,start_local,end_local,time_zone,all_day,start_utc,end_utc,rrule,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)', [id, ...eventValues(event)]);
        await audit(connection, owner, 'event.create', 'event', id, 1);
        return {...event, id, revision: 1, exceptions: []};
      });
    },

    async saveEvent(owner, id, event, revision, {resetExceptions = false} = {}) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const current = await ownedEvent(connection, owner, id);
        checkRevision(current, revision);
        await ownedCalendar(connection, owner, event.calendarId);
        const scheduleChanged = current.start_local !== event.startLocal || current.end_local !== event.endLocal || current.time_zone !== event.timeZone || Boolean(current.all_day) !== event.allDay || (current.rrule || null) !== event.rrule;
        const exceptions = await loadExceptions(connection, owner, [id]);
        if (scheduleChanged && exceptions.length && !resetExceptions) throw new CalendarError('Changing this series schedule requires confirmation to reset its occurrence changes and cancellations.', 409);
        const result = await connection.query(`UPDATE calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id SET e.calendar_id=?,e.title=?,e.description=?,e.location=?,e.start_local=?,e.end_local=?,e.time_zone=?,e.all_day=?,e.start_utc=?,e.end_utc=?,e.rrule=?,e.revision=e.revision+1 WHERE c.owner_id=? AND e.id=? AND e.revision=?`, [...eventValues(event), owner, id, revision]);
        if (Number(result.affectedRows) !== 1) throw stale();
        // Metadata edits preserve cancellations and rescheduled appointments.
        // Schedule changes invalidate occurrence keys and require the member's
        // explicit confirmation before discarding any existing exceptions.
        if (scheduleChanged && exceptions.length) await connection.query('DELETE x FROM calendar_event_exceptions x JOIN calendar_events e ON e.id=x.event_id JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=? AND e.id=?', [owner, id]);
        await audit(connection, owner, 'event.update', 'event', id, revision + 1);
        return {...event, id, revision: revision + 1, exceptions: scheduleChanged ? [] : exceptions.map(exceptionFromRow)};
      });
    },

    async deleteEvent(owner, id, revision) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const current = await ownedEvent(connection, owner, id);
        checkRevision(current, revision);
        const result = await connection.query('DELETE e FROM calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=? AND e.id=? AND e.revision=?', [owner, id, revision]);
        if (Number(result.affectedRows) !== 1) throw stale();
        await audit(connection, owner, 'event.delete', 'event', id, revision);
      });
    },

    async saveOccurrence(owner, id, {revision, occurrenceStart, cancelled, override}) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const row = await ownedEvent(connection, owner, id);
        checkRevision(row, revision);
        if (!row.rrule) throw new CalendarError('This event is not a recurring series.', 400);
        const counts = (await connection.query('SELECT COUNT(*) AS n,SUM(x.occurrence_start=?) AS existing FROM calendar_event_exceptions x JOIN calendar_events e ON e.id=x.event_id JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=? AND e.id=?', [occurrenceStart, owner, id]))[0];
        if (!Number(counts.existing) && Number(counts.n) >= MAX_EXCEPTIONS_PER_EVENT) throw new CalendarError('This series has reached 1,000 occurrence changes. Start a new series for additional changes.', 429);
        // An override stays in its source calendar; moving the whole series is
        // available through saveEvent. Never serialize client ownership fields.
        const value = cancelled ? null : {...override, calendarId: row.calendar_id};
        await connection.query(`INSERT INTO calendar_event_exceptions(id,event_id,occurrence_start,cancelled,override_json,override_all_day,override_start_local,override_end_local,override_start_utc,override_end_utc)
          SELECT ?,e.id,?,?,?,?,?,?,?,? FROM calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id WHERE c.owner_id=? AND e.id=?
          ON DUPLICATE KEY UPDATE cancelled=VALUES(cancelled),override_json=VALUES(override_json),override_all_day=VALUES(override_all_day),override_start_local=VALUES(override_start_local),override_end_local=VALUES(override_end_local),override_start_utc=VALUES(override_start_utc),override_end_utc=VALUES(override_end_utc)`, [randomUUID(), occurrenceStart, cancelled ? 1 : 0, value ? JSON.stringify(value) : null, value ? (value.allDay ? 1 : 0) : null, value?.startLocal || null, value?.endLocal || null, value ? sqlInstant(value.startUtc) : null, value ? sqlInstant(value.endUtc) : null, owner, id]);
        // A duplicate with identical values can report affectedRows=0. The
        // locked ownership check above distinguishes it from a missing event.
        const updated = await connection.query('UPDATE calendar_events e JOIN calendar_calendars c ON c.id=e.calendar_id SET e.revision=e.revision+1 WHERE c.owner_id=? AND e.id=? AND e.revision=?', [owner, id, revision]);
        if (Number(updated.affectedRows) !== 1) throw stale();
        await audit(connection, owner, cancelled ? 'event.occurrence.cancel' : 'event.occurrence.update', 'event', id, revision + 1);
        return attachExceptions([{...eventFromRow(row), revision: revision + 1}], await loadExceptions(connection, owner, [id]))[0];
      });
    },

    async allowWrite(owner) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const row = (await connection.query('SELECT attempts,window_started_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) AS active FROM calendar_write_limits WHERE owner_id=? FOR UPDATE', [owner]))[0];
        if (row?.active && Number(row.attempts) >= 120) return false;
        await connection.query('INSERT INTO calendar_write_limits(owner_id,window_started_at,attempts) VALUES(?,UTC_TIMESTAMP(6),1) ON DUPLICATE KEY UPDATE attempts=IF(window_started_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE),attempts+1,1),window_started_at=IF(window_started_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE),window_started_at,UTC_TIMESTAMP(6))', [owner]);
        return true;
      });
    },

    async allowRead(owner) {
      return transaction(async connection => {
        await lockOwner(connection, owner);
        const row = (await connection.query('SELECT read_attempts,read_window_started_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) AS active FROM calendar_write_limits WHERE owner_id=? FOR UPDATE', [owner]))[0];
        if (row?.active && Number(row.read_attempts) >= 60) return false;
        // Separate counters prevent ordinary navigation from consuming the
        // member's edit allowance, and edits cannot reset this read window.
        await connection.query('INSERT INTO calendar_write_limits(owner_id,read_window_started_at,read_attempts) VALUES(?,UTC_TIMESTAMP(6),1) ON DUPLICATE KEY UPDATE read_attempts=IF(read_window_started_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE),read_attempts+1,1),read_window_started_at=IF(read_window_started_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE),read_window_started_at,UTC_TIMESTAMP(6))', [owner]);
        return true;
      });
    },
  };
}

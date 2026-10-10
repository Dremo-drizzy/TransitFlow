import { format, parseISO, differenceInMinutes, isValid } from 'date-fns';
import { tz, TZDate } from '@date-fns/tz';

// Every time the app shows is German wall-clock time, whoever is looking.
// The departures are German trains; a München departure at 17:53 must read
// 17:53 in Halifax too, not 12:53. date-fns formats in the runtime's own zone
// unless told otherwise, so every format/parse that produces something a
// person reads goes through `inGermany`.
export const GERMAN_TIMEZONE = 'Europe/Berlin';
const inGermany = { in: tz(GERMAN_TIMEZONE) };

// Format an ISO date string (or a Date) to HH:mm in German time — e.g. "14:32"
export const formatTime = (value) => {
  if (!value) return '--:--';
  try {
    const date = value instanceof Date ? value : parseISO(value);
    return format(date, 'HH:mm', inGermany);
  } catch {
    return '--:--';
  }
};

// How many minutes late is a departure?
export const getDelayMinutes = (scheduled, actual) => {
  if (!scheduled || !actual) return 0;
  try {
    const scheduledDate = parseISO(scheduled);
    const actualDate = parseISO(actual);
    // parseISO doesn't throw on a malformed string — it returns an Invalid
    // Date, and differenceInMinutes silently returns NaN for that rather
    // than throwing, so the catch below never fires. Check explicitly.
    if (!isValid(scheduledDate) || !isValid(actualDate)) return 0;
    return differenceInMinutes(actualDate, scheduledDate);
  } catch {
    return 0;
  }
};

// Turn delay minutes into a readable string — e.g. "+7 min" or "On time"
export const formatDelay = (delayMinutes) => {
  if (delayMinutes == null || Number.isNaN(delayMinutes) || delayMinutes <= 0) {
    return 'On time';
  }
  return `+${delayMinutes} min`;
};

// Delay severity, expressed as a Bootstrap-style variant name: on time is
// 'success', 1-5 min late is 'warning', over 5 min is 'danger'.
export const getDelayBadgeVariant = (delayMinutes) => {
  if (delayMinutes == null || Number.isNaN(delayMinutes)) return 'secondary';
  if (delayMinutes <= 0) return 'success';
  if (delayMinutes <= 5) return 'warning';
  return 'danger';
};

// The platform board has two flaps. Rail platforms are already short ("3",
// "11", "5a"), but bus stops arrive as "Pos. 12" and U-Bahn platforms as
// "2 (U5)" — cutting those to their last two characters gives "5)". Show the
// first platform number instead.
export const shortPlatform = (platform) => {
  const match = String(platform ?? '').match(/\d+[A-Za-z]?/);
  return match ? match[0].slice(0, 2) : '';
};

// Convert seconds to a human-readable duration — e.g. "2h 18m"
export const formatDuration = (seconds) => {
  if (!seconds || typeof seconds !== 'number' || Number.isNaN(seconds)) return '';
  const hours   = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// The API sets cancelled: true rather than leaving `when` null and
// nothing else — but a cancelled departure/leg DOES have `when: null`,
// which getDelayMinutes reads as "no data, delay 0", so cancellation has
// to be checked before any delay math or it silently renders as on time.
const STATUS_TONE = { success: 'green', warning: 'amber', danger: 'red', secondary: 'muted' };

export const getDepartureStatus = (plannedTime, actualTime, cancelled) => {
  if (cancelled) {
    return { text: 'CANCELLED', tone: 'red', cancelled: true };
  }
  // A departure with no real-time prediction (actualTime missing, but not
  // cancelled) has no delay to report — getDelayMinutes would read the
  // missing value as "0 minutes late" and render a false ON TIME. Check
  // for this before any delay math, same reasoning as the cancelled check.
  // It reads SCHEDULED, not NO DATA: the planned time is known, it's only
  // the prediction that's absent — and for buses and trams that is the norm.
  if (!actualTime) {
    return { text: 'SCHEDULED', tone: 'muted', cancelled: false };
  }
  const delay = getDelayMinutes(plannedTime, actualTime);
  const variant = getDelayBadgeVariant(delay);
  return {
    text: delay <= 0 ? 'ON TIME' : `+${delay} MIN`,
    tone: STATUS_TONE[variant],
    cancelled: false,
  };
};

// <input type="datetime-local"> holds a bare wall-clock value with no zone
// ("YYYY-MM-DDTHH:mm"). In this app that wall clock is German time, the same
// as every time displayed beside it — a picker that meant the viewer's own
// zone would put 08:00 Halifax next to a board showing 13:00 Berlin.
const DATETIME_LOCAL = "yyyy-MM-dd'T'HH:mm";
// Read by hand rather than with date-fns' parse(): parse() drags the whole
// format-parser table into the bundle (+25 kB) for one fixed shape.
const DATETIME_LOCAL_VALUE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// ISO instant -> the German wall-clock value the input expects. An ISO string
// is UTC (or carries its own offset); slicing it directly displays UTC time.
export const toDatetimeLocalValue = (isoString) => {
  if (!isoString) return '';
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return format(date, DATETIME_LOCAL, inGermany);
  } catch {
    return '';
  }
};

// German wall-clock input value -> UTC ISO string for the API. Resolved
// against Europe/Berlin's offset on that date (CET or CEST), not the runtime's.
export const fromDatetimeLocalValue = (localValue) => {
  const match = DATETIME_LOCAL_VALUE.exec(localValue ?? '');
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const zoned = new TZDate(year, month - 1, day, hour, minute, GERMAN_TIMEZONE);
  // A zoned date silently rolls an impossible day (31 February) into the next
  // month; refuse it instead, the way an invalid date was refused before.
  if (!isValid(zoned) || zoned.getMonth() !== month - 1 || zoned.getDate() !== day) return null;
  // `zoned` writes the Berlin offset from toISOString() ("…+02:00"); the API
  // and the rest of the app carry UTC ("…Z").
  return new Date(zoned.getTime()).toISOString();
};

// Save any value to localStorage under a key
export const saveToLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Save error:', e);
  }
};

// Load a value from localStorage, or return a default. An optional
// `isValid` predicate filters a stored array down to well-formed entries —
// data saved by an older version of the app (or edited by hand) shouldn't
// crash a component that assumes today's shape, it should just be dropped.
export const loadFromLocalStorage = (key, defaultValue = [], isValid) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item);
    if (isValid && Array.isArray(parsed)) return parsed.filter(isValid);
    return parsed;
  } catch (e) {
    console.error('Load error:', e);
    return defaultValue;
  }
};

// Ask the browser for the user's GPS location
export const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
};
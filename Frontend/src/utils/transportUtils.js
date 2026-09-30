import { format, parseISO, differenceInMinutes, isValid } from 'date-fns';

// Format an ISO date string to HH:mm — e.g. "14:32"
export const formatTime = (dateString) => {
  if (!dateString) return '--:--';
  try {
    return format(parseISO(dateString), 'HH:mm');
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

// Convert seconds to a human-readable duration — e.g. "2h 18m"
export const formatDuration = (seconds) => {
  if (!seconds || typeof seconds !== 'number' || Number.isNaN(seconds)) return '';
  const hours   = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// The DB API sets cancelled: true rather than leaving `when` null and
// nothing else — but a cancelled departure/leg DOES have `when: null`,
// which getDelayMinutes reads as "no data, delay 0", so cancellation has
// to be checked before any delay math or it silently renders as on time.
const STATUS_TONE = { success: 'green', warning: 'amber', danger: 'red', secondary: 'muted' };

export const getDepartureStatus = (plannedTime, actualTime, cancelled) => {
  if (cancelled) {
    return { text: 'CANCELLED', tone: 'red', cancelled: true };
  }
  // A departure with no realtime prediction yet (actualTime missing, but
  // not cancelled) has no delay to report — getDelayMinutes would read the
  // missing value as "0 minutes late" and render a false ON TIME. Check
  // for this before any delay math, same reasoning as the cancelled check.
  if (!actualTime) {
    return { text: 'NO DATA', tone: 'muted', cancelled: false };
  }
  const delay = getDelayMinutes(plannedTime, actualTime);
  const variant = getDelayBadgeVariant(delay);
  return {
    text: delay <= 0 ? 'ON TIME' : `+${delay} MIN`,
    tone: STATUS_TONE[variant],
    cancelled: false,
  };
};

// Convert an ISO datetime string to the local wall-clock value
// <input type="datetime-local"> expects ("YYYY-MM-DDTHH:mm"). An ISO string
// is UTC (or carries its own offset); slicing it directly displays UTC time,
// which is off by the viewer's UTC offset.
export const toDatetimeLocalValue = (isoString) => {
  if (!isoString) return '';
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return format(date, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
};

// Convert a <input type="datetime-local"> value (local wall-clock time, no
// timezone info) back to a UTC ISO string for the API.
export const fromDatetimeLocalValue = (localValue) => {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (!isValid(date)) return null;
  return date.toISOString();
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
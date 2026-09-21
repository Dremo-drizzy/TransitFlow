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

// line.product from the DB API is a plain string id (e.g. "nationalExpress",
// "suburban", "bus") — not an object with .type/.name, which is what the old
// version of this function assumed. Exact lookup, no substring guessing.
const PRODUCT_ICONS = {
  nationalExpress: '🚄',
  national:        '🚆',
  regionalExpress: '🚆',
  regional:        '🚆',
  suburban:        '🚈',
  subway:          '🚇',
  tram:            '🚊',
  bus:             '🚌',
  ferry:           '⛴️',
  taxi:            '🚕',
};
const DEFAULT_PRODUCT_ICON = '🚏';

// Pick an emoji icon based on the transport product. Accepts either the
// string id the DB API actually sends, or an object with a .type for
// callers that still pass one.
export const getProductIcon = (product) => {
  const id = typeof product === 'string' ? product : product?.type;
  return PRODUCT_ICONS[id] || DEFAULT_PRODUCT_ICON;
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

// Load a value from localStorage, or return a default
export const loadFromLocalStorage = (key, defaultValue = []) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
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
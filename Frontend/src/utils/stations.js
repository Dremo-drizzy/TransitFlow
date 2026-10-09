import { haversine } from './geo';

/**
 * Station identity helpers.
 *
 * The data source changed from one that identified stations by EVA number
 * (`8011160`) to Transitous, whose ids are long feed-prefixed strings
 * (`at-Railway-…_de:11000:900003200:1:51`) that can differ between feeds and
 * change between dataset years. An id is no longer a durable key, so
 * anything saved (commutes, bookmarked URLs) is re-resolved by name.
 */

// An old-style id is all digits. New ids always contain a feed prefix.
export const isLegacyStopId = (id) => /^\d+$/.test(String(id ?? ''));

// The station search answers "Berlin Hbf" with "Berlin Hauptbahnhof", and
// the same station is "S+U Berlin Hauptbahnhof" on a departure board — so
// names are only comparable after these differences are flattened out.
export function normalizeStationName(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // München -> munchen, on both sides of any comparison
    .replace(/^(s\+u|s\/u|s|u)\s+/, '') // "S+U ", "S ", "U " line-type prefixes
    .replace(/\bhauptbahnhof\b/g, 'hbf')
    .replace(/\bbahnhof\b/g, 'bf')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Station objects come in two shapes: {location: {latitude, longitude}} from
// the API, and flat {latitude, longitude} from the bundled list.
export function coordsOf(place) {
  const source = place?.location ?? place;
  const lat = source?.latitude;
  const lon = source?.longitude;
  return typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : null;
}

// Beyond this, a name match with coordinates is a different place that
// happens to share a name (there are dozens of "Neustadt" stations).
const MAX_MATCH_DISTANCE_M = 25_000;

function nearestOf(candidates, coords) {
  let best = null;
  for (const candidate of candidates) {
    const c = coordsOf(candidate);
    if (!c) continue;
    const distanceM = haversine(coords, c);
    if (!best || distanceM < best.distanceM) best = { station: candidate, distanceM };
  }
  return best;
}

// One name contains the other ("zoo" in "berlin zoologischer garten"), or they
// share a first word of real length ("berlin hbf" / "berlin spandau").
function looselyMatches(candidate, target) {
  if (!candidate || !target) return false;
  if (candidate.includes(target) || target.includes(candidate)) return true;
  const first = (s) => s.split(' ')[0];
  return first(candidate).length >= 4 && first(candidate) === first(target);
}

/**
 * Chooses the station a saved/typed name most plausibly means, from the
 * results of a station search.
 *   1. A candidate whose normalised name equals the target wins (the nearest
 *      such one to the stored coordinates, if there are any).
 *   2. Otherwise only candidates whose name loosely resembles the target are
 *      considered at all (the station search is fuzzy, and will happily
 *      answer a nonsense name with some unrelated place in another country).
 *      With stored coordinates, the nearest of those within 25 km — a result
 *      in another city is rejected, not accepted.
 *   3. Without coordinates, the top of those.
 * Returns null if there is nothing usable, so the caller can show
 * "re-select station" instead of guessing.
 */
export function pickStation(candidates, { name, coords } = {}) {
  const stations = (candidates ?? []).filter((c) => c?.id && (!c.type || c.type === 'station' || c.type === 'stop'));
  if (stations.length === 0) return null;

  const target = normalizeStationName(name);
  const exact = stations.filter((s) => normalizeStationName(s.name) === target);
  if (exact.length > 0) {
    return (coords && nearestOf(exact, coords)?.station) || exact[0];
  }

  const similar = stations.filter((s) => looselyMatches(normalizeStationName(s.name), target));
  if (similar.length === 0) return null;

  if (coords) {
    const near = nearestOf(similar, coords);
    return near && near.distanceM <= MAX_MATCH_DISTANCE_M ? near.station : null;
  }
  return similar[0];
}

/** The closest of `stations` (each with latitude/longitude) to `point` ({lat, lon}). */
export function nearestStation(stations, point) {
  const best = nearestOf(stations, point);
  return best ? { station: best.station, distanceM: best.distanceM } : null;
}

/* ------------------- saved-commute migration (pure part) ------------------- */

// Every distinct old-style station across the saved commutes — one lookup each.
export function legacyStations(commutes) {
  const seen = new Map();
  for (const c of commutes ?? []) {
    for (const station of [c?.from, c?.to]) {
      if (station && isLegacyStopId(station.id) && !seen.has(station.id)) seen.set(station.id, station);
    }
  }
  return [...seen.values()];
}

// Only what the app reads from a station — not the whole search result.
const toSavedStation = (s) => ({
  id: s.id,
  name: s.name,
  type: s.type,
  ...(s.location ? { location: { latitude: s.location.latitude, longitude: s.location.longitude } } : {}),
});

// The `status` flag is display-only; it is never written to storage.
export const stripStatus = (commutes) =>
  commutes.map((commute) => {
    const rest = { ...commute };
    delete rest.status;
    return rest;
  });

/**
 * Applies lookup results to saved commutes. `resolutions` maps a legacy id to
 * `{ status: 'loading' | 'ok' | 'error', station? }`. Each returned commute
 * carries a `status`: 'ok' (usable), 'resolving' (lookup in flight) or
 * 'unresolved' (couldn't be matched — shown with "re-select station", never
 * dropped). `persistable` is the list to write back to storage, or null if
 * nothing changed; unresolved commutes are kept as they were.
 */
export function applyResolutions(stored, resolutions) {
  let changed = false;

  const commutes = (stored ?? []).map((commute) => {
    let resolving = false;
    let unresolved = false;

    const resolve = (station) => {
      if (!station || !isLegacyStopId(station.id)) return station;
      const r = resolutions?.[station.id];
      if (r?.status === 'ok' && r.station) {
        changed = true;
        return toSavedStation(r.station);
      }
      if (r?.status === 'error') unresolved = true;
      else resolving = true;
      return station;
    };

    const from = resolve(commute.from);
    const to = resolve(commute.to);
    return { ...commute, from, to, status: resolving ? 'resolving' : unresolved ? 'unresolved' : 'ok' };
  });

  return { commutes, persistable: changed ? stripStatus(commutes) : null };
}

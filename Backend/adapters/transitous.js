/**
 * Normalises Transitous (via motis-fptf-client) responses into the shape the
 * frontend already reads. Pure functions, no I/O — tested against the real
 * responses saved in Backend/fixtures/.
 *
 * The central rule: Transitous marks "no real-time prediction" with a null
 * delay, while still filling the live time field with the planned time
 * (`when === plannedWhen`). The frontend's contract is the older one — a
 * null live time means "no prediction", a cancelled trip has a null live time
 * too, and `getDepartureStatus` keys on that. If the live time were passed
 * through unchanged, every unpredicted departure (over half of a Berlin Hbf
 * board) would read as a confident, on-time, green departure. So the adapter
 * converts one encoding to the other, in one place.
 */
import { simplifyFeatureCollection } from './polyline.js';

// A delay of 0 is a real prediction ("on time"); only null means none.
const hasPrediction = (delay) => delay !== null && delay !== undefined;

/* ------------------------------ locations ------------------------------ */

// /locations mixes in OSM points of interest and places abroad (a search
// for "berlin" returns one in Ontario). Only stations can be used as a
// from/to for journeys or as a departure board, so only they are kept.
export function normalizeLocations(locations, { limit = 10 } = {}) {
  if (!Array.isArray(locations)) return [];
  return locations.filter((l) => l?.type === 'station').slice(0, limit);
}

/* ------------------------------ departures ----------------------------- */

const PRODUCT_KEYS = [
  'nationalExpress', 'national', 'regionalExpress', 'regional',
  'suburban', 'subway', 'tram', 'bus', 'ferry', 'taxi',
];

// The old API excluded a product when its flag was sent as false; the client
// has no such option, so the filter chips are applied here instead.
export const excludedProducts = (query) =>
  PRODUCT_KEYS.filter((key) => String(query?.[key]) === 'false');

export function normalizeDepartures(body, { exclude = [] } = {}) {
  const departures = (body?.departures ?? [])
    .filter((d) => !exclude.includes(d?.line?.product))
    .map((d) => (hasPrediction(d.delay) ? d : { ...d, when: null }));
  return { ...body, departures };
}

/* ------------------------------- journeys ------------------------------ */

// A journey has no `duration` field on this source; the journey card reads
// one, in seconds.
function journeyDurationSeconds(legs) {
  if (!legs.length) return undefined;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const start = Date.parse(first.departure ?? first.plannedDeparture);
  const end = Date.parse(last.arrival ?? last.plannedArrival);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return undefined;
  return Math.round((end - start) / 1000);
}

function normalizeLeg(leg) {
  // Walking legs have no schedule and so never carry a delay; their times
  // are real, not "unpredicted", and must be left alone.
  if (leg.walking) return leg;
  return {
    ...leg,
    departure: hasPrediction(leg.departureDelay) ? leg.departure : null,
    arrival: hasPrediction(leg.arrivalDelay) ? leg.arrival : null,
  };
}

export function normalizeJourneys(body) {
  const journeys = (body?.journeys ?? []).map((journey) => {
    const legs = journey.legs ?? [];
    // Duration first: it needs the original live-or-planned times, before
    // the unpredicted ones are nulled out below.
    const duration = journeyDurationSeconds(legs);
    return { ...journey, duration, legs: legs.map(normalizeLeg) };
  });
  return { ...body, journeys };
}

/* --------------------------------- trips ------------------------------- */

function normalizeStopover(stopover) {
  return {
    ...stopover,
    arrival: hasPrediction(stopover.arrivalDelay) ? stopover.arrival : null,
    departure: hasPrediction(stopover.departureDelay) ? stopover.departure : null,
  };
}

const stopCoordinates = (stopovers) =>
  stopovers
    .map((s) => s.stop?.location)
    .filter((loc) => typeof loc?.longitude === 'number' && typeof loc?.latitude === 'number')
    .map((loc) => [loc.longitude, loc.latitude]);

// On this source `stopovers` holds only the stops in between: the trip's
// origin and destination are carried separately (trip.origin / trip.destination,
// with the trip-level departure and arrival). The vehicle-position maths
// treats the first stopover as where the trip starts and the last as where
// it ends, so without the endpoints the vehicle would wait at the first
// intermediate stop, never travel the first or last leg, and the timeline
// would be missing its first and last rows. They are rebuilt here as ordinary
// stopovers — origin with only a departure, destination with only an arrival.
function withEndpoints(stopovers, trip, { departure, arrival }) {
  const first = stopovers[0]?.stop;
  const last = stopovers[stopovers.length - 1]?.stop;

  const origin =
    trip.origin && trip.origin.id !== first?.id
      ? [{
          stop: trip.origin,
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          departure,
          plannedDeparture: trip.plannedDeparture,
          departureDelay: trip.departureDelay,
          departurePlatform: trip.departurePlatform,
          plannedDeparturePlatform: trip.plannedDeparturePlatform,
          cancelled: false,
          remarks: [],
        }]
      : [];

  const destination =
    trip.destination && trip.destination.id !== last?.id
      ? [{
          stop: trip.destination,
          arrival,
          plannedArrival: trip.plannedArrival,
          arrivalDelay: trip.arrivalDelay,
          arrivalPlatform: trip.arrivalPlatform,
          plannedArrivalPlatform: trip.plannedArrivalPlatform,
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          cancelled: false,
          remarks: [],
        }]
      : [];

  return [...origin, ...stopovers, ...destination];
}

export function normalizeTrip(body, { toleranceM = 30 } = {}) {
  const trip = body?.trip;
  if (!trip) return body;

  const departure = hasPrediction(trip.departureDelay) ? trip.departure : null;
  const arrival = hasPrediction(trip.arrivalDelay) ? trip.arrival : null;
  const stopovers = withEndpoints((trip.stopovers ?? []).map(normalizeStopover), trip, { departure, arrival });

  // Simplified here, before the response is cached or sent: the raw polyline
  // is ~1 MB for a long-distance trip, nearly all of it invisible on a map.
  const polyline = trip.polyline
    ? simplifyFeatureCollection(trip.polyline, stopCoordinates(stopovers), { toleranceM })
    : trip.polyline;

  return {
    ...body,
    trip: {
      ...trip,
      arrival,
      departure,
      stopovers,
      polyline,
    },
  };
}

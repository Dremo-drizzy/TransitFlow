/**
 * The upstream data source: Transitous, via motis-fptf-client run in-process.
 *
 * It exposes a hafas-client-shaped API (locations, departures, journeys,
 * trip) over MOTIS, so the response shapes match what the frontend already
 * reads. Running it inside this server — rather than as a second service —
 * means one deployment and one cold start; a second free-tier service waking
 * up behind this proxy's upstream timeout would fail the first request after
 * every idle period.
 *
 * Transitous asks every client to send a User-Agent that identifies the app
 * and a way to contact its author, and to keep request volume light: this
 * proxy only ever makes user-driven requests, and the cache collapses repeats.
 */
import { createClient } from '@motis-project/motis-fptf-client';
import { profile } from '@motis-project/motis-fptf-client/p/transitous/index.js';

import {
  normalizeLocations,
  normalizeDepartures,
  normalizeJourneys,
  normalizeTrip,
  excludedProducts,
} from './adapters/transitous.js';

const USER_AGENT =
  process.env.USER_AGENT || 'TransitFlow/2.0 (+https://github.com/Dremo-drizzy/German-Api-project)';
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 12_000);

// enrichStations would attach DB station data (including EVA numbers) to
// stops, at a cost of ~50 MB of memory and a 6-9 s one-time load on the first
// request. Nothing here uses it — places are identified by name and
// coordinates, not EVA numbers — so it stays off.
let client;
const getClient = () => (client ??= createClient(profile, USER_AGENT, { enrichStations: false }));

/** An error that already knows which HTTP status the proxy should answer with. */
export class SourceError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// The client rejects with plain `{ error: "…" }` objects taken from the
// Transitous response body (not Error instances), and with real Errors for
// network failures and argument validation. Collapse both into a SourceError.
function toSourceError(err) {
  if (err instanceof SourceError) return err;
  if (err instanceof TypeError) return new SourceError(400, err.message);

  const text = typeof err?.error === 'string' ? err.error : '';
  if (/unknown feed id|invalid tripid|not found|unknown stop/i.test(text)) {
    return new SourceError(404, 'Unknown station or trip', 'UNKNOWN_ID');
  }
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return new SourceError(504, 'Upstream request timed out');
  }
  console.error('[source] upstream failure:', text || err?.message || err);
  return new SourceError(502, 'Upstream request failed');
}

async function call(fn) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new SourceError(504, 'Upstream request timed out')), UPSTREAM_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fn(getClient()), timeout]);
  } catch (err) {
    throw toSourceError(err);
  } finally {
    clearTimeout(timer);
  }
}

const toDate = (value) => (value ? new Date(value) : undefined);

// The client merges options with Object.assign, which copies keys whose value
// is undefined — silently overwriting its own defaults (e.g. accessibility:
// 'none'). Only pass what was actually given.
const defined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export const source = {
  locations: ({ query, results }) =>
    // Ask for extra: points of interest and places abroad are dropped below,
    // and the caller still wants `results` stations.
    call((c) => c.locations(query, { results: Math.min(results * 3, 30) })).then((list) =>
      normalizeLocations(list, { limit: results })
    ),

  departures: ({ id, duration, when, results, query }) =>
    call((c) => c.departures(id, defined({ duration, when: toDate(when), results }))).then((body) =>
      normalizeDepartures(body, { exclude: excludedProducts(query) })
    ),

  journeys: ({ from, to, departure, results, transfers, accessibility }) =>
    call((c) =>
      c.journeys(from, to, defined({ results, departure: toDate(departure), transfers, accessibility }))
    ).then(normalizeJourneys),

  trip: ({ id, stopovers, polyline }) =>
    call((c) => c.trip(id, defined({ stopovers, polyline }))).then((body) => normalizeTrip(body)),
};

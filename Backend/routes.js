/**
 * The complete set of calls this proxy is willing to make.
 *
 * Each entry declares:
 *   path     – the Express route mounted on this server
 *   query    – the only query parameters read (everything else is dropped)
 *   defaults – values applied when the caller didn't send one
 *   ttlMs    – how long a successful response may be cached
 *   run      – validates the inputs and fetches the data through source.js,
 *              which runs it through the Transitous adapter. The response
 *              returned here is what gets cached, so the cache only ever
 *              holds normalised, downsampled data.
 *
 * There is no URL to build from caller input any more: the data comes from a
 * client library called with typed arguments, so there is no path to walk out
 * of, and no way to use this server as an open relay. The allowlist still
 * matters — it is what stops arbitrary parameters reaching those calls.
 */
import { source } from './source.js';

const MINUTE = 60_000;

/** A caller mistake — answered with 400, never retried or logged as a fault. */
export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const PRODUCT_FLAGS = [
  'nationalExpress', 'national', 'regionalExpress', 'regional',
  'suburban', 'subway', 'tram', 'bus', 'ferry', 'taxi',
];

// Integer within [min, max]; `fallback` (possibly undefined) when absent.
function int(name, value, { min, max, fallback }) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new BadRequest(`"${name}" must be a whole number between ${min} and ${max}`);
  }
  return n;
}

function isoDate(name, value) {
  if (value === undefined || value === '') return undefined;
  if (Number.isNaN(Date.parse(value))) throw new BadRequest(`"${name}" must be a valid date/time`);
  return value;
}

function required(name, value) {
  if (!value) throw new BadRequest(`"${name}" is required`);
  return value;
}

export const ROUTES = [
  {
    path: '/api/locations',
    query: ['query', 'results'],
    defaults: {},
    ttlMs: 10 * MINUTE,
    run: ({ params }) => {
      const query = required('query', params.query);
      if (query.length < 2) throw new BadRequest('"query" must be at least 2 characters');
      return source.locations({ query, results: int('results', params.results, { min: 1, max: 20, fallback: 10 }) });
    },
  },
  {
    path: '/api/stops/:id/departures',
    query: ['when', 'duration', 'results', ...PRODUCT_FLAGS],
    defaults: { duration: 60 },
    // Live data — short TTL, just enough to absorb a burst of viewers.
    ttlMs: 20_000,
    run: ({ params, pathParams }) =>
      source.departures({
        id: pathParams.id,
        duration: int('duration', params.duration, { min: 1, max: 360, fallback: 60 }),
        results: int('results', params.results, { min: 1, max: 500, fallback: undefined }),
        when: isoDate('when', params.when),
        // The product flags themselves are read by the adapter's filter.
        query: params,
      }),
  },
  {
    path: '/api/journeys',
    query: ['from', 'to', 'departure', 'results', 'transfers', 'accessibility'],
    defaults: { results: 6 },
    ttlMs: 30_000,
    run: ({ params }) => {
      const accessibility = params.accessibility;
      if (accessibility !== undefined && !['none', 'partial', 'complete'].includes(accessibility)) {
        throw new BadRequest('"accessibility" must be none, partial or complete');
      }
      return source.journeys({
        from: required('from', params.from),
        to: required('to', params.to),
        departure: isoDate('departure', params.departure),
        results: int('results', params.results, { min: 1, max: 10, fallback: 6 }),
        transfers: int('transfers', params.transfers, { min: 0, max: 10, fallback: undefined }),
        accessibility,
      });
    },
  },
  {
    path: '/api/trips/:id',
    query: ['stopovers', 'polyline'],
    defaults: { stopovers: 'true', polyline: 'true' },
    ttlMs: 20_000,
    run: ({ params, pathParams }) =>
      source.trip({
        id: pathParams.id,
        stopovers: params.stopovers !== 'false',
        polyline: params.polyline !== 'false',
      }),
  },
];

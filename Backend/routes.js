/**
 * The complete set of upstream calls this proxy is willing to make.
 *
 * Each entry declares:
 *   path     – the Express route mounted on this server
 *   upstream – builds the v6.db.transport.rest path from the route params
 *   query    – query parameters that are forwarded (everything else is dropped)
 *   defaults – values always sent upstream
 *   ttlMs    – how long a successful response may be cached
 *
 * Because the upstream path is built from a fixed template rather than
 * whatever the caller typed, there is no way to walk out of the API
 * namespace, and no way to use this server as an open relay.
 */

const MINUTE = 60_000;

export const UPSTREAM_ROUTES = [
  {
    path: "/api/locations",
    upstream: () => "/locations",
    query: ["query", "fuzzy", "results", "stops", "addresses", "poi", "language"],
    defaults: { fuzzy: "true", results: 10 },
    ttlMs: 10 * MINUTE,
  },
  {
    path: "/api/locations/nearby",
    upstream: () => "/locations/nearby",
    query: ["latitude", "longitude", "distance", "results", "stops", "poi", "linesOfStops"],
    defaults: { results: 20 },
    ttlMs: 5 * MINUTE,
  },
  {
    path: "/api/stops/:id",
    upstream: ({ id }) => `/stops/${encodeURIComponent(id)}`,
    query: ["linesOfStops", "language"],
    defaults: {},
    ttlMs: 30 * MINUTE,
  },
  {
    path: "/api/stops/:id/departures",
    upstream: ({ id }) => `/stops/${encodeURIComponent(id)}/departures`,
    query: [
      "when",
      "duration",
      "results",
      "direction",
      "linesOfStops",
      "remarks",
      "language",
      "nationalExpress",
      "national",
      "regionalExpress",
      "regional",
      "suburban",
      "bus",
      "ferry",
      "subway",
      "tram",
      "taxi",
    ],
    defaults: { duration: 60 },
    // Live data — short TTL, just enough to absorb a burst of viewers.
    ttlMs: 20_000,
  },
  {
    path: "/api/stops/:id/arrivals",
    upstream: ({ id }) => `/stops/${encodeURIComponent(id)}/arrivals`,
    query: ["when", "duration", "results", "linesOfStops", "remarks", "language"],
    defaults: { duration: 60 },
    ttlMs: 20_000,
  },
  {
    path: "/api/journeys",
    upstream: () => "/journeys",
    query: [
      "from",
      "to",
      "departure",
      "arrival",
      "results",
      "transfers",
      "transferTime",
      "accessibility",
      "bike",
      "stopovers",
      "remarks",
      "language",
      "nationalExpress",
      "national",
      "regionalExpress",
      "regional",
      "suburban",
      "bus",
      "ferry",
      "subway",
      "tram",
      "taxi",
    ],
    defaults: { results: 6, stopovers: "false" },
    ttlMs: 30_000,
  },
  {
    path: "/api/trips/:id",
    upstream: ({ id }) => `/trips/${encodeURIComponent(id)}`,
    query: ["stopovers", "remarks", "polyline", "language"],
    defaults: { stopovers: "true", polyline: "true" },
    ttlMs: 20_000,
  },
];

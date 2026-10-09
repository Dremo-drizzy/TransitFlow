# Data sources — what was actually tested

Reconnaissance for Phase 2 (see [`build-plan.md`](build-plan.md)). Nothing here changed application code. Everything below was observed on **2026-10-09**; fixtures are in `Backend/fixtures/`.

**Status of this document:** Part B (journeys/trips) was tested and is complete. **Part A (the official DB Timetables API) is partly done:** the base URL and header names are confirmed, but every data endpoint returns 403 "Not registered to plan" until the application is subscribed to the Timetables API, so no response format has been observed yet. See Part A.

---

## Why the old upstream is gone

`v6.db.transport.rest` wrapped DB's old HAFAS endpoint. It now returns HTTP 503 with an empty body, and its own docs page links to a hafas-client issue titled "DB HAFAS API is currently not available". DB moved bahn.de / DB Navigator to a new platform and shut the old API off.

---

## Part A — DB Timetables API (reachable, but BLOCKED on a plan subscription)

Tested on 2026-10-09 with the credentials from `Backend/.env` (read by a script outside the repo; never printed).

**Confirmed:**

- **Base URL is right:** `https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1`. The gateway resolves it: a wrong API name returns 404 "API not found for requested URI", and a wrong path under `timetables/v1` returns 404 "No resources match requested URI".
- **Header names are right:** `DB-Client-Id` and `DB-Api-Key`. With them the credentials are accepted; with the two values swapped, or with no credentials at all, the response is 401 "Invalid client id or secret".
- **Errors come back as XML** (`<errorResponse>` with `httpCode`, `httpMessage`, `moreInformation`), content type `application/xml`.

**The blocker:** all four endpoints — `/station/Berlin%20Hbf`, `/plan/8011160/{YYMMDD}/{HH}`, `/fchg/8011160`, `/rchg/8011160` — return **403 "Not registered to plan"**. Authentication succeeded; the application is simply not subscribed to the Timetables API. On the DB API Marketplace that is done per application (subscribe the application to the Timetables API / pick its plan), and some APIs need approval first. This is an account step, not a code or credentials problem.

**Not done, because there is no data to look at yet:**

- no XML fixtures exist (`station-search.xml`, `plan-sample.xml`, `changes-full.xml`, `changes-recent.xml`)
- the plan/fchg structure, the meaning of the single-letter attributes, how a trip is matched to its change, how a cancellation and a "no live data" trip each look, and the `YYMMddHHmm` time format are **not yet verified** — nothing about them is recorded here on purpose, since an unverified encoding of "no live data" is exactly what caused the false-ON-TIME problem on the Transitous side
- the rate limit: no rate-limit headers were present on the 401/403/404 responses, so the 60 requests/minute figure is still unconfirmed

---

## Part B — FPTF candidates

| | Transitous via `motis-fptf-client` | `db-vendo-client` (`dbnav`) |
|---|---|---|
| Started | Yes (Node, port 3002) | Yes (Node, port 3001) |
| `/locations` | **200** | 500 — upstream `app.services-bahn.de` returns "Unknown" |
| `/stops/:id/departures` | **200** (needs Transitous stop id) | 500 — same upstream failure |
| `/journeys` | **200** (needs Transitous stop ids) | 500 — same upstream failure |
| `/trips/:id?stopovers=true&polyline=true` | **200** | not reachable |
| `/locations/nearby` | **500 `NotImplemented`** | 500 — same upstream failure |

How they were run: Docker Desktop's engine would not start on the test machine, so both projects were cloned from GitHub into a scratch directory and run with Node (`npm install --ignore-scripts`). Both were given the User-Agent `TransitFlow/2.0 (+https://github.com/Dremo-drizzy/German-Api-project)`. `db-vendo-client` was tested only as a comparison and abandoned once every DB call failed upstream, which is exactly what its own readme warns about.

### The decisive result: `/trips` on Transitous

Trip tested: `ICE 706`, München Hbf → Hamburg-Altona, `tripId` `20261009_13:12_de-DELFI_3432207103` (taken from the Berlin Hbf departures).

- **Stopovers with coordinates: yes.** 14 stopovers, 14 with numeric `stop.location.latitude` / `longitude`.
- **Polyline: yes.** A GeoJSON `FeatureCollection` of `Point` features, coordinates `[lon, lat]` (so `toLatLng`'s flip is still required). **12,110 points**, and unlike the old API the features carry no station properties.
- Response shape is `{ trip, realtimeDataUpdatedAt }` — **the trip is wrapped under `trip`**, which resolves the open question `TripDetail.jsx` guards for with `data?.trip ?? data`.
- **Size: ~1.0 MB compact JSON, of which the polyline is ~1.0 MB.** The compact fixture is `transitous-trip.json`. This matters for the backend cache (it is bounded by entry count, not bytes) and for every trip-page load.
- Stopover fields: `arrival`/`departure` (live) were `null` for this trip, with `plannedArrival`/`plannedDeparture` and `prognosedArrival`/`prognosedDeparture` alongside, plus `arrivalDelay`/`departureDelay` and per-stopover `cancelled`. 3 of the 14 stopovers were `cancelled: true` on a trip that was not itself cancelled. `geo.js` already skips cancelled stopovers and falls back `departure ?? plannedDeparture`; whether it should also consider `prognosed*` is a decision for the next stage.
- No `currentLocation` field.

### What else differs from the old upstream

- **Stop IDs are not EVA numbers.** Transitous ids are feed-prefixed and platform-level, e.g. Berlin Hbf = `at-Railway-Current-Reference-Data-2026_de:11000:900003200:1:51`, Frankfurt Hbf = `at-Railway-Current-Reference-Data-2026_de:06412:10:16:16`. Calling `/stops/8011160/departures` or `/journeys?from=8011160…` returns HTTP 500 `unknown feed id ""`. Consequences: `/departures/8011160` URLs, the Berlin Hbf default in `LiveDeparturesPreview`, and **every saved commute in users' localStorage** hold old ids that Transitous will not accept.
- **`/locations` mixes in non-stations.** `?query=berlin` returned OSM POIs (including a "Berlin" in Ontario, Canada) before the actual station. The app's autocomplete would need to filter to `type: "station"` (this also resolves the Known Limitation about addresses/POIs).
- **Journeys carry no `duration` field** (journey keys: `type`, `legs`, `refreshToken`, `remarks`). `JourneyCard` reads `journey.duration`, so it would render empty; it would have to be computed from the first leg's departure and last leg's arrival. Legs have `tripId`, `line.product`, `plannedDeparture`/`departure`, `departureDelay`; no stopovers or polyline unless requested.
- **"No live data" looks different.** Departures never have `when: null` here — `when` equals `plannedWhen` — and the signal is **`delay: null`** (128 of 204 departures in the sample). `delay` is in seconds when present (60, 240, 1800 …). `getDepartureStatus`'s NO DATA branch keys on a missing actual time, so on this source it would never fire and unpredicted departures would still show ON TIME. It needs to key on `delay == null`.
- **Departures payload is large and includes buses/trams:** 204 departures in 60 minutes at Berlin Hbf (~300 KB pretty-printed): 60 tram, 54 bus, 51 S-Bahn, 12 U-Bahn, 16 regional, 8 ICE, 3 IC/EC. `line.product` is still the string the app expects. Bus `platform` values look like `"Pos. 12"`.
- **`nearby` does not work.** `motis-fptf-client`'s `format/nearby-req.js` throws `NotImplemented`, so the "Use my location" feature cannot be served by `/locations/nearby`.

### Fixtures saved (`Backend/fixtures/`)

`transitous-locations.json`, `transitous-departures.json`, `transitous-journeys.json` (Berlin Hbf → Frankfurt Hbf), `transitous-trip.json` (compact). **No fixtures exist for `nearby` or for `db-vendo-client`** — those calls failed and error bodies were not kept. No DB Timetables XML fixtures exist yet (Part A).

---

## Terms of use

**Transitous** (<https://transitous.org/api/>) — you may use it if all of these hold: the project is open-source; it is **not commercial**; it is light on their resources; it follows their usage policy:

- publish the source under an open-source license;
- send an HTTP `User-Agent` with every request containing the application name, client version, and a way to contact you (email or URL);
- link to <https://transitous.org/sources/> somewhere visible, and honour the data sources' own conditions, including OpenStreetMap attribution;
- **contact them before making many requests or resource-intensive ones** (routing is named explicitly) — "also from different users";
- they provide it best-effort and "reserve the right to stop providing it to any consumer at any time".

This repo is public and MIT-licensed and the app is non-commercial, so the conditions are met for user-driven journey/trip requests at low volume. They are **not** compatible with continuous background polling for weeks, which is what delay logging would do.

**db-vendo-client** — its own readme says the DB APIs are "subject to haphazard blocking" and "very unreliable", recommends `motis-fptf-client` with Transitous instead, and states "Strictly speaking, permission is necessary to use this library with the DB APIs."

**DB Timetables API** — registered, key-based, intended for programmatic use. Its terms have not been read as part of this recon.

---

## Migration risks

Three findings above will drive Stage 1. Each is written down here as a risk with the number that proves it, so the fix can be checked against something.

### 1. "No live data" is encoded differently — the ON TIME bug comes back

The existing fix checks for a missing `when`. Transitous never sends a null `when`: for a departure with no realtime prediction it sets `when` equal to `plannedWhen` and `delay: null`. In the saved departures fixture, **128 of 204 departures** are in this state (`when === plannedWhen` in all 128, `when` null in none). Run through today's `getDepartureStatus`, every one of them would render as a green ON TIME, and the NO DATA branch would never fire.

Whatever adapter normalises Transitous data has to turn "`delay == null`" into the app's "no prediction" state, and it needs a test that uses the real fixture (`Backend/fixtures/transitous-departures.json`) and asserts that all 128 come out as NO DATA, not ON TIME. `delay` is in seconds when present. The adapter has to be source-aware: the same field means different things on different sources.

### 2. A single trip response is ~1 MB, almost all polyline

The saved trip (`ICE 706`, München Hbf → Hamburg-Altona) is **1,018,479 bytes** compact, of which the polyline is **1,002,317 bytes** and **12,110 points**. That is far more geometry than a map draws at any normal zoom, and it is also the case the cache's entry-count bound (a documented Known Limitation) handles worst.

The likely fix is downsampling the polyline in the proxy before it is cached and sent, which shrinks the payload for the cache and for every trip-page load. Baseline to measure against: **12,110 points / ~1.0 MB**. Whatever tolerance is chosen, vehicle-position interpolation (which walks the polyline between nearest vertices) has to be re-tested against the downsampled line.

### 3. Stop IDs are feed-prefixed strings, not EVA numbers — saved commutes break

Transitous ids look like `at-Railway-Current-Reference-Data-2026_de:11000:900003200:1:51`. Commutes saved in localStorage hold EVA numbers (e.g. `8011160`) in `from.id` / `to.id`, and Transitous answers those with HTTP 500 `unknown feed id ""`.

Saved commutes also store the station **name** next to each id, so they can be re-resolved by name on load instead of being dropped. One caveat that is easy to miss: the validator added to `Commutes.jsx` only checks that `from.id`, `to.id` and `name` are truthy, so old EVA-numbered commutes currently **pass** validation and would be kept — then fail on first use. The same applies to bookmarked `/departures/:stopId` URLs and the Berlin Hbf default in `LiveDeparturesPreview`.

---

## Recommendation

| Need | Source | Why |
|---|---|---|
| Journeys, trips (map, stopovers, polyline) | **Transitous via `motis-fptf-client`** | The only candidate that worked; returns stopovers with coordinates and a polyline; user-driven, low-volume traffic fits their terms. Pinned to FPTF, so the frontend contract barely changes. |
| Live departures board | Transitous, **short-term**; DB Timetables if it proves to fit | Transitous works today and keeps FPTF, but check the stop-id and `delay == null` changes above. DB Timetables is the better fit for volume, if Part A shows it carries what the board needs. |
| Delay logging (continuous polling) | **DB Timetables API only** | Registered and built for it. Polling Transitous continuously is exactly what their terms ask people not to do. |
| Nearby stops | Undecided | Not available from either FPTF source. Needs a different approach (e.g. a MOTIS stops-by-area call, or a static station list) — out of scope for this recon. |
| `db-vendo-client` | **Do not use** | Every DB call failed upstream, its maintainers recommend against it, and its readme says permission is required. |

The split is partly a terms-of-use decision, not only a technical one: Transitous for user-driven requests, the official registered API for anything that runs on a timer.

---

## Surprises

- The `motis-fptf-client` readme names a Docker image (`ghcr.io/public-transport/motis-fptf-client`) that returns "denied"; the pullable image is `ghcr.io/motis-project/motis-fptf-client`.
- Transitous stop IDs are platform-level and feed-prefixed, not EVA numbers — larger blast radius than expected (URLs, saved commutes, defaults).
- A single trip response is ~1 MB, almost all polyline.
- Partial cancellations: a trip not itself cancelled had 3 cancelled stopovers.
- Unpredicted departures have `when === plannedWhen`, not `when: null`.
- Journeys have no `duration`.

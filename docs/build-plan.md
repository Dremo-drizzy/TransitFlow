# TransitFlow — Staged Build Plan

A rebuild of `Dremo-drizzy/German-Api-project` into something that reads as a product rather than a fetch wrapper.

**Target design:** split-flap departure board — near-black housing, amber monospace readouts, mechanical flip animations on every time change.
**Target feature:** live map + trip tracking — route drawn on a dark map, vehicle position animated from real departure times, full stopover timeline.
**Constraint:** stay on Bootstrap / react-bootstrap, restyled through CSS variables rather than replaced.

Eight stages. Each is one Claude Code session, one branch, one PR. Run them in order — later stages assume earlier ones landed.

---

## How to run these

A few rules that matter more than the prompts themselves:

**One stage, one session.** Start each stage with `/clear`. A session that still remembers Stage 2 will drift while doing Stage 5, and you will not notice until the diff is 40 files wide.

**One branch per stage.** `git checkout -b stage-3-design-system`. If a stage goes badly, `git checkout .` costs you nothing. If you build all eight on `main`, a bad Stage 6 takes Stage 5 with it.

**Read the diff before you commit.** Every stage. `git diff --stat` first to see the shape, then `git diff` on anything that surprises you. The failure mode with a coding agent is not bad code, it is *plausible* code in files you did not expect it to touch.

**Make it prove the work.** Every prompt below ends with a verification command. If the agent says "done" without showing you output from that command, ask for it. "Run `npm run build` and paste the output" is the single most useful follow-up message in this whole document.

**For Stages 6 and 7, ask for a plan first.** Those are the two where a wrong architecture is expensive to unwind. Paste the prompt, then add: *"Before writing any code, show me the file list and the approach. Wait for my go-ahead."*

---

## Stage 0 — Repo hygiene and a safety net

**Goal:** get the repo into a state where the next seven stages can move fast and you can tell when something breaks.

**Why first:** your repo currently tracks 719 files under `Backend/node_modules` plus three committed zips, which makes every diff unreadable. And there are no tests, so nothing tells you when a redesign quietly breaks `formatDuration`. Fix both before touching features.

```
Read the repo first: Backend/ and Frontend/src/ — every file, not just a sample.

This is a housekeeping stage. Do not change any behaviour, styling, or feature.

1. Stop tracking dependencies and build junk.
   - Create Backend/.gitignore with: node_modules, .env, .env.local, *.log, .DS_Store, *.zip
   - git rm -r --cached Backend/node_modules
   - git rm --cached Backend.zip Frontend/node_modules.zip Frontend/src.zip, and delete those
     three files from disk
   - Add *.zip to Frontend/.gitignore

2. Move configuration out of the source.
   - Frontend/src/apis/api.js currently hardcodes
     https://german-api-project.onrender.com/api, so local dev hits production.
     Change it to: import.meta.env.VITE_API_BASE_URL || '/api'
   - Create Frontend/.env.example documenting VITE_API_BASE_URL
   - In Frontend/vite.config.js add a dev server proxy so '/api' forwards to
     http://localhost:5000 during development

3. Add a test runner.
   - Install vitest as a devDependency, add "test": "vitest run" and
     "test:watch": "vitest" to Frontend/package.json
   - Write Frontend/src/utils/transportUtils.test.js covering formatTime,
     formatDuration, getDelayMinutes, formatDelay and getDelayBadgeVariant,
     including the null and malformed-input paths
   - Some of these tests will FAIL. That is expected and correct — do not change
     the implementation to make them pass, that happens in Stage 1. Mark the known
     failures with it.fails() or a clear TODO comment so the suite is green.

4. Remove dependencies that are not used.
   - Frontend/package.json lists express, cors and node-fetch (backend packages in a
     frontend) and react-bootstrap-typeahead (never imported). Remove all four.
   - Delete Frontend/src/Components/FavoriteRoutes.jsx — nothing imports it.
   - Remove unused imports flagged by eslint: useState in App.jsx, Badge in
     PlanJourney.jsx and CommuteCard.jsx.

5. Write a CLAUDE.md at the repo root. This file is read automatically at the start
   of every future session, so it needs to carry the project's context. Include:
   - What the app is and which upstream API it uses (v6.db.transport.rest, via the
     Express proxy in Backend/)
   - The folder layout and what lives where
   - Conventions: functional components with hooks, React Query for all server
     state, Bootstrap 5.3 restyled via CSS custom properties (never inline styles
     for anything themeable), one CSS file per component under src/css/
   - The verification gate: npm run lint && npm run test && npm run build must all
     pass before any work is called done
   - A "gotchas" section, starting with: line.product from the DB API is a STRING
     (e.g. "nationalExpress", "suburban", "bus"), not an object

6. Add .github/workflows/ci.yml running lint, test and build on push and PR.

Verify: from Frontend/, run `npm install && npm run lint && npm run test && npm run build`
and paste the output. Then run `git ls-files | grep -c node_modules` and show me it prints 0.
```

**Done when:** `git ls-files | wc -l` drops from ~750 to under 60, CI is green, and `npm run test` runs.

---

## Stage 1 — Fix what's actually broken

**Goal:** kill the real bugs before you spend time restyling code that doesn't work.

**Why now:** three of these are invisible until you look closely — the icons are always wrong, the time picker is off by your UTC offset, and a rate-limited request renders as "no results found". Redesigning on top of them means shipping them.

```
Read Frontend/src/apis/api.js, Frontend/src/utils/transportUtils.js,
Frontend/src/Pages/PlanJourney.jsx, Frontend/src/Pages/Commutes.jsx,
Frontend/src/App.jsx and all files in Frontend/src/hooks/.

FIRST, clear the two things Stage 0 deliberately left behind:

  a) transportUtils.test.js has four it.fails() cases marking known bugs. it.fails()
     INVERTS the assertion — each passes BECAUSE the code is currently wrong. As you
     fix each bug below, convert that test from it.fails() back to it(). The suite
     must finish at 25 passing, 0 expected-fail. If a test starts failing right after
     you fix a bug, this is why — do NOT "fix" the implementation to make it pass again.

  b) npm run lint currently exits 1: a react-hooks/set-state-in-effect error and an
     exhaustive-deps warning, both on the PlanJourney.jsx mount effect that reads
     searchParams. That effect is BUG 4 below. Fix it properly — derive state from
     searchParams rather than setting it inside an effect — and finish with lint
     exiting clean, zero warnings. CI has been red since Stage 0; this stage closes it.

  c) Add a second job to .github/workflows/ci.yml for Backend/ — CI currently only
     runs Frontend, so Stage 2's server tests would never run.

  d) Add .github/pull_request_template.md with the headings: Why / Changes /
     Verification / Deliberately deferred / What to look at.

THEN the six bugs. Fix each, and add or unskip a test for each where the logic is
testable.

BUG 1 — the retry loop in apis/api.js is wrong twice over.
  `if (attempt === retries - 1) throw error` throws on attempt 2 of 3, so you get two
  attempts, not three. And if every attempt returns 429, the loop falls out of the
  bottom and the function returns undefined with no error thrown — callers then do
  `data?.departures || []` and render "No departures found", so a rate limit is
  indistinguishable from an empty station.
  Rewrite so that: the final attempt rethrows; falling out of the loop is impossible;
  4xx responses other than 429 fail immediately without retrying; backoff is
  exponential with jitter; and every request carries an AbortSignal.timeout(10000),
  because right now a hung request hangs forever.
  Delete the USER_AGENT constant — it is unused, and browsers forbid setting that
  header anyway. It belongs on the server (Stage 2).

BUG 2 — getProductIcon never returns the right icon.
  line.product is a string from the DB API, so product.type and product.name are both
  undefined, t is '', and every single leg renders the default metro icon. Separately,
  the substring matching is broken: t.includes('s') is tested before the bus branch,
  so a bus would match S-Bahn.
  Replace the whole function with an exact lookup keyed on the product id:
  nationalExpress, national, regionalExpress, regional, suburban, subway, tram, bus,
  ferry, taxi. Accept either a string or an object with a .type, and fall back to a
  neutral icon. Test every product id.

BUG 3 — the departure picker is off by the UTC offset.
  Searchform.jsx does value={departure.slice(0, 16)} where departure is an ISO string
  from toISOString() — that is UTC, but <input type="datetime-local"> expects local
  wall-clock time. In Germany it displays 1–2 hours behind what the user means.
  Fix the display conversion in both directions. Add a helper to transportUtils.js
  with tests that pin a non-UTC timezone.

BUG 4 — PlanJourney searches on raw typed text.
  params.from falls back to fromQuery when no station is selected, and the query is
  enabled on mere truthiness — so once there is text in both boxes, every keystroke
  sends ?from=be&to=mu upstream and 400s.
  Gate strictly on selectedFrom?.id and selectedTo?.id.
  In the same file: searchParams.get() already URL-decodes, so the extra
  decodeURIComponent() is a double decode that throws URIError on a stray '%' —
  remove it. The mount effect reads searchParams with an empty dependency array, so
  navigating to /plan with new params while already on /plan keeps the old stations —
  depend on searchParams. And handleSearch both bumps searchTriggered (changing the
  query key) and calls refetch(), which is two fetches per click — keep one.

BUG 5 — autocomplete fires a request per keystroke.
  There is no debounce anywhere in the codebase. Add a useDebounce hook in
  src/hooks/useDebounce.js and apply it in useLocation.js with a 300ms delay, keyed on
  the debounced value so intermediate queries are never issued at all.

BUG 6 — dead routes and no error boundary.
  Commutes.jsx navigates to /departures and the footer links /about; neither route
  exists in App.jsx, so both render a blank white page. There is also no catch-all.
  Add placeholder About and NotFound pages and wire up "*". Create an ErrorBoundary
  component and wrap the routes in it — JourneyCard does journey.legs[0] unguarded, so
  one malformed response currently white-screens the app.

Also: Commutes.jsx calls useState(loadFromLocalStorage('commutes', [])), which reads
localStorage and JSON.parses on every single render. Use the lazy form,
useState(() => ...). And replace id: Date.now() with crypto.randomUUID().

Do not restyle anything. No CSS changes in this stage.

Verify: npm run lint && npm run test && npm run build. Paste the test output showing
the new cases passing.
```

**Done when:** tests cover all six, and the suite is green with nothing skipped.

---

## Stage 2 — Backend: close the open proxy

**Goal:** stop anyone who finds your Render URL from using it as a free relay on your rate limit.

**Head start:** I've already written and smoke-tested this one. Four files ship alongside this plan — `server.js`, `routes.js`, `cache.js`, `.env.example`. Drop them into `Backend/`, run `npm install`, and you can skip most of the prompt. Use the prompt below to have Claude Code review and finish the job.

```
Read Backend/server.js, Backend/routes.js, Backend/cache.js and Backend/.env.example.

These replace the old wildcard proxy. Review them against the original
(git show HEAD~1:Backend/server.js) and confirm each of these is genuinely handled:

  - The old app.get("/api/*path") forwarded ANY path to the upstream. The new version
    has an explicit allowlist in routes.js — each route declares a fixed upstream path
    template, the exact query parameters it forwards, and a cache TTL. Confirm every
    call the frontend actually makes is covered, by cross-referencing
    Frontend/src/apis/api.js.
  - cors() was wide open; it is now an ALLOWED_ORIGINS allowlist.
  - The old code did res.json(data) unconditionally, so upstream 404s and 429s reached
    the browser as HTTP 200 with an error-shaped body. Confirm status codes now pass
    through, and that non-JSON upstream responses become a 502 rather than a crash.
  - A User-Agent is now sent upstream, as transport.rest's docs request.
  - Responses are cached by upstream URL with per-route TTLs.

Then finish it:
  1. Add Backend/server.test.js using vitest and supertest. Cover: /health returns 200;
     an allowlisted route with valid params builds the right upstream URL; an
     unknown path returns 404; a query parameter not on the allowlist is dropped
     rather than forwarded; a second identical request is served from cache. Mock
     global fetch — do not hit the real API in tests.
  2. Add "test": "vitest run" to Backend/package.json.
  3. Update Frontend/src/apis/api.js so it surfaces the proxy's error bodies as real
     Error messages instead of swallowing them.
  4. Because Render's free tier spins down after ~15 minutes idle and the first request
     back takes close to a minute: have the frontend ping /health on app mount and,
     if it has not answered within 3 seconds, show a "waking the server up, this takes
     about a minute" banner. Put this in a useServerWake hook; render the banner in
     App.jsx. Keep it plain for now, Stage 3 will style it.

Verify: from Backend/, npm install && npm test. Then start the server and show me:
  curl -s localhost:5000/health
  curl -s -o /dev/null -w "%{http_code}\n" localhost:5000/api/foo        # expect 404
  curl -s -o /dev/null -w "%{http_code}\n" "localhost:5000/api/locations?query=berlin"
```

**Done when:** `/api/foo` returns 404, `/health` reports a cache hit rate, and tests pass.

---

## Stage 3 — The split-flap design system

**Goal:** build the foundation the whole redesign sits on — tokens, type, and the signature flip component. Apply it to the shell only.

**Why apply it narrowly:** if you restyle twelve components in the same session that invents the design language, you will not be able to tell whether a bad-looking card is a bad token or a bad card. Nail the tokens on the navbar and footer, look at it, then go wide in Stage 4.

```
This stage establishes the visual language. Scope: tokens, fonts, the SplitFlap
component, and the app shell (navbar, footer, page background). Do NOT restyle cards,
forms, or pages yet — that is Stage 4.

The look: a mechanical split-flap departure board. Near-black housing, amber
monospace readouts, phosphor green for live/on-time, hard edges, almost no border
radius, no soft shadows. Think Frankfurt Hbf in 1985, not a SaaS dashboard.

1. Fonts. In Frontend/index.html add preconnect + a Google Fonts link for
   IBM Plex Mono (400, 600, 700) and Inter (400, 600, 800). Every real fallback stack
   ends in monospace / system-ui respectively.

2. Create Frontend/src/css/theme.css — the single source of truth for the palette.
   Set data-bs-theme="dark" on <html> in index.html, then override Bootstrap 5.3's
   own custom properties inside [data-bs-theme="dark"] so that react-bootstrap
   components inherit the theme instead of fighting it. This is the whole trick of
   this stage: restyle Bootstrap through its variables, do not write overrides that
   out-specify it.

   Define these tokens on :root and map them onto the Bootstrap ones:
     --tf-void:        #08090b   /* page background */
     --tf-housing:     #101216   /* board / card surface */
     --tf-flap:        #1a1d23   /* flap tile face */
     --tf-flap-dark:   #0b0d10   /* lower half of a flap */
     --tf-edge:        #252a32   /* 1px borders */
     --tf-amber:       #ffb302   /* primary readout */
     --tf-amber-dim:   #8a6100
     --tf-green:       #3ddc84   /* on time, live */
     --tf-red:         #ff5a5f   /* delayed, cancelled */
     --tf-text:        #e9e7e2   /* off-white body text */
     --tf-muted:       #767f8c

   Map at minimum: --bs-body-bg, --bs-body-color, --bs-emphasis-color,
   --bs-secondary-color, --bs-border-color, --bs-primary, --bs-primary-rgb,
   --bs-link-color, --bs-link-hover-color, --bs-card-bg, --bs-card-border-color,
   --bs-card-cap-bg, --bs-success, --bs-danger, --bs-warning, --bs-font-monospace,
   --bs-body-font-family, --bs-border-radius (drop it to 2px).

   Import theme.css FIRST in main.jsx, before bootstrap's own CSS, and confirm
   the cascade order actually works — check in the browser, do not assume.

3. Build Frontend/src/Components/SplitFlap.jsx + src/css/SplitFlap.css.

   API:  <SplitFlap value="20:18" length={5} tone="amber" />
   tone is one of amber | green | red | muted.

   Behaviour: pad or truncate value to `length`, render one .sf-cell per character.
   Keep the previous value in a ref. When the value changes, only the cells whose
   character actually changed animate — the rest stay still. That selective flip is
   what sells the effect; flipping the whole row on every tick looks like a loading
   animation.

   The flip: rotateX from -90deg to 0 over 260ms with
   cubic-bezier(.36, .07, .19, .97), staggered by index * 30ms. Each cell gets a
   1px hinge line across its middle via ::after, and a top-to-bottom gradient from
   --tf-flap to --tf-flap-dark so the two halves read as separate. Force the
   animation to re-run by including a bump counter in the cell's React key.

   Under @media (prefers-reduced-motion: reduce), replace the rotation with a 120ms
   opacity cross-fade. Non-negotiable.

   Write SplitFlap.test.jsx: renders the right number of cells, pads short values,
   truncates long ones, and marks only changed indices as flipping.

4. Restyle the shell only:
   - TransNavbar: full-width black bar, thin --tf-edge bottom border, brand in
     IBM Plex Mono with wide letter-spacing, active NavLink marked with a 2px amber
     underline rather than a colour change.
   - Footer: REMOVE the fixed-bottom class. It currently overlays page content — on
     the Commutes page the last row of cards sits underneath it. Use mt-auto inside
     the existing flex column instead.
   - Page background: --tf-void, with a very subtle repeating-linear-gradient
     scanline overlay at under 3% opacity. Subtle. If you can see individual lines at
     100% zoom it is too strong.

5. Build a temporary /styleguide route rendering the palette, both fonts, and
   SplitFlap in all four tones with a button that changes the value so the flip can
   be inspected. Delete this route at the end of Stage 4.

Verify: npm run lint && npm run test && npm run build. Then start the dev server, take
a screenshot of /styleguide, and show it to me.
```

**Done when:** `/styleguide` looks like a departure board and the flip animation triggers only on changed characters.

---

## Stage 4 — Restyle the components

**Goal:** apply the language everywhere, and collapse the three copies of the autocomplete into one.

```
Read Frontend/src/css/theme.css and Components/SplitFlap.jsx first — everything here
builds on them. Use the tokens; do not introduce new colours.

1. Extract the shared autocomplete. QuickSearch.jsx, Searchform.jsx and
   AddCommuteModal.jsx each contain the same hand-rolled station picker, about thirty
   duplicated lines. Build one Components/StationAutocomplete.jsx:

     <StationAutocomplete label="From" value={query} onChange={setQuery}
                          selected={selected} onSelect={setSelected} />

   It must fix what all three copies are missing: closes on blur and on Escape,
   arrow-key navigation with Enter to select, and proper ARIA — role="combobox" on the
   input with aria-expanded and aria-activedescendant, role="listbox" on the list,
   role="option" on each item. Right now the suggestions are mouse-only and invisible
   to screen readers.

   Style it as a board readout: mono input, amber caret, dropdown as a hard-edged
   panel with a 1px --tf-edge border and no radius, the highlighted row inverted to
   amber background with near-black text.

   Replace all three usages. The three call sites should lose roughly 90 lines between
   them.

2. JourneyCard: restyle as a board row. Times in SplitFlap. Leg products as small
   mono pills. Replace the coloured Bootstrap badges with: on-time in --tf-green,
   1–5 min in --tf-amber, over 5 min in --tf-red, cancelled in --tf-red with a
   strikethrough on the time.
   Guard the unguarded journey.legs[0] / legs[legs.length - 1] access.
   Handle the cancelled case properly — the DB API sets cancelled: true on legs, and
   getDelayMinutes currently returns 0 when `when` is null, which is exactly what a
   cancellation looks like, so cancelled trains currently render as "On time".

3. CommuteCard: board-panel styling, mono route names, the from/to rail as a vertical
   amber line with square terminals rather than dots.

4. LiveDeparturesPreview: restyle as a proper mini board with a header row
   (TIME / LINE / DESTINATION / PL.) in --tf-muted mono caps.
   Also fix two behaviours: it calls geolocation in a mount effect, so a first-time
   visitor gets a browser permission prompt before seeing anything — replace that
   with the Berlin Hbf default rendered immediately plus a "Use my location" button.
   And it early-returns a bare spinner before the card renders, which makes the
   layout jump; render the card shell with skeleton rows instead.

5. Hero: remove dangerouslySetInnerHTML — pass JSX children instead. There is no
   reason to parse HTML here and it is a habit worth not forming.
   Restyle: oversized mono headline, amber eyebrow in caps with wide tracking, chips
   as hard-edged outlined mono tags.

6. Home, PlanJourney and Commutes pages: apply board panels, consistent section
   headers (mono, uppercase, --tf-muted, wide tracking, 1px bottom rule), and replace
   every Bootstrap Spinner with skeleton rows that match the shape of the content
   they are standing in for.

7. Delete the /styleguide route.

Verify: npm run lint && npm run test && npm run build, then screenshot /, /plan and
/commutes at both 1440px and 390px wide and show me all six.
```

**Done when:** all three pages read as one system, and the autocomplete exists once.

---

## Stage 5 — The departures board

**Goal:** first real feature. A full-page live board — and it fixes the dead `/departures` link from Stage 1.

```
New route: /departures/:stopId, with ?name= for the station label.

Build Frontend/src/Pages/Departures.jsx and Components/DepartureBoard.jsx.

Layout, top to bottom:
  - Station name as a large mono headline, with a live clock ticking beside it
    (build a useNow(1000) hook in src/hooks/ — Stage 6 needs it too)
  - A filter row: toggle chips per product type (ICE, IC/EC, RE, RB, S, U, Tram, Bus,
    Ferry) that map onto the boolean query parameters the API already accepts —
    nationalExpress, national, regionalExpress, regional, suburban, subway, tram,
    bus, ferry. Filter upstream via the query, not client-side; the proxy already
    allowlists these parameters.
  - Column headers in muted mono caps: TIME / LINE / DESTINATION / PLATFORM / DELAY
  - The rows.

Row behaviour, this is the part that has to feel right:
  - Scheduled time in SplitFlap. When live data moves a departure, the digits flip.
  - Delay column: "ON TIME" in green, "+N MIN" in amber or red by severity,
    "CANCELLED" in red with the row dimmed and the time struck through.
  - Platform in SplitFlap too — a platform change is the single most useful thing a
    real board shows, so when it changes, flip it AND pulse the cell amber for 2s.
  - Row click navigates to /trip/:tripId (Stage 6 builds that page; link to it now).

Data: reuse useDepartures. Raise refetchInterval to 30s but ALSO set
refetchIntervalInBackground: false so a backgrounded tab is not burning your rate
limit. Add an aria-live="polite" region announcing changes for screen readers.

Wire up the entry points: the "View Departures" button in CommuteCard (currently
navigating to a route that does not exist), and clicking the station name in
LiveDeparturesPreview.

Handle every state explicitly: loading (skeleton rows, not a spinner), empty
("NO DEPARTURES IN THE NEXT 60 MIN" in board type), error (a board-styled message
with a retry button), and rate-limited (distinguish HTTP 429 from other errors and
say so — after Stage 1 the API layer throws a real error for this).

Verify: npm run lint && npm run test && npm run build, then screenshot the board for
Berlin Hbf (stop 8011160) and show me.
```

**Done when:** the board updates live, digits flip on change, and filters change what's fetched.

---

## Stage 6 — Live map and trip tracking

**Goal:** the headline feature. This is what makes the project not an API demo.

**Ask for a plan before code on this one.**

```
Before writing code, show me your file list and approach, and wait for my go-ahead.

Goal: a trip detail page at /trip/:tripId showing the route on a dark map with the
vehicle's live position animated along it, next to a full stopover timeline.

Dependencies: leaflet and react-leaflet (v5 — it requires React 19, which this project
is already on). Import 'leaflet/dist/leaflet.css' in main.jsx.

FIVE GOTCHAS. Get these wrong and you will lose an hour each:
  1. The DB API returns route geometry at /trips/:id?polyline=true as a GeoJSON
     FeatureCollection. The coordinates are [longitude, latitude]. Leaflet wants
     [latitude, longitude]. You must flip them. If your route renders somewhere in
     the Indian Ocean, this is why.
  2. Leaflet's default marker icons 404 under Vite's bundler. Do not fight it with
     the usual icon-URL patch — use L.divIcon with your own markup, which you want
     anyway for the board aesthetic.
  3. A Leaflet map container with no explicit height renders at zero pixels and looks
     like nothing happened. Set the height in CSS.
  4. MapContainer's center and zoom props are read once at mount and ignored after.
     To change the view, use the useMap() hook from inside a child component.
  5. Tiles: CARTO Dark Matter,
     https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
     Attribution is required and non-optional: "© OpenStreetMap contributors © CARTO".

Build:

1. src/utils/geo.js — pure functions, fully unit tested, no React:
     - haversine(a, b) in metres
     - toLatLng(geoJsonCoordinate) doing the lon/lat flip
     - pointAlongPath(path, fraction) — walks a polyline by cumulative distance and
       returns the coordinate at that fraction of total length
     - vehiclePosition(stopovers, polyline, now) — described below

2. vehiclePosition is the interesting one. Given the stopovers array, the route
   polyline and the current time:
     - For each stopover use the live time when present, falling back to the planned
       one: departure ?? plannedDeparture, arrival ?? plannedArrival
     - Find the segment where now sits between stopover[i]'s departure and
       stopover[i+1]'s arrival
     - t = (now - depart_i) / (arrive_i+1 - depart_i), clamped to [0, 1]
     - Version 1: linear interpolation between the two stops' coordinates. Get this
       working end to end first.
     - Version 2: once v1 renders, slice the polyline between the vertices nearest
       each stop and use pointAlongPath so the marker follows the actual track
       instead of cutting across country.
     - Before the first departure, park at the origin and report status 'scheduled'.
       After the final arrival, park at the destination, status 'arrived'. While
       stopped in a station, status 'at_stop' with that stop's name.
   Test all of it with fixed timestamps. No network, no clock dependency.

3. Components/TripMap.jsx — dark tiles, the route as a 3px amber polyline, a small
   square divIcon at every stopover, a distinct marker for the vehicle carrying the
   line name, and fitBounds to the route on mount. The vehicle marker moves on a
   useNow(1000) tick with a CSS transition so it glides rather than teleports.
   Respect prefers-reduced-motion: snap instead of transition.

4. Components/StopoverTimeline.jsx — vertical rail beside the map. One node per stop
   with arrival and departure times, platform, and delay. Stops already passed are
   dimmed; the segment currently being travelled is amber and pulsing; cancelled
   stops are struck through. Clicking a stop pans the map to it.

5. Pages/TripDetail.jsx — map and timeline side by side on desktop, stacked on
   mobile with the map first. Header shows line name, origin → destination, and a
   live status line ("Departed Hannover Hbf · 4 min late · next stop Göttingen").

6. Wire up entry points: every leg in JourneyCard and every row in DepartureBoard
   links to /trip/:tripId. tripIds contain characters that need encoding — use
   encodeURIComponent and confirm a real one round-trips through the router.

7. Update useTripDetails to request stopovers=true and polyline=true. The proxy
   already allowlists both.

Handle the states: trip not found, a trip with no polyline (fall back to straight
lines between stops — some regional services have no geometry), and a cancelled trip.

Verify: npm run lint && npm run test && npm run build, with geo.js test output pasted
in full. Then screenshot a live long-distance trip — pick any ICE from the Berlin Hbf
departure board — and show me the map with the vehicle marker placed on the route.
```

**Done when:** a real in-progress ICE shows its marker in a plausible place on the track, and it moves.

---

## Stage 7 — Nearby radar

**Goal:** the second map surface, and a much better answer to "what's around me" than the current silent geolocation prompt.

```
New route /nearby.

A dark map centred on the user with stops within an adjustable radius (500m / 1km /
2km) as square amber markers sized by how many lines serve them. Over the map, a
radar sweep: a conic-gradient wedge rotating once every 4 seconds, amber, low opacity.
This is pure decoration and it is the whole point — it makes the page feel like
equipment rather than a list.

Geolocation must be behind a button press, never automatic on mount. Show three
states: never asked (a prompt with the button), denied (a station search box as the
fallback path, not a dead end), and granted.

Selecting a marker opens a panel with the stop name, distance, the lines serving it,
and the next three departures — reuse DepartureBoard in a compact variant rather than
writing a second row renderer. A "Full board" link goes to /departures/:stopId.

Reuse useNearbyStops. The radius selector maps to its distance parameter. Debounce
map-pan refetches by 500ms so dragging does not fire twenty requests.

Add /nearby to the navbar.

Under prefers-reduced-motion: reduce, the radar sweep does not rotate — render it
static.

Verify: npm run lint && npm run test && npm run build, then screenshot /nearby with
location granted and show me.
```

**Done when:** markers appear around a real coordinate and selecting one shows departures.

---

## Stage 8 — Ship it

**Goal:** the difference between "a project" and "a project someone wants to look at".

```
Final pass. No new features.

1. Accessibility audit. Run through the app with the keyboard only — every
   interactive element reachable and operable, visible focus rings in amber, no traps
   in the modal or the autocomplete. Check contrast: amber on near-black passes, but
   --tf-muted on --tf-housing probably does not — fix any pair under 4.5:1. Every map
   needs a text-equivalent nearby (the stopover timeline already serves as one for
   TripMap). aria-live on anything that updates by itself.

2. Performance. Route-level code splitting with React.lazy and Suspense — Leaflet is
   large and has no business loading on the home page. Confirm with
   npm run build that the map chunk is separate from the main bundle. Set sensible
   React Query defaults in main.jsx: refetchOnWindowFocus false, retry 1, a default
   staleTime. Check the departures board does not re-render every row on each tick.

3. README.md at the repo root, and this is the part people actually read:
   - One-line description and a live link
   - Animated GIF of the split-flap board updating, and a screenshot of the trip map
   - Features list
   - Architecture: why there is a proxy at all (browser CORS, plus the User-Agent and
     the rate limit the DB API applies per client IP), and what the cache and the
     allowlist are for. This paragraph is what makes a reviewer think you understand
     systems rather than just React.
   - Local setup for both halves, with the env vars
   - A short "known limitations" section — honest beats overclaimed

4. Deploy: frontend to Vercel or Netlify, backend stays on Render. Set
   ALLOWED_ORIGINS on the backend to the deployed frontend origin and confirm CORS
   actually rejects a request from anywhere else. Set VITE_API_BASE_URL on the
   frontend. Then test the cold-start path for real: leave the backend idle 20
   minutes, load the site, and confirm the "waking the server up" banner appears
   instead of a spinner that looks broken.

5. Add a LICENSE (MIT).

Verify: paste a Lighthouse run against the deployed site — performance,
accessibility and best practices. Then give me a one-paragraph summary of anything
you know is still weak, with no diplomacy.
```

---

## Dependency map

```
Stage 0 ─┬─→ Stage 1 ──→ Stage 3 ──→ Stage 4 ──→ Stage 5 ──→ Stage 6 ──→ Stage 7 ──→ Stage 8
         └─→ Stage 2 ────────────────────────────┘
```

Stage 2 only needs Stage 0, so it can run any time before Stage 5. Everything else is a straight line — Stage 4 needs the tokens from 3, Stage 5 needs the components from 4, Stage 6 needs the board rows from 5 to link from.

Rough sizes: Stages 0, 2 and 7 are small. Stages 1, 3, 4 and 5 are medium. Stage 6 is the big one — budget real time for it and expect the vehicle-position maths to need a second pass.

---

## Appendix A — Design tokens

```css
--tf-void:      #08090b   /* page background            */
--tf-housing:   #101216   /* board / card surface       */
--tf-flap:      #1a1d23   /* flap tile face             */
--tf-flap-dark: #0b0d10   /* lower half of a flap       */
--tf-edge:      #252a32   /* 1px borders                */
--tf-amber:     #ffb302   /* primary readout            */
--tf-amber-dim: #8a6100   /* inactive readout           */
--tf-green:     #3ddc84   /* on time, live              */
--tf-red:       #ff5a5f   /* delayed, cancelled         */
--tf-text:      #e9e7e2   /* off-white body text        */
--tf-muted:     #767f8c   /* labels, column headers     */
```

Type: **IBM Plex Mono** for anything a real board would show — times, platforms, line names, labels, column headers. **Inter** for prose. Rule of thumb: if a station board would print it in mechanical characters, it is mono.

Radius stays at 2px everywhere. Shadows are for depth on physical panels only, never for elevation on cards.

---

## Appendix B — API facts worth having in front of you

Base: `https://v6.db.transport.rest` — [docs](https://v6.db.transport.rest/api.html)

- `line.product` is a **string**, one of `nationalExpress`, `national`, `regionalExpress`, `regional`, `suburban`, `subway`, `tram`, `bus`, `ferry`, `taxi`. Not an object. This is the Stage 1 icon bug.
- Departures carry both `plannedWhen` and `when`. `when: null` with `cancelled: true` is a cancellation, not an on-time departure.
- `delay` is given in **seconds**, not minutes.
- `/trips/:id?stopovers=true&polyline=true` gives the full stop list and the route geometry. The polyline is GeoJSON, so coordinates are `[lon, lat]`.
- Journey legs have `walking: true` for footpaths between platforms — these have no `line` and will break a renderer that assumes one.
- Rate limiting is **per client IP**, roughly 100 requests/minute. On a free Render instance every visitor shares one IP, which is exactly why Stage 2's cache matters.
- Stop IDs are numeric strings (Berlin Hbf is `8011160`). Trip IDs are long opaque strings containing characters that need URL encoding.

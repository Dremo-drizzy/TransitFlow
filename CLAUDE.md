# TransitFlow

TransitFlow is a German public transit journey planner: search stations, view
live departures with delay info, plan multi-leg journeys, and save frequent
commutes. It is a rebuild of a fetch-wrapper demo into a product with a
split-flap departure board aesthetic and live map/trip tracking.

This is a staged rebuild — see [docs/build-plan.md](docs/build-plan.md) for
the source of truth on what each stage does, why, and its verification gate.
Check it before starting work to see which stage is current and what the
next one assumes is already in place.

## Data source

All transit data comes from [Transitous](https://transitous.org) — open public
transport data served through MOTIS — via `motis-fptf-client`, which presents
it in the Friendly Public Transport Format the frontend reads. The frontend
never calls it directly: every request goes through the Express proxy in
`Backend/`, which runs the client **in-process** (`Backend/source.js`) and
normalises every response (`Backend/adapters/transitous.js`) before it is
cached. Why that layer exists, what was tested, and the terms of use are in
[docs/data-sources.md](docs/data-sources.md) — read it before touching either.
The previous upstream (v6.db.transport.rest) no longer works.

Transitous requires a User-Agent with a contact and light, user-driven
request volume. Nothing here may poll it on a timer.

## Folder layout

```
Backend/                   Express proxy: allowlisted routes under /api, TTL cache,
                             rate limit, CORS allowlist
  server.js  routes.js  cache.js
  source.js                 Transitous via motis-fptf-client, in-process
  adapters/                 transitous.js (normalise responses), polyline.js
                             (downsample route geometry)
  fixtures/                 Real saved responses the adapter tests run against

Frontend/
  src/
    apis/api.js             All fetch calls to the backend proxy. Nothing else
                             in the app calls fetch() directly.
    hooks/                  One React Query hook per API call (useDepartures,
                             useJourneys, useLocations, useTripDetails,
                             useResolvedStation, useCommuteMigration).
    Components/              Reusable, mostly presentational pieces (cards,
                             forms, navbar, footer).
    Pages/                  Route-level components, wired into App.jsx.
    utils/transportUtils.js  Pure formatting/helper functions (times, delays,
                             durations, localStorage helpers).
                             Covered by transportUtils.test.js.
    utils/stations.js        Station identity: legacy-id detection, name
                             normalisation and matching, nearest station,
                             saved-commute migration.
    utils/geo.js             Vehicle-position maths for the trip map.
    data/majorStations.js    ~50 major stations for "Nearest major station".
    css/                    One CSS file per component, imported by that
                             component. Theming lives in CSS custom properties
                             defined in App.css (:root).
```

## Conventions

- Functional components with hooks only — no class components.
- All server state goes through React Query (`@tanstack/react-query`); no
  fetch calls or server data in `useState`/`useEffect` outside of a hook in
  `src/hooks/`.
- Styling is Bootstrap 5.3 (via `react-bootstrap`), restyled through CSS
  custom properties (see `:root` in `App.css`). Never use inline `style={}`
  for anything themeable (colors, spacing scale, radii, fonts) — add or reuse
  a CSS variable instead.
- One CSS file per component, under `src/css/`, imported by that component
  file directly.
- Environment-specific values (API base URL, etc.) come from Vite env vars
  (`import.meta.env.VITE_*`), never hardcoded — see `Frontend/.env.example`.
- No colour emoji anywhere in the UI — use monochrome SVG or text that takes
  a --tf token.

## Verification gate

Before any work is considered done, from `Frontend/`:

```
npm run lint && npm run test && npm run build
```

All three must pass.

## Gotchas

- `line.product` is a **string** (e.g. `"nationalExpress"`,
  `"suburban"`, `"bus"`), not an object. Don't destructure it or access
  `.type`/`.name` on it expecting an object shape.
- **Known lint failure:** `Pages/PlanJourney.jsx` calls `setState` directly
  inside a `useEffect` to seed form state from URL search params, which
  `react-hooks/set-state-in-effect` flags as a cascading-render anti-pattern
  (plus a related `exhaustive-deps` warning for the missing `searchParams`
  dependency). Left as-is deliberately — fixing it means switching to lazy
  `useState` initializers, which changes render timing (state present on
  first paint instead of one tick later) and was out of scope for the
  behavior-neutral housekeeping pass that first documented it. Fix in a
  dedicated pass, not as a drive-by.
- Delay info comes as separate `planned*` and live (`when`) timestamps, not a
  precomputed delay — compute it with `getDelayMinutes`.
- **A null live time means "no real-time prediction"** (shown as SCHEDULED).
  Transitous itself marks that with a null `delay` and fills `when` with the
  planned time; the backend adapter converts it so the frontend only ever sees
  a null live time. Without that, over half of a busy board would read as a
  confident on-time departure. Bus and tram departures almost never have a
  prediction.
- **Station ids are not durable.** They are long feed-prefixed strings that
  differ between feeds and dataset years, and a station has many (one per
  platform). Never hard-code one or treat one as permanent: look stations up by
  name (`useResolvedStation`), and keep name + coordinates next to any id you
  save. Old all-digit ids (EVA numbers) are from the previous source and are
  re-resolved by name.
- A trip's `stopovers` list only the stops in between; the backend adapter adds
  the origin and destination so the timeline and vehicle position work.
- `transportUtils.test.js` has a handful of tests marked `it.fails()` for
  known null/malformed-input bugs (e.g. `formatDelay(undefined)` produces
  `"+undefined min"`, `getDelayBadgeVariant(undefined)` returns `"danger"`).
  These are intentional and documented with `TODO(Stage 1)` comments — don't
  "fix" the test expectations without also fixing the implementation.
- Local dev requires the backend running (`cd Backend && npm start`, port
  5000) — the Vite dev server proxies `/api` to `http://localhost:5000`. See
  `Frontend/vite.config.js` and `Frontend/.env.example`.

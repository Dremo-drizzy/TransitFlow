# TransitFlow

TransitFlow is a German public transit journey planner: search stations, view
live departures with delay info, plan multi-leg journeys, and save frequent
commutes. It is a rebuild of a fetch-wrapper demo into a product with a
split-flap departure board aesthetic and live map/trip tracking.

This is a staged rebuild — see [docs/build-plan.md](docs/build-plan.md) for
the source of truth on what each stage does, why, and its verification gate.
Check it before starting work to see which stage is current and what the
next one assumes is already in place.

## Upstream API

All transit data comes from the public [v6.db.transport.rest](https://v6.db.transport.rest)
API (Deutsche Bahn network via transport.rest). The frontend never calls it
directly — every request goes through the Express proxy in `Backend/`
(`Backend/server.js`), which forwards `GET /api/*` to `v6.db.transport.rest/*`.
This exists to keep CORS and any future rate-limiting/caching server-side.

## Folder layout

```
Backend/                   Express proxy, single route: GET /api/*path -> v6.db.transport.rest
  server.js

Frontend/
  src/
    apis/api.js             All fetch calls to the backend proxy. Nothing else
                             in the app calls fetch() directly.
    hooks/                  One React Query hook per API call (useDepartures,
                             useJourneys, useLocations, useNearbyStops,
                             useStopDetails, useTripDetails).
    Components/              Reusable, mostly presentational pieces (cards,
                             forms, navbar, footer).
    Pages/                  Route-level components, wired into App.jsx.
    utils/transportUtils.js  Pure formatting/helper functions (times, delays,
                             durations, product icons, localStorage helpers).
                             Covered by transportUtils.test.js.
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

- `line.product` from the DB API is a **string** (e.g. `"nationalExpress"`,
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
- The upstream API returns delay info as separate `planned*` and actual
  (`when`) timestamps, not a precomputed delay — compute delay with
  `getDelayMinutes` in `utils/transportUtils.js`.
- `transportUtils.test.js` has a handful of tests marked `it.fails()` for
  known null/malformed-input bugs (e.g. `formatDelay(undefined)` produces
  `"+undefined min"`, `getDelayBadgeVariant(undefined)` returns `"danger"`).
  These are intentional and documented with `TODO(Stage 1)` comments — don't
  "fix" the test expectations without also fixing the implementation.
- Local dev requires the backend running (`cd Backend && npm start`, port
  5000) — the Vite dev server proxies `/api` to `http://localhost:5000`. See
  `Frontend/vite.config.js` and `Frontend/.env.example`.

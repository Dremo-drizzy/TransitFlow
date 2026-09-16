# TransitFlow

TransitFlow is a live departures, journey-planning, and saved-commutes app for the German rail network, built on Deutsche Bahn's open transit API.

## Stack

- **Frontend:** React 19 + Vite, [`@tanstack/react-query`](https://tanstack.com/query) for all server state, `react-bootstrap` for UI.
- **Backend:** Express, acting as a proxy in front of the upstream transit API.
- **Testing:** Vitest.
- **CI:** GitHub Actions (lint, test, build on every push and PR).

## Architecture

The frontend never calls the transit API directly — every request goes through a small Express proxy in `Backend/`. That indirection isn't incidental; it's there for three concrete reasons.

First, **CORS**. The upstream API ([v6.db.transport.rest](https://v6.db.transport.rest), run by transport.rest) isn't necessarily configured to accept requests from an arbitrary browser origin, and baking that assumption into the frontend is fragile. A server-to-server call sidesteps the question entirely.

Second, **the User-Agent header**. transport.rest's own docs ask clients to identify themselves with a descriptive User-Agent so they can reach out if a client is misbehaving or if something changes upstream. Browsers refuse to let JavaScript set that header on `fetch` requests — it's on the forbidden header list — so a real, honest User-Agent can only be sent from a server we control.

Third, and most important operationally: **the API rate-limits per client IP**. On a free-tier deployment, every visitor to the app shares one outbound IP, so without a cache sitting in front of the upstream API, a moderately popular page could trip the rate limit for everyone using the app, not just the one user who triggered it. A shared server-side cache (arriving in Stage 2 of the rebuild) means five people looking at the same station's departures within the cache TTL cost one upstream request, not five — that's the difference between a client-side inconvenience and a shared outage.

## Local setup

**Backend** (`Backend/`):

```bash
cd Backend
npm install
npm start
```

Runs on port `5000` by default. Set `PORT` to change it.

**Frontend** (`Frontend/`):

```bash
cd Frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so with both halves running locally there's nothing else to configure. To point the frontend at a different backend (e.g. a deployed one), copy `Frontend/.env.example` to `Frontend/.env` and set `VITE_API_BASE_URL`.

## Roadmap

This is a staged rebuild of an earlier fetch-wrapper version of this project into something that reads as a product — a split-flap departure board UI and live map/trip tracking are the end goal. The full plan, stage by stage, with what each one changes and why, lives in [`docs/build-plan.md`](docs/build-plan.md).

**Complete:**
- **Stage 0** — repo hygiene: stopped tracking `node_modules` and committed zips, moved config out of source, added a Vitest test runner, and got CI green.
- **Stage 1** — fixed six real bugs (see below), closed out CI, and folded the lessons from doing so back into the build plan for later stages.

**Up next:** Stage 2 (hardening the backend proxy — the allowlisted routes, caching, and CORS restriction described above). Stages 3 through 8 (the design system, the departures board, live map and trip tracking, and the final ship pass) haven't been started. Nothing past what's listed as complete above should be assumed to exist yet.

## Engineering notes

A couple of the Stage 1 fixes are worth calling out on their own, because they're the kind of bug that looks fine in a code review and only shows up once you think about what actually happens at the edges.

**The retry loop could return `undefined` instead of failing.** The original fetch wrapper retried on HTTP 429 (rate limited), but the loop had no `throw` waiting at the end of it — if every retry came back rate-limited, the `for` loop simply ran out of iterations and the function fell off the end, implicitly returning `undefined`. Every call site treated that as "no data" (`data?.departures || []`), so a rate-limited station and an empty station were indistinguishable in the UI. The fix makes the final attempt rethrow explicitly, with a trailing `throw lastError` after the loop that should be unreachable — a small, deliberate insurance policy against the function ever silently resolving to nothing again.

**Every transit icon was wrong, silently.** `getProductIcon` was written assuming `line.product` was an object with `.type`/`.name` fields, and picked an icon by testing substrings like `t.includes('s')` for S-Bahn. In reality, the DB API sends `product` as a plain string (`"nationalExpress"`, `"suburban"`, `"bus"`, etc.), so `.type` and `.name` were always `undefined`, the substring being tested was always empty, and every single journey leg rendered the same fallback icon regardless of mode. It never threw, never showed up in a log — it just quietly looked wrong for every train, tram, and bus in the app. The fix replaced the substring guessing with an exact lookup keyed on the actual product id.

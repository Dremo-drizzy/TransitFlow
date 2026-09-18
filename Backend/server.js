import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pathToFileURL } from "node:url";

import { UPSTREAM_ROUTES } from "./routes.js";
import { TtlCache } from "./cache.js";

const app = express();

const PORT = process.env.PORT || 5000;
const BASE_API = process.env.BASE_API || "https://v6.db.transport.rest";
const USER_AGENT =
  process.env.USER_AGENT || "TransitFlow/2.0 (+https://github.com/Dremo-drizzy/German-Api-project)";
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 12_000);

/* ------------------------------------------------------------------ *
 * CORS — an allowlist, not a wide-open door.
 * ALLOWED_ORIGINS is a comma-separated list; unset means "local dev".
 * ------------------------------------------------------------------ */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin / curl / server-to-server requests send no Origin header.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed`));
    },
  })
);

app.set("trust proxy", 1); // Render sits behind a proxy; needed for per-IP limiting.

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Slow down." },
  })
);

const cache = new TtlCache({ maxEntries: 500 });

/* ------------------------------------------------------------------ *
 * The proxy itself.
 *
 * Every upstream call goes through an explicit route definition in
 * routes.js: a fixed upstream path, an allowlist of query parameters and
 * a cache TTL. Anything not described there is a 404 — this server will
 * not forward arbitrary paths to the DB API on a stranger's behalf.
 * ------------------------------------------------------------------ */
for (const route of UPSTREAM_ROUTES) {
  app.get(route.path, async (req, res) => {
    let upstreamUrl;
    try {
      upstreamUrl = buildUpstreamUrl(route, req);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const cached = cache.get(upstreamUrl);
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.status(cached.status).json(cached.body);
    }

    try {
      const upstream = await fetch(upstreamUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      const text = await upstream.text();
      let body;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        // The upstream occasionally answers with an HTML error page.
        return res.status(502).json({
          error: "Upstream returned a non-JSON response",
          status: upstream.status,
        });
      }

      // Only cache successful responses — never cache an error.
      if (upstream.ok && route.ttlMs > 0) {
        cache.set(upstreamUrl, { status: upstream.status, body }, route.ttlMs);
      }

      res.set("X-Cache", "MISS");
      return res.status(upstream.status).json(body);
    } catch (err) {
      const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
      console.error(`[proxy] ${route.path} failed:`, err.message);
      return res.status(timedOut ? 504 : 502).json({
        error: timedOut ? "Upstream request timed out" : "Upstream request failed",
      });
    }
  });
}

function buildUpstreamUrl(route, req) {
  const path = route.upstream(req.params);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(route.defaults || {})) {
    params.set(key, String(value));
  }

  for (const key of route.query) {
    const value = req.query[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      throw new Error(`Query parameter "${key}" may only be given once`);
    }
    if (String(value).length > 200) {
      throw new Error(`Query parameter "${key}" is too long`);
    }
    params.set(key, String(value));
  }

  const qs = params.toString();
  return `${BASE_API}${path}${qs ? `?${qs}` : ""}`;
}

/* ------------------------------------------------------------------ *
 * Health check. Render's free tier spins the service down after ~15
 * minutes idle, and the first request back takes the better part of a
 * minute. The frontend pings this on load so it can say "waking the
 * server up" instead of showing a spinner that looks broken.
 * ------------------------------------------------------------------ */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    cache: cache.stats(),
  });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
app.use((err, _req, res, _next) => {
  if (err?.message?.includes("is not allowed")) {
    return res.status(403).json({ error: err.message });
  }
  console.error("[server]", err);
  return res.status(500).json({ error: "Internal server error" });
});

// Only listen when this file is run directly (`node server.js` / `npm start`),
// not when it's imported — server.test.js imports `app` and drives it with
// supertest, which starts its own ephemeral listener per request.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`TransitFlow proxy listening on :${PORT}`);
    console.log(`  upstream : ${BASE_API}`);
    console.log(`  origins  : ${ALLOWED_ORIGINS.join(", ")}`);
  });
}

export default app;

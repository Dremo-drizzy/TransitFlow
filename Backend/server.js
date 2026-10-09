import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pathToFileURL } from "node:url";

import { ROUTES } from "./routes.js";
import { TtlCache } from "./cache.js";

const app = express();

const PORT = process.env.PORT || 5000;

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
 * Every call goes through an explicit route definition in routes.js: a
 * fixed path, an allowlist of query parameters, validation, and a cache
 * TTL. Anything not described there is a 404. The data comes from
 * source.js (Transitous, via motis-fptf-client, run in-process) and is
 * normalised before it is cached, so the cache only ever stores clean,
 * downsampled responses.
 * ------------------------------------------------------------------ */
for (const route of ROUTES) {
  app.get(route.path, async (req, res) => {
    let params;
    try {
      params = readParams(route, req);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Identical requests collapse into one: keyed on the route, the path
    // parameters, and the allowlisted query parameters in a stable order.
    const cacheKey = JSON.stringify([
      route.path,
      req.params,
      Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
    ]);

    const cached = cache.get(cacheKey);
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.status(cached.status).json(cached.body);
    }

    try {
      const body = await route.run({ params, pathParams: req.params });

      // Only successful responses reach this line — an error throws.
      if (route.ttlMs > 0) {
        cache.set(cacheKey, { status: 200, body }, route.ttlMs);
      }

      res.set("X-Cache", "MISS");
      return res.json(body);
    } catch (err) {
      // BadRequest (400) and SourceError (404/502/504) carry their own status.
      const status = Number.isInteger(err?.status) ? err.status : 502;
      if (status >= 500) console.error(`[proxy] ${route.path} failed:`, err?.message ?? err);
      return res.status(status).json({
        error: status === 502 && !err?.status ? "Upstream request failed" : err.message,
        ...(err?.code ? { code: err.code } : {}),
      });
    }
  });
}

// Reads only the allowlisted query parameters, applies the route's defaults,
// and rejects repeated or oversized values. Anything else the caller sent is
// ignored — it never reaches route.run().
function readParams(route, req) {
  const params = {};

  for (const [key, value] of Object.entries(route.defaults || {})) {
    params[key] = String(value);
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
    params[key] = String(value);
  }

  for (const [key, value] of Object.entries(req.params)) {
    if (String(value).length > 200) throw new Error(`Path parameter "${key}" is too long`);
  }

  return params;
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
    console.log("  upstream : Transitous (motis-fptf-client, in-process)");
    console.log(`  origins  : ${ALLOWED_ORIGINS.join(", ")}`);
  });
}

export default app;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// The data source is mocked: these tests are about the proxy — routing, the
// allowlist, validation, caching and error mapping — not about Transitous.
// (The adapter that normalises its responses is tested separately against
// real saved responses, in adapters/transitous.test.js.)
vi.mock('./source.js', () => ({
  source: {
    locations: vi.fn(),
    departures: vi.fn(),
    journeys: vi.fn(),
    trip: vi.fn(),
  },
}));

import app from './server.js';
import { source } from './source.js';

// Errors from source.js carry their own HTTP status.
const sourceError = (status, message, code) => Object.assign(new Error(message), { status, code });

describe('server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health returns 200 with cache stats, without touching the source', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.cache).toHaveProperty('hitRate');
    expect(source.locations).not.toHaveBeenCalled();
  });

  it('runs an allowlisted route through the source with validated params and defaults', async () => {
    source.locations.mockResolvedValueOnce([{ id: '1', name: 'Berlin Hbf', type: 'station' }]);

    const res = await request(app).get('/api/locations').query({ query: 'test-query-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1', name: 'Berlin Hbf', type: 'station' }]);
    expect(source.locations).toHaveBeenCalledTimes(1);
    // `results` wasn't sent, so the route's default applies.
    expect(source.locations).toHaveBeenCalledWith({ query: 'test-query-1', results: 10 });
  });

  it('returns 404 for a path with no matching allowlisted route', async () => {
    const res = await request(app).get('/api/definitely-not-a-real-route');
    expect(res.status).toBe(404);
  });

  it.each(['/api/locations/nearby', '/api/stops/abc', '/api/stops/abc/arrivals'])(
    'no longer serves %s — Transitous has no equivalent and the frontend does not use it',
    async (path) => {
      const res = await request(app).get(path).query({ latitude: '52.5', longitude: '13.4' });
      expect(res.status).toBe(404);
    }
  );

  it('drops a query parameter that is not on the allowlist instead of passing it on', async () => {
    source.departures.mockResolvedValueOnce({ departures: [] });

    await request(app)
      .get('/api/stops/some-stop/departures')
      .query({ evil: 'drop-me', bus: 'false' });

    expect(source.departures).toHaveBeenCalledTimes(1);
    const args = source.departures.mock.calls[0][0];
    // Nothing the caller invented reaches the source, anywhere in its arguments...
    expect(JSON.stringify(args)).not.toContain('evil');
    expect(JSON.stringify(args)).not.toContain('drop-me');
    // ...while the real, allowlisted filter flag does.
    expect(args.query).toEqual({ duration: '60', bus: 'false' });
  });

  it('drops non-allowlisted parameters on every route, not just departures', async () => {
    source.locations.mockResolvedValueOnce([]);
    source.journeys.mockResolvedValueOnce({ journeys: [] });
    source.trip.mockResolvedValueOnce({ trip: {} });

    await request(app).get('/api/locations').query({ query: 'test-query-allowlist', evil: 'drop-me' });
    await request(app).get('/api/journeys').query({ from: 'a', to: 'b', evil: 'drop-me', results: '2' });
    await request(app).get('/api/trips/some-trip').query({ evil: 'drop-me' });

    for (const fn of [source.locations, source.journeys, source.trip]) {
      expect(JSON.stringify(fn.mock.calls)).not.toContain('drop-me');
    }
  });

  it('serves a second identical request from cache, without a second source call', async () => {
    source.locations.mockResolvedValueOnce([{ id: '1', name: 'Cached Result', type: 'station' }]);

    const first = await request(app).get('/api/locations').query({ query: 'test-query-3' });
    const second = await request(app).get('/api/locations').query({ query: 'test-query-3' });

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
    expect(source.locations).toHaveBeenCalledTimes(1);
  });

  it('does not share a cache entry between different path parameters', async () => {
    source.trip.mockResolvedValue({ trip: { id: 'x' } });

    await request(app).get('/api/trips/trip-aaa');
    await request(app).get('/api/trips/trip-bbb');

    expect(source.trip).toHaveBeenCalledTimes(2);
    expect(source.trip.mock.calls.map(([a]) => a.id)).toEqual(['trip-aaa', 'trip-bbb']);
  });

  describe('validation', () => {
    it('rejects a too-short location query with 400, without calling the source', async () => {
      const res = await request(app).get('/api/locations').query({ query: 'a' });
      expect(res.status).toBe(400);
      expect(source.locations).not.toHaveBeenCalled();
    });

    it('rejects a journey with no destination', async () => {
      const res = await request(app).get('/api/journeys').query({ from: 'a' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/"to" is required/);
      expect(source.journeys).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric duration and an invalid date', async () => {
      const a = await request(app).get('/api/stops/s/departures').query({ duration: 'lots' });
      const b = await request(app).get('/api/stops/s/departures').query({ when: 'not-a-date' });
      expect(a.status).toBe(400);
      expect(b.status).toBe(400);
      expect(source.departures).not.toHaveBeenCalled();
    });

    it('rejects a repeated query parameter and an oversized value', async () => {
      const repeated = await request(app).get('/api/locations?query=aa&query=bb');
      const long = await request(app).get('/api/locations').query({ query: 'x'.repeat(201) });
      expect(repeated.status).toBe(400);
      expect(long.status).toBe(400);
    });

    it('rejects an oversized path parameter', async () => {
      const res = await request(app).get(`/api/trips/${'x'.repeat(201)}`);
      expect(res.status).toBe(400);
      expect(source.trip).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    it('passes a source error through with its status and code, and does not cache it', async () => {
      source.trip.mockRejectedValueOnce(sourceError(404, 'Unknown station or trip', 'UNKNOWN_ID'));
      source.trip.mockResolvedValueOnce({ trip: { id: 'now-fine' } });

      const bad = await request(app).get('/api/trips/trip-err-1');
      expect(bad.status).toBe(404);
      expect(bad.body).toEqual({ error: 'Unknown station or trip', code: 'UNKNOWN_ID' });

      // Same request again goes back to the source — the failure was not cached.
      const retry = await request(app).get('/api/trips/trip-err-1');
      expect(retry.status).toBe(200);
      expect(source.trip).toHaveBeenCalledTimes(2);
    });

    it('answers an unexpected failure with a generic 502, not the internal message', async () => {
      source.locations.mockRejectedValueOnce(new Error('connect ECONNRESET 10.0.0.1:443'));
      const res = await request(app).get('/api/locations').query({ query: 'test-query-502' });
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Upstream request failed');
    });

    it('passes a timeout through as 504', async () => {
      source.locations.mockRejectedValueOnce(sourceError(504, 'Upstream request timed out'));
      const res = await request(app).get('/api/locations').query({ query: 'test-query-504' });
      expect(res.status).toBe(504);
    });
  });
});

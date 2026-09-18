import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from './server.js';

function upstreamResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('server', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health returns 200 with cache stats, without touching the upstream', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.cache).toHaveProperty('hitRate');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('builds the right upstream URL for an allowlisted route with valid params', async () => {
    globalThis.fetch.mockResolvedValueOnce(upstreamResponse([{ id: '1', name: 'Berlin Hbf' }]));

    const res = await request(app).get('/api/locations').query({ query: 'test-query-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1', name: 'Berlin Hbf' }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl] = globalThis.fetch.mock.calls[0];
    const url = new URL(calledUrl);
    expect(url.origin + url.pathname).toBe('https://v6.db.transport.rest/locations');
    expect(url.searchParams.get('query')).toBe('test-query-1');
    // Route defaults should still be present even though the caller didn't send them.
    expect(url.searchParams.get('fuzzy')).toBe('true');
    expect(url.searchParams.get('results')).toBe('10');
  });

  it('returns 404 for a path with no matching allowlisted route', async () => {
    const res = await request(app).get('/api/definitely-not-a-real-route');

    expect(res.status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('drops a query parameter not on the allowlist instead of forwarding it', async () => {
    globalThis.fetch.mockResolvedValueOnce(upstreamResponse([]));

    await request(app).get('/api/locations').query({ query: 'test-query-2', evil: 'drop-me' });

    const [calledUrl] = globalThis.fetch.mock.calls[0];
    expect(calledUrl).not.toContain('evil');
    expect(calledUrl).not.toContain('drop-me');
  });

  it('serves a second identical request from cache, without a second upstream call', async () => {
    globalThis.fetch.mockResolvedValueOnce(upstreamResponse([{ id: '1', name: 'Cached Result' }]));

    const first = await request(app).get('/api/locations').query({ query: 'test-query-3' });
    const second = await request(app).get('/api/locations').query({ query: 'test-query-3' });

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

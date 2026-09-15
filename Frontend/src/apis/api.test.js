import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchLocations } from './api';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('fetchFromApi (exercised via searchLocations)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on a successful response, with a single fetch call', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse([{ id: '1', name: 'Berlin Hbf' }]));

    const result = await searchLocations('berlin');

    expect(result).toEqual([{ id: '1', name: 'Berlin Hbf' }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('passes an AbortSignal on every request', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse([]));

    await searchLocations('berlin');

    const [, options] = globalThis.fetch.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries on 429 and succeeds once the upstream recovers, using all 3 attempts', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(null, 429))
      .mockResolvedValueOnce(jsonResponse(null, 429))
      .mockResolvedValueOnce(jsonResponse([{ id: '1', name: 'Berlin Hbf' }]));

    const promise = searchLocations('berlin');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual([{ id: '1', name: 'Berlin Hbf' }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('throws a real error instead of returning undefined when every attempt is rate-limited', async () => {
    globalThis.fetch.mockResolvedValue(jsonResponse(null, 429));

    const promise = searchLocations('berlin');
    // Attach the rejection expectation before advancing fake timers, so the
    // rejection is never briefly "unhandled" mid-retry.
    const assertion = expect(promise).rejects.toThrow(/429/);
    await vi.runAllTimersAsync();
    await assertion;

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('fails immediately on a non-429 4xx without retrying', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(null, 404));

    await expect(searchLocations('berlin')).rejects.toThrow(/404/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on a 5xx and eventually rethrows if it never recovers', async () => {
    globalThis.fetch.mockResolvedValue(jsonResponse(null, 503));

    const promise = searchLocations('berlin');
    const assertion = expect(promise).rejects.toThrow(/503/);
    await vi.runAllTimersAsync();
    await assertion;

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('retries on a network error and eventually rethrows the original error', async () => {
    globalThis.fetch.mockRejectedValue(new Error('network down'));

    const promise = searchLocations('berlin');
    const assertion = expect(promise).rejects.toThrow('network down');
    await vi.runAllTimersAsync();
    await assertion;

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});

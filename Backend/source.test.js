import { describe, it, expect, vi } from 'vitest';
import { toSourceError, SourceError } from './source.js';

describe('toSourceError', () => {
  it('answers 502, not 400, when Transitous cannot be reached', () => {
    // What Node's fetch throws on a DNS failure or refused connection.
    const offline = new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }) });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = toSourceError(offline);
    expect(err).toBeInstanceOf(SourceError);
    expect(err.status).toBe(502);
    // An outage must reach the server log; it used to be swallowed as a 400.
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('still answers 400 for the client library\'s argument checks', () => {
    const err = toSourceError(new TypeError('id must be a non-empty string.'));
    expect(err.status).toBe(400);
  });

  it('answers 404 for an unknown station or trip', () => {
    const err = toSourceError({ error: 'unknown stop' });
    expect(err.status).toBe(404);
    expect(err.code).toBe('UNKNOWN_ID');
  });
});

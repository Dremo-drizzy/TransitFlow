import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  formatTime,
  formatDuration,
  getDelayMinutes,
  formatDelay,
  getDelayBadgeVariant,
  getProductIcon,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from './transportUtils';

describe('formatTime', () => {
  it('returns "--:--" for null', () => {
    expect(formatTime(null)).toBe('--:--');
  });

  it('returns "--:--" for undefined', () => {
    expect(formatTime(undefined)).toBe('--:--');
  });

  it('returns "--:--" for a malformed date string', () => {
    expect(formatTime('not-a-date')).toBe('--:--');
  });

  it('formats a valid ISO string to HH:mm in local time', () => {
    const d = new Date(2024, 0, 15, 14, 32);
    const expected =
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    expect(formatTime(d.toISOString())).toBe(expected);
  });
});

describe('formatDuration', () => {
  it('returns "" for 0 seconds', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('returns "" for null', () => {
    expect(formatDuration(null)).toBe('');
  });

  it('returns "" for undefined', () => {
    expect(formatDuration(undefined)).toBe('');
  });

  it('formats sub-hour durations as minutes only', () => {
    expect(formatDuration(300)).toBe('5m');
  });

  it('formats hour-plus durations as "Xh Ym"', () => {
    expect(formatDuration(4980)).toBe('1h 23m');
  });

  it('returns "" for a malformed (non-numeric) input', () => {
    expect(formatDuration('not-a-number')).toBe('');
  });
});

describe('getDelayMinutes', () => {
  it('returns 0 when scheduled is null', () => {
    expect(getDelayMinutes(null, '2024-01-15T14:32:00.000Z')).toBe(0);
  });

  it('returns 0 when actual is null', () => {
    expect(getDelayMinutes('2024-01-15T14:32:00.000Z', null)).toBe(0);
  });

  it('returns 0 when both are null', () => {
    expect(getDelayMinutes(null, null)).toBe(0);
  });

  it('returns the positive difference in minutes when actual is later', () => {
    expect(
      getDelayMinutes('2024-01-15T14:00:00.000Z', '2024-01-15T14:07:00.000Z')
    ).toBe(7);
  });

  it('returns a negative difference when actual is earlier (early departure)', () => {
    expect(
      getDelayMinutes('2024-01-15T14:07:00.000Z', '2024-01-15T14:00:00.000Z')
    ).toBe(-7);
  });

  it('returns 0 for a malformed scheduled/actual string', () => {
    expect(getDelayMinutes('not-a-date', 'also-not-a-date')).toBe(0);
  });
});

describe('formatDelay', () => {
  it('returns "On time" for 0 minutes', () => {
    expect(formatDelay(0)).toBe('On time');
  });

  it('returns "On time" for a negative (early) delay', () => {
    expect(formatDelay(-3)).toBe('On time');
  });

  it('returns "+N min" for a positive delay', () => {
    expect(formatDelay(7)).toBe('+7 min');
  });

  it('returns "On time" for null/undefined delay', () => {
    expect(formatDelay(undefined)).toBe('On time');
  });
});

describe('getDelayBadgeVariant', () => {
  it('returns "success" for 0 minutes', () => {
    expect(getDelayBadgeVariant(0)).toBe('success');
  });

  it('returns "success" for a negative (early) delay', () => {
    expect(getDelayBadgeVariant(-3)).toBe('success');
  });

  it('returns "warning" for a delay under 5 minutes', () => {
    expect(getDelayBadgeVariant(3)).toBe('warning');
  });

  it('returns "danger" for a delay of 5 minutes or more', () => {
    expect(getDelayBadgeVariant(10)).toBe('danger');
  });

  it('returns a neutral variant for undefined delay', () => {
    expect(getDelayBadgeVariant(undefined)).toBe('secondary');
  });
});

describe('getProductIcon', () => {
  const cases = [
    ['nationalExpress', '🚄'],
    ['national', '🚆'],
    ['regionalExpress', '🚆'],
    ['regional', '🚆'],
    ['suburban', '🚈'],
    ['subway', '🚇'],
    ['tram', '🚊'],
    ['bus', '🚌'],
    ['ferry', '⛴️'],
    ['taxi', '🚕'],
  ];

  it.each(cases)('returns the right icon for product id "%s"', (id, icon) => {
    expect(getProductIcon(id)).toBe(icon);
  });

  it('accepts an object with a .type instead of a bare string', () => {
    expect(getProductIcon({ type: 'bus' })).toBe('🚌');
  });

  it('falls back to a neutral icon for an unrecognised product id', () => {
    expect(getProductIcon('hyperloop')).not.toBe(undefined);
    expect(getProductIcon('hyperloop')).toBe('🚏');
  });

  it('falls back to a neutral icon for null/undefined', () => {
    expect(getProductIcon(null)).toBe('🚏');
    expect(getProductIcon(undefined)).toBe('🚏');
  });

  it('does not let a bus match the old broken "s" substring check for S-Bahn', () => {
    // Regression guard for the old implementation, where t.includes('s') for
    // S-Bahn was checked before the bus branch, so "bus" (which contains no
    // "s"... but the old `t` was built from product.type/.name, always '' for
    // a string product) matched the wrong branch. Confirm bus and suburban
    // never collide now that lookup is exact.
    expect(getProductIcon('bus')).not.toBe(getProductIcon('suburban'));
  });
});

describe('toDatetimeLocalValue / fromDatetimeLocalValue', () => {
  const originalTZ = process.env.TZ;

  beforeAll(() => {
    // Pin a non-UTC zone so a naive implementation that treats ISO strings
    // as already-local (e.g. departure.slice(0, 16)) would fail this test.
    // New York is UTC-5 in January (EST, before DST starts in March).
    process.env.TZ = 'America/New_York';
  });

  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('converts a UTC ISO string to local wall-clock time for the input value', () => {
    expect(toDatetimeLocalValue('2024-01-15T14:32:00.000Z')).toBe('2024-01-15T09:32');
  });

  it('returns "" for a malformed ISO string', () => {
    expect(toDatetimeLocalValue('not-a-date')).toBe('');
  });

  it('returns "" for null/undefined', () => {
    expect(toDatetimeLocalValue(null)).toBe('');
    expect(toDatetimeLocalValue(undefined)).toBe('');
  });

  it('converts a local wall-clock input value back to the correct UTC instant', () => {
    expect(fromDatetimeLocalValue('2024-01-15T09:32')).toBe('2024-01-15T14:32:00.000Z');
  });

  it('round-trips through both conversions', () => {
    const original = '2024-06-01T18:00:00.000Z';
    const roundTripped = fromDatetimeLocalValue(toDatetimeLocalValue(original));
    expect(roundTripped).toBe(original);
  });

  it('returns null for a malformed local value', () => {
    expect(fromDatetimeLocalValue('not-a-date')).toBeNull();
  });

  it('returns null for an empty local value', () => {
    expect(fromDatetimeLocalValue('')).toBeNull();
  });
});

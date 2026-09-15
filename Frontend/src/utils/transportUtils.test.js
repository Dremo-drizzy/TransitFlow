import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatDuration,
  getDelayMinutes,
  formatDelay,
  getDelayBadgeVariant,
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

  // TODO(Stage 1): formatDuration(seconds) does `!seconds` then floors seconds/3600
  // with no numeric validation, so a non-numeric input produces "NaNh NaNm" instead
  // of a safe fallback. Fix in Stage 1, not here.
  it.fails('returns "" for a malformed (non-numeric) input', () => {
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

  // TODO(Stage 1): parseISO on a malformed string produces an Invalid Date, and
  // differenceInMinutes silently returns NaN instead of throwing — the try/catch
  // in getDelayMinutes never fires, so malformed input returns NaN instead of the
  // documented 0 fallback. Fix in Stage 1, not here.
  it.fails('returns 0 for a malformed scheduled/actual string', () => {
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

  // TODO(Stage 1): formatDelay does `delayMinutes <= 0` with no null/NaN guard, so
  // undefined/NaN fall through to the string-interpolation branch and produce
  // "+undefined min" / "+NaN min" instead of a safe fallback like "On time". Fix in
  // Stage 1, not here.
  it.fails('returns "On time" for null/undefined delay', () => {
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

  // TODO(Stage 1): getDelayBadgeVariant has no null/NaN guard, so undefined delay
  // minutes fall through both comparisons (undefined <= 0 and undefined < 5 are
  // both false) and produce "danger" — the worst-looking badge — for missing data,
  // instead of a neutral fallback. Fix in Stage 1, not here.
  it.fails('returns a neutral variant for undefined delay', () => {
    expect(getDelayBadgeVariant(undefined)).not.toBe('danger');
  });
});

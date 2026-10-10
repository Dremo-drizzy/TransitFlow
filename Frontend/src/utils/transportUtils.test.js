import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatTime,
  formatDuration,
  getDelayMinutes,
  formatDelay,
  getDelayBadgeVariant,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  getDepartureStatus,
  shortPlatform,
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

});

// Every displayed time is German wall-clock time, whatever zone the machine
// (or the viewer) is in. These tests deliberately run with the process zone
// pinned somewhere that is NOT Berlin: on a machine that happens to be in
// Germany a naive local-time implementation would pass, and fail everywhere
// else. Expected values are written out by hand, never derived from `Date`
// getters, which would just echo the runtime zone back.
describe('German time display', () => {
  const originalTZ = process.env.TZ;
  const NON_BERLIN_ZONES = [
    'America/Halifax', // the reviewer's zone: UTC-4 winter, UTC-3 summer
    'UTC',
    'Asia/Tokyo', // UTC+9, no DST
    'America/Los_Angeles',
    'Pacific/Kiritimati', // UTC+14: the local calendar day differs from Berlin's
  ];

  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it('the zone pin really changes what the runtime thinks the local time is', () => {
    // Guard against the suite passing vacuously because TZ was ignored:
    // 12:00 UTC is 08:00 in Halifax in January, and 12:00 in UTC.
    process.env.TZ = 'America/Halifax';
    expect(new Date('2024-01-15T12:00:00.000Z').getHours()).toBe(8);
    process.env.TZ = 'UTC';
    expect(new Date('2024-01-15T12:00:00.000Z').getHours()).toBe(12);
  });

  describe.each(NON_BERLIN_ZONES)('with the machine in %s', (zone) => {
    beforeEach(() => {
      process.env.TZ = zone;
    });

    it('shows winter time as CET (UTC+1)', () => {
      expect(formatTime('2024-01-15T16:53:00.000Z')).toBe('17:53');
    });

    it('shows summer time as CEST (UTC+2)', () => {
      expect(formatTime('2024-07-15T15:53:00.000Z')).toBe('17:53');
    });

    it('honours an offset already carried in the ISO string', () => {
      // The same instant as 16:53Z, written the way the API writes it.
      expect(formatTime('2024-01-15T17:53:00+01:00')).toBe('17:53');
      expect(formatTime('2024-07-15T17:53:00+02:00')).toBe('17:53');
    });

    it('formats a Date (the page clock) in German time too', () => {
      expect(formatTime(new Date('2024-01-15T16:53:00.000Z'))).toBe('17:53');
    });

    it('switches offset at the end-of-March DST change (2024-03-31 01:00Z)', () => {
      expect(formatTime('2024-03-31T00:59:00.000Z')).toBe('01:59'); // CET
      expect(formatTime('2024-03-31T01:00:00.000Z')).toBe('03:00'); // CEST
    });

    it('switches offset at the end-of-October DST change (2024-10-27 01:00Z)', () => {
      expect(formatTime('2024-10-27T00:59:00.000Z')).toBe('02:59'); // CEST
      expect(formatTime('2024-10-27T01:00:00.000Z')).toBe('02:00'); // CET
    });

    it('a late-evening departure keeps its German clock time, not the viewer\'s', () => {
      expect(formatTime('2024-01-15T22:58:00.000Z')).toBe('23:58');
      expect(formatTime('2024-01-15T23:30:00.000Z')).toBe('00:30');
    });

    it('turns an ISO instant into the German wall-clock value for the picker', () => {
      expect(toDatetimeLocalValue('2024-01-15T14:32:00.000Z')).toBe('2024-01-15T15:32');
      expect(toDatetimeLocalValue('2024-07-15T14:32:00.000Z')).toBe('2024-07-15T16:32');
    });

    it('rolls the picker date over at German midnight, not the viewer\'s', () => {
      expect(toDatetimeLocalValue('2024-01-15T23:30:00.000Z')).toBe('2024-01-16T00:30');
    });

    it('reads a picker value as German wall-clock time', () => {
      expect(fromDatetimeLocalValue('2024-01-15T15:32')).toBe('2024-01-15T14:32:00.000Z');
      expect(fromDatetimeLocalValue('2024-07-15T16:32')).toBe('2024-07-15T14:32:00.000Z');
    });

    it('round-trips through both picker conversions', () => {
      for (const original of ['2024-06-01T18:00:00.000Z', '2024-01-15T14:32:00.000Z']) {
        expect(fromDatetimeLocalValue(toDatetimeLocalValue(original))).toBe(original);
      }
    });
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

  it('returns "warning" for a 1-5 minute delay', () => {
    expect(getDelayBadgeVariant(3)).toBe('warning');
  });

  it('returns "warning" at exactly 5 minutes (the boundary is inclusive)', () => {
    expect(getDelayBadgeVariant(5)).toBe('warning');
  });

  it('returns "danger" for a delay over 5 minutes', () => {
    expect(getDelayBadgeVariant(6)).toBe('danger');
    expect(getDelayBadgeVariant(10)).toBe('danger');
  });

  it('returns a neutral variant for undefined delay', () => {
    expect(getDelayBadgeVariant(undefined)).toBe('secondary');
  });
});

// The valid conversions are covered per-zone under "German time display";
// this block is the bad-input handling.
describe('toDatetimeLocalValue / fromDatetimeLocalValue — invalid input', () => {
  it('returns "" for a malformed ISO string', () => {
    expect(toDatetimeLocalValue('not-a-date')).toBe('');
  });

  it('returns "" for null/undefined', () => {
    expect(toDatetimeLocalValue(null)).toBe('');
    expect(toDatetimeLocalValue(undefined)).toBe('');
  });

  it('returns null for a malformed local value', () => {
    expect(fromDatetimeLocalValue('not-a-date')).toBeNull();
  });

  it('returns null for an impossible calendar date instead of rolling it over', () => {
    expect(fromDatetimeLocalValue('2024-02-31T10:00')).toBeNull();
    expect(fromDatetimeLocalValue('2024-13-01T10:00')).toBeNull();
  });

  it('returns null for an empty local value', () => {
    expect(fromDatetimeLocalValue('')).toBeNull();
  });
});

describe('getDepartureStatus', () => {
  it('returns CANCELLED/red when cancelled, ignoring the planned/actual times', () => {
    // A cancelled departure has when: null, which getDelayMinutes reads as
    // "no data, delay 0" — cancelled must be checked first or this would
    // render as ON TIME.
    const status = getDepartureStatus('2024-01-15T14:00:00.000Z', null, true);
    expect(status).toEqual({ text: 'CANCELLED', tone: 'red', cancelled: true });
  });

  it('returns ON TIME/green when not delayed', () => {
    const status = getDepartureStatus('2024-01-15T14:00:00.000Z', '2024-01-15T14:00:00.000Z', false);
    expect(status).toEqual({ text: 'ON TIME', tone: 'green', cancelled: false });
  });

  it('returns +N MIN/amber for a 1-5 minute delay', () => {
    const status = getDepartureStatus('2024-01-15T14:00:00.000Z', '2024-01-15T14:03:00.000Z', false);
    expect(status).toEqual({ text: '+3 MIN', tone: 'amber', cancelled: false });
  });

  it('returns +N MIN/red for a delay over 5 minutes', () => {
    const status = getDepartureStatus('2024-01-15T14:00:00.000Z', '2024-01-15T14:09:00.000Z', false);
    expect(status).toEqual({ text: '+9 MIN', tone: 'red', cancelled: false });
  });

  it('returns SCHEDULED/muted when there is no realtime prediction and it is not cancelled', () => {
    // actualTime: null with cancelled: false is a real, distinct case from
    // both CANCELLED and ON TIME — getDelayMinutes would otherwise read the
    // missing value as "0 minutes late" and render a false ON TIME.
    const status = getDepartureStatus('2024-01-15T14:00:00.000Z', null, false);
    expect(status).toEqual({ text: 'SCHEDULED', tone: 'muted', cancelled: false });
  });

  it('returns SCHEDULED/muted when actualTime is missing even without a plannedTime', () => {
    const status = getDepartureStatus(null, null, false);
    expect(status).toEqual({ text: 'SCHEDULED', tone: 'muted', cancelled: false });
  });
});

describe('shortPlatform', () => {
  it.each([
    ['3', '3'],
    ['11', '11'],
    ['5a', '5a'],
    ['Pos. 12', '12'],
    ['Pos. 5', '5'],
    ['2 (U5)', '2'],
    ['12a', '12'],
  ])('shows %j as %j', (input, expected) => {
    expect(shortPlatform(input)).toBe(expected);
  });

  it('returns an empty string when there is no number', () => {
    expect(shortPlatform(null)).toBe('');
    expect(shortPlatform(undefined)).toBe('');
    expect(shortPlatform('Gleis')).toBe('');
  });
});

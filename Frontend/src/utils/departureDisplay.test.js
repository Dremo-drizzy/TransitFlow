import { describe, it, expect } from 'vitest';
import { displayTime, departureKey, productFilterParams, formatTime, countChanges } from './transportUtils';
import { otherStopName } from './stations';

// Times are written in UTC; formatTime shows them in Europe/Berlin (CET in
// November, UTC+1), so 12:37Z reads 13:37.

describe('displayTime', () => {
  it('leads with the real time when a departure is late', () => {
    // The live case that motivated it: X35 at Hamburg Hbf, planned 13:37, left 15:11.
    const shown = displayTime('2026-11-02T12:37:00Z', '2026-11-02T14:11:00Z');
    expect(formatTime(shown.time)).toBe('15:11');
    expect(formatTime(shown.planned)).toBe('13:37');
    expect(shown.changed).toBe(true);
  });

  it('shows the planned time, unchanged, when there is no prediction', () => {
    const shown = displayTime('2026-11-02T12:37:00Z', null);
    expect(formatTime(shown.time)).toBe('13:37');
    expect(shown.changed).toBe(false);
  });

  it('is not "changed" when real and planned fall in the same minute', () => {
    const shown = displayTime('2026-11-02T12:37:00Z', '2026-11-02T12:37:40Z');
    expect(shown.changed).toBe(false);
  });

  it('keeps the planned time for a cancelled departure', () => {
    const shown = displayTime('2026-11-02T12:37:00Z', '2026-11-02T12:50:00Z', true);
    expect(formatTime(shown.time)).toBe('13:37');
    expect(shown.changed).toBe(false);
  });
});

describe('departureKey', () => {
  it('tells apart the same trip calling at two stops of one station', () => {
    // Bus 123 at Berlin Hbf: once at S+U Berlin Hauptbahnhof, once at
    // Lehrter Str./Invalidenstr., same tripId.
    const a = { tripId: 't-123', stop: { id: 'hbf' }, plannedWhen: '2026-11-02T14:15:00Z' };
    const b = { tripId: 't-123', stop: { id: 'lehrter' }, plannedWhen: '2026-11-02T14:17:00Z' };
    expect(departureKey(a)).not.toBe(departureKey(b));
  });

  it('does not throw on a departure with missing fields', () => {
    expect(() => departureKey({})).not.toThrow();
  });
});

describe('productFilterParams', () => {
  it('sends nothing when no chip is active', () => {
    expect(productFilterParams(new Set())).toEqual({});
  });

  it('keeps both regional products when the RE/RB chip is the only one active', () => {
    const params = productFilterParams(new Set(['regional']));
    expect(params.regional).toBeUndefined();
    expect(params.regionalExpress).toBeUndefined();
    expect(params.bus).toBe(false);
    expect(params.nationalExpress).toBe(false);
  });

  it('excludes both regional products when the RE/RB chip is not selected', () => {
    const params = productFilterParams(new Set(['bus']));
    expect(params.regional).toBe(false);
    expect(params.regionalExpress).toBe(false);
    expect(params.bus).toBeUndefined();
  });
});

describe('otherStopName', () => {
  it('is null for the station itself, however it is spelled', () => {
    expect(otherStopName({ stop: { name: 'S+U Berlin Hauptbahnhof' } }, 'Berlin Hbf')).toBeNull();
    expect(otherStopName({ stop: { name: 'München Hauptbahnhof' } }, 'München Hbf')).toBeNull();
  });

  it('names a nearby stop that is not the station', () => {
    expect(otherStopName({ stop: { name: 'Lehrter Str./Invalidenstr. (Berlin)' } }, 'Berlin Hbf'))
      .toBe('Lehrter Str./Invalidenstr. (Berlin)');
  });

  it('is null when there is no station name to compare against', () => {
    expect(otherStopName({ stop: { name: 'Hauptbahnhof Nord' } }, undefined)).toBeNull();
  });
});

describe('countChanges', () => {
  const ride = { line: { name: 'ICE' } };
  const walk = { walking: true };

  it('does not count walks as changes', () => {
    // Frankfurt -> Dresden as Transitous returned it: ICE, walk within the station, ICE.
    expect(countChanges([ride, walk, ride])).toBe(1);
    // Hamburg -> München: walk to the platform, ICE, walk, ICE.
    expect(countChanges([walk, ride, walk, ride])).toBe(1);
  });

  it('is 0 for a direct journey, with or without walks', () => {
    expect(countChanges([ride])).toBe(0);
    expect(countChanges([walk, ride, walk])).toBe(0);
  });

  it('is 0 for no legs', () => {
    expect(countChanges([])).toBe(0);
    expect(countChanges(undefined)).toBe(0);
  });
});

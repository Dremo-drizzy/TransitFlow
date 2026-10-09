import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDepartureStatus } from './transportUtils';
// The backend adapter is what turns Transitous's encoding of "no prediction"
// into the one this app's status logic understands. This test runs the REAL
// saved Transitous response through both, end to end.
import { normalizeDepartures, normalizeTrip } from '../../../Backend/adapters/transitous.js';
import { vehiclePosition, toLatLng } from './geo';

// Tests run from Frontend/ (npm run test), so the shared fixture is one level up.
const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), '..', 'Backend', 'fixtures', 'transitous-departures.json'), 'utf8')
);

const status = (d) => getDepartureStatus(d.plannedWhen, d.when, d.cancelled);

describe('real Transitous departures, through the adapter and getDepartureStatus', () => {
  const raw = fixture.departures;
  const normalised = normalizeDepartures(fixture).departures;

  it('the problem is real: unadapted, all 128 unpredicted departures read as ON TIME', () => {
    const noPrediction = raw.filter((d) => d.delay == null);
    expect(noPrediction).toHaveLength(128);
    // Transitous fills `when` with the planned time, so this is what the old
    // status logic saw: a confident on-time departure for every one of them.
    expect(noPrediction.every((d) => status(d).text === 'ON TIME')).toBe(true);
  });

  it('adapted, all 128 read SCHEDULED (muted) and none read ON TIME', () => {
    const rows = normalised.filter((_, i) => raw[i].delay == null);
    expect(rows).toHaveLength(128);
    expect(rows.every((d) => status(d).text === 'SCHEDULED' && status(d).tone === 'muted')).toBe(true);
    expect(rows.some((d) => status(d).text === 'ON TIME')).toBe(false);
  });

  it('adapted, a real prediction is untouched: 0 delay is ON TIME, a delay is +N MIN', () => {
    const predicted = normalised.filter((_, i) => raw[i].delay != null);
    expect(predicted).toHaveLength(76);
    expect(predicted.some((d) => status(d).text === 'SCHEDULED')).toBe(false);
    expect(predicted.filter((d) => status(d).text === 'ON TIME')).toHaveLength(69);
    expect(predicted.filter((d) => /^\+\d+ MIN$/.test(status(d).text))).toHaveLength(7);
  });
});

describe('real Transitous trip, through the adapter and vehiclePosition', () => {
  const rawTrip = JSON.parse(
    readFileSync(resolve(process.cwd(), '..', 'Backend', 'fixtures', 'transitous-trip.json'), 'utf8')
  );
  const trip = normalizeTrip(rawTrip).trip;
  const path = trip.polyline.features.map((f) => toLatLng(f.geometry.coordinates));
  // München Hbf -> 14 intermediate stops -> Hamburg-Altona. The first three
  // intermediate stops (Pasing, Augsburg, Donauwörth) are cancelled on this
  // trip, so the first stop it really calls at is Nürnberg Hbf.

  it('without the adapter the vehicle starts at the first stop it calls at, ~150 km from the real origin', () => {
    const before = vehiclePosition(rawTrip.trip.stopovers, path, '2026-10-09T12:00:00+02:00');
    expect(before.status).toBe('scheduled');
    // It parks at Nürnberg Hbf (lat 49.45), because München Hbf isn't in the list.
    expect(before.position.lat).toBeCloseTo(49.4454, 2);
  });

  it('with it, the vehicle waits at the real origin before departure', () => {
    const before = vehiclePosition(trip.stopovers, path, '2026-10-09T12:00:00+02:00');
    expect(before.status).toBe('scheduled');
    expect(before.position.lat).toBeCloseTo(trip.origin.location.latitude, 3);
    expect(before.position.lon).toBeCloseTo(trip.origin.location.longitude, 3);
  });

  it('and travels the first leg, München Hbf to Nürnberg Hbf, which was missing entirely before', () => {
    // Departs 13:12; the cancelled stops are skipped; Nürnberg is ~15:02.
    const during = vehiclePosition(trip.stopovers, path, '2026-10-09T14:00:00+02:00');
    expect(during.status).toBe('en_route');
    expect(during.fromStop).toBe('München Hbf');
    expect(during.toStop).toBe('Nürnberg Hbf');
  });

  it('and finishes at the real destination, after the last intermediate stop', () => {
    const after = vehiclePosition(trip.stopovers, path, '2026-10-09T23:00:00+02:00');
    expect(after.status).toBe('arrived');
    expect(after.position.lat).toBeCloseTo(trip.destination.location.latitude, 3);
  });
});

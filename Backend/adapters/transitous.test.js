import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  normalizeLocations,
  normalizeDepartures,
  normalizeJourneys,
  normalizeTrip,
  excludedProducts,
} from './transitous.js';
import { simplifyIndices, nearestIndex } from './polyline.js';

// Real responses captured from Transitous — see docs/data-sources.md.
const fixture = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8'));

const departures = fixture('transitous-departures.json');
const journeys = fixture('transitous-journeys.json');
const locations = fixture('transitous-locations.json');
const iceTrip = fixture('transitous-trip.json');
const busTrip = fixture('transitous-trip-bus-nolive.json');
const sbahnTrip = fixture('transitous-trip-sbahn-live.json');

describe('normalizeDepartures', () => {
  it('the fixture really is the case that matters: 128 of 204 have no prediction, none with a null `when`', () => {
    const noPrediction = departures.departures.filter((d) => d.delay == null);
    expect(departures.departures).toHaveLength(204);
    expect(noPrediction).toHaveLength(128);
    expect(noPrediction.every((d) => d.when === d.plannedWhen)).toBe(true);
    expect(departures.departures.some((d) => d.when == null)).toBe(false);
  });

  it('turns "no prediction" into a null live time for all 128, and touches nothing else', () => {
    const out = normalizeDepartures(departures).departures;
    const before = departures.departures;

    for (let i = 0; i < before.length; i++) {
      if (before[i].delay == null) {
        expect(out[i].when).toBeNull();
      } else {
        // A delay of 0 is a real prediction: "on time" must stay on time.
        expect(out[i].when).toBe(before[i].when);
      }
      expect(out[i].plannedWhen).toBe(before[i].plannedWhen);
    }
    expect(out.filter((d) => d.when === null)).toHaveLength(128);
  });

  it('filters out excluded products', () => {
    const out = normalizeDepartures(departures, { exclude: ['bus', 'tram'] }).departures;
    expect(out).toHaveLength(204 - 54 - 60);
    expect(out.some((d) => d.line.product === 'bus' || d.line.product === 'tram')).toBe(false);
  });

  it('derives the excluded products from the false-flagged query params only', () => {
    expect(excludedProducts({ bus: 'false', tram: 'false', suburban: 'true', ferry: undefined })).toEqual([
      'tram',
      'bus',
    ]);
    expect(excludedProducts({})).toEqual([]);
  });
});

describe('normalizeLocations', () => {
  it('keeps only stations — drops OSM points of interest and places abroad', () => {
    expect(locations.some((l) => l.type !== 'station')).toBe(true);
    const out = normalizeLocations(locations);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((l) => l.type === 'station')).toBe(true);
    expect(out[0].name).toBe('Berlin Hbf');
  });

  it('respects the limit and tolerates a non-array', () => {
    expect(normalizeLocations(locations, { limit: 0 })).toEqual([]);
    expect(normalizeLocations(null)).toEqual([]);
  });
});

describe('normalizeJourneys', () => {
  const out = normalizeJourneys(journeys).journeys;

  it('adds a duration in seconds, which this source does not send', () => {
    expect(journeys.journeys.every((j) => j.duration === undefined)).toBe(true);
    for (const journey of out) {
      const first = journey.legs[0];
      const last = journey.legs[journey.legs.length - 1];
      const expected = Math.round(
        (Date.parse(last.arrival ?? last.plannedArrival) - Date.parse(first.departure ?? first.plannedDeparture)) /
          1000
      );
      expect(journey.duration).toBeGreaterThan(0);
      expect(journey.duration).toBe(expected);
    }
    // Berlin 18:43 → Frankfurt 22:44, a direct ICE: a little over four hours.
    expect(out[0].duration).toBeGreaterThan(4 * 3600);
    expect(out[0].duration).toBeLessThan(4.2 * 3600);
  });

  it('leaves walking legs alone — their times are real, not unpredicted', () => {
    const walking = journeys.journeys.flatMap((j) => j.legs).filter((l) => l.walking);
    expect(walking.length).toBeGreaterThan(0);
    const outWalking = out.flatMap((j) => j.legs).filter((l) => l.walking);
    expect(outWalking).toEqual(walking);
    expect(outWalking.every((l) => l.departure && l.arrival)).toBe(true);
  });

  it('nulls the live time of a transit leg only when its delay is null', () => {
    const transit = out.flatMap((j) => j.legs).filter((l) => !l.walking);
    const original = journeys.journeys.flatMap((j) => j.legs).filter((l) => !l.walking);
    expect(transit.length).toBe(original.length);
    transit.forEach((leg, i) => {
      expect(leg.departure).toBe(original[i].departureDelay == null ? null : original[i].departure);
      expect(leg.plannedDeparture).toBe(original[i].plannedDeparture);
    });
  });
});

describe('normalizeTrip — no-prediction rule', () => {
  it('a bus trip with no real-time data comes out with null live times on every stopover', () => {
    const before = busTrip.trip.stopovers;
    expect(before.every((s) => s.departureDelay === null && s.arrivalDelay === null)).toBe(true);
    // ...and before normalising, the live time just repeats the planned one.
    expect(before[1].departure).toBe(before[1].plannedDeparture);

    const out = normalizeTrip(busTrip).trip;
    expect(out.stopovers).toHaveLength(before.length);
    expect(out.stopovers.every((s) => s.departure === null && s.arrival === null)).toBe(true);
    expect(out.stopovers.every((s, i) => s.plannedDeparture === before[i].plannedDeparture)).toBe(true);
    expect(out.departure).toBeNull();
    expect(out.arrival).toBeNull();
  });

  it('an S-Bahn trip with predictions keeps its live times, including a real delay of 0', () => {
    const before = sbahnTrip.trip.stopovers;
    const out = normalizeTrip(sbahnTrip).trip.stopovers;
    expect(before.some((s) => s.departureDelay === 0)).toBe(true);
    expect(before.some((s) => s.departureDelay === 60)).toBe(true);
    out.forEach((s, i) => {
      expect(s.departure).toBe(before[i].departure);
      expect(s.arrival).toBe(before[i].arrival);
    });
  });

  it('does not disturb cancelled stopovers on a trip that is not itself cancelled', () => {
    const cancelled = iceTrip.trip.stopovers.filter((s) => s.cancelled);
    expect(cancelled).toHaveLength(3);
    const out = normalizeTrip(iceTrip).trip;
    expect(out.cancelled).toBe(false);
    expect(out.stopovers.filter((s) => s.cancelled)).toHaveLength(3);
  });

  it('passes a body with no trip through untouched', () => {
    expect(normalizeTrip({ error: 'x' })).toEqual({ error: 'x' });
  });
});

describe('normalizeTrip — polyline downsampling', () => {
  const originalPoints = iceTrip.trip.polyline.features.map((f) => f.geometry.coordinates);
  const out = normalizeTrip(iceTrip);
  const simplified = out.trip.polyline.features.map((f) => f.geometry.coordinates);

  it('cuts the long-distance trip from ~12,000 points to a small fraction', () => {
    const rawBytes = Buffer.byteLength(JSON.stringify(iceTrip));
    const newBytes = Buffer.byteLength(JSON.stringify(out));
    console.log(
      `[polyline] points ${originalPoints.length} -> ${simplified.length} ` +
        `(${(100 - (simplified.length / originalPoints.length) * 100).toFixed(1)}% fewer) | ` +
        `response ${rawBytes} B -> ${newBytes} B (${(100 - (newBytes / rawBytes) * 100).toFixed(1)}% smaller)`
    );
    expect(originalPoints).toHaveLength(12110);
    expect(simplified.length).toBeLessThan(originalPoints.length * 0.1);
    expect(newBytes).toBeLessThan(rawBytes * 0.1);
  });

  it('keeps the first and last points, and the vertex nearest every stopover', () => {
    // Round exactly as the adapter does (Math.round, not toFixed — they
    // disagree on values sitting exactly half-way, like 13.365635).
    const r = (v) => (Math.round(v * 1e5) / 1e5).toFixed(5);
    const key = ([lon, lat]) => `${r(lon)},${r(lat)}`;
    const kept = new Set(simplified.map(key));
    expect(kept.has(key(originalPoints[0]))).toBe(true);
    expect(kept.has(key(originalPoints[originalPoints.length - 1]))).toBe(true);

    const stops = iceTrip.trip.stopovers.map((s) => [s.stop.location.longitude, s.stop.location.latitude]);
    for (const stop of stops) {
      const nearest = originalPoints[nearestIndex(originalPoints, stop)];
      expect(kept.has(key(nearest))).toBe(true);
    }
  });

  it('stays within the tolerance: no original point is further than ~30 m from the simplified line', () => {
    const cosLat = Math.cos((originalPoints[Math.floor(originalPoints.length / 2)][1] * Math.PI) / 180);
    const m = (p) => [p[0] * 111_320 * cosLat, p[1] * 111_320];
    const distToSegment = (p, a, b) => {
      const [px, py] = m(p), [ax, ay] = m(a), [bx, by] = m(b);
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };

    let worst = 0;
    for (const p of originalPoints) {
      let best = Infinity;
      for (let i = 0; i < simplified.length - 1; i++) {
        best = Math.min(best, distToSegment(p, simplified[i], simplified[i + 1]));
      }
      worst = Math.max(worst, best);
    }
    console.log(`[polyline] worst-case deviation of any original point: ${worst.toFixed(1)} m`);
    // 30 m tolerance, plus slack for coordinate rounding (~1 m).
    expect(worst).toBeLessThan(32);
  });

  it('keeps the GeoJSON shape the frontend reads: Point features with [lon, lat]', () => {
    expect(out.trip.polyline.type).toBe('FeatureCollection');
    expect(out.trip.polyline.features.every((f) => f.geometry.type === 'Point')).toBe(true);
    expect(simplified[0]).toHaveLength(2);
  });

  it('never drops an anchor index, however loose the tolerance', () => {
    const line = [[0, 0], [1, 0.0001], [2, 0], [3, 0.0001], [4, 0]];
    const kept = simplifyIndices(line, { toleranceM: 1_000_000, anchors: [2] });
    expect(kept).toEqual([0, 2, 4]);
  });

  it('leaves a tiny polyline alone', () => {
    expect(simplifyIndices([[0, 0], [1, 1]], { toleranceM: 30 })).toEqual([0, 1]);
  });
});

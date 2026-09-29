import { describe, it, expect } from 'vitest';
import { haversine, toLatLng, pointAlongPath, nearestPointIndex, vehiclePosition } from './geo';

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    expect(haversine({ lat: 52.5, lon: 13.4 }, { lat: 52.5, lon: 13.4 })).toBe(0);
  });

  it('returns roughly 111km for one degree of longitude at the equator', () => {
    const d = haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
});

describe('toLatLng', () => {
  it('flips GeoJSON [lon, lat] into {lat, lon}', () => {
    expect(toLatLng([13.3777, 52.5163])).toEqual({ lat: 52.5163, lon: 13.3777 });
  });
});

describe('pointAlongPath', () => {
  // Unequal segment lengths (roughly 1:3 at the equator) so fraction=0.5
  // lands inside the second segment, not at the midpoint vertex — this is
  // what catches a naive "average the vertices" implementation.
  const path = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 0, lon: 4 },
  ];

  it('returns the start point at fraction 0', () => {
    expect(pointAlongPath(path, 0)).toEqual(path[0]);
  });

  it('returns the end point at fraction 1', () => {
    const p = pointAlongPath(path, 1);
    expect(p.lat).toBeCloseTo(0, 5);
    expect(p.lon).toBeCloseTo(4, 5);
  });

  it('walks by cumulative distance, not by vertex count', () => {
    const p = pointAlongPath(path, 0.5);
    expect(p.lat).toBeCloseTo(0, 3);
    expect(p.lon).toBeCloseTo(2, 1);
  });

  it('clamps fractions outside [0, 1]', () => {
    expect(pointAlongPath(path, -0.5)).toEqual(path[0]);
    const p = pointAlongPath(path, 1.5);
    expect(p.lon).toBeCloseTo(4, 5);
  });

  it('returns the single point for a one-point path', () => {
    expect(pointAlongPath([{ lat: 1, lon: 2 }], 0.5)).toEqual({ lat: 1, lon: 2 });
  });
});

describe('nearestPointIndex', () => {
  const path = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 0, lon: 2 },
    { lat: 0, lon: 4 },
  ];

  it('finds the closest vertex to a point', () => {
    expect(nearestPointIndex(path, { lat: 0, lon: 1.2 })).toBe(1);
  });

  it('finds the last vertex when the point is past the end', () => {
    expect(nearestPointIndex(path, { lat: 0, lon: 10 })).toBe(3);
  });
});

describe('vehiclePosition', () => {
  // Berlin Hbf -> Wolfsburg Hbf -> Hannover Hbf, three stopovers shaped
  // like the real DB API response (stop.location, departure/arrival with
  // planned* fallbacks).
  const berlin = {
    stop: { id: '8011160', name: 'Berlin Hbf', location: { latitude: 52.5251, longitude: 13.3694 } },
    arrival: null,
    plannedArrival: null,
    departure: '2024-01-15T10:00:00.000Z',
    plannedDeparture: '2024-01-15T10:00:00.000Z',
  };
  const wolfsburg = {
    stop: { id: '8000237', name: 'Wolfsburg Hbf', location: { latitude: 52.4227, longitude: 10.7865 } },
    arrival: '2024-01-15T10:30:00.000Z',
    plannedArrival: '2024-01-15T10:30:00.000Z',
    departure: '2024-01-15T10:32:00.000Z',
    plannedDeparture: '2024-01-15T10:32:00.000Z',
  };
  const hannover = {
    stop: { id: '8000152', name: 'Hannover Hbf', location: { latitude: 52.3759, longitude: 9.7320 } },
    arrival: '2024-01-15T11:00:00.000Z',
    plannedArrival: '2024-01-15T11:00:00.000Z',
    departure: null,
    plannedDeparture: null,
  };
  const stopovers = [berlin, wolfsburg, hannover];

  it('parks at the origin, status scheduled, before the first departure', () => {
    const result = vehiclePosition(stopovers, null, '2024-01-15T09:50:00.000Z');
    expect(result.status).toBe('scheduled');
    expect(result.position).toEqual({ lat: 52.5251, lon: 13.3694 });
  });

  it('interpolates position en route on the first leg, straight-line without a polyline', () => {
    // Exactly halfway between 10:00 and 10:30.
    const result = vehiclePosition(stopovers, null, '2024-01-15T10:15:00.000Z');
    expect(result.status).toBe('en_route');
    expect(result.fromStop).toBe('Berlin Hbf');
    expect(result.toStop).toBe('Wolfsburg Hbf');
    expect(result.fraction).toBeCloseTo(0.5, 5);
    expect(result.position.lat).toBeCloseTo((52.5251 + 52.4227) / 2, 4);
    expect(result.position.lon).toBeCloseTo((13.3694 + 10.7865) / 2, 4);
  });

  it('reports at_stop with the station name while dwelling between arrival and departure', () => {
    const result = vehiclePosition(stopovers, null, '2024-01-15T10:31:00.000Z');
    expect(result.status).toBe('at_stop');
    expect(result.stopName).toBe('Wolfsburg Hbf');
    expect(result.position).toEqual({ lat: 52.4227, lon: 10.7865 });
  });

  it('interpolates position en route on the second leg', () => {
    // 13 of 28 minutes into the 10:32 -> 11:00 leg.
    const result = vehiclePosition(stopovers, null, '2024-01-15T10:45:00.000Z');
    expect(result.status).toBe('en_route');
    expect(result.fromStop).toBe('Wolfsburg Hbf');
    expect(result.toStop).toBe('Hannover Hbf');
    expect(result.fraction).toBeCloseTo(13 / 28, 4);
  });

  it('parks at the destination, status arrived, after the final arrival', () => {
    const result = vehiclePosition(stopovers, null, '2024-01-15T11:05:00.000Z');
    expect(result.status).toBe('arrived');
    expect(result.position).toEqual({ lat: 52.3759, lon: 9.7320 });
  });

  it('skips a cancelled stopover rather than stopping there', () => {
    const cancelledMiddle = {
      stop: { id: '9999', name: 'Skipped Stop', location: { latitude: 52.4, longitude: 10.0 } },
      arrival: '2024-01-15T10:40:00.000Z',
      plannedArrival: '2024-01-15T10:40:00.000Z',
      departure: '2024-01-15T10:41:00.000Z',
      plannedDeparture: '2024-01-15T10:41:00.000Z',
      cancelled: true,
    };
    const withCancelled = [berlin, wolfsburg, cancelledMiddle, hannover];
    // Still squarely inside the Wolfsburg -> Hannover leg once the
    // cancelled stopover is filtered out.
    const result = vehiclePosition(withCancelled, null, '2024-01-15T10:45:00.000Z');
    expect(result.status).toBe('en_route');
    expect(result.fromStop).toBe('Wolfsburg Hbf');
    expect(result.toStop).toBe('Hannover Hbf');
  });

  it('falls back to live times only when present, else the planned ones', () => {
    const delayed = [
      { ...berlin, departure: '2024-01-15T10:05:00.000Z' },
      wolfsburg,
      hannover,
    ];
    // The train hasn't actually left yet (delayed departure at 10:05),
    // even though the planned departure was 10:00.
    const result = vehiclePosition(delayed, null, '2024-01-15T10:02:00.000Z');
    expect(result.status).toBe('scheduled');
  });

  it('follows the polyline (V2) instead of a straight line when it usefully brackets the two stops', () => {
    // A polyline that bends north between Berlin and Wolfsburg — a straight
    // lerp and a path-walk would disagree here, which is what distinguishes
    // V2 actually engaging from silently falling back to V1.
    const polyline = [
      { lat: 52.5251, lon: 13.3694 }, // Berlin Hbf
      { lat: 52.9, lon: 12.0 },       // bulges north
      { lat: 52.4227, lon: 10.7865 }, // Wolfsburg Hbf
    ];
    const result = vehiclePosition(stopovers, polyline, '2024-01-15T10:15:00.000Z');
    expect(result.status).toBe('en_route');
    const straightLerp = { lat: (52.5251 + 52.4227) / 2, lon: (13.3694 + 10.7865) / 2 };
    expect(result.position.lat).toBeGreaterThan(straightLerp.lat);
  });

  it('falls back to a straight line when the polyline does not bracket the stops', () => {
    const uselessPolyline = [{ lat: 10, lon: 10 }];
    const result = vehiclePosition(stopovers, uselessPolyline, '2024-01-15T10:15:00.000Z');
    expect(result.status).toBe('en_route');
    expect(result.position.lat).toBeCloseTo((52.5251 + 52.4227) / 2, 4);
  });

  it('returns scheduled with a null position when every stopover is cancelled', () => {
    const allCancelled = stopovers.map((s) => ({ ...s, cancelled: true }));
    const result = vehiclePosition(allCancelled, null, '2024-01-15T10:15:00.000Z');
    expect(result.status).toBe('scheduled');
    expect(result.position).toBeNull();
  });
});

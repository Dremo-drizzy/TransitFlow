const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Great-circle distance between two {lat, lon} points, in metres.
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
}

// The DB API's polyline coordinates are GeoJSON [longitude, latitude].
// Leaflet (and everything else here) wants {lat, lon}.
export function toLatLng([lon, lat]) {
  return { lat, lon };
}

function lerp(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

// Walks `path` (an array of {lat, lon}, in order) by cumulative distance and
// returns the coordinate at `fraction` (0..1) of the total path length.
export function pointAlongPath(path, fraction) {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];

  const clamped = Math.min(1, Math.max(0, fraction));
  const segmentLengths = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = haversine(path[i], path[i + 1]);
    segmentLengths.push(len);
    total += len;
  }
  if (total === 0) return path[0];

  const targetDist = clamped * total;
  let covered = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    const isLastSegment = i === segmentLengths.length - 1;
    if (covered + segLen >= targetDist || isLastSegment) {
      const segFraction = segLen === 0 ? 0 : Math.min(1, (targetDist - covered) / segLen);
      return lerp(path[i], path[i + 1], segFraction);
    }
    covered += segLen;
  }
  return path[path.length - 1];
}

// The polyline's vertices rarely coincide exactly with a stop's own
// coordinate (rounding, snapping to track geometry rather than the station
// building). This finds the index of the closest vertex, so a caller can
// slice the polyline between two stops before walking it with
// pointAlongPath.
export function nearestPointIndex(path, point) {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversine(path[i], point);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function stopCoord(stopover) {
  const { latitude, longitude } = stopover.stop.location;
  return { lat: latitude, lon: longitude };
}

function departureTime(stopover) {
  return stopover.departure ?? stopover.plannedDeparture;
}

function arrivalTime(stopover) {
  return stopover.arrival ?? stopover.plannedArrival;
}

function toMs(isoString) {
  if (!isoString) return null;
  const ms = new Date(isoString).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Interpolates between two stops' coordinates at fraction `t`. When the
// polyline has vertices near both stops, walks the actual track between
// them (V2) instead of cutting a straight line across country (V1). Falls
// back to the straight line whenever the polyline can't usefully bracket
// the two stops — missing geometry, or a nearest-vertex match that doesn't
// give a real slice.
function interpolate(fromCoord, toCoord, t, polylinePath) {
  if (polylinePath && polylinePath.length >= 2) {
    const fromIndex = nearestPointIndex(polylinePath, fromCoord);
    const toIndex = nearestPointIndex(polylinePath, toCoord);
    if (toIndex > fromIndex) {
      const slice = polylinePath.slice(fromIndex, toIndex + 1);
      if (slice.length >= 2) return pointAlongPath(slice, t);
    }
  }
  return lerp(fromCoord, toCoord, t);
}

// Given a trip's stopovers, its route polyline (already flipped to
// {lat, lon} via toLatLng — pass [] or null if there is none), and the
// current time, returns where the vehicle is and what it's doing:
//   { status: 'scheduled', position }              — before the first departure
//   { status: 'at_stop', stopName, position }       — stopped at a station
//   { status: 'en_route', fromStop, toStop, position, fraction }
//   { status: 'arrived', position }                 — after the final arrival
// Cancelled stopovers are skipped, since the vehicle never actually calls there.
export function vehiclePosition(stopovers, polylinePath, now) {
  const stops = (stopovers || []).filter((s) => !s.cancelled);
  if (stops.length === 0) return { status: 'scheduled', position: null };

  const first = stops[0];
  if (stops.length === 1) return { status: 'scheduled', position: stopCoord(first) };

  const last = stops[stops.length - 1];
  const nowMs = toMs(now) ?? new Date(now).getTime();

  const firstDepartureMs = toMs(departureTime(first));
  if (firstDepartureMs != null && nowMs < firstDepartureMs) {
    return { status: 'scheduled', position: stopCoord(first) };
  }

  const lastArrivalMs = toMs(arrivalTime(last));
  if (lastArrivalMs != null && nowMs >= lastArrivalMs) {
    return { status: 'arrived', position: stopCoord(last) };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];

    // Waiting at `current` between its arrival and departure. The origin
    // (i === 0) has no arrival of its own, so it can never match here —
    // it's covered by the "before first departure" check above instead.
    if (i > 0) {
      const arriveCurrentMs = toMs(arrivalTime(current));
      const departCurrentMs = toMs(departureTime(current));
      if (arriveCurrentMs != null && departCurrentMs != null && nowMs >= arriveCurrentMs && nowMs < departCurrentMs) {
        return { status: 'at_stop', stopName: current.stop.name, position: stopCoord(current) };
      }
    }

    const departMs = toMs(departureTime(current));
    const arriveNextMs = toMs(arrivalTime(next));
    if (departMs != null && arriveNextMs != null && nowMs >= departMs && nowMs < arriveNextMs) {
      const t = arriveNextMs === departMs ? 1 : (nowMs - departMs) / (arriveNextMs - departMs);
      const fraction = Math.min(1, Math.max(0, t));
      const position = interpolate(stopCoord(current), stopCoord(next), fraction, polylinePath);
      return { status: 'en_route', fromStop: current.stop.name, toStop: next.stop.name, position, fraction };
    }
  }

  // Timestamps didn't line up cleanly against any segment (a gap in the
  // data) — park at the origin rather than returning nothing.
  return { status: 'scheduled', position: stopCoord(first) };
}

/**
 * Polyline downsampling.
 *
 * A long-distance trip from Transitous carries ~10,000 route points (≈1 MB)
 * — far more than a map can show, since at normal zoom a point is a fraction
 * of a pixel. Ramer–Douglas–Peucker drops points that lie within
 * `toleranceM` of the straight line between their kept neighbours, which
 * preserves the shape of the route (corners stay, long straights collapse).
 *
 * Points are GeoJSON-style [lon, lat].
 */

const METRES_PER_DEGREE_LAT = 111_320;

// Distance in metres from point p to the segment a–b, using a local flat
// projection around `refLat`. Over the few hundred metres that matter for a
// 30 m tolerance, this is indistinguishable from a great-circle calculation
// and far cheaper than running haversine on every pair.
function distanceToSegmentM(p, a, b, cosLat) {
  const toX = (pt) => pt[0] * METRES_PER_DEGREE_LAT * cosLat;
  const toY = (pt) => pt[1] * METRES_PER_DEGREE_LAT;
  const px = toX(p), py = toY(p);
  const ax = toX(a), ay = toY(a);
  const bx = toX(b), by = toY(b);
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Index of the point in `points` nearest to `target`.
export function nearestIndex(points, target) {
  let best = 0;
  let bestSq = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i][0] - target[0];
    const dy = points[i][1] - target[1];
    const sq = dx * dx + dy * dy;
    if (sq < bestSq) {
      bestSq = sq;
      best = i;
    }
  }
  return best;
}

/**
 * Returns the indices (ascending) of the points to keep.
 *
 * `anchors` are indices that must survive regardless of tolerance — the
 * vehicle-position code walks the line between the vertices nearest each
 * stop, so those vertices have to still exist after simplification.
 */
export function simplifyIndices(points, { toleranceM = 30, anchors = [] } = {}) {
  const n = points.length;
  if (n <= 2) return points.map((_, i) => i);

  const refLat = points[Math.floor(n / 2)][1];
  const cosLat = Math.cos((refLat * Math.PI) / 180);

  const keep = new Set([0, n - 1, ...anchors.filter((i) => i >= 0 && i < n)]);
  const bounds = [...keep].sort((a, b) => a - b);

  // Iterative (explicit stack) rather than recursive: a 12k-point line can
  // otherwise nest deeply enough to be uncomfortable.
  for (let k = 0; k < bounds.length - 1; k++) {
    const stack = [[bounds[k], bounds[k + 1]]];
    while (stack.length) {
      const [lo, hi] = stack.pop();
      if (hi - lo < 2) continue;
      let maxDist = 0;
      let maxIdx = -1;
      for (let i = lo + 1; i < hi; i++) {
        const d = distanceToSegmentM(points[i], points[lo], points[hi], cosLat);
        if (d > maxDist) {
          maxDist = d;
          maxIdx = i;
        }
      }
      if (maxDist > toleranceM && maxIdx !== -1) {
        keep.add(maxIdx);
        stack.push([lo, maxIdx], [maxIdx, hi]);
      }
    }
  }

  return [...keep].sort((a, b) => a - b);
}

// ~1.1 m of precision at the equator — well below the tolerance, and it
// removes the long float tails (13.369114000000001) that bloat the JSON.
export const roundCoord = (value, decimals = 5) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/**
 * Downsamples a GeoJSON FeatureCollection of Point features (the shape the
 * trip endpoint returns) and returns a new FeatureCollection. `stopCoords`
 * is a list of [lon, lat] for the trip's stops; the nearest vertex to each is
 * always kept.
 */
export function simplifyFeatureCollection(collection, stopCoords = [], options = {}) {
  const features = collection?.features;
  if (!Array.isArray(features) || features.length <= 2) return collection;

  const points = features.map((f) => f.geometry.coordinates);
  const anchors = stopCoords.map((c) => nearestIndex(points, c));
  const kept = simplifyIndices(points, { ...options, anchors });

  return {
    type: 'FeatureCollection',
    features: kept.map((i) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [roundCoord(points[i][0]), roundCoord(points[i][1])],
      },
    })),
  };
}

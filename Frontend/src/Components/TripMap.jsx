import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../css/TripMap.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
// Required by CARTO's terms of use, not optional.
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

// Leaflet's SVG renderer sets a path's stroke as a plain XML attribute, not
// a style property — a CSS custom property in pathOptions.color would never
// resolve, unlike every other themeable value in this app. Hardcoded to
// match --tf-amber for that reason.
const ROUTE_COLOR = '#ffb302';

function stopDivIcon() {
  return L.divIcon({ className: 'tf-stop-marker', html: '<span></span>', iconSize: [10, 10] });
}

// divIcon's `html` is set via innerHTML — escape the line name (it comes
// straight from the API) rather than trust it's never markup.
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function vehicleDivIcon(label) {
  return L.divIcon({
    className: 'tf-vehicle-marker',
    html: `<span class="tf-vehicle-marker-pill">${escapeHtml(label)}</span>`,
    iconSize: [0, 0],
  });
}

// MapContainer's center/zoom props are read once at mount and ignored after
// — the only way to change the view post-mount is useMap() from a child.
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, bounds]);
  return null;
}

function PanToStop({ stop }) {
  const map = useMap();
  useEffect(() => {
    if (stop) map.panTo([stop.lat, stop.lon]);
  }, [map, stop]);
  return null;
}

/**
 * The route on a dark map, with the vehicle's live position animated along
 * it. `vehicle` is the result of geo.js's vehiclePosition — this component
 * only renders what that pure function returns, it never computes position
 * itself. The caller (TripDetail) computes it once from a single `now` tick
 * and hands the same object to both this and StopoverTimeline, so the map
 * and the timeline never highlight different segments a tick apart.
 */
export default function TripMap({ stopovers, polyline, lineName, vehicle, selectedStop }) {
  const stopPoints = useMemo(
    () =>
      (stopovers || [])
        .filter((s) => !s.cancelled)
        .map((s) => ({ lat: s.stop.location.latitude, lon: s.stop.location.longitude, name: s.stop.name })),
    [stopovers]
  );

  const bounds = useMemo(() => {
    const points = polyline && polyline.length > 0 ? polyline : stopPoints;
    return points.map((p) => [p.lat, p.lon]);
  }, [polyline, stopPoints]);

  if (stopPoints.length === 0) return null;

  const origin = stopPoints[0];
  // Some regional services have no route geometry at all — connect the
  // stops with straight segments rather than showing no line whatsoever.
  const routePoints = polyline && polyline.length > 1 ? polyline : stopPoints;

  return (
    <div className="trip-map">
      <MapContainer center={[origin.lat, origin.lon]} zoom={9} scrollWheelZoom={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitBounds bounds={bounds} />
        <PanToStop stop={selectedStop} />

        {routePoints.length > 1 && (
          <Polyline positions={routePoints.map((p) => [p.lat, p.lon])} pathOptions={{ color: ROUTE_COLOR, weight: 3 }} />
        )}

        {stopPoints.map((stop) => (
          <Marker key={`${stop.lat},${stop.lon},${stop.name}`} position={[stop.lat, stop.lon]} icon={stopDivIcon()} />
        ))}

        {vehicle?.position && (
          <Marker position={[vehicle.position.lat, vehicle.position.lon]} icon={vehicleDivIcon(lineName || '')} />
        )}
      </MapContainer>
    </div>
  );
}

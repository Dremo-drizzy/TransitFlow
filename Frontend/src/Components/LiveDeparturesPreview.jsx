import { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useDepartures } from '../hooks/useDepartures';
import { useResolvedStation } from '../hooks/useResolvedStation';
import { getUserLocation, formatTime } from '../utils/transportUtils';
import { nearestStation } from '../utils/stations';
import { MAJOR_STATIONS } from '../data/majorStations';
import '../css/LiveDeparturesPreview.css';

// Looked up by name, never by a hard-coded id: station ids differ between
// data sources and datasets (see utils/stations.js).
const DEFAULT_PLACE = { name: 'Berlin Hbf' };
const PREVIEW_ROWS = 8;

export default function LiveDeparturesPreview() {
  const [nearest, setNearest] = useState(null); // { station, distanceM }
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  // Geolocation only happens on request — a first-time visitor used to get a
  // browser permission prompt before seeing anything. Berlin Hbf renders
  // either way.
  const place = nearest
    ? { name: nearest.station.name, location: nearest.station }
    : DEFAULT_PLACE;
  const { data: station, isLoading: resolving, isError: resolveFailed } = useResolvedStation(place);

  const stopName = station?.name || place.name;
  const { data, isLoading: loadingDepartures, error } = useDepartures(station?.id, { duration: 60 });
  const isLoading = resolving || loadingDepartures;
  // A preview, not the board: a large interchange has well over a hundred
  // departures an hour, so only the next few are shown (the full board is one
  // click away).
  const departures = (data?.departures || []).slice(0, PREVIEW_ROWS);

  // "Nearest major station", not "nearest stop": the stations are a bundled
  // list of the ~50 largest, found by straight-line distance in the browser.
  // The transit data source has no nearby-stops lookup to ask instead.
  const handleNearest = () => {
    setLocating(true);
    setLocationError(false);
    getUserLocation()
      .then(({ lat, lon }) => setNearest(nearestStation(MAJOR_STATIONS, { lat, lon })))
      .catch(() => setLocationError(true))
      .finally(() => setLocating(false));
  };

  return (
    <Card className="departures-preview-card">
      <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 className="m-0">
          Live Departures —{' '}
          {station ? (
            <Link to={`/departures/${encodeURIComponent(station.id)}?name=${encodeURIComponent(stopName)}`} className="departures-station-link">
              {stopName}
            </Link>
          ) : (
            stopName
          )}
        </h5>
        <div className="d-flex align-items-center gap-2">
          <span className="live-pill">● LIVE</span>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleNearest}
            disabled={locating}
          >
            {locating ? 'Locating…' : 'Nearest major station'}
          </Button>
        </div>
      </Card.Header>

      {nearest && (
        <div className="px-3 pt-2">
          <p className="text-muted mb-0 small">
            Nearest major station to you: {nearest.station.name}, {nearest.distanceM < 1000 ? 'less than 1 km' : `about ${Math.round(nearest.distanceM / 1000)} km`} away
            (straight-line, from a list of about fifty major stations).
          </p>
        </div>
      )}

      {locationError && (
        <div className="px-3 pt-2">
          <p className="text-muted mb-0 small">
            Could not get your location — showing {DEFAULT_PLACE.name} instead.
          </p>
        </div>
      )}

      <div className="departures-header-row">
        <span>Time</span>
        <span>Line</span>
        <span>Destination</span>
        <span>Pl.</span>
      </div>

      {isLoading ? (
        <div className="departures-skeleton">
          {[0, 1, 2].map((i) => (
            <div className="departure-row" key={i}>
              <div className="skeleton-block skeleton-time" />
              <div className="skeleton-block skeleton-line" />
              <div className="skeleton-block skeleton-destination" />
              <div className="skeleton-block skeleton-platform" />
            </div>
          ))}
        </div>
      ) : error || resolveFailed || !station ? (
        <Card.Body>
          <p className="text-muted mb-0">Could not load departures.</p>
        </Card.Body>
      ) : departures.length === 0 ? (
        <Card.Body>
          <p className="text-muted mb-0">No departures found.</p>
        </Card.Body>
      ) : (
        departures.map((dep) => (
          <div className="departure-row" key={dep.tripId || dep.plannedWhen}>
            <div className="departure-time">{formatTime(dep.plannedWhen)}</div>
            <div className="departure-line">
              {dep.line?.name || dep.tripId}
            </div>
            <div className="departure-direction">{dep.direction}</div>
            <div className="departure-platform">{dep.platform || '—'}</div>
          </div>
        ))
      )}
    </Card>
  );
}

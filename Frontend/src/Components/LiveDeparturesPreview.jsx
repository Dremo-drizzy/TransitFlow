import { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useDepartures } from '../hooks/useDepartures';
import { useNearbyStops } from '../hooks/useNearbyStops';
import { getUserLocation, formatTime } from '../utils/transportUtils';
import '../css/LiveDeparturesPreview.css';

const DEFAULT_STOP = { id: '900003200', name: 'Berlin Hbf' };

export default function LiveDeparturesPreview() {
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  // Geolocation now happens only on request — a first-time visitor used to
  // get a browser permission prompt before seeing anything. The Berlin Hbf
  // default renders immediately either way.
  const { data: nearbyData } = useNearbyStops(location?.lat, location?.lon, 1000, !!location);
  const nearbyStop = nearbyData?.[0];

  const stopId   = nearbyStop?.id   || DEFAULT_STOP.id;
  const stopName = nearbyStop?.name || DEFAULT_STOP.name;

  const { data, isLoading, error } = useDepartures(stopId, { duration: 60 });
  const departures = data?.departures || [];

  const handleUseLocation = () => {
    setLocating(true);
    setLocationError(false);
    getUserLocation()
      .then(({ lat, lon }) => setLocation({ lat, lon }))
      .catch(() => setLocationError(true))
      .finally(() => setLocating(false));
  };

  return (
    <Card className="departures-preview-card">
      <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 className="m-0">
          Live Departures — <Link to={`/departures/${stopId}?name=${encodeURIComponent(stopName)}`} className="departures-station-link">{stopName}</Link>
        </h5>
        <div className="d-flex align-items-center gap-2">
          <span className="live-pill">● LIVE</span>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleUseLocation}
            disabled={locating}
          >
            {locating ? 'Locating…' : 'Use my location'}
          </Button>
        </div>
      </Card.Header>

      {locationError && (
        <div className="px-3 pt-2">
          <p className="text-muted mb-0 small">
            Could not get your location — showing {DEFAULT_STOP.name} instead.
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
      ) : error ? (
        <Card.Body>
          <p className="text-muted mb-0">Could not load departures.</p>
        </Card.Body>
      ) : departures.length === 0 ? (
        <Card.Body>
          <p className="text-muted mb-0">No departures found.</p>
        </Card.Body>
      ) : (
        departures.map((dep) => (
          <div className="departure-row" key={dep.tripId || dep.when}>
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

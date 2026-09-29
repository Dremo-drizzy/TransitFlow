import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Button } from 'react-bootstrap';
import { useTripDetails } from '../hooks/useTripDetails';
import { useNow } from '../hooks/useNow';
import { vehiclePosition, toLatLng } from '../utils/geo';
import { formatTime, getDelayMinutes, formatDelay } from '../utils/transportUtils';
import TripMap from '../Components/TripMap';
import StopoverTimeline from '../Components/StopoverTimeline';
import '../css/TripDetail.css';

function findStopover(stopovers, name) {
  return (stopovers || []).find((s) => !s.cancelled && s.stop?.name === name);
}

function statusLine(vehicle, stopovers, trip) {
  if (!vehicle) return '';
  if (vehicle.status === 'scheduled') {
    const when = trip?.plannedDeparture ? ` at ${formatTime(trip.plannedDeparture)}` : '';
    return `Scheduled to depart ${trip?.origin?.name || 'origin'}${when}`;
  }
  if (vehicle.status === 'arrived') {
    return `Arrived at ${trip?.destination?.name || 'destination'}`;
  }
  if (vehicle.status === 'at_stop') {
    const stop = findStopover(stopovers, vehicle.stopName);
    const delay = stop ? getDelayMinutes(stop.plannedArrival, stop.arrival) : 0;
    const delayText = delay > 0 ? ` · ${formatDelay(delay)}` : '';
    return `At ${vehicle.stopName}${delayText}`;
  }
  if (vehicle.status === 'en_route') {
    const stop = findStopover(stopovers, vehicle.fromStop);
    const delay = stop ? getDelayMinutes(stop.plannedDeparture, stop.departure) : 0;
    const delayText = delay > 0 ? ` · ${formatDelay(delay)}` : '';
    return `Departed ${vehicle.fromStop}${delayText} · next stop ${vehicle.toStop}`;
  }
  return '';
}

function Skeleton() {
  return (
    <div className="trip-detail-skeleton">
      <div className="skeleton-block" style={{ width: '45%', height: '1.5rem' }} />
      <div className="skeleton-block" style={{ width: '30%', height: '0.9rem', marginTop: '0.6rem' }} />
      <div className="skeleton-block" style={{ width: '100%', height: '420px', marginTop: '1.5rem' }} />
    </div>
  );
}

export default function TripDetail() {
  const { tripId } = useParams();
  const now = useNow(1000);
  const [selectedStop, setSelectedStop] = useState(null);

  const { data, isLoading, error, refetch } = useTripDetails(tripId);
  // The REST wrapper's response shape for a single trip isn't documented
  // with a full example (unlike /stops/:id, which confirms an unwrapped
  // root object) — this falls back to an unwrapped root if there's no
  // `trip` field, so either shape works without needing live access to verify.
  const trip = data?.trip ?? data;

  const stopovers = useMemo(() => trip?.stopovers || [], [trip]);

  const polylinePath = useMemo(() => {
    const features = trip?.polyline?.features;
    if (!features) return [];
    return features
      .filter((f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
      .map((f) => toLatLng(f.geometry.coordinates));
  }, [trip]);

  const vehicle = useMemo(() => vehiclePosition(stopovers, polylinePath, now), [stopovers, polylinePath, now]);

  if (isLoading) {
    return (
      <Container fluid="lg" className="trip-detail-page py-4">
        <Skeleton />
      </Container>
    );
  }

  if (error || !trip) {
    const notFound = error?.status === 404;
    return (
      <Container fluid="lg" className="trip-detail-page py-5 text-center">
        <p className="trip-detail-message">{notFound ? 'TRIP NOT FOUND' : 'COULD NOT LOAD TRIP DETAILS'}</p>
        {!notFound && (
          <Button variant="outline-primary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        )}
        <div className="mt-3">
          <Link to="/">Back home</Link>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid="lg" className="trip-detail-page py-4">
      <div className="trip-detail-header">
        <div>
          <div className="trip-detail-line">{trip.line?.name || tripId}</div>
          <h1 className="trip-detail-route">
            {trip.origin?.name} → {trip.destination?.name}
          </h1>
        </div>
      </div>

      {trip.cancelled ? (
        <p className="trip-detail-status trip-detail-status-cancelled">THIS TRIP IS CANCELLED</p>
      ) : (
        <p className="trip-detail-status">{statusLine(vehicle, stopovers, trip)}</p>
      )}

      <div className="trip-detail-layout">
        <TripMap
          stopovers={stopovers}
          polyline={polylinePath}
          lineName={trip.line?.name}
          vehicle={vehicle}
          selectedStop={selectedStop}
        />
        <StopoverTimeline stopovers={stopovers} vehicle={vehicle} onSelectStop={setSelectedStop} />
      </div>
    </Container>
  );
}

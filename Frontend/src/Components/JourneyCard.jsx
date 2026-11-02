import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { formatTime, formatDuration, getDepartureStatus, displayTime, countChanges } from '../utils/transportUtils';
import FlapTime from './FlapTime';
import '../css/JourneyCard.css';

// The planned time, struck through, beside a real time that differs from it.
function PlannedTime({ value }) {
  return (
    <span className="journey-planned-time">
      <span className="visually-hidden">planned </span>
      {formatTime(value)}
    </span>
  );
}

export default function JourneyCard({ journey, index = 0 }) {
  const legs = journey?.legs || [];
  if (legs.length === 0) return null;

  const firstLeg = legs[0];
  const lastLeg  = legs[legs.length - 1];
  // Real times when known, the same pair the backend measures the duration
  // from — planned times here beside a live-time duration once printed
  // "15:12 → 15:10 · 6m", arriving before it left.
  const start = displayTime(firstLeg?.plannedDeparture, firstLeg?.departure, firstLeg?.cancelled);
  const end = displayTime(lastLeg?.plannedArrival, lastLeg?.arrival, lastLeg?.cancelled);
  const changes = countChanges(legs);

  return (
    <Card className="journey-card" style={{ animationDelay: `${index * 0.07}s` }}>
      <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <div className="journey-route">
            {firstLeg?.origin?.name} → {lastLeg?.destination?.name}
          </div>
          <div className="journey-times">
            <FlapTime value={formatTime(start.time)} size="sm" />
            {start.changed && <PlannedTime value={start.planned} />}
            <span className="journey-times-arrow">→</span>
            <FlapTime value={formatTime(end.time)} size="sm" />
            {end.changed && <PlannedTime value={end.planned} />}
          </div>
        </div>
        <div className="journey-duration-pill">
          {formatDuration(journey.duration)}
          {changes > 0 && ` · ${changes} change${changes > 1 ? 's' : ''}`}
        </div>
      </Card.Header>

      <div className="journey-legs">
        {legs.map((leg, i) => {
          // Walking legs (footpaths between platforms) have no line and no
          // tripId — linking them to /trip/undefined would 404. Render them
          // as a plain, unlinked row instead.
          if (leg.walking) {
            return (
              <div className="journey-leg journey-leg-walk" key={i}>
                <div className="leg-product-pill">
                  <span>Walk</span>
                </div>

                <div className="leg-stops flex-grow-1">
                  {leg.origin?.name} → {leg.destination?.name}
                </div>

                <div className="leg-time-status">
                  <div className="leg-times-row">
                    <FlapTime value={formatTime(leg.departure)} size="sm" />
                    <span className="leg-arrival-time">→ {formatTime(leg.arrival)}</span>
                  </div>
                </div>
              </div>
            );
          }

          const status = getDepartureStatus(leg.plannedDeparture, leg.departure, leg.cancelled);
          const legStart = displayTime(leg.plannedDeparture, leg.departure, leg.cancelled);
          const legEnd = displayTime(leg.plannedArrival, leg.arrival, leg.cancelled);
          const content = (
            <>
              <div className="leg-product-pill">
                <span>{leg.line?.name || leg.tripId}</span>
              </div>

              <div className="leg-stops flex-grow-1">
                {leg.origin?.name} → {leg.destination?.name}
              </div>

              <div className="leg-time-status">
                <div className="leg-times-row">
                  <FlapTime
                    value={formatTime(legStart.time)}
                    size="sm"
                    tone={status.cancelled ? 'red' : 'amber'}
                    cancelled={status.cancelled}
                  />
                  {legStart.changed && <PlannedTime value={legStart.planned} />}
                  <span className="leg-arrival-time">→ {formatTime(legEnd.time)}</span>
                </div>
                <div className={`leg-status leg-status-${status.tone}`}>{status.text}</div>
              </div>
            </>
          );

          if (!leg.tripId) {
            return <div className="journey-leg" key={i}>{content}</div>;
          }

          return (
            <Link to={`/trip/${encodeURIComponent(leg.tripId)}`} className="journey-leg journey-leg-link" key={i}>
              {content}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

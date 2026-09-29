import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { formatTime, formatDuration, getDepartureStatus } from '../utils/transportUtils';
import FlapTime from './FlapTime';
import '../css/JourneyCard.css';

export default function JourneyCard({ journey, index = 0 }) {
  const legs = journey?.legs || [];
  if (legs.length === 0) return null;

  const firstLeg = legs[0];
  const lastLeg  = legs[legs.length - 1];

  return (
    <Card className="journey-card" style={{ animationDelay: `${index * 0.07}s` }}>
      <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <div className="journey-route">
            {firstLeg?.origin?.name} → {lastLeg?.destination?.name}
          </div>
          <div className="journey-times">
            <FlapTime value={formatTime(firstLeg?.plannedDeparture)} size="sm" />
            <span className="journey-times-arrow">→</span>
            <FlapTime value={formatTime(lastLeg?.plannedArrival)} size="sm" />
          </div>
        </div>
        <div className="journey-duration-pill">
          {formatDuration(journey.duration)}
          {legs.length > 1 && ` · ${legs.length - 1} change${legs.length > 2 ? 's' : ''}`}
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
                    value={formatTime(leg.plannedDeparture)}
                    size="sm"
                    tone={status.cancelled ? 'red' : 'amber'}
                    cancelled={status.cancelled}
                  />
                  <span className="leg-arrival-time">→ {formatTime(leg.plannedArrival)}</span>
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

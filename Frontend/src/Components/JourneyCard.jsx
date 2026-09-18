import { Card } from 'react-bootstrap';
import { formatTime, formatDuration, getProductIcon, getDelayMinutes, getDelayBadgeVariant } from '../utils/transportUtils';
import FlapTime from './FlapTime';
import '../css/JourneyCard.css';

// getDelayBadgeVariant works off plannedWhen/when, and a cancelled leg has
// when: null — which getDelayMinutes reads as "no data, delay 0", so a
// cancelled train would otherwise render as "ON TIME". Check leg.cancelled
// first, before any delay math.
const STATUS_TONE = { success: 'green', warning: 'amber', danger: 'red', secondary: 'muted' };

function legStatus(leg) {
  if (leg.cancelled) {
    return { text: 'CANCELLED', tone: 'red', className: 'leg-status-cancelled', cancelled: true };
  }
  const delay = getDelayMinutes(leg.plannedDeparture, leg.departure);
  const variant = getDelayBadgeVariant(delay);
  return {
    text: delay <= 0 ? 'ON TIME' : `+${delay} MIN`,
    tone: STATUS_TONE[variant],
    className: `leg-status-${variant}`,
    cancelled: false,
  };
}

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
          const status = legStatus(leg);
          return (
            <div className="journey-leg" key={i}>
              <div className="leg-product-pill">
                <span className="leg-product-icon">{getProductIcon(leg.line?.product)}</span>
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
                <div className={`leg-status ${status.className}`}>{status.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

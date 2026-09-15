import { Card, Badge, ListGroup } from 'react-bootstrap';
import { formatTime, formatDuration, getProductIcon, formatDelay, getDelayMinutes, getDelayBadgeVariant } from '../utils/transportUtils';
import '../css/JourneyCard.css';

export default function JourneyCard({ journey, index = 0 }) {
  const legs = journey?.legs || [];
  if (legs.length === 0) return null;

  const firstLeg = legs[0];
  const lastLeg  = legs[legs.length - 1];

  return (
    <Card className="journey-card text-white" style={{ animationDelay: `${index * 0.07}s` }}>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <div className="journey-route">
            {firstLeg?.origin?.name} → {lastLeg?.destination?.name}
          </div>
          <div className="journey-times">
            {formatTime(firstLeg?.plannedDeparture)} → {formatTime(lastLeg?.plannedArrival)}
          </div>
        </div>
        <Badge bg={legs.length > 1 ? 'secondary' : 'primary'}>
          {formatDuration(journey.duration)}
          {legs.length > 1 && ` · ${legs.length - 1} change${legs.length > 2 ? 's' : ''}`}
        </Badge>
      </Card.Header>

      <ListGroup variant="flush">
        {legs.map((leg, i) => {
          const delay = getDelayMinutes(leg.plannedDeparture, leg.departure);
          return (
            <div className="journey-leg" key={i}>
              <div className="leg-icon">{getProductIcon(leg.line?.product)}</div>

              <div className="flex-grow-1">
                <div className="leg-name">{leg.line?.name || leg.tripId}</div>
                <div className="leg-stops">{leg.origin?.name} → {leg.destination?.name}</div>
              </div>

              <div>
                <div className="leg-times">
                  {formatTime(leg.plannedDeparture)} – {formatTime(leg.plannedArrival)}
                </div>
                <div className="text-end mt-1">
                  <Badge bg={getDelayBadgeVariant(delay)}>{formatDelay(delay)}</Badge>
                </div>
              </div>
            </div>
          );
        })}
      </ListGroup>
    </Card>
  );
}
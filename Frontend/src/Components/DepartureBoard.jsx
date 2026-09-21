import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useDepartures } from '../hooks/useDepartures';
import { formatTime, getDepartureStatus } from '../utils/transportUtils';
import FlapTime from './FlapTime';
import SplitFlap from './SplitFlap';
import '../css/DepartureBoard.css';

function SkeletonRow() {
  return (
    <div className="db-row" role="row">
      <div className="skeleton-block" style={{ width: '3.5rem' }} role="cell" />
      <div className="skeleton-block" style={{ width: '3rem' }} role="cell" />
      <div className="skeleton-block" style={{ width: '60%' }} role="cell" />
      <div className="skeleton-block" style={{ width: '1.5rem' }} role="cell" />
      <div className="skeleton-block" style={{ width: '4rem' }} role="cell" />
    </div>
  );
}

function DepartureRow({ dep }) {
  const status = getDepartureStatus(dep.plannedWhen, dep.when, dep.cancelled);
  const platformChanged =
    dep.plannedPlatform != null && dep.platform != null && dep.plannedPlatform !== dep.platform;

  const rowContent = (
    <>
      <div className="db-cell db-time" role="cell">
        <FlapTime
          value={formatTime(dep.plannedWhen)}
          size="md"
          tone={status.cancelled ? 'red' : 'amber'}
          cancelled={status.cancelled}
        />
      </div>
      <div className="db-cell db-line" role="cell">
        <span className="db-line-pill">{dep.line?.name || dep.tripId}</span>
      </div>
      <div className="db-cell db-destination" role="cell">{dep.direction}</div>
      <div className="db-cell db-platform" role="cell">
        <SplitFlap
          value={dep.platform || '-'}
          length={2}
          align="end"
          size="md"
          tone={platformChanged ? 'amber' : dep.platform ? 'text' : 'muted'}
          pulseOnChange={platformChanged}
        />
      </div>
      <div className={`db-cell db-delay leg-status-${status.tone}`} role="cell">{status.text}</div>
    </>
  );

  const rowClassName = `db-row db-data-row${status.cancelled ? ' db-row-cancelled' : ''}`;

  if (!dep.tripId) {
    return (
      <div className={rowClassName} role="row">
        {rowContent}
      </div>
    );
  }

  return (
    <Link to={`/trip/${encodeURIComponent(dep.tripId)}`} className={rowClassName} role="row">
      {rowContent}
    </Link>
  );
}

export default function DepartureBoard({ stopId, filters = {} }) {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useDepartures(stopId, {
    duration: 60,
    ...filters,
  });
  const departures = data?.departures || [];

  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (dataUpdatedAt) {
      setAnnouncement(`Departures updated. ${departures.length} upcoming.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the timestamp should trigger this, not the departures array identity
  }, [dataUpdatedAt]);

  const isRateLimited = error?.status === 429;

  return (
    <div className="departure-board" role="table" aria-label="Departures">
      <div className="visually-hidden" aria-live="polite">{announcement}</div>

      <div className="db-row db-header" role="row">
        <span className="db-cell db-time" role="columnheader">Time</span>
        <span className="db-cell db-line" role="columnheader">Line</span>
        <span className="db-cell db-destination" role="columnheader">Destination</span>
        <span className="db-cell db-platform" role="columnheader">Platform</span>
        <span className="db-cell db-delay" role="columnheader">Delay</span>
      </div>

      {isLoading ? (
        <div className="db-body">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : error ? (
        <div className="db-message">
          <p className="db-message-text">
            {isRateLimited
              ? 'RATE LIMITED — TOO MANY REQUESTS. TRY AGAIN SHORTLY.'
              : 'COULD NOT LOAD DEPARTURES.'}
          </p>
          <Button variant="outline-primary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : departures.length === 0 ? (
        <div className="db-message">
          <p className="db-message-text">NO DEPARTURES IN THE NEXT 60 MIN</p>
        </div>
      ) : (
        <div className="db-body">
          {departures.map((dep) => (
            <DepartureRow dep={dep} key={dep.tripId || dep.when} />
          ))}
        </div>
      )}
    </div>
  );
}

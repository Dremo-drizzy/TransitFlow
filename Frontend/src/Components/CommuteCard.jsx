import { Card, Button } from 'react-bootstrap';
import { format, isValid } from 'date-fns';
import { motion } from 'framer-motion';
import '../css/CommuteCard.css';

export default function CommuteCard({ commute, onDelete, onPlan, onDepartures }) {
  // date-fns v4's format() throws a RangeError on an invalid date rather
  // than returning a placeholder — a commute saved without createdAt (or
  // with a malformed one) would otherwise permanently break this page.
  const createdAt = new Date(commute.createdAt);
  const createdAtText = isValid(createdAt) ? format(createdAt, 'dd/MM/yyyy') : '—';

  // 'resolving' / 'unresolved' come from the station migration (see
  // useCommuteMigration): until a saved station has been matched to the
  // current data source, Plan/Departures would only fail.
  const usable = commute.status === undefined || commute.status === 'ok';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="commute-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <h5 className="fw-bold mb-0">{commute.name}</h5>
            <Button
              variant="link"
              className="commute-delete-btn p-0"
              onClick={() => onDelete(commute.id)}
              aria-label="Delete commute"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                <path
                  d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Button>
          </div>

          <div className="mb-3">
            <div className="commute-route-from">
              <span className="terminal-from" />
              <span>{commute.from?.name}</span>
            </div>
            <div className="route-connector ms-1" />
            <div className="commute-route-to">
              <span className="terminal-to" />
              <span>{commute.to?.name}</span>
            </div>
          </div>

          {commute.status === 'resolving' && (
            <p className="commute-station-note" role="status">Updating saved stations…</p>
          )}
          {commute.status === 'unresolved' && (
            <p className="commute-station-note commute-station-note-warn">
              Re-select station — a saved station couldn&apos;t be matched. Delete this commute and add it again.
            </p>
          )}

          <div className="d-grid gap-2">
            <Button variant="primary" size="sm" onClick={() => onPlan(commute)} disabled={!usable}>
              Plan Journey
            </Button>
            <Button variant="outline-primary" size="sm" onClick={() => onDepartures(commute)} disabled={!usable}>
              View Departures
            </Button>
          </div>
        </Card.Body>

        <Card.Footer>
          Added {createdAtText}
        </Card.Footer>
      </Card>
    </motion.div>
  );
}

import { Card, Button } from 'react-bootstrap';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import '../css/CommuteCard.css';

export default function CommuteCard({ commute, onDelete, onPlan, onDepartures }) {
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
              className="text-danger p-0"
              onClick={() => onDelete(commute.id)}
              aria-label="Delete commute"
            >
              🗑️
            </Button>
          </div>

          <div className="mb-3">
            <div className="commute-route-from">
              <span className="terminal-from" />
              <span>{commute.from.name}</span>
            </div>
            <div className="route-connector ms-1" />
            <div className="commute-route-to">
              <span className="terminal-to" />
              <span>{commute.to.name}</span>
            </div>
          </div>

          <div className="d-grid gap-2">
            <Button variant="primary" size="sm" onClick={() => onPlan(commute)}>
              Plan Journey
            </Button>
            <Button variant="outline-primary" size="sm" onClick={() => onDepartures(commute)}>
              View Departures
            </Button>
          </div>
        </Card.Body>

        <Card.Footer>
          Added {format(new Date(commute.createdAt), 'dd/MM/yyyy')}
        </Card.Footer>
      </Card>
    </motion.div>
  );
}

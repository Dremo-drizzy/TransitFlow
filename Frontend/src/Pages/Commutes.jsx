import { useState } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loadFromLocalStorage, saveToLocalStorage } from '../utils/transportUtils';
import CommuteCard from '../Components/CommuteCard';
import AddCommuteModal from '../Components/AddCommuteModal';
import '../css/Commutes.css';

export default function Commutes() {
  const navigate = useNavigate();
  const [commutes, setCommutes] = useState(() => loadFromLocalStorage('commutes', []));
  const [showModal, setShowModal] = useState(false);

  const handleAdd = ({ name, from, to }) => {
    const newCommute = {
      id: crypto.randomUUID(),
      name,
      from,
      to,
      createdAt: new Date().toISOString(),
    };
    const updated = [...commutes, newCommute];
    setCommutes(updated);
    saveToLocalStorage('commutes', updated);
    setShowModal(false);
  };

  const handleDelete = (id) => {
    const updated = commutes.filter((c) => c.id !== id);
    setCommutes(updated);
    saveToLocalStorage('commutes', updated);
  };

  const handlePlan = (commute) => {
    navigate(
      `/plan?from=${commute.from.id}&fromName=${encodeURIComponent(commute.from.name)}` +
      `&to=${commute.to.id}&toName=${encodeURIComponent(commute.to.name)}`
    );
  };

  const handleDepartures = (commute) => {
    navigate(`/departures/${commute.from.id}?name=${encodeURIComponent(commute.from.name)}`);
  };

  return (
    <motion.div
      className="commutes-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      <Container fluid="lg vh-100">
        <div className="commutes-header">
          <div>
            <h2 className='fs-1'>My Commutes</h2>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + Add Commute
          </Button>
        </div>

        {commutes.length === 0 ? (
          <Card>
            <Card.Body className="empty-state">
              <span className="empty-state-icon">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" aria-hidden="true">
                  <rect x="5" y="3" width="14" height="13" rx="3" stroke="currentColor" strokeWidth="1.4" />
                  <line x1="5" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.4" />
                  <line x1="9" y1="3" x2="9" y2="10" stroke="currentColor" strokeWidth="1.4" />
                  <line x1="15" y1="3" x2="15" y2="10" stroke="currentColor" strokeWidth="1.4" />
                  <line x1="8.5" y1="16" x2="8.5" y2="17.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="15.5" y1="16" x2="15.5" y2="17.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8.5" cy="19" r="1.4" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="15.5" cy="19" r="1.4" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
              <h4 className="mb-2">No Saved Commutes Yet</h4>
              <p className="mb-4">
                Save your frequent routes for quick access to journey plans and live updates.
              </p>
              <Button variant="primary" onClick={() => setShowModal(true)}>
                Add Your First Commute
              </Button>
            </Card.Body>
          </Card>
        ) : (
          <Row className="g-3">
            {commutes.map((commute) => (
              <Col xs={12} md={6} lg={4} key={commute.id}>
                <CommuteCard
                  commute={commute}
                  onDelete={handleDelete}
                  onPlan={handlePlan}
                  onDepartures={handleDepartures}
                />
              </Col>
            ))}
          </Row>
        )}
      </Container>

      <AddCommuteModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onSave={handleAdd}
      />
    </motion.div>
  );
}
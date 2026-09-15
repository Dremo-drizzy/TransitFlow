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
    navigate(`/departures?stationId=${commute.from.id}&stationName=${encodeURIComponent(commute.from.name)}`);
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
          <Button 
          className='border-0'
          variant="primary" onClick={() => setShowModal(true)}>
            + Add Commute
          </Button>
        </div>

        {commutes.length === 0 ? (
          <Card>
            <Card.Body className="empty-state text-white">
              <span className="empty-state-icon">🚇</span>
              <h4 className="fw-bold mb-2">No Saved Commutes Yet</h4>
              <p className=" mb-4 text-white-50">
                Save your frequent routes for quick access to journey plans and live updates.
              </p>
              <Button 
              className='border-0'
              variant="primary" onClick={() => setShowModal(true)}>
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
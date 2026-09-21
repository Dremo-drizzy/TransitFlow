import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import StationAutocomplete from './StationAutocomplete';

export default function AddCommuteModal({ show, onHide, onSave }) {
  const [name, setName] = useState('');
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery,   setToQuery]   = useState('');
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [selectedTo,   setSelectedTo]   = useState(null);

  const handleSave = () => {
    if (!name || !selectedFrom || !selectedTo) return;
    onSave({ name, from: selectedFrom, to: selectedTo });
    setName(''); setFromQuery(''); setToQuery('');
    setSelectedFrom(null); setSelectedTo(null);
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Commute</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Commute Name</Form.Label>
          <Form.Control
            placeholder="Home → Work"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <StationAutocomplete
            label="From"
            placeholder="Origin station"
            value={fromQuery}
            onChange={setFromQuery}
            selected={selectedFrom}
            onSelect={setSelectedFrom}
          />
        </Form.Group>

        <Form.Group>
          <StationAutocomplete
            label="To"
            placeholder="Destination station"
            value={toQuery}
            onChange={setToQuery}
            selected={selectedTo}
            onSelect={setSelectedTo}
          />
        </Form.Group>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>Save Commute</Button>
      </Modal.Footer>
    </Modal>
  );
}

import { useState } from 'react';
import { Card, Button, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import StationAutocomplete from './StationAutocomplete';
import '../css/QuickSearch.css';

export default function QuickSearch() {
  const navigate = useNavigate();

  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery]     = useState('');
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [selectedTo, setSelectedTo]     = useState(null);

  const handleSwap = () => {
    setSelectedFrom(selectedTo);
    setSelectedTo(selectedFrom);
    setFromQuery(toQuery);
    setToQuery(fromQuery);
  };

  const handleSearch = () => {
    if (!selectedFrom || !selectedTo) return;
    navigate(
      `/plan?from=${selectedFrom.id}&to=${selectedTo.id}` +
      `&fromName=${encodeURIComponent(selectedFrom.name)}` +
      `&toName=${encodeURIComponent(selectedTo.name)}`
    );
  };

  return (
    <Card className="quick-search-card">
      <Card.Header>
        <h5 className="m-0">Quick Search</h5>
      </Card.Header>
      <Card.Body className="p-3">
        <Row className="g-3">

          <Col xs={12} md={5}>
            <StationAutocomplete
              label="From"
              placeholder="Origin station"
              value={fromQuery}
              onChange={setFromQuery}
              selected={selectedFrom}
              onSelect={setSelectedFrom}
            />
          </Col>

          <Col xs={12} md={2} className="d-flex align-items-end justify-content-center">
            <Button variant="outline-primary" className="swap-btn" onClick={handleSwap}>⇄</Button>
          </Col>

          <Col xs={12} md={5}>
            <StationAutocomplete
              label="To"
              placeholder="Destination station"
              value={toQuery}
              onChange={setToQuery}
              selected={selectedTo}
              onSelect={setSelectedTo}
            />
          </Col>

          <Col xs={12}>
            <Button variant="primary" className="btn-lg" onClick={handleSearch}>
              Search Connections
            </Button>
          </Col>

        </Row>
      </Card.Body>
    </Card>
  );
}

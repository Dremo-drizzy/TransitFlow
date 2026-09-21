import { Card, Button, Row, Col, Form, Spinner } from 'react-bootstrap';
import StationAutocomplete from './StationAutocomplete';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../utils/transportUtils';
import '../css/SearchForm.css';

export default function SearchForm({
  fromQuery, setFromQuery,
  toQuery,   setToQuery,
  selectedFrom, setSelectedFrom,
  selectedTo,   setSelectedTo,
  departure, setDeparture,
  onSearch, onSwap,
  isLoading,
}) {
  return (
    <Card className="search-form-card">
      <Card.Body>
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

          <Col xs={12} md={2} className="swap-col">
            <Button variant="outline-primary" onClick={onSwap}>⇄</Button>
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

          <Col xs={12} md={6}>
            <Form.Label>Departure</Form.Label>
            <Form.Control
              type="datetime-local"
              value={toDatetimeLocalValue(departure)}
              onChange={(e) => {
                const iso = fromDatetimeLocalValue(e.target.value);
                if (iso) setDeparture(iso);
              }}
            />
          </Col>

          <Col xs={12}>
            <Button
              variant="primary"
              className="btn-lg"
              onClick={onSearch}
              disabled={isLoading}
            >
              {isLoading ? <Spinner size="sm" /> : 'Search Journeys'}
            </Button>
          </Col>

        </Row>
      </Card.Body>
    </Card>
  );
}

import { Card, Button, Row, Col, Form, ListGroup, Spinner } from 'react-bootstrap';
import { useLocations } from '../hooks/useLocation';
import '../css/SearchForm.css';

export default function SearchForm({
  fromQuery, setFromQuery,
  toQuery,   setToQuery,
  setSelectedFrom,
  setSelectedTo,
  showFrom, setShowFrom,
  showTo,   setShowTo,
  departure, setDeparture,
  onSearch, onSwap,
  isLoading,
}) {
  const { data: fromResults, isLoading: fromLoading } = useLocations(fromQuery);
  const { data: toResults,   isLoading: toLoading }   = useLocations(toQuery);

  return (
    <Card className="search-form-card">
      <Card.Body>
        <Row className="g-3">

          <Col xs={12} md={5}>
            <Form.Label>From</Form.Label>
            <div className="input-wrapper">
              <Form.Control
                placeholder="Origin station"
                value={fromQuery}
                onChange={(e) => {
                  setFromQuery(e.target.value);
                  setShowFrom(true);
                  setSelectedFrom(null);
                }}
                autoComplete="off"
              />
              {fromLoading && <Spinner size="sm" className="mt-1" />}
              {showFrom && fromResults?.length > 0 && (
                <ListGroup className="suggestions-list">
                  {fromResults.map((loc) => (
                    <ListGroup.Item key={loc.id} action
                      onClick={() => {
                        setSelectedFrom(loc);
                        setFromQuery(loc.name);
                        setShowFrom(false);
                      }}
                    >
                      {loc.name}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
          </Col>

          <Col xs={12} md={2} className="swap-col">
            <Button variant="outline-primary" onClick={onSwap}>⇄</Button>
          </Col>

          <Col xs={12} md={5}>
            <Form.Label>To</Form.Label>
            <div className="input-wrapper">
              <Form.Control
                placeholder="Destination station"
                value={toQuery}
                onChange={(e) => {
                  setToQuery(e.target.value);
                  setShowTo(true);
                  setSelectedTo(null);
                }}
                autoComplete="off"
              />
              {toLoading && <Spinner size="sm" className="mt-1" />}
              {showTo && toResults?.length > 0 && (
                <ListGroup className="suggestions-list">
                  {toResults.map((loc) => (
                    <ListGroup.Item key={loc.id} action
                      onClick={() => {
                        setSelectedTo(loc);
                        setToQuery(loc.name);
                        setShowTo(false);
                      }}
                    >
                      {loc.name}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
          </Col>

          <Col xs={12} md={6}>
            <Form.Label>Departure</Form.Label>
            <Form.Control
              type="datetime-local"
              value={departure.slice(0, 16)}
              onChange={(e) => setDeparture(new Date(e.target.value).toISOString())}
            />
          </Col>

          <Col xs={12}>
            <Button
              variant="primary"
              className="btn-lg border-0"
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
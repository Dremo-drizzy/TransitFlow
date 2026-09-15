import { Container } from 'react-bootstrap';

export default function About() {
  return (
    <Container fluid="lg" className="py-5">
      <h2>About TransitFlow</h2>
      <p className="text-muted">
        TransitFlow is a German public transit journey planner built on the
        public transport.rest API (v6.db.transport.rest).
      </p>
    </Container>
  );
}

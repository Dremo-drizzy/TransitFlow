import { Link } from 'react-router-dom';
import { Container } from 'react-bootstrap';

export default function NotFound() {
  return (
    <Container fluid="lg" className="py-5 text-center">
      <h2>Page not found</h2>
      <p className="text-muted">That page doesn't exist yet.</p>
      <Link to="/">Back home</Link>
    </Container>
  );
}

import { Link } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import '../css/Footer.css';

export default function Footer() {
  return (
    <footer className="footer-custom mt-auto text-center">
      <Container fluid="lg">
        <small className="d-block">All times are German time (Europe/Berlin)</small>
        <small>
          Data:{' '}
          <a href="https://transitous.org/sources/" target="_blank" rel="noopener noreferrer">
            Transitous
          </a>
          {' · © '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap contributors
          </a>
          {' · '}
          <a href="https://github.com/Dremo-drizzy/German-Api-project" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {' · '}
          <Link to="/about">About</Link>
        </small>
      </Container>
    </footer>
  );
}
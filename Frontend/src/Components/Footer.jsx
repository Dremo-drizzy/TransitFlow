import { Link } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import '../css/Footer.css';

export default function Footer() {
  return (
    <footer className="footer-custom mt-auto text-center">
      <Container fluid="lg">
        <small>
          Powered by{' '}
          <a href="https://transport.rest" target="_blank" rel="noopener noreferrer">
            transport.rest
          </a>
          {' · DB & partners · '}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {' · '}
          <Link to="/about">About</Link>
        </small>
      </Container>
    </footer>
  );
}
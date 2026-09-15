import { Component } from 'react';
import { Container, Button } from 'react-bootstrap';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container fluid="lg" className="py-5 text-center">
          <h2>Something went wrong.</h2>
          <p className="text-muted">This page hit an error. Try refreshing.</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Container>
      );
    }
    return this.props.children;
  }
}

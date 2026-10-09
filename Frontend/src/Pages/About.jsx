import { Container } from 'react-bootstrap';

export default function About() {
  return (
    <Container fluid="lg" className="py-5">
      <h2>About TransitFlow</h2>
      <p className="text-muted">
        TransitFlow is a German public transit journey planner. Timetables,
        departures and routes come from{' '}
        <a href="https://transitous.org/sources/" target="_blank" rel="noopener noreferrer">
          Transitous
        </a>
        , an open public-transport data service; map data is © OpenStreetMap
        contributors. Real-time predictions aren&apos;t available from all
        operators, so many departures — buses and trams especially — show
        their scheduled time only.
      </p>
    </Container>
  );
}

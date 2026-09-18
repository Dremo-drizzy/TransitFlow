import { motion } from 'framer-motion';
import { Container } from 'react-bootstrap';
import Hero from '../Components/Hero';
import QuickSearch from '../Components/QuickSearch';
import LiveDeparturesPreview from '../Components/LiveDeparturesPreview';
import '../css/Home.css';

export default function Home() {
  return (
    <motion.div
      className="home-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      <Container fluid="lg">
        <Hero
          eyebrow="Live Transit Updates"
          subtitle="Real-time departures, smart journey planning, and saved commutes — all in one place."
          chips={['Live', 'DB Network', 'Real-time']}
        >
          Your city,<br />
          <span>on schedule.</span>
        </Hero>
        <QuickSearch />
        <LiveDeparturesPreview />
      </Container>
    </motion.div>
  );
}
import { useState, useEffect } from 'react';
import { Container, Button, Spinner } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useJourneys } from '../hooks/useJourneys';
import SearchForm from '../Components/Searchform';
import JourneyCard from '../Components/JourneyCard';
import '../css/PlanJourney.css';

export default function PlanJourney() {
  const [searchParams] = useSearchParams();

  const [fromQuery, setFromQuery] = useState('');
  const [toQuery,   setToQuery]   = useState('');
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [selectedTo,   setSelectedTo]   = useState(null);
  const [showFrom, setShowFrom] = useState(false);
  const [showTo,   setShowTo]   = useState(false);
  const [departure, setDeparture] = useState(new Date().toISOString());
  const [searchTriggered, setSearchTriggered] = useState(0);

  useEffect(() => {
    const from     = searchParams.get('from');
    const to       = searchParams.get('to');
    const fromName = searchParams.get('fromName');
    const toName   = searchParams.get('toName');

    if (from && to) {
      setSelectedFrom({ id: from, name: decodeURIComponent(fromName || '') });
      setSelectedTo({ id: to, name: decodeURIComponent(toName || '') });
      setFromQuery(decodeURIComponent(fromName || ''));
      setToQuery(decodeURIComponent(toName || ''));
      setSearchTriggered(1);
    }
  }, []);

  const params = {
    from: selectedFrom?.id || fromQuery,
    to:   selectedTo?.id   || toQuery,
    departure,
  };

  const { data, isLoading, error, refetch } = useJourneys(params, searchTriggered);

  const handleSearch = () => {
    if (!fromQuery && !selectedFrom) return;
    if (!toQuery   && !selectedTo)   return;
    setSearchTriggered((n) => n + 1);
    refetch();
  };

  const handleSwap = () => {
    setSelectedFrom(selectedTo);
    setSelectedTo(selectedFrom);
    setFromQuery(toQuery);
    setToQuery(fromQuery);
  };

  const journeys = data?.journeys || [];

  return (
    <motion.div
      className="plan-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      <Container fluid="lg">
        <div className="plan-page-header">
          <h2 className='fs-1'>Find Your Route</h2>
          <p className="text-muted">
            Search connections across the entire DB network.
          </p>
        </div>

        <SearchForm
          fromQuery={fromQuery}     setFromQuery={setFromQuery}
          toQuery={toQuery}         setToQuery={setToQuery}
          selectedFrom={selectedFrom} setSelectedFrom={setSelectedFrom}
          selectedTo={selectedTo}     setSelectedTo={setSelectedTo}
          showFrom={showFrom}       setShowFrom={setShowFrom}
          showTo={showTo}           setShowTo={setShowTo}
          departure={departure}     setDeparture={setDeparture}
          onSearch={handleSearch}
          onSwap={handleSwap}
          isLoading={isLoading}
        />

        <div className="results-header mt-5 mb-3">
          <h4 className='fs-5'>Available Connections</h4>
          <Button
          className='refresh border-1'
           size='sm'
            onClick={() => { setSearchTriggered((n) => n + 1); refetch(); }}
          >
            Refresh
          </Button>
        </div>

        {error && <p className="text-muted">Could not load journeys. Please try again.</p>}

        {isLoading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        ) : journeys.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🗺️</span>
            <p>Search for a journey to see connections.</p>
          </div>
        ) : (
          journeys.map((journey, i) => (
            <JourneyCard key={journey.refreshToken || i} journey={journey} index={i} />
          ))
        )}
      </Container>
    </motion.div>
  );
}
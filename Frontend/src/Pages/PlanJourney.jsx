import { useState } from 'react';
import { Container, Button } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useJourneys } from '../hooks/useJourneys';
import SearchForm from '../Components/Searchform';
import JourneyCard from '../Components/JourneyCard';
import '../css/PlanJourney.css';

// searchParams.get() already URL-decodes — a second decodeURIComponent() is
// a double decode that throws URIError on a stray '%' in a station name.
function stationFromParams(searchParams, idKey, nameKey) {
  const id = searchParams.get(idKey);
  if (!id) return null;
  return { id, name: searchParams.get(nameKey) || '' };
}

export default function PlanJourney() {
  // App.jsx keys this component by location.search, so navigating to /plan
  // with new query params (e.g. from Commutes or QuickSearch) remounts it —
  // these lazy initializers re-run instead of needing an effect + setState
  // to re-sync stale state.
  const [searchParams] = useSearchParams();

  const [selectedFrom, setSelectedFrom] = useState(() => stationFromParams(searchParams, 'from', 'fromName'));
  const [selectedTo,   setSelectedTo]   = useState(() => stationFromParams(searchParams, 'to', 'toName'));
  const [fromQuery, setFromQuery] = useState(() => selectedFrom?.name || '');
  const [toQuery,   setToQuery]   = useState(() => selectedTo?.name || '');
  const [departure, setDeparture] = useState(() => new Date().toISOString());
  const [searchTriggered, setSearchTriggered] = useState(() => (selectedFrom && selectedTo) ? 1 : 0);

  const params = {
    // Gate strictly on a selected station's id — falling back to raw typed
    // text meant every keystroke (once both boxes had text) sent a
    // half-typed ?from=be&to=mu upstream and 400'd.
    from: selectedFrom?.id,
    to:   selectedTo?.id,
    departure,
  };

  const { data, isLoading, error } = useJourneys(params, searchTriggered);

  const handleSearch = () => {
    if (!selectedFrom?.id || !selectedTo?.id) return;
    // Bumping searchTriggered already changes the query key and refetches —
    // calling refetch() too was firing the request twice per click.
    setSearchTriggered((n) => n + 1);
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
          departure={departure}     setDeparture={setDeparture}
          onSearch={handleSearch}
          onSwap={handleSwap}
          isLoading={isLoading}
        />

        <div className="results-header mt-5">
          <span className="section-label">Available Connections</span>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setSearchTriggered((n) => n + 1)}
          >
            Refresh
          </Button>
        </div>

        {error && <p className="text-muted">Could not load journeys. Please try again.</p>}

        {isLoading ? (
          <div className="journey-skeleton-list">
            {[0, 1, 2].map((i) => (
              <div className="journey-skeleton-card" key={i}>
                <div className="skeleton-block" style={{ width: '55%', height: '0.95rem' }} />
                <div className="skeleton-block" style={{ width: '35%', height: '0.75rem', marginTop: '0.5rem' }} />
                <div className="skeleton-block" style={{ width: '100%', height: '2.5rem', marginTop: '0.85rem' }} />
              </div>
            ))}
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
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { format } from 'date-fns';
import { useNow } from '../hooks/useNow';
import FlapTime from '../Components/FlapTime';
import DepartureBoard from '../Components/DepartureBoard';
import '../css/Departures.css';

// Chip label -> the boolean query param the DB API (and the proxy's
// allowlist) actually accepts.
const PRODUCT_FILTERS = [
  { key: 'nationalExpress', label: 'ICE' },
  { key: 'national', label: 'IC/EC' },
  { key: 'regionalExpress', label: 'RE' },
  { key: 'regional', label: 'RB' },
  { key: 'suburban', label: 'S' },
  { key: 'subway', label: 'U' },
  { key: 'tram', label: 'Tram' },
  { key: 'bus', label: 'Bus' },
  { key: 'ferry', label: 'Ferry' },
];

export default function Departures() {
  const { stopId } = useParams();
  const [searchParams] = useSearchParams();
  const stationName = searchParams.get('name') || stopId;

  const now = useNow(1000);
  const [activeFilters, setActiveFilters] = useState(() => new Set());

  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // No chips active means no filtering at all — the API only excludes a
  // product when its param is explicitly false, so an active selection
  // means "exclude everything not selected", not "include only these".
  const filters = {};
  if (activeFilters.size > 0) {
    for (const { key } of PRODUCT_FILTERS) {
      if (!activeFilters.has(key)) filters[key] = false;
    }
  }

  return (
    <Container fluid="lg" className="departures-page py-4">
      <div className="departures-header">
        <h1 className="departures-station-name">{stationName}</h1>
        <FlapTime value={format(now, 'HH:mm')} size="lg" />
      </div>

      <div className="departures-filters" role="group" aria-label="Filter by transport type">
        {PRODUCT_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`filter-chip${activeFilters.has(key) ? ' filter-chip-active' : ''}`}
            aria-pressed={activeFilters.has(key)}
            onClick={() => toggleFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <DepartureBoard stopId={stopId} filters={filters} />
    </Container>
  );
}

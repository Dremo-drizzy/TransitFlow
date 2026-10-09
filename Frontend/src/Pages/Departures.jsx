import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { format } from 'date-fns';
import { useNow } from '../hooks/useNow';
import FlapTime from '../Components/FlapTime';
import DepartureBoard from '../Components/DepartureBoard';
import { useResolvedStation } from '../hooks/useResolvedStation';
import { isLegacyStopId } from '../utils/stations';
import '../css/Departures.css';

// Chip label -> the boolean query param the proxy accepts (a product is
// excluded when its param is sent as false).
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
  { key: 'taxi', label: 'Taxi' },
];

export default function Departures() {
  const { stopId: idParam } = useParams();
  const [searchParams] = useSearchParams();
  const nameParam = searchParams.get('name');

  // An all-digits id is from the old data source (a bookmarked or shared
  // link) and the current one rejects it. If the link carries a station
  // name, look the station up by that; if not, there's nothing to go on.
  const legacy = isLegacyStopId(idParam);
  const resolved = useResolvedStation(nameParam ? { name: nameParam } : null, legacy);
  const stopId = legacy ? resolved.data?.id : idParam;
  const lookupFailed = legacy && (!nameParam || resolved.isError || (resolved.isSuccess && !resolved.data));
  const stationName = nameParam || resolved.data?.name || 'Departures';

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
  // Memoized so the ticking clock's re-render every second doesn't hand
  // DepartureBoard a new object identity it has no way to tell apart from
  // an actual filter change — that would defeat the memoization below.
  const filters = useMemo(() => {
    const next = {};
    if (activeFilters.size > 0) {
      for (const { key } of PRODUCT_FILTERS) {
        if (!activeFilters.has(key)) next[key] = false;
      }
    }
    return next;
  }, [activeFilters]);

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

      {stopId ? (
        <DepartureBoard stopId={stopId} filters={filters} />
      ) : (
        <div className="departures-lookup" role="status">
          {lookupFailed ? (
            <>
              <p className="departures-lookup-text">STATION NOT FOUND</p>
              <p className="departures-lookup-hint">
                This link uses a station id from before the data source changed, and no station name came with it.{' '}
                <Link to="/">Back home</Link>
              </p>
            </>
          ) : (
            <p className="departures-lookup-text">LOOKING UP STATION…</p>
          )}
        </div>
      )}
    </Container>
  );
}

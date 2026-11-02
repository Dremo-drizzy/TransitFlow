import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { useNow } from '../hooks/useNow';
import { formatTime, PRODUCT_FILTERS, productFilterParams } from '../utils/transportUtils';
import FlapTime from '../Components/FlapTime';
import DepartureBoard from '../Components/DepartureBoard';
import { useResolvedStation } from '../hooks/useResolvedStation';
import { isLegacyStopId } from '../utils/stations';
import '../css/Departures.css';

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
  const filters = useMemo(() => productFilterParams(activeFilters), [activeFilters]);

  return (
    <Container fluid="lg" className="departures-page py-4">
      <div className="departures-header">
        <h1 className="departures-station-name">{stationName}</h1>
        <FlapTime value={formatTime(now)} size="lg" />
      </div>

      <div className="departures-filters" role="group" aria-label="Filter by transport type">
        {PRODUCT_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`filter-chip${activeFilters.has(id) ? ' filter-chip-active' : ''}`}
            aria-pressed={activeFilters.has(id)}
            onClick={() => toggleFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {stopId ? (
        <DepartureBoard stopId={stopId} filters={filters} stationName={stationName} />
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

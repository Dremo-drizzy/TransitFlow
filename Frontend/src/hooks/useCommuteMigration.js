import { useQueries } from '@tanstack/react-query';
import { resolveStation } from '../apis/api';
import { applyResolutions, legacyStations } from '../utils/stations';

/**
 * Saved commutes hold station ids from the old data source (EVA numbers),
 * which the current one rejects. This looks each such station up by name —
 * unconditionally, since the old ids still look perfectly valid — and
 * returns the commutes with those stations swapped for the resolved ones.
 *
 * Each returned commute has a `status`: 'ok', 'resolving' (lookup in
 * flight) or 'unresolved' (no match — the commute stays visible, flagged for
 * the user to re-select). `persistable` is the list to write back to storage
 * once something has been resolved, so each station is only ever looked up
 * once.
 */
export function useCommuteMigration(stored) {
  const legacy = legacyStations(stored);

  const lookups = useQueries({
    queries: legacy.map((station) => ({
      queryKey: ['commuteStation', station.id, station.name],
      queryFn: () => resolveStation(station),
      staleTime: Infinity,
      retry: 1,
    })),
  });

  const resolutions = {};
  legacy.forEach((station, i) => {
    const q = lookups[i];
    if (q.isSuccess) {
      resolutions[station.id] = q.data ? { status: 'ok', station: q.data } : { status: 'error' };
    } else if (q.isError) {
      resolutions[station.id] = { status: 'error' };
    } else {
      resolutions[station.id] = { status: 'loading' };
    }
  });

  return applyResolutions(stored, resolutions);
}

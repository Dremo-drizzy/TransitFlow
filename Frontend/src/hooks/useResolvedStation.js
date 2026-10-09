import { useQuery } from '@tanstack/react-query';
import { resolveStation } from '../apis/api';
import { coordsOf } from '../utils/stations';

/**
 * Looks a place up by name (and coordinates, when it has them) and returns
 * the matching station — `{ id, name, location }` — or null when nothing
 * plausible matched. Used for the default Berlin Hbf, the "nearest major
 * station" result, and legacy /departures/:id links, none of which can rely
 * on a hard-coded station id any more.
 */
export const useResolvedStation = (place, enabled = true) => {
  const coords = coordsOf(place);
  return useQuery({
    queryKey: ['resolvedStation', place?.name, coords?.lat, coords?.lon],
    queryFn: () => resolveStation(place),
    enabled: enabled && !!place?.name,
    // A station's id only changes with a new dataset year; an hour is plenty.
    staleTime: 60 * 60 * 1000,
  });
};

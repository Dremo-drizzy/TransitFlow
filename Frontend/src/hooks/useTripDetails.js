import { useQuery } from '@tanstack/react-query';
import { getTripDetails } from '../apis/api';

export const useTripDetails = (tripId, lineName = '', enabled = true) => {
  return useQuery({
    queryKey: ['tripDetails', tripId, lineName],
    queryFn: () => getTripDetails(tripId),
    enabled: enabled && !!tripId,
    staleTime: 60000,
    // The page is a live view: without a refresh, delays and platforms stayed
    // as they were at load while the marker kept moving on the clock. Once a
    // minute, and only while someone is looking at the tab — the same rule
    // as the departures board.
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
};

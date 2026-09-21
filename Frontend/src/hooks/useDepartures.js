import { useQuery } from '@tanstack/react-query';
import { getDepartures } from '../apis/api';

export const useDepartures = (stopId, options = {}) => {
    return useQuery({
        queryKey: ['departures', stopId, options],
        queryFn: () => getDepartures(stopId, options),
        enabled: !!stopId,
        staleTime: 30000,
        refetchInterval: 30000,
        // A backgrounded tab has no reason to keep polling live departures
        // every 30s — that's rate-limit budget spent on a tab nobody's
        // looking at.
        refetchIntervalInBackground: false,
    });
}
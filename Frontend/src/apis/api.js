const BASE_URL = 'https://German-Api-project.onrender.com/api';
const USER_AGENT = 'TransitFlowAustria/1.0';

async function fetchFromApi(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++){
        try{
            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT
                }
            })
            if (response.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); 
                continue; 
            }
            if (!response.ok){
                throw new Error(`API request failed with status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            if (attempt === retries - 1) {
                throw error;
            }
        }
    }
}

export const searchLocations = async (query) => {
    if (!query || query.length < 2) return [];
    const params = new URLSearchParams({ query, fuzzy: 'true', results: '10'});
    const url = `${BASE_URL}/locations?${params}`;
    return await fetchFromApi(url);
}

export const getNearbyStops = async (lat, lon, distance = 1000) => {
    const params = new URLSearchParams({ latitude: lat.toString(), longitude: lon.toString(), distance: distance.toString(), results: '20' });
    const url = `${BASE_URL}/locations/nearby?${params}`;
    return await fetchFromApi(url);
}

export const getStopDetails = async (stopId) => {
  if (!stopId) return null;
  const url = `${BASE_URL}/stops/${stopId}`;
  return await fetchFromApi(url);
};

export const getDepartures = async (stopId, options = { duration: 60 }) => {
  if (!stopId) return [];
  const params = new URLSearchParams({ duration: options.duration.toString() });
  if (options.when) params.append('when', options.when);
  const url = `${BASE_URL}/stops/${stopId}/departures?${params}`;
  return await fetchFromApi(url);
};

export const getJourneys = async (params) => {
  if (!params.from || !params.to) return { journeys: [] };
  const queryParams = new URLSearchParams({
    from: params.from, 
    to: params.to,
    results: '5'
  });
  if (params.departure) queryParams.append('departure', params.departure);
  if (params.transfers !== undefined) queryParams.append('transfers', params.transfers);
  if (params.accessibility) queryParams.append('accessibility', 'partial');
  const url = `${BASE_URL}/journeys?${queryParams}`;
  return await fetchFromApi(url);
};

export const getTripDetails = async (tripId) => {
  if (!tripId) return null;
  const url = `${BASE_URL}/trips/${tripId}`;
  return await fetchFromApi(url);
};

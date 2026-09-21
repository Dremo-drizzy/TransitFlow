const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const REQUEST_TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff with jitter: ~1s, ~2s, ~4s (plus up to 50% extra,
// randomised), so retrying clients don't all hammer the upstream in lockstep.
function backoffDelayMs(attempt) {
  const base = 1000 * 2 ** (attempt - 1);
  return base + Math.random() * base * 0.5;
}

// The proxy answers errors with a JSON body like { error: "..." } (rate
// limited, CORS-rejected, upstream timeout, etc). Surface that message
// instead of a generic "status 429" — it's the difference between a user
// seeing "Too many requests, slow down" and just "something went wrong".
async function errorFromResponse(response) {
  let message = `API request failed with status ${response.status}`;
  try {
    const body = await response.json();
    if (body?.error) message = body.error;
  } catch {
    // Non-JSON error body (e.g. an HTML error page) — keep the generic message.
  }
  const error = new Error(message);
  // The message alone isn't a reliable way to detect a 429 — our own proxy's
  // rate limiter and a passed-through upstream 429 use different wording.
  // Attach the real status so callers (e.g. the departures board) can check
  // error.status === 429 instead of pattern-matching text.
  error.status = response.status;
  return error;
}

async function fetchFromApi(url, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const isLastAttempt = attempt === retries;

    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      // Network error, timeout, or abort — worth retrying.
      lastError = error;
      if (isLastAttempt) throw lastError;
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    if (response.ok) {
      return await response.json();
    }

    const isNon429ClientError = response.status >= 400 && response.status < 500 && response.status !== 429;
    if (isNon429ClientError) {
      // A 404/400/etc won't fix itself on retry — fail fast.
      throw await errorFromResponse(response);
    }

    // 429 (rate limited) or a 5xx — worth retrying.
    lastError = await errorFromResponse(response);
    if (isLastAttempt) throw lastError;
    await sleep(backoffDelayMs(attempt));
  }

  // Unreachable in practice (every branch above returns or throws), but
  // guarantees fetchFromApi() can never silently resolve to undefined.
  throw lastError;
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

// Boolean product-type filters the proxy allowlists and forwards upstream.
// Omitted entirely means "show everything"; the DB API only excludes a
// product when its param is explicitly sent as false.
const PRODUCT_FILTER_KEYS = [
  'nationalExpress', 'national', 'regionalExpress', 'regional',
  'suburban', 'subway', 'tram', 'bus', 'ferry',
];

export const getDepartures = async (stopId, options = { duration: 60 }) => {
  if (!stopId) return [];
  const params = new URLSearchParams({ duration: options.duration.toString() });
  if (options.when) params.append('when', options.when);
  for (const key of PRODUCT_FILTER_KEYS) {
    if (options[key] === false) params.append(key, 'false');
  }
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

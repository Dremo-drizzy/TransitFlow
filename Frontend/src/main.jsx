import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './css/theme.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The upstream API rate-limits per client IP (see README) — refetching
      // on every window focus is exactly the kind of thing that trips it for
      // everyone sharing that IP, not just the one user who alt-tabbed back.
      refetchOnWindowFocus: false,
      // api.js's own fetchFromApi already retries each request up to 3 times
      // with backoff before it ever throws — a query-level retry on top of
      // that compounds fast. One extra retry here is enough headroom for a
      // genuinely transient failure without multiplying the whole backoff
      // sequence needlessly.
      retry: 1,
      // Queries that need a different cadence (useDepartures' live polling,
      // useTripDetails' 60s cache) already set their own staleTime/
      // refetchInterval, which overrides this baseline.
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
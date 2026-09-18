import { useEffect, useState } from 'react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// The backend mounts /health at its own root, not under /api. In dev, BASE_URL
// is the relative '/api' (proxied by Vite), so /health is also relative and
// proxied the same way. In production, BASE_URL is an absolute URL like
// https://backend.onrender.com/api — /health has to be resolved against that
// same origin, not the frontend's own, or it 404s against the wrong server.
const HEALTH_URL = /^https?:\/\//.test(BASE_URL)
  ? BASE_URL.replace(/\/api\/?$/, '') + '/health'
  : '/health';

// Render's free tier spins the backend down after ~15 minutes idle, and the
// first request back can take close to a minute. Ping /health on mount so the
// app can say "waking the server up" instead of a spinner that looks broken.
export const useServerWake = ({ timeoutMs = 3000 } = {}) => {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) setWaking(true);
    }, timeoutMs);

    fetch(HEALTH_URL)
      .catch(() => {})
      .finally(() => {
        settled = true;
        clearTimeout(timer);
        setWaking(false);
      });

    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [timeoutMs]);

  return waking;
};

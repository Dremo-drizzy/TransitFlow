import { useEffect, useState } from 'react';

// A ticking clock: re-renders every `intervalMs` with the current time.
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};

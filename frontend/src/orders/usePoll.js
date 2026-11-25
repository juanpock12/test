import { useEffect, useRef } from 'react';

// Calls fn now and then every `ms` milliseconds (simple live updates).
// Proposed architecture: WebSockets instead of polling.
export function usePoll(fn, ms, deps = []) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    let stopped = false;
    const tick = () => !stopped && saved.current();
    tick();
    const t = setInterval(tick, ms);
    return () => {
      stopped = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}

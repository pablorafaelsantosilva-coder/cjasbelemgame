// One clock per cadence, shared by every counter on the page.
// Hidden tabs and clocks with no subscribers do not keep timers running.
export function createClock(intervalMs: number) {
  let value = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();
  const tick = () => {
    value = Date.now();
    for (const listener of listeners) listener();
  };
  const sync = () => {
    clearInterval(timer);
    timer = undefined;
    if (listeners.size && typeof document !== "undefined" && !document.hidden) {
      tick();
      timer = setInterval(tick, intervalMs);
    }
  };
  return {
    getSnapshot: () => value,
    getServerSnapshot: () => 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", sync);
        sync();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearInterval(timer);
          timer = undefined;
          document.removeEventListener("visibilitychange", sync);
        }
      };
    },
  };
}

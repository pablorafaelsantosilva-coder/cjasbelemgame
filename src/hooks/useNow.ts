import { useSyncExternalStore } from "react";
import { createClock } from "@/lib/clock-store";

const clocks = new Map<number, ReturnType<typeof createClock>>();
export function useNow(intervalMs = 30_000) {
  let clock = clocks.get(intervalMs);
  if (!clock) {
    clock = createClock(intervalMs);
    clocks.set(intervalMs, clock);
  }
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
}

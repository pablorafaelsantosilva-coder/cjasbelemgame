import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../src/lib/clock-store.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { createClock } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const original = { setInterval, clearInterval, now: Date.now, document: globalThis.document };
let now = 1000,
  sequence = 0;
const timers = new Map();
const page = new EventTarget();
page.hidden = false;
globalThis.document = page;
globalThis.setInterval = (fn) => {
  const id = ++sequence;
  timers.set(id, fn);
  return id;
};
globalThis.clearInterval = (id) => timers.delete(id);
Date.now = () => now;
try {
  const clock = createClock(1000);
  let updates = 0;
  const stops = Array.from({ length: 20 }, () => clock.subscribe(() => updates++));
  assert.equal(timers.size, 1, "Twenty counters share one timer");
  now = 2000;
  const before = updates;
  [...timers.values()][0]();
  assert.equal(updates - before, 20);
  assert.equal(clock.getSnapshot(), 2000);
  page.hidden = true;
  page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(timers.size, 0, "Hidden page has no timer");
  now = 9000;
  page.hidden = false;
  page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(clock.getSnapshot(), 9000, "Visible page catches up without accumulated ticks");
  assert.equal(timers.size, 1);
  stops.forEach((stop) => stop());
  assert.equal(timers.size, 0, "Unmount removes the final timer");
  const stop = clock.subscribe(() => {});
  assert.equal(timers.size, 1, "Remount starts exactly one timer");
  stop();
  console.log("PASS shared clock: 20 consumers, hidden tab, catch-up, cleanup and remount");
} finally {
  globalThis.setInterval = original.setInterval;
  globalThis.clearInterval = original.clearInterval;
  Date.now = original.now;
  if (original.document === undefined) delete globalThis.document;
  else globalThis.document = original.document;
}

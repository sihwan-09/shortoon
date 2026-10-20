import assert from "node:assert/strict";
import test from "node:test";
import { getHighlightDayWindow } from "../lib/highlight-time.ts";

test("Korean midnight starts a new 24-hour highlight window", () => {
  const before = getHighlightDayWindow(new Date("2026-10-19T14:59:59.999Z"));
  const after = getHighlightDayWindow(new Date("2026-10-19T15:00:00.000Z"));
  assert.equal(before.start.toISOString(), "2026-10-18T15:00:00.000Z");
  assert.equal(before.end.toISOString(), "2026-10-19T15:00:00.000Z");
  assert.equal(after.start.toISOString(), before.end.toISOString());
  assert.equal(after.end.toISOString(), "2026-10-20T15:00:00.000Z");
  assert.equal(after.end - after.start, 24 * 60 * 60 * 1000);
});

test("window handles a year boundary without using the host timezone", () => {
  const window = getHighlightDayWindow(new Date("2027-01-01T00:30:00+09:00"));
  assert.equal(window.start.toISOString(), "2026-12-31T15:00:00.000Z");
  assert.equal(window.end.toISOString(), "2027-01-01T15:00:00.000Z");
});

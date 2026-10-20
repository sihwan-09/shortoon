const DAY_MS = 24 * 60 * 60 * 1000;
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getHighlightDayWindow(now = new Date()) {
  const start = Math.floor((now.getTime() + KOREA_OFFSET_MS) / DAY_MS) * DAY_MS - KOREA_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + DAY_MS) };
}

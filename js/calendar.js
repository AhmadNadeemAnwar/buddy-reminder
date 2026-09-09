// Pure helpers for dates and recurrence — no DOM, no state. Started as
// just the month-grid's helpers; also the shared home for the day-math
// used across app.js/parse.js/insights.js, so there's one definition of
// "what day is this" and "how do you say this interval" instead of three.

const DAY_MS = 86400000;

export function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);
}

export function addDays(d, n) {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}

// "every day" / "every week" / "every 2 weeks" / "every month" for the
// common cases, falling back to a plain day or week count otherwise.
export function repeatLabel(intervalDays) {
  if (!intervalDays) return "";
  if (intervalDays === 1) return "every day";
  if (intervalDays === 7) return "every week";
  if (intervalDays === 14) return "every 2 weeks";
  if (intervalDays === 30) return "every month";
  if (intervalDays % 7 === 0) return `every ${intervalDays / 7} weeks`;
  return `every ${intervalDays} days`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dateKey(d) {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function sameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

export function itemsByDay(items) {
  const map = new Map();
  for (const it of items) {
    if (!it.dueAt || it.parentId) continue;
    const key = dateKey(it.dueAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return map;
}

export function isToday(date) {
  return sameDay(date, new Date());
}

// The 7 dates (Sun-Sat, same first-day convention as monthMatrix) of the
// week containing `anchor`.
export function weekDates(anchor) {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  return days;
}

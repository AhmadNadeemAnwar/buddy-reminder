// Pure helpers for the month-grid calendar view. No DOM, no state —
// app.js renders whatever this returns.

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dateKey(d) {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function sameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

// Returns an array of week-rows, each an array of 7 { date, inMonth } cells,
// Sunday-first, always full weeks (padded with adjacent-month days).
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0=Sun
  const gridStart = new Date(year, month, 1 - startOffset);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const weeks = [];
  let cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      row.push({ date: new Date(cursor), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
    // Stop as soon as this row reaches the month's last day — otherwise a
    // month whose last day lands on Saturday gets a trailing all-outside row.
    if (row[6].date >= lastDayOfMonth) break;
  }
  return weeks;
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

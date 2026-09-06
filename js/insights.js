// Buddy Insights — fully deterministic, rule-based, offline. No network,
// no external AI call: just checking recurring items against the interval
// the user told us about.

const GRACE_DAYS = 2;
const STALE_TODO_DAYS = 14;
const DAY_MS = 86400000;

function daysBetween(a, b) {
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db_ = new Date(b);
  db_.setHours(0, 0, 0, 0);
  return Math.round((da - db_) / DAY_MS);
}

function formatInterval(intervalDays) {
  if (intervalDays % 7 === 0) {
    const weeks = intervalDays / 7;
    return `every ${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  return `every ${intervalDays} day${intervalDays === 1 ? "" : "s"}`;
}

// Two things Buddy notices on its own, merged into one sorted list:
//  - a recurring item whose expected next occurrence has passed by more
//    than GRACE_DAYS without being brought back into view (the user's
//    usual pattern was skipped)
//  - a plain to-do (no reminder ever set) that's just been sitting there,
//    untouched, for a while
// Both share the same anchor field (lastRecreatedAt, falling back to
// completedAt/createdAt) — which is also what "Not now" already touches —
// so dismissing either kind naturally suppresses it until it drifts again,
// with no separate cooldown mechanism needed.
export function computeFlags(items, today = new Date()) {
  const recurring = items
    .filter((it) => !it.parentId && it.recurring && it.recurring.intervalDays > 0)
    .map((it) => {
      const anchor = it.lastRecreatedAt || it.completedAt || it.createdAt;
      const expected = new Date(anchor);
      expected.setDate(expected.getDate() + it.recurring.intervalDays);
      const days = daysBetween(today, expected);
      return { kind: "recurring-drift", item: it, days };
    })
    .filter((f) => f.days >= GRACE_DAYS);

  const staleTodos = items
    .filter((it) => !it.parentId && !it.recurring && !it.dueAt && !it.completedAt)
    .map((it) => ({
      kind: "stale-todo",
      item: it,
      days: daysBetween(today, it.lastRecreatedAt || it.createdAt),
    }))
    .filter((f) => f.days >= STALE_TODO_DAYS);

  return recurring.concat(staleTodos).sort((a, b) => b.days - a.days);
}

export function messageFor(flag) {
  const { kind, item, days } = flag;
  if (kind === "stale-todo") {
    return `"${item.title}" has been sitting on your list for ${days} days. Want to give it a moment today, or should I stop mentioning it?`;
  }
  return `You usually take care of "${item.title}" ${formatInterval(
    item.recurring.intervalDays
  )} — it's been ${days} day${days === 1 ? "" : "s"} longer than usual. Forgot this one?`;
}

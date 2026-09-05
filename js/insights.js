// Buddy Insights — fully deterministic, rule-based, offline. No network,
// no external AI call: just checking recurring items against the interval
// the user told us about.

const GRACE_DAYS = 2;
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

// Returns items whose expected next occurrence has passed by more than
// GRACE_DAYS without the item being brought back into view — i.e. the
// user's usual pattern was skipped.
export function computeFlags(items, today = new Date()) {
  return items
    .filter((it) => !it.parentId && it.recurring && it.recurring.intervalDays > 0)
    .map((it) => {
      const anchor = it.lastRecreatedAt || it.completedAt || it.createdAt;
      const expected = new Date(anchor);
      expected.setDate(expected.getDate() + it.recurring.intervalDays);
      const overdueDays = daysBetween(today, expected);
      return { item: it, overdueDays, expected };
    })
    .filter((f) => f.overdueDays >= GRACE_DAYS)
    .sort((a, b) => b.overdueDays - a.overdueDays);
}

export function messageFor(flag) {
  const { item, overdueDays } = flag;
  return `You usually take care of "${item.title}" ${formatInterval(
    item.recurring.intervalDays
  )} — it's been ${overdueDays} day${overdueDays === 1 ? "" : "s"} longer than usual. Forgot this one?`;
}

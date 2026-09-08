// Priority and category — the two optional classification fields a task
// can carry, alongside the reminder it might also carry. Both are just
// tags: nothing in insights.js or the bucket logic reasons about them,
// and a task with neither set behaves exactly as it always has. This is
// the one place their labels/colors/order live, so the composer, the
// detail screen, and the filter sheet can't drift out of sync with each
// other.

// Priority reuses the app's existing three semantic colors rather than
// inventing a fourth meaning for them — high/medium/low maps naturally
// onto terracotta/honey/sage (urgent → calm), so a priority dot reads
// consistently with what those colors already mean elsewhere (overdue,
// due today, a kept habit).
export const PRIORITIES = ["high", "medium", "low"];
export const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };
export const PRIORITY_COLOR = { high: "terracotta", medium: "honey", low: "sage" };
export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }; // for sorting; unset sorts last

// Category needs four distinct colors that don't collide with the
// priority/due-date palette above, so these are fixed swatches rather
// than theme tokens — small dots and pill text, never a large surface,
// so they don't need to be theme-reactive the way backgrounds do.
export const CATEGORIES = ["work", "personal", "health", "other"];
export const CATEGORY_LABEL = { work: "Work", personal: "Personal", health: "Health", other: "Other" };
export const CATEGORY_SWATCH = {
  work: "#3a8f6b",
  personal: "#c2487e",
  health: "#d1584a",
  other: "#8c8580",
};

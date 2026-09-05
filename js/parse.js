// Small heuristic parser: turns typed or spoken text like
// "buy chicken every 2 weeks" or "call mom tomorrow" into a title,
// due date, and recurrence interval. Runs entirely offline.

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

export function parseInput(raw, today = new Date()) {
  let text = raw.trim();
  let intervalDays = null;
  let dueAt = null;
  const base = startOfDay(today);

  // "every friday" — a weekly repeat anchored to that weekday. Checked first,
  // otherwise the weekday matcher below would eat "friday" and strip the
  // recurrence, leaving a stray "every" in the title.
  const everyWeekday = text.match(
    /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
  );
  if (everyWeekday) {
    intervalDays = 7;
    const target = WEEKDAYS.indexOf(everyWeekday[1].toLowerCase());
    const delta = (((target - base.getDay()) % 7) + 7) % 7; // today counts as the next one
    dueAt = addDays(base, delta);
    text = text.replace(everyWeekday[0], "").trim();
  }

  const everyN = !intervalDays && text.match(/\bevery\s+(\d+)\s*(day|days|week|weeks|month|months)\b/i);
  if (everyN) {
    const n = parseInt(everyN[1], 10);
    const unit = everyN[2].toLowerCase();
    intervalDays = unit.startsWith("week") ? n * 7 : unit.startsWith("month") ? n * 30 : n;
    text = text.replace(everyN[0], "").trim();
  } else if (!intervalDays) {
    const everySimple = text.match(/\bevery\s+(day|week|month|night|morning|evening)\b/i);
    if (everySimple) {
      const unit = everySimple[1].toLowerCase();
      intervalDays = unit === "week" ? 7 : unit === "month" ? 30 : 1;
      text = text.replace(everySimple[0], "").trim();
    }
  }

  if (!dueAt) {
    const inN = text.match(/\bin\s+(\d+)\s*(day|days|week|weeks)\b/i);
    if (inN) {
      const n = parseInt(inN[1], 10);
      const unit = inN[2].toLowerCase();
      dueAt = addDays(base, unit.startsWith("week") ? n * 7 : n);
      text = text.replace(inN[0], "").trim();
    } else if (/\btomorrow\b/i.test(text)) {
      dueAt = addDays(base, 1);
      text = text.replace(/\btomorrow\b/i, "").trim();
    } else if (/\btoday\b/i.test(text)) {
      dueAt = base;
      text = text.replace(/\btoday\b/i, "").trim();
    } else {
      const wd = text.match(/\b(?:on\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
      if (wd) {
        const target = WEEKDAYS.indexOf(wd[1].toLowerCase());
        const delta = (((target - base.getDay()) % 7) + 7) % 7 || 7;
        dueAt = addDays(base, delta);
        text = text.replace(wd[0], "").trim();
      }
    }
  }

  if (!dueAt && intervalDays) dueAt = base;

  let hasTime = false;
  const timeMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3].toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (!dueAt) dueAt = new Date(base);
    dueAt = new Date(dueAt);
    dueAt.setHours(hour, minute, 0, 0);
    hasTime = true;
    text = text.replace(timeMatch[0], "").trim();
  }

  // Pulling the date/time out can strand the word that introduced it
  // ("water the plants every", "call mom at") — drop those.
  text = text
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\b(every|at|on|by|in|next)\b\s*$/i, "")
    .replace(/^\s*\b(at|on|by)\b\s*/i, "")
    .replace(/^[,\-\s]+|[,\-\s]+$/g, "");
  const title = text ? text.charAt(0).toUpperCase() + text.slice(1) : raw.trim();

  return { title, dueAt: dueAt ? dueAt.toISOString() : null, intervalDays, hasTime };
}

export function describeParse(parsed, today = new Date()) {
  const bits = [];
  if (parsed.dueAt) {
    const d = Math.round((startOfDay(parsed.dueAt) - startOfDay(today)) / 86400000);
    let label = d === 0 ? "today" : d === 1 ? "tomorrow" : d > 1 ? `in ${d} days` : "due date passed";
    if (parsed.hasTime && d >= 0) {
      const t = new Date(parsed.dueAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      label += ` at ${t}`;
    }
    bits.push("due " + label);
  } else {
    bits.push("no due date");
  }
  if (parsed.intervalDays) {
    bits.push(
      parsed.intervalDays % 7 === 0
        ? `repeats every ${parsed.intervalDays / 7} week${parsed.intervalDays === 7 ? "" : "s"}`
        : `repeats every ${parsed.intervalDays} days`
    );
  }
  return bits;
}

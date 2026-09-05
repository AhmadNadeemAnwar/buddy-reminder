import { db } from "./db.js";
import { computeFlags, messageFor } from "./insights.js";
import { voiceSupported, createVoiceInput } from "./voice.js";
import { parseInput } from "./parse.js";
import { notificationsSupported, requestPermission, pollDueReminders, scheduleTrigger } from "./notify.js";
import { initSync, pushItem, pushDelete } from "./sync.js";
import { WEEKDAY_LABELS, dateKey, monthMatrix, itemsByDay, isToday } from "./calendar.js";

const OWNER_NAME = "Ahmad";
const DAY_MS = 86400000;

function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}
function daysBetween(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);
}
function addDays(d, n) {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}

// ---------------- elements ----------------
const contentEl = document.getElementById("content");
const listsEl = document.getElementById("lists");
const calendarWrap = document.getElementById("calendarWrap");
const filterBar = document.getElementById("filterBar");
const greetingEl = document.getElementById("greetingText");
const dateLineEl = document.getElementById("dateLine");
const statusLine = document.getElementById("statusLine");
const buddyEl = document.getElementById("buddy");
const insightBody = document.getElementById("insightBody");
const form = document.getElementById("captureForm");
const input = document.getElementById("captureInput");
const micBtn = document.getElementById("micBtn");
const voiceStatus = document.getElementById("voiceStatus");
const offlineBanner = document.getElementById("offlineBanner");
const notifyPrompt = document.getElementById("notifyPrompt");
const notifyEnable = document.getElementById("notifyEnable");
const viewListBtn = document.getElementById("viewList");
const viewCalendarBtn = document.getElementById("viewCalendar");
const dayModalOverlay = document.getElementById("dayModalOverlay");
const dayModal = document.getElementById("dayModal");
const whenRow = document.getElementById("whenRow");
const whenPicker = document.getElementById("whenPicker");
const whenDate = document.getElementById("whenDate");
const whenTime = document.getElementById("whenTime");
const whenRepeat = document.getElementById("whenRepeat");
const whenEditing = document.getElementById("whenEditing");
const voiceOverlay = document.getElementById("voiceOverlay");
const voiceTranscript = document.getElementById("voiceTranscript");
const voiceStop = document.getElementById("voiceStop");

let allItems = [];
let view = "list";
let calendarMonth = startOfDay(new Date());
calendarMonth.setDate(1);
let openAddFor = null;
let justAddedId = null;
let activeFilter = "all";
let expandedSections = new Set();
let editingItemId = null; // task whose reminder the picker is currently editing
let selectedDate = null;
let dayCreateOpen = false;

let pendingWhen = { dueAt: null, hasTime: false, intervalDays: null };
let whenTouched = false;

// ---------------- icons ----------------
const iconCheck =
  '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l3.5 3.5L16 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const iconTrash =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h12M8 6V4.6c0-.6.5-1.1 1.1-1.1h1.8c.6 0 1.1.5 1.1 1.1V6M6 6l.6 9.4c0 .6.5 1.1 1.1 1.1h4.6c.6 0 1-.5 1.1-1.1L14 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const iconPlus =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 4.5v11M4.5 10h11" stroke-linecap="round"/></svg>';
const iconBell =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 3a4 4 0 0 0-4 4c0 3.5-1.2 4.7-1.2 4.7h10.4S14 10.5 14 7a4 4 0 0 0-4-4zM8.6 14.4a1.6 1.6 0 0 0 2.8 0" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const iconSpark =
  '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.2l1.5 4.3 4.3 1.5-4.3 1.5L10 13.8 8.5 9.5 4.2 8l4.3-1.5z"/></svg>';

// ---------------- when helpers ----------------
function repeatLabel(intervalDays) {
  if (!intervalDays) return "";
  if (intervalDays === 1) return "every day";
  if (intervalDays === 7) return "every week";
  if (intervalDays === 14) return "every 2 weeks";
  if (intervalDays === 30) return "every month";
  if (intervalDays % 7 === 0) return `every ${intervalDays / 7} weeks`;
  return `every ${intervalDays} days`;
}

function dayLabel(date, today = new Date()) {
  const d = daysBetween(date, today);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1 && d < 7) return new Date(date).toLocaleDateString(undefined, { weekday: "long" });
  return new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function timeLabel(date) {
  return new Date(date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function describeWhen(when) {
  const bits = [];
  if (when.dueAt) {
    bits.push(dayLabel(when.dueAt));
    if (when.hasTime) bits.push(timeLabel(when.dueAt));
  }
  if (when.intervalDays) bits.push(repeatLabel(when.intervalDays));
  return bits.join(" · ");
}

function whenIsSet(when) {
  return !!(when.dueAt || when.intervalDays);
}

// ---------------- capture: reminder chip + picker ----------------
function renderWhenRow() {
  whenRow.innerHTML = "";
  if (!whenIsSet(pendingWhen)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "when-add";
    btn.innerHTML = iconBell + "<span>Remind me</span>";
    btn.addEventListener("click", () => toggleWhenPicker());
    whenRow.appendChild(btn);
    return;
  }

  const chip = document.createElement("span");
  chip.className = "when-chip";
  chip.innerHTML = iconBell + '<button type="button" class="when-chip-label"></button>';
  chip.querySelector(".when-chip-label").textContent = describeWhen(pendingWhen);
  chip.querySelector(".when-chip-label").addEventListener("click", () => toggleWhenPicker());

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "when-chip-clear";
  clear.setAttribute("aria-label", "Remove reminder");
  clear.innerHTML =
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke-linecap="round"/></svg>';
  clear.addEventListener("click", () => {
    pendingWhen = { dueAt: null, hasTime: false, intervalDays: null };
    whenTouched = true;
    toggleWhenPicker(false);
    renderWhenRow();
  });
  chip.appendChild(clear);
  whenRow.appendChild(chip);
}

// No argument toggles; pass true/false to force it.
// The picker edits one of two things: the draft reminder for the task being
// typed, or the reminder on an existing task. `editingItemId` says which.
function readWhen() {
  if (!editingItemId) return pendingWhen;
  const it = allItems.find((i) => i.id === editingItemId);
  if (!it) return pendingWhen;
  return {
    dueAt: it.dueAt,
    hasTime: !!it.hasTime,
    intervalDays: it.recurring ? it.recurring.intervalDays : null,
  };
}

function writeWhen(next) {
  if (!editingItemId) {
    pendingWhen = next;
    whenTouched = true; // manual control; stop auto-filling from typed text
    renderWhenRow();
    syncPicker();
    positionPicker(); // the chip it's anchored to just changed width
    return;
  }
  saveUpdate(editingItemId, {
    dueAt: next.dueAt,
    hasTime: !!next.hasTime,
    recurring: next.intervalDays ? { intervalDays: next.intervalDays } : null,
  }).then(syncPicker);
}

function openReminderEditor(item, event) {
  if (event) event.stopPropagation(); // don't let the outside-click handler close it again

  // Tapping the same reminder again closes it.
  if (editingItemId === item.id && !whenPicker.hidden) {
    toggleWhenPicker(false);
    return;
  }

  editingItemId = item.id;
  whenEditing.textContent = `Reminder for “${item.title}”`;
  whenEditing.hidden = false;
  whenRow.hidden = true;
  whenPicker.hidden = false;
  whenPicker.classList.add("floating");
  syncPicker();
  positionPicker();
}

// Whatever opened the picker: a task's reminder pill, or the chip in the
// composer. Re-resolved each time because both get re-rendered underneath us.
function anchorEl() {
  if (editingItemId) return document.querySelector(`.pill-edit[data-pill-for="${editingItemId}"]`);
  return whenRow.firstElementChild;
}

// The picker floats next to whatever opened it. It deliberately does NOT sit
// in the composer's flow — doing that grew the composer and squeezed the list
// off screen, which read as the page going dark.
function positionPicker() {
  if (whenPicker.hidden) return;
  const anchor = anchorEl();
  if (!anchor) return;

  const r = anchor.getBoundingClientRect();
  const width = Math.min(340, window.innerWidth - 24);
  whenPicker.style.width = width + "px";
  whenPicker.style.left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12) + "px";

  const h = whenPicker.offsetHeight || 160;
  const below = r.bottom + 8;
  whenPicker.style.top = (below + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 8) : below) + "px";
}

window.addEventListener("resize", positionPicker);

function toggleWhenPicker(open) {
  const next = open === undefined ? whenPicker.hidden : open;
  whenPicker.hidden = !next;

  if (!next) {
    // leaving edit mode hands the picker back to the compose draft
    editingItemId = null;
    whenEditing.hidden = true;
    whenRow.hidden = false;
    whenPicker.classList.remove("floating");
    whenPicker.style.cssText = "";
    renderWhenRow();
    return;
  }

  whenPicker.classList.add("floating");

  // Opening it is intent to set a reminder, so start from now rather than
  // from empty fields the user has to fill in from scratch.
  if (!editingItemId && !whenIsSet(pendingWhen)) {
    const now = new Date();
    now.setSeconds(0, 0);
    writeWhen({ dueAt: now.toISOString(), hasTime: true, intervalDays: null });
    return;
  }
  syncPicker();
  positionPicker();
}

// Click anywhere outside to dismiss. Nothing is discarded — every field
// writes straight into pendingWhen, so there's no unsaved state to lose.
document.addEventListener("click", (e) => {
  if (whenPicker.hidden) return;
  // Opening the picker re-renders the chip row, which detaches the very
  // element that was clicked — that's our own doing, not a click outside.
  if (!e.target.isConnected) return;
  if (e.target.closest("#whenPicker") || e.target.closest("#whenRow")) return;
  // a native date/time popup is open on top of us — leave it alone
  if (document.activeElement === whenDate || document.activeElement === whenTime) return;
  toggleWhenPicker(false);
});

function syncPicker() {
  const w = readWhen();
  whenDate.value = w.dueAt ? dateKey(w.dueAt) : "";
  whenTime.value = w.hasTime && w.dueAt ? new Date(w.dueAt).toTimeString().slice(0, 5) : "";
  whenRepeat.value = w.intervalDays ? String(w.intervalDays) : "";
}

function setWhenDate(date) {
  const w = readWhen();
  const next = new Date(date);
  if (w.hasTime && w.dueAt) {
    const prev = new Date(w.dueAt);
    next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
  } else {
    next.setHours(0, 0, 0, 0);
  }
  writeWhen({ ...w, dueAt: next.toISOString() });
}

whenPicker.querySelectorAll("[data-quick]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const map = { today: 0, tomorrow: 1, nextweek: 7 };
    setWhenDate(addDays(startOfDay(new Date()), map[btn.dataset.quick]));
  });
});

whenDate.addEventListener("change", () => {
  const w = readWhen();
  if (!whenDate.value) {
    writeWhen({ ...w, dueAt: null, hasTime: false });
    return;
  }
  const [y, m, d] = whenDate.value.split("-").map(Number);
  setWhenDate(new Date(y, m - 1, d));
});

whenTime.addEventListener("change", () => {
  const w = readWhen();
  if (!whenTime.value) {
    writeWhen({ ...w, hasTime: false });
    return;
  }
  const [h, min] = whenTime.value.split(":").map(Number);
  const base = w.dueAt ? new Date(w.dueAt) : startOfDay(new Date());
  base.setHours(h, min, 0, 0);
  writeWhen({ ...w, dueAt: base.toISOString(), hasTime: true });
});

whenRepeat.addEventListener("change", () => {
  const w = readWhen();
  const intervalDays = whenRepeat.value ? parseInt(whenRepeat.value, 10) : null;
  // a repeat needs a starting point
  const dueAt = intervalDays && !w.dueAt ? startOfDay(new Date()).toISOString() : w.dueAt;
  writeWhen({ ...w, intervalDays, dueAt });
});

// No "Done" button — clicking away, Escape, or tapping the chip all close it,
// and nothing needs saving because every field writes straight to pendingWhen.
document.getElementById("whenClear").addEventListener("click", () => {
  writeWhen({ dueAt: null, hasTime: false, intervalDays: null });
  toggleWhenPicker(false);
});

function resetPendingWhen() {
  editingItemId = null;
  pendingWhen = { dueAt: null, hasTime: false, intervalDays: null };
  whenTouched = false;
  toggleWhenPicker(false);
}

// ---------------- greeting ----------------
function renderGreeting() {
  const h = new Date().getHours();
  const part = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  greetingEl.textContent = `${part}, ${OWNER_NAME}`;
  dateLineEl.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  statusLine.textContent = statusText(new Date());
}

function statusText(today) {
  // Counted off the same buckets the list shows, so the header can never
  // disagree with what's on screen. A recurring task is never "done" — it
  // has a completedAt from its last run but is still live for the next one.
  const open = allItems.filter((it) => !it.parentId && bucketOf(it, today) !== "done");
  const overdue = open.filter((it) => bucketOf(it, today) === "overdue").length;
  const dueToday = open.filter((it) => bucketOf(it, today) === "today").length;

  if (overdue && dueToday) return `${overdue} overdue · ${dueToday} due today`;
  if (overdue) return overdue === 1 ? "1 thing slipped past" : `${overdue} things slipped past`;
  if (dueToday) return dueToday === 1 ? "You have 1 thing left today" : `You have ${dueToday} things left today`;
  // Deliberately says nothing about later work — this line is about today.
  return "Nothing left for today";
}

// ---------------- tree helpers ----------------
function buildChildrenMap(items) {
  const map = new Map();
  for (const it of items) {
    if (!it.parentId) continue;
    if (!map.has(it.parentId)) map.set(it.parentId, []);
    map.get(it.parentId).push(it);
  }
  for (const arr of map.values()) arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return map;
}

function descendantIds(id, childrenMap) {
  const out = [];
  for (const k of childrenMap.get(id) || []) {
    out.push(k.id);
    out.push(...descendantIds(k.id, childrenMap));
  }
  return out;
}

function subtaskProgress(id, childrenMap) {
  const kids = childrenMap.get(id) || [];
  if (!kids.length) return null;
  return { done: kids.filter((k) => k.completedAt).length, total: kids.length };
}

// ---------------- list ----------------
const BUCKETS = [
  { key: "overdue", label: "Overdue", cls: "overdue" },
  { key: "today", label: "Today", cls: "today" },
  { key: "week", label: "This week", cls: "" },
  { key: "month", label: "This month", cls: "" },
  { key: "later", label: "Beyond this month", cls: "" },
  { key: "done", label: "Done", cls: "" },
];

// Each window includes everything more urgent than it, so they nest:
// Today ⊂ This week ⊂ This month. Overdue always rides along — hiding
// something you've already missed would be the opposite of helpful.
// One chip per section — picking "This month" shows the month's work and
// nothing else, rather than everything due sooner as well.
const FILTERS = [{ key: "all", label: "All" }].concat(
  BUCKETS.map((b) => ({ key: b.key, label: b.label }))
);

const SECTION_CAP = 7;

function matchesFilter(item, today) {
  if (activeFilter === "all") return true;
  return bucketOf(item, today) === activeFilter;
}

function renderFilterBar() {
  filterBar.hidden = view !== "list";
  if (filterBar.hidden) return;
  filterBar.innerHTML = "";
  FILTERS.forEach((f) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = f.label;
    btn.setAttribute("aria-pressed", String(activeFilter === f.key));
    btn.addEventListener("click", () => {
      activeFilter = f.key;
      expandedSections.clear(); // a new view starts collapsed again
      render();
    });
    filterBar.appendChild(btn);
  });
}

function bucketOf(item, today) {
  if (item.completedAt && !item.recurring) return "done";

  if (item.dueAt) {
    const d = daysBetween(item.dueAt, today);
    if (d < 0) return "overdue";
    if (d === 0) return "today";
    if (d <= 7) return "week";
    if (d <= 31) return "month";
    return "later";
  }

  // No reminder: it ages forward from the day you wrote it down. Written
  // today it sits with today's work; left undone it drifts down the list
  // instead of disappearing into a bucket nobody reads.
  const age = -daysBetween(item.createdAt, today);
  if (age <= 0) return "today";
  if (age <= 7) return "week";
  if (age <= 31) return "month";
  return "later";
}

// Dated work first, soonest deadline at the top; loose ideas after it,
// newest first — so "the latest 7" still means something in every bucket.
function sortBucket(arr) {
  return arr.sort((a, b) => {
    const ad = a.dueAt ? 0 : 1;
    const bd = b.dueAt ? 0 : 1;
    if (ad !== bd) return ad - bd;
    if (a.dueAt) return new Date(a.dueAt) - new Date(b.dueAt);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

// which colour the card's left stripe carries
function stateClass(item, today) {
  if (item.completedAt && !item.recurring) return "s-done";
  if (item.dueAt) {
    const d = daysBetween(item.dueAt, today);
    if (d < 0) return "s-overdue";
    if (d === 0) return "s-today";
  }
  if (item.recurring) return "s-habit";
  return "";
}

// The reminder pill — the bell plus the word says what the time means.
// On a task that's still open it's a button: tap it to edit the reminder.
function duePill(item, today) {
  if (!item.dueAt) return "";
  const finished = item.completedAt && !item.recurring;
  const d = daysBetween(item.dueAt, today);
  let cls = "";
  let text = "";

  if (d < 0) {
    const n = Math.abs(d);
    cls = "terracotta";
    text = `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  } else if (d === 0) {
    // Due today? The section heading already says so — don't repeat it.
    cls = "honey";
    text = `Reminder${item.hasTime ? ` at ${timeLabel(item.dueAt)}` : ""}`;
  } else {
    text = `Reminder · ${dayLabel(item.dueAt, today)}${item.hasTime ? ", " + timeLabel(item.dueAt) : ""}`;
  }

  // Colour means "this still wants something from you". Once it's done the
  // pill goes quiet, whatever its date said.
  if (finished) cls = "muted";

  const classes = `pill ${cls} ${finished ? "" : "pill-edit"}`.replace(/\s+/g, " ").trim();
  return finished
    ? `<span class="${classes}">${iconBell}${text}</span>`
    : `<button type="button" class="${classes}" data-pill-for="${item.id}">${iconBell}${text}</button>`;
}

function subLine(item, childrenMap) {
  const bits = [];
  if (item.recurring) bits.push(repeatLabel(item.recurring.intervalDays).replace(/^e/, "E"));
  const p = subtaskProgress(item.id, childrenMap);
  if (p) bits.push(`${p.done} of ${p.total} steps`);
  return bits.join(" · ");
}

function renderItemNode(item, childrenMap, today, depth) {
  const wrap = document.createElement("div");
  wrap.className = "item-node" + (depth === 0 ? " " + stateClass(item, today) : "");

  const row = document.createElement("div");
  row.className = "row" + (item.completedAt && !item.recurring ? " done" : "") + (item.id === justAddedId ? " enter" : "");
  if (item.id === justAddedId) justAddedId = null;

  const check = document.createElement("button");
  check.className = "check";
  check.type = "button";
  check.setAttribute("aria-label", "Mark done");
  check.innerHTML = iconCheck;
  check.addEventListener("click", () => completeItem(item, check));

  const body = document.createElement("div");
  body.className = "row-body";

  const title = document.createElement("div");
  title.className = "row-title";
  title.contentEditable = "true";
  title.spellcheck = false;
  title.textContent = item.title;
  title.addEventListener("blur", async () => {
    const v = title.textContent.trim();
    if (v && v !== item.title) await saveUpdate(item.id, { title: v });
    else title.textContent = item.title;
  });
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      title.blur();
    }
  });
  body.appendChild(title);

  // Pill and sub-text share one wrapping line, so a long due label can never
  // squeeze the title into a two-line stack on a narrow screen.
  const sub = subLine(item, childrenMap);
  const pill = depth === 0 ? duePill(item, today) : "";
  if (sub || pill) {
    const meta = document.createElement("div");
    meta.className = "row-meta";
    meta.innerHTML = pill + (sub ? `<span class="row-sub">${sub}</span>` : "");
    const editable = meta.querySelector(".pill-edit");
    if (editable) editable.addEventListener("click", (e) => openReminderEditor(item, e));
    body.appendChild(meta);
  }

  row.appendChild(check);
  row.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const addSub = document.createElement("button");
  addSub.className = "row-add-sub";
  addSub.type = "button";
  addSub.setAttribute("aria-label", "Add step");
  addSub.title = "Add a step";
  addSub.innerHTML = iconPlus;
  addSub.addEventListener("click", () => {
    openAddFor = openAddFor === item.id ? null : item.id;
    render();
  });

  const del = document.createElement("button");
  del.className = "row-delete";
  del.type = "button";
  del.setAttribute("aria-label", "Delete");
  del.innerHTML = iconTrash;
  del.addEventListener("click", () => removeItem(item.id));

  actions.appendChild(addSub);
  actions.appendChild(del);
  row.appendChild(actions);
  wrap.appendChild(row);

  const kids = childrenMap.get(item.id) || [];
  if (kids.length || openAddFor === item.id) {
    const childWrap = document.createElement("div");
    childWrap.className = "subtasks";
    kids.forEach((k) => childWrap.appendChild(renderItemNode(k, childrenMap, today, depth + 1)));
    if (openAddFor === item.id) childWrap.appendChild(renderInlineAdd(item));
    wrap.appendChild(childWrap);
  }

  return wrap;
}

function renderInlineAdd(parent) {
  const row = document.createElement("div");
  row.className = "row inline-add";

  const dot = document.createElement("span");
  dot.className = "inline-add-dot";

  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "inline-add-input";
  inp.placeholder = "Add a step…";

  let committed = false;
  async function commit() {
    if (committed) return; // Enter fires this, then the re-render detaches the
    committed = true; // input and its own blur event would call this again.
    const v = inp.value.trim();
    openAddFor = null;
    if (v) {
      const created = await db.add({ title: v, parentId: parent.id });
      pushItem(created);
      justAddedId = created.id;
    }
    await loadAll();
  }

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      openAddFor = null;
      render();
    }
  });
  inp.addEventListener("blur", () => commit());

  row.appendChild(dot);
  row.appendChild(inp);
  setTimeout(() => inp.focus(), 0);
  return row;
}

function render() {
  const today = new Date();
  renderGreeting();

  listsEl.hidden = view !== "list";
  calendarWrap.hidden = view !== "calendar";
  renderFilterBar();

  if (view === "list") renderListView(today);
  else renderCalendarView();

  renderInsight(today);
  pollDueReminders(allItems);
  positionPicker(); // the row it's anchored to may have moved buckets
}

function renderListView(today) {
  const topLevel = allItems.filter((it) => !it.parentId && matchesFilter(it, today));
  const childrenMap = buildChildrenMap(allItems);

  const grouped = {};
  BUCKETS.forEach((b) => (grouped[b.key] = []));
  topLevel.forEach((it) => grouped[bucketOf(it, today)].push(it));

  grouped.done.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  ["overdue", "today", "week", "month", "later"].forEach((k) => sortBucket(grouped[k]));

  listsEl.innerHTML = "";
  let any = false;
  BUCKETS.forEach((b) => {
    const items = grouped[b.key];
    if (!items.length) return;
    any = true;

    const section = document.createElement("section");
    section.className = "section" + (b.cls ? " " + b.cls : "");
    const label = document.createElement("p");
    label.className = "section-label";
    label.innerHTML = `${b.label}<span class="count">${items.length}</span>`;
    section.appendChild(label);

    const expanded = expandedSections.has(b.key);
    const visible = expanded ? items : items.slice(0, SECTION_CAP);
    visible.forEach((it) => section.appendChild(renderItemNode(it, childrenMap, today, 0)));

    if (items.length > SECTION_CAP) {
      const hidden = items.length - SECTION_CAP;
      const more = document.createElement("button");
      more.type = "button";
      more.className = "show-more";
      more.textContent = expanded ? "Show less" : `Show ${hidden} more`;
      more.addEventListener("click", () => {
        if (expanded) expandedSections.delete(b.key);
        else expandedSections.add(b.key);
        render();
      });
      section.appendChild(more);
    }

    listsEl.appendChild(section);
  });

  if (!any) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent =
      activeFilter === "all"
        ? "Nothing on your plate. Tell me what's on your mind."
        : activeFilter === "done"
        ? "Nothing finished yet."
        : activeFilter === "later"
        ? "Nothing parked for later."
        : "Nothing due in this window.";
    listsEl.appendChild(hint);
  }
}

function renderInsight(today) {
  const flags = computeFlags(allItems, today);
  insightBody.innerHTML = "";
  contentEl.classList.toggle("has-nudges", flags.length > 0);
  if (!flags.length) return;

  flags.forEach((f) => {
    const card = document.createElement("div");
    card.className = "nudge";
    card.innerHTML =
      `<div class="nudge-tag">${iconSpark} BUDDY'S TAKE</div>` +
      '<p class="nudge-text"></p>' +
      '<div class="nudge-actions"><button class="nudge-add">Add nudge</button><button class="nudge-dismiss">Not now</button></div>';
    card.querySelector(".nudge-text").textContent = messageFor(f);
    card.querySelector(".nudge-add").addEventListener("click", () => recreateItem(f.item));
    card.querySelector(".nudge-dismiss").addEventListener("click", () => {
      saveUpdate(f.item.id, { lastRecreatedAt: new Date().toISOString() });
    });
    insightBody.appendChild(card);
  });
}

// ---------------- calendar ----------------
function renderCalendarView() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const weeks = monthMatrix(year, month);
  const byDay = itemsByDay(allItems);

  calendarWrap.innerHTML = "";

  const header = document.createElement("div");
  header.className = "cal-header";
  header.innerHTML = `
    <button type="button" class="cal-nav" id="calPrev" aria-label="Previous month">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5l-5 5 5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <h2>${calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
    <button type="button" class="cal-nav" id="calNext" aria-label="Next month">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 5l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button type="button" class="cal-today" id="calToday">Today</button>
  `;
  calendarWrap.appendChild(header);

  const weekdayRow = document.createElement("div");
  weekdayRow.className = "cal-weekdays";
  weekdayRow.innerHTML = WEEKDAY_LABELS.map((d) => `<span>${d}</span>`).join("");
  calendarWrap.appendChild(weekdayRow);

  const grid = document.createElement("div");
  grid.className = "cal-grid";
  weeks.forEach((week) => {
    week.forEach((cell) => {
      const dayItems = byDay.get(dateKey(cell.date)) || [];
      const shown = dayItems.slice(0, 3);
      const overflow = dayItems.length - shown.length;
      const cellEl = document.createElement("button");
      cellEl.type = "button";
      cellEl.className = "cal-cell" + (cell.inMonth ? "" : " outside") + (isToday(cell.date) ? " today" : "");
      cellEl.innerHTML =
        `<span class="cal-daynum">${cell.date.getDate()}</span>` +
        `<span class="cal-dots">${shown.map(() => '<span class="cal-dot"></span>').join("")}${
          overflow > 0 ? `<span class="cal-more">+${overflow}</span>` : ""
        }</span>`;
      cellEl.addEventListener("click", () => openDayModal(cell.date));
      grid.appendChild(cellEl);
    });
  });
  calendarWrap.appendChild(grid);

  const note = document.createElement("p");
  note.className = "cal-note";
  note.textContent = "Only tasks with a reminder show up here.";
  calendarWrap.appendChild(note);

  calendarWrap.querySelector("#calPrev").addEventListener("click", () => {
    calendarMonth = new Date(year, month - 1, 1);
    render();
  });
  calendarWrap.querySelector("#calNext").addEventListener("click", () => {
    calendarMonth = new Date(year, month + 1, 1);
    render();
  });
  calendarWrap.querySelector("#calToday").addEventListener("click", () => {
    calendarMonth = startOfDay(new Date());
    calendarMonth.setDate(1);
    render();
  });
}

function openDayModal(date) {
  selectedDate = date;
  dayCreateOpen = false;
  renderDayModal();
  dayModalOverlay.hidden = false;
  requestAnimationFrame(() => dayModalOverlay.classList.add("show"));
}

function closeDayModal() {
  dayModalOverlay.classList.remove("show");
  setTimeout(() => {
    dayModalOverlay.hidden = true;
  }, 180);
}

function renderDayModal() {
  const today = new Date();
  const key = dateKey(selectedDate);
  const items = allItems.filter((it) => it.dueAt && !it.parentId && dateKey(it.dueAt) === key);
  const childrenMap = buildChildrenMap(allItems);

  dayModal.innerHTML = "";

  const head = document.createElement("div");
  head.className = "modal-head";
  head.innerHTML = `
    <h2>${selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
    <button type="button" class="modal-close" aria-label="Close">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l10 10M15 5L5 15" stroke-linecap="round"/></svg>
    </button>
  `;
  head.querySelector(".modal-close").addEventListener("click", closeDayModal);
  dayModal.appendChild(head);

  const list = document.createElement("div");
  list.className = "modal-day-list";
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "Nothing set for this day.";
    list.appendChild(p);
  } else {
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "row" + (item.completedAt && !item.recurring ? " done" : "");
      const check = document.createElement("button");
      check.className = "check";
      check.type = "button";
      check.setAttribute("aria-label", "Mark done");
      check.innerHTML = iconCheck;
      check.addEventListener("click", async () => {
        await completeItem(item, check);
        renderDayModal();
      });
      const body = document.createElement("div");
      body.className = "row-body";
      const sub = subLine(item, childrenMap);
      const dp = duePill(item, today);
      body.innerHTML =
        `<div class="row-title">${escapeHtml(item.title)}</div>` +
        (sub || dp ? `<div class="row-meta">${dp}${sub ? `<span class="row-sub">${sub}</span>` : ""}</div>` : "");
      const del = document.createElement("button");
      del.className = "row-delete";
      del.type = "button";
      del.setAttribute("aria-label", "Delete");
      del.innerHTML = iconTrash;
      del.addEventListener("click", async () => {
        await removeItem(item.id);
        renderDayModal();
      });
      row.appendChild(check);
      row.appendChild(body);
      row.appendChild(del);
      list.appendChild(row);
    });
  }
  dayModal.appendChild(list);

  if (!dayCreateOpen) {
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "modal-add-toggle";
    addBtn.innerHTML = iconPlus + "<span>Add for this day</span>";
    addBtn.addEventListener("click", () => {
      dayCreateOpen = true;
      renderDayModal();
    });
    dayModal.appendChild(addBtn);
  } else {
    dayModal.appendChild(renderDayCreateForm());
  }
}

function renderDayCreateForm() {
  const f = document.createElement("form");
  f.className = "day-create-form";
  f.innerHTML = `
    <input type="text" class="day-title-input" placeholder="What should I remind you about?" autocomplete="off" required />
    <label class="when-field"><span>Time</span><input type="time" class="day-time-input" /></label>
    <label class="when-field"><span>Repeat</span>
      <select class="day-repeat-input">
        <option value="">Never</option>
        <option value="1">Every day</option>
        <option value="7">Every week</option>
        <option value="14">Every 2 weeks</option>
        <option value="30">Every month</option>
      </select>
    </label>
    <div class="day-form-actions">
      <button type="button" class="day-cancel">Cancel</button>
      <button type="submit" class="day-save">Save</button>
    </div>
  `;

  f.querySelector(".day-cancel").addEventListener("click", () => {
    dayCreateOpen = false;
    renderDayModal();
  });

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = f.querySelector(".day-title-input").value.trim();
    if (!title) return;
    const time = f.querySelector(".day-time-input").value;
    const due = new Date(selectedDate);
    let hasTime = false;
    if (time) {
      const [h, m] = time.split(":").map(Number);
      due.setHours(h, m, 0, 0);
      hasTime = true;
    } else {
      due.setHours(0, 0, 0, 0);
    }
    const repeatVal = f.querySelector(".day-repeat-input").value;
    const intervalDays = repeatVal ? parseInt(repeatVal, 10) : null;

    const created = await db.add({
      title,
      dueAt: due.toISOString(),
      hasTime,
      recurring: intervalDays ? { intervalDays } : null,
    });
    pushItem(created);
    scheduleTrigger(created);
    justAddedId = created.id;
    dayCreateOpen = false;
    await loadAll();
    renderDayModal();
  });

  return f;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ---------------- data actions ----------------
async function loadAll() {
  allItems = await db.getAll();
  render();
}

async function saveUpdate(id, patch) {
  const updated = await db.update(id, patch);
  if (updated) pushItem(updated);
  await loadAll();
}

async function completeItem(item, buttonEl) {
  const now = new Date().toISOString();
  const completing = !item.completedAt;
  if (buttonEl && completing) {
    buttonEl.classList.add("pop");
    buddyEl.classList.add("celebrate");
    setTimeout(() => buddyEl.classList.remove("celebrate"), 650);
  }
  if (item.recurring) {
    const next = new Date();
    next.setDate(next.getDate() + item.recurring.intervalDays);
    if (item.hasTime && item.dueAt) {
      const prev = new Date(item.dueAt);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    }
    await saveUpdate(item.id, { completedAt: now, lastRecreatedAt: now, dueAt: next.toISOString() });
  } else {
    await saveUpdate(item.id, { completedAt: completing ? now : null });
  }
}

async function recreateItem(item) {
  const now = new Date().toISOString();
  await saveUpdate(item.id, { dueAt: now, lastRecreatedAt: now, completedAt: null });
}

async function removeItem(id) {
  const childrenMap = buildChildrenMap(allItems);
  for (const did of [id, ...descendantIds(id, childrenMap)]) {
    await db.remove(did);
    pushDelete(did);
  }
  await loadAll();
}

async function addFromCapture() {
  const raw = input.value.trim();
  if (!raw) return;
  const parsed = parseInput(raw, new Date());
  const when = whenTouched
    ? pendingWhen
    : { dueAt: parsed.dueAt, hasTime: !!parsed.hasTime, intervalDays: parsed.intervalDays };

  const item = await db.add({
    title: parsed.title,
    dueAt: when.dueAt,
    hasTime: !!when.hasTime,
    recurring: when.intervalDays ? { intervalDays: when.intervalDays } : null,
  });
  pushItem(item);
  scheduleTrigger(item);
  justAddedId = item.id;
  input.value = "";
  resetPendingWhen();
  await loadAll();
}

// ---------------- capture UI ----------------
input.addEventListener("input", () => {
  if (whenTouched) return;
  const v = input.value.trim();
  const parsed = v ? parseInput(v, new Date()) : { dueAt: null, hasTime: false, intervalDays: null };
  pendingWhen = { dueAt: parsed.dueAt, hasTime: !!parsed.hasTime, intervalDays: parsed.intervalDays };
  renderWhenRow();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addFromCapture();
});

// ---------------- view toggle ----------------
viewListBtn.addEventListener("click", () => setView("list"));
viewCalendarBtn.addEventListener("click", () => setView("calendar"));
function setView(v) {
  view = v;
  viewListBtn.setAttribute("aria-pressed", String(v === "list"));
  viewCalendarBtn.setAttribute("aria-pressed", String(v === "calendar"));
  render();
}
dayModalOverlay.addEventListener("click", (e) => {
  if (e.target === dayModalOverlay) closeDayModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!dayModalOverlay.hidden) closeDayModal();
  else if (!whenPicker.hidden) toggleWhenPicker(false);
});

// ---------------- voice ----------------
if (!voiceSupported) {
  micBtn.style.display = "none";
} else {
  let recording = false;

  const voice = createVoiceInput({
    onStart() {
      recording = true;
      voiceTranscript.textContent = "Listening…";
      voiceStatus.hidden = true;
      voiceOverlay.hidden = false;
      requestAnimationFrame(() => voiceOverlay.classList.add("show"));
    },
    onEnd() {
      recording = false;
      closeVoiceOverlay();
    },
    onResult(text) {
      voiceTranscript.textContent = text ? `“${text}”` : "Listening…";
      input.value = text;
      input.dispatchEvent(new Event("input"));
    },
    onError(reason) {
      recording = false;
      closeVoiceOverlay();
      const messages = {
        blocked: "Microphone access is blocked — check your browser settings, or type instead.",
        offline: "Voice needs a connection (your browser sends audio off-device to transcribe) — type instead while offline.",
        unknown: "Didn't catch that — try again or type instead.",
      };
      voiceStatus.textContent = messages[reason] || messages.unknown;
      voiceStatus.hidden = false;
    },
  });

  function closeVoiceOverlay() {
    voiceOverlay.classList.remove("show");
    setTimeout(() => {
      voiceOverlay.hidden = true;
    }, 200);
  }

  micBtn.addEventListener("click", () => {
    if (recording) voice.stop();
    else voice.start();
  });
  voiceStop.addEventListener("click", () => voice.stop());
}

// ---------------- notifications ----------------
function refreshBell() {
  if (!notificationsSupported) {
    notifyEnable.hidden = true;
    return;
  }
  notifyPrompt.classList.toggle("show", Notification.permission === "default");
  notifyEnable.title = Notification.permission === "granted" ? "Notifications are on" : "Turn on notifications";
}
notifyEnable.addEventListener("click", async () => {
  await requestPermission();
  refreshBell();
});
refreshBell();

// ---------------- online/offline ----------------
function updateOnlineStatus() {
  offlineBanner.classList.toggle("show", !navigator.onLine);
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// ---------------- service worker ----------------
if ("serviceWorker" in navigator) {
  // If a NEW worker takes over a page that already had one, the page is now
  // running against older code — reload once so what's on screen matches.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((reg) => reg.update())
      .catch(() => {});
  });
}

// ---------------- sync (optional, no-op unless configured) ----------------
initSync({
  onRemoteChange(remoteItems) {
    (async () => {
      for (const remote of remoteItems) {
        const local = allItems.find((i) => i.id === remote.id);
        if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
          await db.put(remote);
        }
      }
      await loadAll();
    })();
  },
});

// ---------------- boot ----------------
renderWhenRow();
loadAll();
setInterval(() => pollDueReminders(allItems), 45000);

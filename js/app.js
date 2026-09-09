import { db } from "./db.js";
import { computeFlags, messageFor } from "./insights.js";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_COLOR,
  PRIORITY_RANK,
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_SWATCH,
} from "./taxonomy.js";
import { voiceSupported, createVoiceInput } from "./voice.js";
import { parseInput } from "./parse.js";
import {
  notificationsSupported,
  requestPermission,
  pollDueReminders,
  scheduleTrigger,
  cancelTrigger,
  scheduleDailyNudge,
  getPermissionState,
  isNative,
} from "./notify.js";
import { initSync, pushItem, pushDelete } from "./sync.js";
import {
  WEEKDAY_LABELS,
  dateKey,
  monthMatrix,
  itemsByDay,
  isToday,
  startOfDay,
  daysBetween,
  addDays,
  repeatLabel,
} from "./calendar.js";
import { initTheme, getColorTheme, getMode, setColorTheme, setMode, getFontScale, setFontScale } from "./theme.js";
import {
  getVoiceAutoCreate,
  setVoiceAutoCreate,
  getOwnerName,
  setOwnerName,
  isOnboarded,
  setOnboarded,
  getOllamaEnabled,
  setOllamaEnabled,
  getOllamaUrl,
  setOllamaUrl,
  getOllamaModel,
  setOllamaModel,
  getReminderTone,
  setReminderTone,
  getDailyNudgeEnabled,
  setDailyNudgeEnabled,
  getDailyNudgeTime,
  setDailyNudgeTime,
} from "./prefs.js";
import { isSyncEnabled } from "./sync.js";
import { chat as ollamaChat, listModels, buildContext } from "./ollama.js";

const OWNER_NAME = "Ahmad";

// ---------------- elements ----------------
const listsEl = document.getElementById("lists");
const calendarWrap = document.getElementById("calendarWrap");
const filterBar = document.getElementById("filterBar");
const todayHero = document.getElementById("todayHero");
const greetingEl = document.getElementById("greetingText");
const dateLineEl = document.getElementById("dateLine");
const statusLine = document.getElementById("statusLine");
const buddyEl = document.getElementById("buddy");
const buddyLineEl = document.getElementById("buddyLine");
const ringProgress = document.getElementById("ringProgress");
const insightBody = document.getElementById("insightBody");
const statsRow = document.getElementById("statsRow");
const form = document.getElementById("captureForm");
const input = document.getElementById("captureInput");
const fabAdd = document.getElementById("fabAdd");
const captureMicBtn = document.getElementById("captureMicBtn");
const voiceStatus = document.getElementById("voiceStatus");
const offlineBanner = document.getElementById("offlineBanner");
const notifyPrompt = document.getElementById("notifyPrompt");
const notifyEnable = document.getElementById("notifyEnable");
const dayModalOverlay = document.getElementById("dayModalOverlay");
const dayModal = document.getElementById("dayModal");
const whenPicker = document.getElementById("whenPicker");
const whenDate = document.getElementById("whenDate");
const whenTime = document.getElementById("whenTime");
const whenRepeat = document.getElementById("whenRepeat");
const whenEditing = document.getElementById("whenEditing");
const voiceOverlay = document.getElementById("voiceOverlay");
const voiceTranscript = document.getElementById("voiceTranscript");
const voiceStop = document.getElementById("voiceStop");
const themeGrid = document.getElementById("themeGrid");
const modeSwitch = document.getElementById("modeSwitch");
const fontSizeSwitch = document.getElementById("fontSizeSwitch");
const voiceAutoSwitch = document.getElementById("voiceAutoSwitch");
const voiceAutoHint = document.getElementById("voiceAutoHint");

// tab shell
const panelToday = document.getElementById("panelToday");
const panelCalendar = document.getElementById("panelCalendar");
const panelBuddy = document.getElementById("panelBuddy");
const panelSettings = document.getElementById("panelSettings");
const tabToday = document.getElementById("tabToday");
const tabCalendar = document.getElementById("tabCalendar");
const tabBuddy = document.getElementById("tabBuddy");
const tabSettings = document.getElementById("tabSettings");

// composer sheet
const composerOverlay = document.getElementById("composerOverlay");
const composerClose = document.getElementById("composerClose");
const parseChip = document.getElementById("parseChip");
const quickDay = document.getElementById("quickDay");
const quickTime = document.getElementById("quickTime");
const quickRepeat = document.getElementById("quickRepeat");
const quickPriority = document.getElementById("quickPriority");
const quickCategory = document.getElementById("quickCategory");
const saveDraftBtn = document.getElementById("saveDraftBtn");

// filter sheet
const filterOpenBtn = document.getElementById("filterOpenBtn");
const filterActiveDot = document.getElementById("filterActiveDot");
const filterOverlay = document.getElementById("filterOverlay");
const filterClose = document.getElementById("filterClose");
const filterPriorityRow = document.getElementById("filterPriorityRow");
const filterCategoryRow = document.getElementById("filterCategoryRow");
const filterReset = document.getElementById("filterReset");
const filterApply = document.getElementById("filterApply");

// task detail screen
const detailScreen = document.getElementById("detailScreen");
const detailBack = document.getElementById("detailBack");
const detailDelete = document.getElementById("detailDelete");
const detailCheck = document.getElementById("detailCheck");
const detailTitle = document.getElementById("detailTitle");
const detailReminderRow = document.getElementById("detailReminderRow");
const detailReminderValue = document.getElementById("detailReminderValue");
const detailPriority = document.getElementById("detailPriority");
const detailCategory = document.getElementById("detailCategory");
const detailNotes = document.getElementById("detailNotes");
const detailStepsLabel = document.getElementById("detailStepsLabel");
const detailStepsList = document.getElementById("detailStepsList");
const detailStepInput = document.getElementById("detailStepInput");
const detailStepAddBtn = document.getElementById("detailStepAddBtn");
const detailFootnote = document.getElementById("detailFootnote");
// settings: notifications/sync toggles + notification preview
const notifToggleRow = document.getElementById("notifToggleRow");
const notifToggleSwitch = document.getElementById("notifToggleSwitch");
const notifToggleHint = document.getElementById("notifToggleHint");
const syncToggleRow = document.getElementById("syncToggleRow");
const syncToggleSwitch = document.getElementById("syncToggleSwitch");
const syncToggleHint = document.getElementById("syncToggleHint");
const lockPreviewDate = document.getElementById("lockPreviewDate");
const lockPreviewTime = document.getElementById("lockPreviewTime");
const lockCard = document.getElementById("lockCard");
const lockCardTitle = document.getElementById("lockCardTitle");
const lockCardSub = document.getElementById("lockCardSub");
const lockPreviewEmpty = document.getElementById("lockPreviewEmpty");
const toneSwitch = document.getElementById("toneSwitch");
const tonePreviewAudio = document.getElementById("tonePreviewAudio");
const toneHint = document.getElementById("toneHint");
const dailyNudgeHint = document.getElementById("dailyNudgeHint");
const dailyNudgeToggleRow = document.getElementById("dailyNudgeToggleRow");
const dailyNudgeToggleSwitch = document.getElementById("dailyNudgeToggleSwitch");
const dailyNudgeTimeRow = document.getElementById("dailyNudgeTimeRow");
const dailyNudgeTimeInput = document.getElementById("dailyNudgeTimeInput");

// ask buddy (local model chat)
const chatSection = document.getElementById("chatSection");
const chatThread = document.getElementById("chatThread");
const chatStatus = document.getElementById("chatStatus");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const ollamaToggleRow = document.getElementById("ollamaToggleRow");
const ollamaToggleSwitch = document.getElementById("ollamaToggleSwitch");
const ollamaToggleHint = document.getElementById("ollamaToggleHint");
const ollamaFields = document.getElementById("ollamaFields");
const ollamaUrlInput = document.getElementById("ollamaUrlInput");
const ollamaModelInput = document.getElementById("ollamaModelInput");
const ollamaModelList = document.getElementById("ollamaModelList");
const ollamaTestBtn = document.getElementById("ollamaTestBtn");
const ollamaTestResult = document.getElementById("ollamaTestResult");

// toast
const toast = document.getElementById("toast");

// onboarding
const onboardScreen = document.getElementById("onboardScreen");
const onboardTitle = document.getElementById("onboardTitle");
const onboardBody = document.getElementById("onboardBody");
const onboardName = document.getElementById("onboardName");
const onboardPrimary = document.getElementById("onboardPrimary");
const onboardSkip = document.getElementById("onboardSkip");

let allItems = [];
let tab = "today";
let calendarMonth = startOfDay(new Date());
calendarMonth.setDate(1);
let openAddFor = null;
let justAddedId = null;
let activeFilter = "today"; // open on what's due today, not the whole list
// Narrower than the chips above: priority is one value or none; category is
// "show tasks in any of these" — a Set, since unlike a task's own single
// category, a filter naturally wants to allow several at once.
let filterPriority = null;
let filterCategories = new Set();
let expandedSections = new Set();
let editingItemId = null; // task whose reminder the picker is currently editing
let selectedDate = null;
let dayCreateOpen = false;
let detailItemId = null; // task shown full-screen, or null

let pendingWhen = { dueAt: null, hasTime: false, intervalDays: null };
let whenTouched = false;
let pendingPriority = null;
let pendingCategory = null;

// ---------------- icons ----------------
const iconCheck =
  '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l3.5 3.5L16 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const iconTrash =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h12M8 6V4.6c0-.6.5-1.1 1.1-1.1h1.8c.6 0 1.1.5 1.1 1.1V6M6 6l.6 9.4c0 .6.5 1.1 1.1 1.1h4.6c.6 0 1-.5 1.1-1.1L14 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const iconPlus =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 4.5v11M4.5 10h11" stroke-linecap="round"/></svg>';
const iconBell =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 3a4 4 0 0 0-4 4c0 3.5-1.2 4.7-1.2 4.7h10.4S14 10.5 14 7a4 4 0 0 0-4-4zM8.6 14.4a1.6 1.6 0 0 0 2.8 0" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const iconChevron =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 4l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Small static "Buddy is talking" avatar — nudge cards and Ask Buddy chat
// replies. Always the happy face; these are brief, friendly asides, not a
// mood readout the way the hero avatar is.
const buddyFaceSvg =
  '<svg class="buddy-face" viewBox="0 0 120 120" aria-hidden="true">' +
  '<ellipse class="buddy-eye" cx="42" cy="54" rx="5.5" ry="7"/><ellipse class="buddy-eye" cx="78" cy="54" rx="5.5" ry="7"/>' +
  '<path class="buddy-mouth-path mouth-happy" d="M40 76 Q60 90 80 76"/></svg>';

// Priority/category quick-pick rows appear twice — the composer sheet and
// the detail screen — so the markup is built once here rather than typed
// out in index.html or duplicated between the two call sites.
function priorityRowHtml() {
  return PRIORITIES.map(
    (p) =>
      `<button type="button" data-priority="${p}" style="--dot:var(--${PRIORITY_COLOR[p]})"><span class="quick-dot"></span>${PRIORITY_LABEL[p]}</button>`
  ).join("");
}
function categoryRowHtml() {
  return CATEGORIES.map(
    (c) =>
      `<button type="button" data-category="${c}" style="--dot:${CATEGORY_SWATCH[c]}"><span class="quick-dot"></span>${CATEGORY_LABEL[c]}</button>`
  ).join("");
}

// ---------------- toast ----------------
let toastTimer = null;
function showToast(msg) {
  toast.innerHTML = "";
  const inner = document.createElement("div");
  inner.className = "toast-inner";
  inner.textContent = msg;
  toast.appendChild(inner); // a fresh element each time, so the animation always restarts
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

// ---------------- when helpers ----------------
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

// ---------------- reminder editor (existing tasks only) ----------------
// `#whenPicker` now only edits the reminder on an existing task — the
// composer sheet has its own quick-pick chips instead. `editingItemId` is
// always set while it's open.
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
  if (!editingItemId) return; // the composer sheet writes pendingWhen directly
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
  whenPicker.hidden = false;
  whenPicker.classList.add("floating");
  syncPicker();
  positionPicker();
}

// Pinned to a fixed, scroll-independent spot near the top of the screen —
// the row it's editing lives inside the scrolling list, so anchoring to it
// would desync the instant the user scrolls.
function positionPicker() {
  if (whenPicker.hidden) return;
  const width = Math.min(340, window.innerWidth - 24);
  whenPicker.style.width = width + "px";
  whenPicker.style.left = "50%";
  whenPicker.style.transform = "translateX(-50%)";
  whenPicker.style.top = "12px";
}

window.addEventListener("resize", positionPicker);

function toggleWhenPicker(open) {
  const next = open === undefined ? whenPicker.hidden : open;
  whenPicker.hidden = !next;

  if (!next) {
    editingItemId = null;
    whenEditing.hidden = true;
    whenPicker.classList.remove("floating");
    whenPicker.style.cssText = "";
    return;
  }

  whenPicker.classList.add("floating");
  syncPicker();
  positionPicker();
}

// Click anywhere outside to dismiss. Nothing is discarded — every field
// writes straight to the task being edited, so there's no unsaved state to lose.
document.addEventListener("click", (e) => {
  if (whenPicker.hidden) return;
  if (!e.target.isConnected) return;
  if (e.target.closest("#whenPicker")) return;
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
  pendingWhen = { dueAt: null, hasTime: false, intervalDays: null };
  whenTouched = false;
  pendingPriority = null;
  pendingCategory = null;
}

// ---------------- greeting & buddy hero ----------------
const RING_CIRC = 2 * Math.PI * 41; // matches the ring's r=41 in index.html

function renderGreeting() {
  const today = new Date();
  const h = today.getHours();
  const part = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  greetingEl.textContent = `${part}, ${getOwnerName() || OWNER_NAME}`;
  dateLineEl.textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const { statusMsg, mood, buddyLine, ringOffset } = heroStatus(today);
  statusLine.textContent = statusMsg;
  ringProgress.style.strokeDashoffset = String(ringOffset);
  buddyEl.classList.remove("mood-happy", "mood-concerned", "mood-calm");
  buddyEl.classList.add("mood-" + mood);
  buddyLineEl.textContent = buddyLine;
  buddyLineEl.hidden = !buddyLine;
}

// today's done/total, for the progress ring — a non-recurring task counts as
// done for today only the day it was actually completed; a recurring task
// has no lingering completedAt (its dueAt just advances), so lastRecreatedAt
// is what says "this one was finished today".
function computeTodayProgress(today) {
  const topLevel = allItems.filter((it) => !it.parentId);
  let total = 0;
  let done = 0;
  topLevel.forEach((it) => {
    const finishedToday = it.recurring
      ? !!(it.lastRecreatedAt && daysBetween(it.lastRecreatedAt, today) === 0)
      : !!(it.completedAt && daysBetween(it.completedAt, today) === 0);
    const b = bucketOf(it, today);
    const openToday = b === "overdue" || b === "today";
    if (openToday || finishedToday) {
      total++;
      if (finishedToday) done++;
    }
  });
  return { done, total };
}

function heroStatus(today) {
  const statusMsg = statusText(today);
  const open = allItems.filter((it) => !it.parentId && bucketOf(it, today) !== "done");
  const overdue = open.filter((it) => bucketOf(it, today) === "overdue").length;
  const { done, total } = computeTodayProgress(today);

  let mood = "calm";
  let buddyLine = "";
  if (overdue) {
    mood = "concerned";
    buddyLine =
      overdue === 1 ? "One thing slipped past — want to tackle it first?" : `${overdue} things slipped past — want to tackle them first?`;
  } else if (total > 0 && done === total) {
    mood = "happy";
    buddyLine = "Everything's done for today. Nice work.";
  }

  const ratio = total ? done / total : 1;
  const ringOffset = RING_CIRC * (1 - ratio);
  return { statusMsg, mood, buddyLine, ringOffset };
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

// Four grouped chips rather than one per bucket: Today folds in anything
// already overdue (hiding something you've missed would be the opposite of
// helpful), Upcoming covers everything not due yet, and All/Done bookend it.
const FILTER_GROUPS = {
  today: ["overdue", "today"],
  upcoming: ["week", "month", "later"],
  all: ["overdue", "today", "week", "month", "later", "done"],
  done: ["done"],
};
const FILTERS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All" },
  { key: "done", label: "Done" },
];

const SECTION_CAP = 7;

function matchesFilter(item, today) {
  if (!FILTER_GROUPS[activeFilter].includes(bucketOf(item, today))) return false;
  if (filterPriority && item.priority !== filterPriority) return false;
  if (filterCategories.size && !filterCategories.has(item.category)) return false;
  return true;
}

function renderFilterBar() {
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

// Category only (not priority) gets its own pill on the list row, matching
// the reference: a category tag identifies what a task belongs to at a
// glance, where priority is something you'd check inside the task, not
// scan a whole list for.
function categoryPill(item) {
  if (!item.category) return "";
  return `<span class="pill cat-pill" style="--dot:${CATEGORY_SWATCH[item.category]}">${CATEGORY_LABEL[item.category]}</span>`;
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
  const catPill = depth === 0 ? categoryPill(item) : "";
  if (sub || pill || catPill) {
    const meta = document.createElement("div");
    meta.className = "row-meta";
    meta.innerHTML = pill + catPill + (sub ? `<span class="row-sub">${sub}</span>` : "");
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
  del.addEventListener("click", () => {
    removeItem(item.id);
    if (depth === 0) showToast("Deleted");
  });

  actions.appendChild(addSub);
  actions.appendChild(del);

  // Only top-level tasks get a detail screen — a subtask's "steps" would be
  // one level too deep to be worth its own full-screen view.
  if (depth === 0) {
    const open = document.createElement("button");
    open.className = "row-open";
    open.type = "button";
    open.setAttribute("aria-label", "Open task");
    open.innerHTML = iconChevron;
    open.addEventListener("click", () => openDetail(item.id));
    actions.appendChild(open);
  }

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

// ---------------- task detail (full screen) ----------------
function openDetail(id) {
  detailItemId = id;
  renderDetail();
  detailScreen.hidden = false;
}

function closeDetail() {
  detailScreen.hidden = true;
  detailItemId = null;
}

function renderDetail() {
  const item = allItems.find((i) => i.id === detailItemId);
  if (!item) {
    closeDetail();
    return;
  }
  const today = new Date();
  const done = !!(item.completedAt && !item.recurring);

  detailCheck.classList.toggle("done", done);
  detailTitle.textContent = item.title;
  detailTitle.classList.toggle("done", done);

  const when = { dueAt: item.dueAt, hasTime: !!item.hasTime, intervalDays: item.recurring ? item.recurring.intervalDays : null };
  detailReminderValue.textContent = describeWhen(when) || "None";

  detailPriority.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.priority === item.priority));
  });
  detailCategory.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.category === item.category));
  });
  // Only touch the field if it's not what the user is actively typing —
  // renderDetail() re-runs after every save, including this one's own.
  if (document.activeElement !== detailNotes) detailNotes.value = item.notes || "";

  const childrenMap = buildChildrenMap(allItems);
  const kids = childrenMap.get(item.id) || [];
  detailStepsLabel.textContent = kids.length ? `${kids.filter((k) => k.completedAt).length} of ${kids.length} done` : "";
  detailStepsList.innerHTML = "";
  kids.forEach((k) => {
    const row = document.createElement("div");
    row.className = "detail-step-row";

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check" + (k.completedAt ? " done" : "");
    check.setAttribute("aria-label", "Mark step done");
    check.innerHTML = iconCheck;
    check.addEventListener("click", async () => {
      await completeItem(k, check);
      renderDetail();
    });

    const title = document.createElement("span");
    title.className = "detail-step-title" + (k.completedAt ? " done" : "");
    title.textContent = k.title;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "row-delete";
    del.setAttribute("aria-label", "Delete step");
    del.innerHTML = iconTrash;
    del.addEventListener("click", async () => {
      await removeItem(k.id);
      renderDetail();
    });

    row.appendChild(check);
    row.appendChild(title);
    row.appendChild(del);
    detailStepsList.appendChild(row);
  });

  detailFootnote.textContent = `Added ${dayLabel(item.createdAt, today)}.`;
}

detailBack.addEventListener("click", closeDetail);
detailDelete.addEventListener("click", async () => {
  if (!detailItemId) return;
  await removeItem(detailItemId);
  closeDetail();
  showToast("Deleted");
});
detailCheck.addEventListener("click", async () => {
  const item = allItems.find((i) => i.id === detailItemId);
  if (!item) return;
  await completeItem(item, detailCheck);
  renderDetail();
});
detailTitle.addEventListener("blur", async () => {
  const item = allItems.find((i) => i.id === detailItemId);
  if (!item) return;
  const v = detailTitle.textContent.trim();
  if (v && v !== item.title) await saveUpdate(item.id, { title: v });
  else detailTitle.textContent = item.title;
});
detailTitle.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    detailTitle.blur();
  }
});

detailPriority.innerHTML = priorityRowHtml();
detailCategory.innerHTML = categoryRowHtml();
// Unlike the composer's pendingPriority/pendingCategory, this edits an
// existing task directly — same tap-again-to-clear behavior, but each tap
// saves immediately rather than waiting on a form submit.
detailPriority.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const item = allItems.find((i) => i.id === detailItemId);
    if (!item) return;
    const priority = item.priority === btn.dataset.priority ? null : btn.dataset.priority;
    await saveUpdate(item.id, { priority });
    renderDetail();
  });
});
detailCategory.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const item = allItems.find((i) => i.id === detailItemId);
    if (!item) return;
    const category = item.category === btn.dataset.category ? null : btn.dataset.category;
    await saveUpdate(item.id, { category });
    renderDetail();
  });
});
detailNotes.addEventListener("blur", async () => {
  const item = allItems.find((i) => i.id === detailItemId);
  if (!item) return;
  const v = detailNotes.value;
  if (v !== item.notes) await saveUpdate(item.id, { notes: v });
});

detailReminderRow.addEventListener("click", (e) => {
  const item = allItems.find((i) => i.id === detailItemId);
  if (!item) return;
  openReminderEditor(item, e);
});

let detailStepCommitted = false;
async function commitDetailStep() {
  if (detailStepCommitted) return;
  detailStepCommitted = true;
  const v = detailStepInput.value.trim();
  const parentId = detailItemId;
  detailStepInput.value = "";
  if (v && parentId) {
    const created = await db.add({ title: v, parentId });
    pushItem(created);
  }
  detailStepCommitted = false;
  await loadAll();
  renderDetail();
}
detailStepAddBtn.addEventListener("click", commitDetailStep);
detailStepInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    commitDetailStep();
  }
});

function render() {
  const today = new Date();
  renderGreeting();
  renderFilterBar();
  renderListView(today);
  renderCalendarView();
  renderInsight(today);
  pollDueReminders(allItems);
  positionPicker(); // the row it's anchored to may have moved buckets
  if (detailItemId) renderDetail(); // reminder edits land while the detail screen is open
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
    listsEl.appendChild(renderEmptyState(activeFilter));
  }
}

// Copy and mood for each of the four filter chips' empty state. "today"
// gets the happy/caught-up read — it's the one that means "you're done for
// now"; the other three are just "nothing here yet", so a calmer mood fits
// better than a triumphant one. Bodies avoid restating the title (the hero
// line above already says "Nothing left for today" too — no need for a
// third phrasing of the same fact) and never mention adding a task: the
// composer bar sits right below this, always, so pointing at it here would
// just be describing a button that's already on screen.
const EMPTY_STATE_COPY = {
  today: {
    mood: "happy",
    title: "You're all caught up",
    body: "Enjoy the rest of your day, or get a head start on tomorrow.",
  },
  upcoming: {
    mood: "calm",
    title: "Nothing on the horizon",
    body: "Nothing scheduled ahead yet.",
  },
  all: {
    mood: "calm",
    title: "Nothing on your plate",
    body: "Whenever something's on your mind, type it below — or just say it.",
  },
  done: {
    mood: "calm",
    title: "Nothing finished yet",
    body: "Complete a task and it'll show up here.",
  },
};

// A standalone illustration, not the header's .buddy component scaled up.
// At 44px flat dot eyes and a rectangle mouth read fine as a small avatar;
// blown up as the screen's one focal image those same shapes look
// unfinished, and it'd put the same face on screen twice at once. SVG
// instead of CSS shapes so "happy" can be an actual smile curve, with a
// soft halo behind it for some presence rather than a bare flat icon.
function emptyIllustrationSvg(mood) {
  const mouth =
    mood === "happy"
      ? '<path d="M46 76 Q60 89 74 76" stroke="#1c1b1a" stroke-width="5.5" stroke-linecap="round" fill="none" opacity=".82"/>'
      : '<path d="M47 78 H73" stroke="#1c1b1a" stroke-width="5.5" stroke-linecap="round" opacity=".82"/>';
  return `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="emptyBuddyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--grad-a)"/>
          <stop offset="100%" stop-color="var(--grad-b)"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="url(#emptyBuddyGrad)" opacity=".14"/>
      <rect x="28" y="28" width="64" height="64" rx="24" fill="url(#emptyBuddyGrad)"/>
      <circle cx="48" cy="58" r="4.5" fill="#1c1b1a" opacity=".82"/>
      <circle cx="72" cy="58" r="4.5" fill="#1c1b1a" opacity=".82"/>
      ${mouth}
    </svg>`;
}

function renderEmptyState(filter) {
  const copy = EMPTY_STATE_COPY[filter] || EMPTY_STATE_COPY.today;

  const wrap = document.createElement("div");
  wrap.className = "empty-state";

  const face = document.createElement("div");
  face.className = "empty-illustration";
  face.innerHTML = emptyIllustrationSvg(copy.mood);
  wrap.appendChild(face);

  const title = document.createElement("p");
  title.className = "empty-state-title";
  title.textContent = copy.title;
  wrap.appendChild(title);

  const body = document.createElement("p");
  body.className = "empty-state-body";
  body.textContent = copy.body;
  wrap.appendChild(body);

  return wrap;
}

// Recurring tasks not currently overdue, out of all recurring tasks — a
// simple "on track" read on your habits without trying to reconstruct a
// full completion-streak history from the data model.
function computeHabitStat(items, today) {
  const habits = items.filter((it) => it.recurring && !it.parentId);
  if (!habits.length) return null;
  const onTrack = habits.filter((it) => bucketOf(it, today) !== "overdue").length;
  return { onTrack, total: habits.length };
}

function renderStats(today) {
  statsRow.innerHTML = "";
  const { done, total } = computeTodayProgress(today);
  const habitStat = computeHabitStat(allItems, today);

  const cards = [{ value: `${done}/${total}`, label: "Today's tasks done" }];
  if (habitStat) cards.push({ value: `${habitStat.onTrack}/${habitStat.total}`, label: "Habits on track" });

  cards.forEach((c) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<p class="stat-value">${c.value}</p><p class="stat-label">${c.label}</p>`;
    statsRow.appendChild(card);
  });
}

function renderInsight(today) {
  renderStats(today);

  const flags = computeFlags(allItems, today);
  insightBody.innerHTML = "";

  if (!flags.length) {
    insightBody.innerHTML =
      '<div class="nudge-empty"><p>Nothing has slipped</p><p>Every repeating task is inside its usual window, and nothing plain has been sitting too long. I’ll speak up when either changes.</p></div>';
    return;
  }

  flags.forEach((f) => {
    const card = document.createElement("div");
    card.className = "nudge";
    card.innerHTML =
      '<div class="nudge-avatar buddy mood-happy" aria-hidden="true">' + buddyFaceSvg + "</div>" +
      '<div class="nudge-bubble">' +
      '<p class="nudge-text"></p>' +
      '<div class="nudge-actions"><button class="nudge-add">Remind me today</button><button class="nudge-dismiss">Not now</button></div>' +
      "</div>";
    card.querySelector(".nudge-text").textContent = messageFor(f);
    card.querySelector(".nudge-add").addEventListener("click", () => recreateItem(f.item));
    card.querySelector(".nudge-dismiss").addEventListener("click", () => {
      saveUpdate(f.item.id, { lastRecreatedAt: new Date().toISOString() });
    });
    insightBody.appendChild(card);
  });
}

// ---------------- ask buddy (local model chat) ----------------
// Only ever reached from the Buddy tab, and only when switched on in
// Settings. Everything else in the app works exactly the same whether or
// not Ollama is running.
let chatHistory = []; // {role, content} — the conversation, without the system context
let chatBusy = false;

function renderChatSection() {
  const on = getOllamaEnabled();
  chatSection.hidden = !on;
  if (!on) return;
  if (!getOllamaModel()) {
    setChatStatus("Pick a model in Settings to start asking.", true);
    chatSend.disabled = true;
  } else if (!chatBusy) {
    chatSend.disabled = false;
    if (chatStatus.textContent.startsWith("Pick a model")) setChatStatus("");
  }
}

function setChatStatus(text, warn) {
  chatStatus.textContent = text;
  chatStatus.hidden = !text;
  chatStatus.classList.toggle("warn", !!warn);
}

function appendChatMessage(role, text) {
  const row = document.createElement("div");
  row.className = "chat-msg" + (role === "user" ? " from-me" : "");

  if (role !== "user") {
    const avatar = document.createElement("div");
    avatar.className = "nudge-avatar buddy mood-happy";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = buddyFaceSvg;
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "chat-msg-bubble";
  bubble.textContent = text;
  row.appendChild(bubble);

  chatThread.appendChild(row);
  row.scrollIntoView({ block: "nearest" });
  return bubble;
}

async function sendChatMessage(text) {
  if (chatBusy) return;
  const model = getOllamaModel();
  if (!model) {
    setChatStatus("Pick a model in Settings first.", true);
    return;
  }

  chatBusy = true;
  chatSend.disabled = true;
  setChatStatus("");

  const askedRow = appendChatMessage("user", text).parentElement;
  chatHistory.push({ role: "user", content: text });

  const bubble = appendChatMessage("assistant", "thinking…");
  bubble.classList.add("thinking");
  let started = false;

  // Rebuilt every turn so the model sees the task list as it is now,
  // not as it was when the conversation started.
  const system = buildContext(allItems, new Date(), { dayLabel, describeWhen });

  try {
    const reply = await ollamaChat({
      url: getOllamaUrl(),
      model,
      messages: [{ role: "system", content: system }, ...chatHistory],
      onToken(piece) {
        if (!started) {
          started = true;
          bubble.classList.remove("thinking");
          bubble.textContent = "";
        }
        bubble.textContent += piece;
        bubble.scrollIntoView({ block: "nearest" });
      },
    });
    chatHistory.push({ role: "assistant", content: reply });
  } catch (e) {
    // Roll the whole exchange back — thread and history together, so they
    // can't drift apart — and hand the question back for an easy retry.
    bubble.parentElement.remove();
    askedRow.remove();
    chatHistory.pop();
    if (!chatInput.value) chatInput.value = text;
    setChatStatus(
      e && e.name === "TypeError"
        ? `Couldn't reach Ollama at ${getOllamaUrl()}. Check it's running, and that OLLAMA_ORIGINS allows ${location.origin}.`
        : `Ollama couldn't answer: ${e.message}`,
      true
    );
  } finally {
    chatBusy = false;
    chatSend.disabled = false;
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  sendChatMessage(text);
});

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
    <div class="cal-header-text">
      <p class="eyebrow">Reminders only</p>
      <h2>${calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
    </div>
    <button type="button" class="cal-today" id="calToday">Today</button>
    <button type="button" class="cal-nav" id="calPrev" aria-label="Previous month">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5l-5 5 5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button type="button" class="cal-nav" id="calNext" aria-label="Next month">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 5l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  `;
  calendarWrap.appendChild(header);

  const card = document.createElement("div");
  card.className = "cal-card";

  const weekdayRow = document.createElement("div");
  weekdayRow.className = "cal-weekdays";
  weekdayRow.innerHTML = WEEKDAY_LABELS.map((d) => `<span>${d}</span>`).join("");
  card.appendChild(weekdayRow);

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
  card.appendChild(grid);
  calendarWrap.appendChild(card);

  const note = document.createElement("p");
  note.className = "cal-note";
  note.textContent = "Only tasks carrying a reminder appear here. Tap any day to see it, or to add one for that date.";
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
  // Re-armed every time anything changes (this is the one choke point
  // every mutation already runs through), so its content — and whether it
  // fires at all — stays as current as ordinary use allows.
  scheduleDailyNudge(computeFlags(allItems, new Date()));
}

async function saveUpdate(id, patch) {
  const updated = await db.update(id, patch);
  if (updated) {
    pushItem(updated);
    // Single choke point every edit path (writeWhen, completeItem,
    // recreateItem, ...) already funnels through, so this is the one place
    // that needs to keep a native alarm in sync with what actually changed:
    // reschedule to a new dueAt, or cancel if there's no longer a live one
    // to fire. `completedAt && !recurring` is the same "truly finished"
    // test used throughout this file (bucketOf, duePill, ...) — a
    // recurring task's completedAt marks its last run, not the end of it,
    // and its dueAt has already moved to the next occurrence.
    const trulyDone = updated.completedAt && !updated.recurring;
    if (updated.dueAt && !trulyDone) scheduleTrigger(updated);
    else cancelTrigger(id);
  }
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
  if (completing) showToast(item.recurring ? `Nice. Back again ${repeatLabel(item.recurring.intervalDays)}.` : "Nice one.");
}

async function recreateItem(item) {
  const now = new Date().toISOString();
  await saveUpdate(item.id, { dueAt: now, lastRecreatedAt: now, completedAt: null });
  showToast("Moved to today");
}

async function removeItem(id) {
  const childrenMap = buildChildrenMap(allItems);
  for (const did of [id, ...descendantIds(id, childrenMap)]) {
    await db.remove(did);
    pushDelete(did);
    cancelTrigger(did); // a deleted task shouldn't still buzz at its old time
  }
  await loadAll();
}

async function addFromCapture() {
  const raw = input.value.trim();
  if (!raw) return;
  const parsed = parseInput(raw, new Date());
  const when = effectiveWhen();

  const item = await db.add({
    title: parsed.title,
    dueAt: when.dueAt,
    hasTime: !!when.hasTime,
    recurring: when.intervalDays ? { intervalDays: when.intervalDays } : null,
    priority: pendingPriority,
    category: pendingCategory,
  });
  pushItem(item);
  scheduleTrigger(item);
  justAddedId = item.id;
  input.value = "";
  resetPendingWhen();
  closeComposer();
  const desc = describeWhen(when);
  showToast(desc ? `Added · ${desc}` : "Added to your list");
  await loadAll();
}

// ---------------- composer sheet ----------------
// Overridden fields (whenTouched) win; otherwise the reminder is whatever
// the typed text parses to right now — re-derived on demand rather than
// written into pendingWhen on every keystroke.
function effectiveWhen() {
  if (whenTouched) return pendingWhen;
  const v = input.value.trim();
  const parsed = v ? parseInput(v, new Date()) : { dueAt: null, hasTime: false, intervalDays: null };
  return { dueAt: parsed.dueAt, hasTime: !!parsed.hasTime, intervalDays: parsed.intervalDays };
}

function updateComposer() {
  const w = effectiveWhen();
  const desc = describeWhen(w);
  parseChip.textContent = desc || "No reminder — just a to-do";
  parseChip.classList.toggle("set", !!desc);

  const dayOffset = w.dueAt ? daysBetween(w.dueAt, new Date()) : null;
  quickDay.querySelectorAll("button").forEach((b) => {
    const key = b.dataset.day;
    const on =
      key === "none"
        ? !w.dueAt
        : key === "today"
        ? dayOffset === 0
        : key === "tomorrow"
        ? dayOffset === 1
        : key === "nextweek"
        ? dayOffset === 7
        : false;
    b.setAttribute("aria-pressed", String(on));
  });

  const curTime = w.hasTime && w.dueAt ? new Date(w.dueAt).toTimeString().slice(0, 5) : null;
  quickTime.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(curTime === b.dataset.time));
  });

  const curRepeat = w.intervalDays ? String(w.intervalDays) : "";
  quickRepeat.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.repeat === curRepeat));
  });

  quickPriority.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.priority === pendingPriority));
  });
  quickCategory.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.category === pendingCategory));
  });

  saveDraftBtn.textContent = w.dueAt || w.intervalDays ? "Save reminder" : "Save task";
}

function showComposerSheet() {
  updateComposer();
  composerOverlay.hidden = false;
  requestAnimationFrame(() => composerOverlay.classList.add("show"));
}

function openComposer() {
  input.value = "";
  pendingWhen = { dueAt: null, hasTime: false, intervalDays: null };
  whenTouched = false;
  pendingPriority = null;
  pendingCategory = null;
  showComposerSheet();
  setTimeout(() => input.focus(), 50);
}

function closeComposer() {
  composerOverlay.classList.remove("show");
  setTimeout(() => {
    composerOverlay.hidden = true;
  }, 180);
}

function quickDayDate(key) {
  if (key === "today") return startOfDay(new Date());
  if (key === "tomorrow") return addDays(startOfDay(new Date()), 1);
  if (key === "nextweek") return addDays(startOfDay(new Date()), 7);
  return null;
}

fabAdd.addEventListener("click", () => openComposer());
composerClose.addEventListener("click", () => closeComposer());
composerOverlay.addEventListener("click", (e) => {
  if (e.target === composerOverlay) closeComposer();
});

quickDay.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const w = effectiveWhen();
    whenTouched = true;
    const key = btn.dataset.day;
    if (key === "none") {
      pendingWhen = { dueAt: null, hasTime: false, intervalDays: w.intervalDays };
    } else {
      const next = quickDayDate(key);
      if (w.hasTime && w.dueAt) {
        const prev = new Date(w.dueAt);
        next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      }
      pendingWhen = { dueAt: next.toISOString(), hasTime: w.hasTime, intervalDays: w.intervalDays };
    }
    updateComposer();
  });
});

quickTime.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const w = effectiveWhen();
    whenTouched = true;
    const [h, m] = btn.dataset.time.split(":").map(Number);
    const base = w.dueAt ? new Date(w.dueAt) : startOfDay(new Date());
    base.setHours(h, m, 0, 0);
    pendingWhen = { dueAt: base.toISOString(), hasTime: true, intervalDays: w.intervalDays };
    updateComposer();
  });
});

quickRepeat.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const w = effectiveWhen();
    whenTouched = true;
    const intervalDays = btn.dataset.repeat ? parseInt(btn.dataset.repeat, 10) : null;
    const dueAt = intervalDays && !w.dueAt ? startOfDay(new Date()).toISOString() : w.dueAt;
    pendingWhen = { dueAt, hasTime: w.hasTime, intervalDays };
    updateComposer();
  });
});

// Priority and category rows are populated from taxonomy.js rather than
// written out in index.html, so there's one list to keep in sync, not two.
// Tapping the already-selected option clears it — neither field has its
// own explicit "None" button the way quickDay/quickRepeat do. Each button
// carries its own accent as a --dot custom property, so the selected
// state can use that color (CSS) instead of the generic honey used
// elsewhere in this sheet — more useful here, since the color is the
// whole point of picking one.
quickPriority.innerHTML = priorityRowHtml();
quickCategory.innerHTML = categoryRowHtml();

quickPriority.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    pendingPriority = pendingPriority === btn.dataset.priority ? null : btn.dataset.priority;
    updateComposer();
  });
});
quickCategory.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    pendingCategory = pendingCategory === btn.dataset.category ? null : btn.dataset.category;
    updateComposer();
  });
});

// ---------------- filter sheet ----------------
// Draft state, committed to the real filterPriority/filterCategories only
// on Apply — Reset/Apply buttons imply "try some choices, then commit,"
// unlike the composer's pickers (each tap there already writes straight
// into the field it belongs to; there's no draft to abandon).
let draftFilterPriority = null;
let draftFilterCategories = new Set();

filterPriorityRow.innerHTML = priorityRowHtml();
filterCategoryRow.innerHTML = categoryRowHtml();

function updateFilterSheet() {
  filterPriorityRow.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.priority === draftFilterPriority));
  });
  filterCategoryRow.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(draftFilterCategories.has(b.dataset.category)));
  });
}

filterPriorityRow.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    draftFilterPriority = draftFilterPriority === btn.dataset.priority ? null : btn.dataset.priority;
    updateFilterSheet();
  });
});
// Category filtering allows several at once — "show Work or Personal" — so
// each pill toggles independently instead of the tag-a-task single choice.
filterCategoryRow.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const c = btn.dataset.category;
    if (draftFilterCategories.has(c)) draftFilterCategories.delete(c);
    else draftFilterCategories.add(c);
    updateFilterSheet();
  });
});

function reflectFilterDot() {
  filterActiveDot.classList.toggle("show", !!filterPriority || filterCategories.size > 0);
}

function openFilterSheet() {
  draftFilterPriority = filterPriority;
  draftFilterCategories = new Set(filterCategories);
  updateFilterSheet();
  filterOverlay.hidden = false;
  requestAnimationFrame(() => filterOverlay.classList.add("show"));
}
function closeFilterSheet() {
  filterOverlay.classList.remove("show");
  setTimeout(() => {
    filterOverlay.hidden = true;
  }, 180);
}

filterOpenBtn.addEventListener("click", openFilterSheet);
filterClose.addEventListener("click", closeFilterSheet);
filterOverlay.addEventListener("click", (e) => {
  if (e.target === filterOverlay) closeFilterSheet();
});
filterReset.addEventListener("click", () => {
  draftFilterPriority = null;
  draftFilterCategories = new Set();
  updateFilterSheet();
});
filterApply.addEventListener("click", () => {
  filterPriority = draftFilterPriority;
  filterCategories = draftFilterCategories;
  reflectFilterDot();
  closeFilterSheet();
  expandedSections.clear();
  render();
});

// ---------------- capture UI ----------------
input.addEventListener("input", () => updateComposer());

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addFromCapture();
});

saveDraftBtn.addEventListener("click", () => addFromCapture());

// ---------------- tab bar ----------------
const panels = { today: panelToday, calendar: panelCalendar, buddy: panelBuddy, settings: panelSettings };
const tabButtons = { today: tabToday, calendar: tabCalendar, buddy: tabBuddy, settings: tabSettings };

function setTab(next) {
  tab = next;
  Object.entries(tabButtons).forEach(([k, b]) => b.setAttribute("aria-pressed", String(k === tab)));
  Object.entries(panels).forEach(([k, el]) => {
    el.hidden = k !== tab;
  });
  todayHero.hidden = tab !== "today";
  if (tab === "buddy") renderChatSection();
  if (tab === "settings") {
    reflectThemeButtons();
    reflectToggles();
    renderLockPreview(new Date());
  }
}

Object.entries(tabButtons).forEach(([k, b]) => b.addEventListener("click", () => setTab(k)));

dayModalOverlay.addEventListener("click", (e) => {
  if (e.target === dayModalOverlay) closeDayModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!whenPicker.hidden) toggleWhenPicker(false);
  else if (!dayModalOverlay.hidden) closeDayModal();
  else if (!composerOverlay.hidden) closeComposer();
  else if (!detailScreen.hidden) closeDetail();
});

// ---------------- settings ----------------
const VOICE_AUTO_HINTS = {
  true: "Creates the task the moment you stop talking.",
  false: "Fills in what you said — press Enter or tap + to create it.",
};

function reflectThemeButtons() {
  const color = getColorTheme();
  const mode = getMode();
  const fontScale = getFontScale();
  const voiceAuto = String(getVoiceAutoCreate());

  themeGrid.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.colorTheme === color));
  });
  modeSwitch.querySelectorAll("button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
  });
  fontSizeSwitch.querySelectorAll("button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.fontScale === fontScale));
  });
  voiceAutoSwitch.querySelectorAll("button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.voiceAuto === voiceAuto));
  });
  voiceAutoHint.textContent = VOICE_AUTO_HINTS[voiceAuto];

  const tone = getReminderTone();
  toneSwitch.querySelectorAll("button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String((btn.dataset.tone || "") === tone));
  });
}

// A notification permission, once granted, can't be revoked from JS — only
// from the OS/browser's own settings — so this toggle can only ever turn
// itself on; "off" just means "not asked yet".
function reflectToggles() {
  const granted = notificationsSupported && getPermissionState() === "granted";
  notifToggleSwitch.classList.toggle("on", granted);
  notifToggleHint.textContent = !notificationsSupported
    ? "Not supported here."
    : granted
    ? isNative
      ? "On — change this in Android's app notification settings to turn off."
      : "On — change this in your browser's site settings to turn off."
    : isNative
    ? "Buddy will ask Android for permission."
    : "Buddy will ask your browser for permission.";

  // Both of these only do anything in the installed app, but saying "native
  // app only" to someone who *is* in the native app is just confusing — so
  // each side gets the sentence that's true where it's being read.
  toneHint.textContent = isNative
    ? "Tap a tone to hear it. This is what your reminders will sound like."
    : "Native app only — a browser has no way to set a notification's sound. Tapping a tone plays it here so you can hear it first.";

  dailyNudgeHint.textContent = isNative
    ? "Only sent when something's actually pending, and only fires once — it renews itself each time you open Buddy."
    : "Native app only. Only sent when something's actually pending, and only fires once — it renews itself each time you open Buddy.";

  const syncOn = isSyncEnabled();
  syncToggleSwitch.classList.toggle("on", syncOn);
  // This one isn't a real switch — sync is on only if js/firebase-config.js
  // exists with syncEnabled: true in it, set up by hand per the README, not
  // toggled from here. So unlike the other hints, there's no click to
  // react to; this just needs to stay honest about which state it's in.
  syncToggleHint.textContent = syncOn
    ? "On — syncing across your devices."
    : "Off until you add your own Firebase config.";

  const ollamaOn = getOllamaEnabled();
  ollamaToggleSwitch.classList.toggle("on", ollamaOn);
  ollamaToggleHint.textContent = ollamaOn
    ? "A chat box appears on the Buddy tab."
    : "Ask a model running on your own computer about your tasks.";
  ollamaFields.hidden = !ollamaOn;
  ollamaUrlInput.value = getOllamaUrl();
  ollamaModelInput.value = getOllamaModel();

  const dailyOn = getDailyNudgeEnabled();
  dailyNudgeToggleSwitch.classList.toggle("on", dailyOn);
  dailyNudgeTimeRow.hidden = !dailyOn;
  dailyNudgeTimeInput.value = getDailyNudgeTime();
}

// Reschedules every currently-pending reminder so a changed tone (or a
// disabled/re-enabled notification permission) applies retroactively, not
// just to reminders created from now on — same rebuild-pending-triggers
// pattern used whenever a setting that shapes an already-scheduled
// notification changes.
function rescheduleAllPendingTriggers() {
  allItems.filter((it) => it.dueAt && !(it.completedAt && !it.recurring)).forEach((it) => scheduleTrigger(it));
}

toneSwitch.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tone = btn.dataset.tone || "";
    setReminderTone(tone);
    reflectThemeButtons();
    if (tone) {
      tonePreviewAudio.src = `sounds/${tone}.wav`;
      tonePreviewAudio.play().catch(() => {});
    }
    rescheduleAllPendingTriggers();
  });
});

dailyNudgeToggleRow.addEventListener("click", () => {
  setDailyNudgeEnabled(!getDailyNudgeEnabled());
  reflectToggles();
  scheduleDailyNudge(computeFlags(allItems, new Date()));
});

dailyNudgeTimeInput.addEventListener("change", () => {
  setDailyNudgeTime(dailyNudgeTimeInput.value);
  scheduleDailyNudge(computeFlags(allItems, new Date()));
});

ollamaToggleRow.addEventListener("click", () => {
  setOllamaEnabled(!getOllamaEnabled());
  reflectToggles();
  renderChatSection();
});

ollamaUrlInput.addEventListener("change", () => {
  setOllamaUrl(ollamaUrlInput.value);
  ollamaUrlInput.value = getOllamaUrl();
});

ollamaModelInput.addEventListener("change", () => {
  setOllamaModel(ollamaModelInput.value);
  renderChatSection();
});

ollamaTestBtn.addEventListener("click", async () => {
  setOllamaUrl(ollamaUrlInput.value);
  ollamaUrlInput.value = getOllamaUrl();
  ollamaTestResult.textContent = "Checking…";
  ollamaTestResult.className = "settings-hint";
  try {
    const models = await listModels(getOllamaUrl());
    ollamaModelList.innerHTML = "";
    models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      ollamaModelList.appendChild(opt);
    });
    if (!models.length) {
      ollamaTestResult.textContent = "Connected, but no models installed. Try `ollama pull llama3.2`.";
      ollamaTestResult.className = "settings-hint warn";
      return;
    }
    // nothing chosen yet — take the first installed model as the default
    if (!getOllamaModel()) {
      setOllamaModel(models[0]);
      ollamaModelInput.value = models[0];
      renderChatSection();
    }
    ollamaTestResult.textContent = `Connected. ${models.length} model${models.length === 1 ? "" : "s"}: ${models.join(", ")}`;
    ollamaTestResult.className = "settings-hint ok";
  } catch (e) {
    ollamaTestResult.textContent =
      e && e.name === "TypeError"
        ? `No answer from ${getOllamaUrl()}. Check Ollama is running and that OLLAMA_ORIGINS allows ${location.origin}.`
        : `Ollama replied with an error: ${e.message}`;
    ollamaTestResult.className = "settings-hint warn";
  }
});

notifToggleRow.addEventListener("click", async () => {
  if (!notificationsSupported) return;
  if (getPermissionState() === "granted") {
    showToast(isNative ? "Already on — turn off from Android's app settings" : "Already on — turn off from your browser's site settings");
    return;
  }
  await requestPermission();
  reflectToggles();
  refreshBell();
});

syncToggleRow.addEventListener("click", () => {
  if (isSyncEnabled()) return;
  showToast("Needs a Firebase config first");
});

// An illustration of what a reminder notification looks like, filled in
// with the most urgent real task — a PWA can't actually render on the OS
// lock screen, so this just shows the intent.
function renderLockPreview(today) {
  lockPreviewDate.textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  lockPreviewTime.textContent = today.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const open = allItems.filter((it) => !it.parentId && ["overdue", "today"].includes(bucketOf(it, today)));
  sortBucket(open);
  const item = open[0];

  if (!item) {
    lockCard.hidden = true;
    lockPreviewEmpty.hidden = false;
    return;
  }
  lockPreviewEmpty.hidden = true;
  lockCard.hidden = false;
  lockCardTitle.textContent = item.title;
  const when = { dueAt: item.dueAt, hasTime: !!item.hasTime, intervalDays: item.recurring ? item.recurring.intervalDays : null };
  lockCardSub.textContent = describeWhen(when) || "Reminder";
}

themeGrid.querySelectorAll(".theme-swatch").forEach((btn) => {
  btn.addEventListener("click", () => {
    setColorTheme(btn.dataset.colorTheme);
    reflectThemeButtons();
  });
});
modeSwitch.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
    reflectThemeButtons();
  });
});
fontSizeSwitch.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    setFontScale(btn.dataset.fontScale);
    reflectThemeButtons();
  });
});
voiceAutoSwitch.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    setVoiceAutoCreate(btn.dataset.voiceAuto === "true");
    reflectThemeButtons();
  });
});

// ---------------- voice ----------------
// The mic now lives inside the composer sheet's input (was a standalone
// FAB) — starting it while the sheet is already open works unchanged
// because .voice-overlay's z-index (60) already sits above .modal-overlay
// (50), so it simply covers the sheet rather than needing to close it.
if (!voiceSupported) {
  captureMicBtn.style.display = "none";
} else {
  let recording = false;
  // Voice is a single "say it, it's done" gesture — no Enter, no tapping +.
  // Only fire that once real speech actually came back this session, and
  // not if it errored out (offline, blocked mic) with nothing usable said —
  // otherwise a failed listen could silently submit whatever stale text was
  // already sitting in the box before the mic was tapped.
  let voiceHeardSomething = false;
  let voiceHadError = false;

  const voice = createVoiceInput({
    onStart() {
      recording = true;
      voiceHeardSomething = false;
      voiceHadError = false;
      voiceTranscript.textContent = "Listening…";
      voiceStatus.hidden = true;
      voiceOverlay.hidden = false;
      requestAnimationFrame(() => voiceOverlay.classList.add("show"));
    },
    onEnd() {
      recording = false;
      closeVoiceOverlay();
      if (voiceHeardSomething && !voiceHadError) {
        if (getVoiceAutoCreate()) addFromCapture();
        else showComposerSheet(); // review mode — sheet was hidden while listening
      }
    },
    onResult(text) {
      voiceHeardSomething = !!text.trim();
      voiceTranscript.textContent = text ? `“${text}”` : "Listening…";
      input.value = text;
      input.dispatchEvent(new Event("input"));
    },
    onError(reason) {
      recording = false;
      voiceHadError = true;
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

  captureMicBtn.addEventListener("click", () => {
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
  notifyPrompt.classList.toggle("show", getPermissionState() === "default");
  notifyEnable.title = getPermissionState() === "granted" ? "Notifications are on" : "Turn on notifications";
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
// Skipped inside the native Android app: asset requests there go through
// Capacitor's own local-server interception rather than the path a
// registered SW expects (registration is unreliable there), and both of
// its jobs are moot on native anyway — the WebView already has every asset
// bundled locally, and @capacitor/local-notifications now handles the
// background-notification job the experimental TimestampTrigger path was
// standing in for.
if (!isNative && "serviceWorker" in navigator) {
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

// ---------------- onboarding (first run only) ----------------
function startOnboarding() {
  let step = 0;
  onboardName.value = getOwnerName();

  function renderStep() {
    if (step === 0) {
      onboardTitle.textContent = "Hi, I'm Buddy.";
      onboardBody.textContent =
        "Tell me what's on your mind — by typing or talking. I keep it on this phone, and I notice when something you usually do slips.";
      onboardName.hidden = false;
      onboardPrimary.textContent = "Let's go";
      onboardSkip.textContent = "Skip for now";
    } else {
      onboardTitle.textContent = "Want me to nudge you?";
      onboardBody.textContent =
        "I'll only speak up for reminders you set, and when a repeating task drifts more than two days late. You can change this any time in Settings.";
      onboardName.hidden = true;
      onboardPrimary.textContent = "Turn on reminders";
      onboardSkip.textContent = "Not now";
    }
  }

  function finish(withNotif) {
    const name = onboardName.value.trim();
    if (name) setOwnerName(name);
    setOnboarded();
    onboardScreen.hidden = true;
    if (withNotif) requestPermission().then(refreshBell);
    renderGreeting();
  }

  onboardPrimary.addEventListener("click", () => {
    if (step === 0) {
      step = 1;
      renderStep();
    } else {
      finish(true);
    }
  });
  onboardSkip.addEventListener("click", () => {
    if (step === 0) {
      step = 1;
      renderStep();
    } else {
      finish(false);
    }
  });

  renderStep();
  onboardScreen.hidden = false;
}

// ---------------- boot ----------------
initTheme(); // index.html already set the attributes pre-paint; this just syncs the meta color and re-runs the same logic
setTab("today");
reflectThemeButtons();
loadAll();
if (!isOnboarded()) startOnboarding();
setInterval(() => pollDueReminders(allItems), 45000);

# Buddy Reminder — Build Prompt

Build **Buddy Reminder**, a lightweight, offline-first task & reminder PWA that feels like a helpful friend, not a corporate productivity tool.

## Core concept

A voice-and-UI task/reminder app that proactively notices patterns in what the user does and gently nudges them about things they've likely forgotten — e.g. they buy chicken every 2 weeks but skipped this cycle, so the app suggests recreating that reminder.

## Architecture (decided)

- **Offline-first PWA** — installable to a phone's home screen, fully usable with zero network connection. This is non-negotiable: opening the app, adding tasks/reminders, viewing lists, and getting nudges must all work in airplane mode.
- **Local storage**: IndexedDB is the source of truth on-device. Every read/write hits IndexedDB first; the UI never blocks on network.
- **Optional cloud sync**: when online, sync to a **free-tier backend only** (Firebase Firestore Spark plan, or equivalent free tier — no paid tier, no credit card requirement, no feature that could incur charges). Sync is best-effort and additive: if sync fails or the user is offline, the app keeps working locally with zero degradation, and syncs silently when connectivity returns. Never block a user action on the network.
- **Service worker** precaches the app shell (HTML/CSS/JS/icons) so the app itself opens offline after first install, not just its data.
- **Manifest.json** for installability (name, icons, standalone display mode, theme colors).
- Vanilla HTML/CSS/JS — no heavy framework. The app must stay genuinely lightweight (small bundle, fast open/close) since "light and fast to open/use/close" is the core product pitch, not a footnote.

## Features

### P0 (MVP)
1. **Add task or reminder** via a text field AND a mic button (Web Speech API `SpeechRecognition`, with graceful fallback to text-only when voice/network isn't available — note Chrome's default recognizer needs network, so voice capture may itself be online-only; don't block the rest of the app on it).
2. **List view** — all tasks grouped into Overdue / Today / Coming up / Anytime / Done. Tasks carrying a reminder show a bell chip with the day (and time, if set); plain to-dos sit in **Anytime** with no date furniture at all.
3. **Mark done / delete / edit** an item.
4. **Recurring items**: user can explicitly tag an item as recurring with an interval (e.g. every 2 weeks), rather than relying on the app to infer recurrence from zero history.
5. **Buddy Insights panel**: deterministic, rule-based logic (no external AI calls — keep this fully offline and free) that checks recurring items against their expected next-due date and flags ones that are overdue for re-creation, e.g. "You usually add 'buy chicken' every 2 weeks — it's been 3. Want to set it up again?" One-tap to recreate.
6. **Local notifications** for due reminders (via the Notifications API / service worker), working offline.

### P1 (next)
- Smart bundling: group same-day small errands into one suggested batch.
- Nag escalation: a missed reminder gets a single gentler follow-up nudge rather than repeat identical alerts (avoid notification fatigue — cap proactive nudges to a small number per day).
- Persona/tone setting (encouraging buddy / minimalist / witty) — just changes copy templates, still no external AI call needed.

### P2 (later, online-only, opt-in)
- Cloud sync across devices via the free-tier backend.
- Natural-language voice parsing ("remind me to drop off dry cleaning when I leave work tomorrow") if a free/low-cost NLP path exists — otherwise keep manual structured entry (text/date/recurrence fields) as the reliable baseline.

## Data model (IndexedDB)

Item: `{ id, title, dueAt, hasTime, recurring: { intervalDays } | null, createdAt, completedAt, lastRecreatedAt, parentId }`

**There is no task-vs-reminder type.** Everything is a task. A "reminder"
is just an optional `dueAt` (+ `hasTime`, + `recurring`) attached to a
task — that's what makes it notify you and what puts it on the calendar.
A plain to-do simply has `dueAt: null` and lives in the list only.

`parentId` links a subtask to its parent item's `id` (`null` for top-level
items). Subtasks don't carry their own `dueAt`/`recurring` — completion
rolls up into a `done/total` progress chip on the parent.

## Implemented beyond the original P0/P1/P2 scope

- **Subtasks**: any item can have child items added inline from a `+`
  button on its row, nested to any depth (a subtask can itself have
  subtasks). Deleting a parent recursively deletes its whole subtree.
- **Calendar view**: a second, toggleable view alongside the list — a
  month grid with a dot per due item per day, previous/next/today
  navigation, and a day modal (tap a date) that lists that day's items
  and lets you add a new item — with its own repeat interval — for that
  specific date.

## Non-functional requirements

- **Free tier only, always.** No feature may require a paid plan, API key with billing, or credit card. If a free tier has a hard cap, design so normal personal use never approaches it, and fail gracefully (local-only) rather than erroring if it's ever exceeded.
- Fast open/close — no heavy load screens; app shell must render instantly from cache.
- Works installed as a home-screen PWA on Android/iOS Safari (note iOS PWA notification support is limited — document this constraint rather than silently failing).
- Clean, friendly, low-clutter UI; not a dense productivity dashboard.

## Deliverable

A working PWA in this repo (`buddy-reminder/`) with `index.html`, `manifest.json`, a service worker, app JS/CSS, and install/deploy instructions (e.g. via GitHub Pages, free) so it can be installed on a phone and tested offline.

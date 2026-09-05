# Buddy Reminder

A lightweight, offline-first task & reminder PWA. Add things by voice or
text, break a task into subtasks, see everything on one clean list or a
month calendar, and let Buddy notice when a recurring habit slipped —
without any server, account, or paid tier required.

## What's here

```
buddy-reminder/
  index.html            app shell
  manifest.json          PWA install metadata
  service-worker.js      precaches the shell for offline use
  css/app.css
  js/
    app.js               UI + orchestration (list view, calendar view, day modal)
    db.js                IndexedDB wrapper (source of truth, on-device)
    insights.js           deterministic "you forgot X" pattern detection
    parse.js              "every 2 weeks" / "tomorrow" / "at 5pm" text parsing
    calendar.js            pure month-grid helpers for the calendar view
    voice.js               Web Speech API wrapper
    notify.js               local notifications for due reminders
    sync.js                 optional Firebase sync — no-op until configured
    firebase-config.example.js
  icons/                  app icons (generated, buddy-blob mark)
```

### One thing: a task

There's no "task vs. reminder" split. You add a task. If you also want to
be nudged about it, you attach a reminder — a day, optionally a time,
optionally a repeat — either by typing it naturally ("take medicine every
day at 9am") or by tapping **Remind me** and picking. A task without a
reminder is just a to-do: it stays in your list and never touches the
calendar.

### Two views

- **List** — everything, grouped into **Overdue / Today / This week /
  This month / Beyond this month / Done**. A task with no reminder ages
  forward through those same windows from the day you wrote it down, so
  it drifts down the list instead of being stranded in a bucket nobody
  reads. Filter chips mirror the sections one-for-one, and each section
  shows its latest 7 with a *Show more*. Any task can have subtasks (tap
  the **+** on a row, nests to any depth); a parent shows a `done/total`
  progress chip once it has children.
- **Calendar** — a month grid of *only* the tasks carrying a reminder
  (tap ‹ › or **Today** to navigate); each day shows a dot per reminder.
  Tapping a day lists that day's reminders and lets you add one for that
  date without leaving the calendar.

Everything runs from static files. No build step, no framework, no backend
of its own.

## Run it locally

Service workers require `http(s)://` or `localhost` — opening `index.html`
directly via `file://` will skip offline caching. Serve the folder with
anything static, e.g.:

```bash
python -m http.server 8833
```

Then open `http://localhost:8833`. To actually test offline behavior:
open it once (so the service worker installs), then turn on airplane mode
or kill your network and reload — the app shell and your data should both
still work.

## Testing on an Android phone

PWA features (service worker, offline, install, notifications) only run in
a **secure context** — HTTPS, or `localhost`. A plain `http://192.168.x.x`
address loads the page but silently disables all of them, so the app will
look like it works while quietly not being a PWA at all.

**Best option — USB port forwarding.** Gives the phone a real `localhost`,
so everything works without deploying:

1. Phone: Settings → About phone → tap **Build number** seven times, then
   Developer options → **USB debugging** on.
2. Plug the phone in, accept the "Allow USB debugging" prompt.
3. Desktop Chrome: open `chrome://inspect/#devices` → **Port forwarding…**
   → tick *Enable port forwarding* → add `8833` → `localhost:8833`.
4. On the phone open Chrome at `http://localhost:8833`, then ⋮ →
   **Add to Home screen**.

**Quick look only — same Wi-Fi.** `http://<your-lan-ip>:8833`. Needs an
inbound firewall rule for the port, and gets you layout checking only, not
offline or install.

## Deploy for free — GitHub Pages

GitHub Pages serves from a branch root or a `/docs` folder — **not** from
an arbitrary subfolder — so `buddy-reminder/` needs to be at the root of
its own repo (or copied to `/docs`).

1. Create a new **public** repo on GitHub (Pages on free accounts requires
   public), then from inside `buddy-reminder/`:
   ```bash
   git init && git add . && git commit -m "Buddy Reminder"
   git remote add origin https://github.com/<you>/buddy-reminder.git
   git push -u origin main
   ```
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main`
   → `/ (root)`.
3. You get `https://<you>.github.io/buddy-reminder/` — HTTPS, so the full
   PWA works, installable from the phone's browser menu. Free tier, no
   billing involved.

Any other static host works the same way (Cloudflare Pages, Netlify free
tier, Vercel free tier) — there's nothing server-specific here.

## Install it on your phone

- **Android (Chrome)**: open the deployed URL → menu (⋮) → **Add to Home
  screen** / **Install app**.
- **iOS (Safari)**: open the deployed URL → Share sheet → **Add to Home
  Screen**.

Once installed, it opens instantly from cache — no loading screen, no
network required to open the app itself.

### iOS notification limitation (real constraint, not a bug)

iOS Safari — including installed home-screen PWAs — has no support for
the Notification Triggers API this app uses for exact-time background
alerts, and web push on iOS requires the PWA to be added to the home
screen *and* iOS 16.4+, with the user granting permission from inside the
installed app (not Safari itself). Practically: on iOS, treat Buddy
Reminder as a list you check rather than something that will reliably
interrupt you — due/overdue items are always visible the moment you open
the app regardless of notification support. Android Chrome has the full
picture: foreground polling always, plus best-effort background triggers
when the app was opened recently enough for the OS not to have killed its
service worker.

## Optional: sync across devices (free tier only)

By default Buddy Reminder is single-device, local-only — there is nothing
to set up. If you want the same list on your phone and laptop:

1. Create a **free** Firebase project at
   [console.firebase.google.com](https://console.firebase.google.com) —
   stay on the **Spark plan** (no credit card, no billing account, hard
   free quotas). Do not upgrade to Blaze.
2. Firestore Database → Create database → start in test mode, then lock
   it down (Firestore → Rules), e.g.:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /items/{itemId} {
         allow read, write: if true; // fine for a single personal project
                                      // nobody else has the URL/config to
       }
     }
   }
   ```
   This is intentionally simple (no auth) since it's your own private
   project's keys, not a public endpoint anyone can discover — but don't
   share your `firebase-config.js` publicly.
3. Project settings → your web app → copy the config object.
4. Copy `js/firebase-config.example.js` to `js/firebase-config.js`
   (already gitignored), paste your config in, and set
   `syncEnabled: true`.
5. Reload the app. Sync is additive and best-effort: if you're offline or
   the project is misconfigured, the app just keeps working locally with
   zero degradation — nothing ever blocks on the network.

Firestore's Spark (free) plan caps at 50K reads / 20K writes / 1GiB
storage per day — a personal task list will never get close.

## Notes on voice capture

Chrome's built-in speech recognizer sends audio to a Google service to
transcribe it, so — counterintuitively — voice input needs a network
connection even though everything else in the app doesn't. Offline, the
mic button will show a friendly inline message and you can just type
instead; nothing else in the app is affected.

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
    app.js               UI + orchestration (tabs, list, calendar, detail, sheets)
    db.js                IndexedDB wrapper (source of truth, on-device)
    insights.js           deterministic "you forgot X" pattern detection
    parse.js              "every 2 weeks" / "tomorrow" / "at 5pm" text parsing
    calendar.js            pure month-grid helpers for the calendar view
    voice.js               Web Speech API wrapper
    notify.js               local notifications for due reminders
    theme.js                colour theme, light/dark, text size
    prefs.js                small settings (name, voice capture mode, Ollama)
    ollama.js               optional local-LLM chat — no-op until enabled
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

### Four tabs

- **Today** — Buddy up top with a ring showing today's progress and a face
  that reads the state of your day, over a list grouped into **Overdue /
  Today / This week / This month / Beyond this month / Done**. A task with
  no reminder ages forward through those same windows from the day you
  wrote it down, so it drifts down the list instead of being stranded in a
  bucket nobody reads. Four filter chips sit above it — **Today**
  (overdue + due today), **Upcoming**, **All**, **Done** — and each
  section shows its latest 7 with a *Show more*. Any task can have
  subtasks (tap the **+** on a row, nests to any depth); a parent shows a
  `done/total` progress chip once it has children. Tap the **›** on a task
  to open it full-screen.
- **Calendar** — a month grid of *only* the tasks carrying a reminder
  (tap ‹ › or **Today** to navigate); each day shows a dot per reminder.
  Tapping a day lists that day's reminders and lets you add one for that
  date without leaving the calendar.
- **Buddy** — what Buddy has noticed: today's progress and how many habits
  are on track, plus any nudges about repeating tasks that have drifted.
  Optionally a chat box too, if you've pointed it at a local model (see
  *Ask Buddy* below).
- **Settings** — theme, light/dark, text size, voice behaviour,
  notifications, sync, and the local-model chat.

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

## Android app (Capacitor) — a real app, not a browser tab

The PWA above is the whole app running inside Chrome. This is the same code
wrapped as an actual installed Android app via
[Capacitor](https://capacitorjs.com), which fixes the one thing the PWA
can't: real, OS-scheduled notifications. `@capacitor/local-notifications`
sets an exact Android alarm for every reminder, so it fires at its exact
time with the app fully closed — no experimental browser API, no best-effort.

This targets **your own device, sideloaded for free** — no Play Store, no
developer account, nothing that costs money. iOS isn't set up yet (it needs
a Mac to build).

**One-time setup:**
1. Install [Android Studio](https://developer.android.com/studio) — its
   SDK Manager brings the JDK, Android SDK, and `adb` together in one step.
2. From `buddy-reminder/`: `npm install`.

**Every time you want the app on your phone with the latest code:**
```bash
npm run sync:android    # rebuilds www/ from the real source, copies it into android/
npm run open:android    # opens the project in Android Studio
```
Then in Android Studio: connect your phone by USB with Developer Options →
USB debugging on, pick it as the run target, and click **Run**. That
installs a debug-signed APK directly — no store, no fee.

If a Gradle build fails right after `sync:android` with something like
*"not a regular file"* or *"unable to determine incremental changes,"*
that's this project living inside a OneDrive-synced folder — OneDrive can
momentarily represent a freshly-written file as a cloud placeholder before
Gradle gets to read it. It's a timing race, not a real problem: just run
the build again.

**What's different from the web build:** the app's own source (`index.html`,
`css/`, `js/`, etc.) is untouched and still what GitHub Pages serves —
`www/` is just a disposable, gitignored copy `npm run sync:android` builds
for Capacitor from that same source (see `scripts/build-www.mjs`). The
service worker isn't registered inside the native app (unreliable in a
Capacitor WebView, and redundant once local notifications take over its
job); `notify.js` detects the native app at runtime and switches to the real
scheduler automatically — nothing to configure.

**If you use [Ask Buddy](#optional-ask-buddy-local-model-via-ollama) from
the native app**, its origin is `https://localhost` — different from the web
build's `http://localhost:8833` (different scheme *and* port both count),
so it needs its own entry in `OLLAMA_ORIGINS` alongside that one, not instead
of it: `setx OLLAMA_ORIGINS "http://localhost:8833,https://localhost"`.

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

## Optional: ask Buddy (local model via Ollama)

Off by default. Switch it on and the **Buddy** tab gains a chat box that can
answer questions about your own tasks — "what did I miss this week?",
"what's on for Thursday?" — using a model running on your own computer via
[Ollama](https://ollama.com). Nothing goes to a cloud service, there's no
API key and no bill. It can currently only *read* your tasks; it won't
create or complete anything.

1. Install Ollama and pull a model:
   ```bash
   ollama pull llama3.2
   ```
2. **Let the browser talk to it.** Ollama rejects web origins it wasn't told
   about, and this is the step that catches everyone out. Set
   `OLLAMA_ORIGINS` to wherever Buddy is served from, then restart Ollama:
   ```bash
   # Windows (PowerShell), then restart Ollama from the tray
   setx OLLAMA_ORIGINS "http://localhost:8833"
   ```
   Use your Pages URL instead (e.g. `https://you.github.io`) if you're
   running the deployed copy. Comma-separate to allow more than one.
3. In Buddy: **Settings → Ask Buddy** → switch on → **Test connection**. It
   lists your installed models and picks one; change it if you'd rather use
   another.

If Ollama isn't reachable, the chat says so plainly and the rest of the app
carries on untouched — same rule as sync.

**On your phone this is harder.** Ollama runs on your computer, not the
handset, and a Buddy served over HTTPS can't call a plain `http://` address
on your LAN — browsers block that as mixed content. To use it from the
phone you'd need an HTTPS tunnel to your machine (Tailscale or Cloudflare
Tunnel, both free), then point the Server field at that address. On the same
computer that runs Ollama, it just works.

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

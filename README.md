# Buddy Reminder

A lightweight, offline-first task & reminder PWA. Add things by voice or
text, break a task into subtasks, see everything on one clean list or a
month calendar, have a WhatsApp message ready to send the moment a
reminder fires, and let Buddy notice when a recurring habit slipped —
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
    whatsapp.js             contact picker + wa.me link building
    theme.js                colour theme, light/dark, text size
    prefs.js                small settings (name, voice mode, country code)
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
- **Settings** — theme, light/dark, text size, voice behaviour,
  notifications, and the WhatsApp country code.

Everything runs from static files. No build step, no framework, no backend
of its own.

### Sending a WhatsApp message

A task can carry a message — who it's for and what it says. When its
reminder fires you get a **Send on WhatsApp** button on the notification
itself, and the same button sits on the task row and its detail screen.
Tapping it opens WhatsApp with the message already typed; you press send.

**Buddy doesn't send it for you, on purpose.** There's no free way to: the
official WhatsApp Business API costs money and needs a server behind it,
and the unofficial bridges break WhatsApp's terms and can get your number
banned. Neither belongs in an app that promises to stay free and local, so
Buddy does the part it can do well — having the right message ready for the
right person at the right moment — and leaves the send to you.

Pick the recipient straight from your phone's contacts (Chrome on Android;
each pick is its own one-off permission, Buddy never holds your address
book). Anywhere else, type the number — or leave it blank and let WhatsApp
ask who to send to. Set your **country code** in Settings so numbers saved
the local way (`0300 1234567`) resolve to the international form WhatsApp
links need.

The notification's action button needs Android; iOS doesn't support action
buttons on web notifications, so there you tap the notification to open
Buddy and send from the task.

#### Truly automatic sending (Android, optional)

If you want the message to go out with no tap at all, that has to happen on
the phone — no web app can send WhatsApp for you (see the note above). Turn
on **Settings → Automation payload** and every WhatsApp reminder's
notification gains a second line:

```
Call the plumber
[BUDDY-WA] https://wa.me/923001234567?text=Are%20you%20free%20this%20afternoon%3F
```

That's a machine-readable handle an automation app can act on. It has to be
in the visible text — an automation app can read a notification's title and
body, but not the hidden data the Send button uses. Leave the setting off
and notifications stay clean; it's only worth turning on if you're wiring
this up.

**MacroDroid recipe** (the free tier covers it):

1. **Trigger** → *Notification Received*. Application: the browser Buddy
   runs in (Chrome), or Buddy itself if you installed it to the home
   screen. Set *Text content contains* → `[BUDDY-WA]`.
2. **Action** → *Set Variable* (string, e.g. `waUrl`), value from the
   notification text with a regex of `\[BUDDY-WA\]\s+(\S+)` — capture
   group 1 is the link.
3. **Action** → *Open Website / Launch Intent* with `[lv=waUrl]`. WhatsApp
   opens with the message already typed.
4. **Action** → *UI Interaction → Click* the send button, with a short
   *Wait* before it so WhatsApp has finished opening.

Steps 1–2 need MacroDroid's notification access; step 4 needs its
accessibility permission. Tasker does the same job if you already own it.

Fair warning: bulk automated messaging is against WhatsApp's terms.
Device-level automation like this looks like an ordinary message from the
real app — unlike a `whatsapp-web.js` bridge, which is a known ban vector —
but keep it to your own genuine reminders, not blasts.

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

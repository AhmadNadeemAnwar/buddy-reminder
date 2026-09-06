// Local notifications for due reminders.
//
// Two entirely different implementations behind the same exported API,
// chosen at runtime by Capacitor.isNativePlatform() — every call site in
// app.js stays exactly as it is; only what happens inside changes.
//
//  - Native (the Android app): @capacitor/local-notifications schedules a
//    real OS-level alarm via LocalNotifications.schedule(). This fires at
//    its exact time even with the app fully closed — no experimental APIs,
//    no best-effort.
//  - Web (the PWA, e.g. GitHub Pages): unchanged from before — foreground
//    polling every 45s while the tab is open, plus the Notification
//    Triggers API for background firing where Chromium supports it
//    (experimental; not supported in Firefox, Safari, or iOS home-screen
//    PWAs — see README for the platform matrix).

// No bundler in this project — Capacitor's native host injects `window.
// Capacitor` directly into the WebView at runtime (that's how it supports
// plain script-tag apps with no build step at all), so this reads that
// global rather than `import`ing the npm package, which would 404 as a
// bare specifier in an unbundled <script type="module">. `@capacitor/core`
// and `@capacitor/local-notifications` are still real npm dependencies —
// `cap sync` needs them present to discover and wire the native plugin —
// just not ones this file's JS imports.
const Capacitor = typeof window !== "undefined" ? window.Capacitor : undefined;
const native = !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const LocalNotifications = native && Capacitor.Plugins ? Capacitor.Plugins.LocalNotifications : null;

// app.js needs this one bit too (to skip registering the service worker,
// which is unreliable inside a Capacitor WebView and redundant once native
// scheduling covers what it was standing in for) — exported so it doesn't
// have to duplicate the same window.Capacitor read.
export const isNative = native;

const notifiedIds = new Set();

export const notificationsSupported = native || "Notification" in window;

// LocalNotifications ids are 32-bit integers, but item ids here are short
// strings (see db.js's newId()) — hash to a stable int so the same task
// always maps to the same native notification id, letting a later
// schedule() or cancel() call target exactly the one already pending.
function numericIdFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  // The plugin documents a signed-32-bit range (-2147483648..2147483647);
  // Math.abs() on the boundary value would overflow that by 1, so mask the
  // sign bit off instead — guarantees [0, 2147483647].
  return (h & 0x7fffffff) || 1;
}

// On web, `Notification.permission` is a plain synchronously-readable
// property the browser keeps current — app.js's Settings toggle reads it
// directly in a few places. Native has no such thing (checking it is
// always async, and it's a completely separate permission system from the
// page's own Notification global, which may not even reflect it), so this
// mirrors it into a synchronously-readable cache app.js can read the same
// way regardless of platform, refreshed on boot and after every request.
let cachedPermission = !native && "Notification" in window ? Notification.permission : "default";

function normalize(display) {
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

export function getPermissionState() {
  return cachedPermission;
}

if (native) {
  LocalNotifications.checkPermissions()
    .then(({ display }) => (cachedPermission = normalize(display)))
    .catch(() => {});
}

export async function requestPermission() {
  if (native) {
    const { display } = await LocalNotifications.requestPermissions();
    cachedPermission = normalize(display);
    return cachedPermission;
  }
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return (cachedPermission = "granted");
  try {
    return (cachedPermission = await Notification.requestPermission());
  } catch (e) {
    return "denied";
  }
}

async function show(title, body, tag) {
  if (native) {
    try {
      const { display } = await LocalNotifications.checkPermissions();
      if (display !== "granted") return;
      await LocalNotifications.schedule({
        notifications: [{ id: numericIdFor(tag), title, body }],
      });
    } catch (e) {
      // best-effort — the item still shows in the in-app list either way
    }
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
    });
  } catch (e) {
    // showNotification can fail if the SW isn't ready yet or the
    // platform doesn't support it (e.g. iOS Safari) — fail silently.
  }
}

export function pollDueReminders(items) {
  const now = Date.now();
  for (const item of items) {
    if (item.completedAt || !item.dueAt) continue;
    if (new Date(item.dueAt).getTime() > now) continue;
    if (notifiedIds.has(item.id + item.dueAt)) continue;
    notifiedIds.add(item.id + item.dueAt);
    show("Buddy Reminder", item.title, item.id);
  }
}

const triggersSupported = !native && typeof Notification !== "undefined" && "TimestampTrigger" in window;
export const backgroundTriggersSupported = native || triggersSupported;

// The authoritative scheduler on native (a real alarm, not a foreground
// poll) — called on create AND on every edit that touches dueAt, via
// saveUpdate() in app.js, so a rescheduled or cleared reminder never
// leaves a stale alarm behind. On web this is still just the best-effort
// experimental trigger it always was.
export async function scheduleTrigger(item) {
  if (!item.dueAt) return;
  const when = new Date(item.dueAt).getTime();
  if (when <= Date.now()) return;

  if (native) {
    try {
      const { display } = await LocalNotifications.checkPermissions();
      if (display !== "granted") return;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numericIdFor(item.id),
            title: "Buddy Reminder",
            body: item.title,
            schedule: { at: new Date(when), allowWhileIdle: true },
          },
        ],
      });
    } catch (e) {
      // best-effort — foreground polling still covers it if the app is open
    }
    return;
  }

  if (!triggersSupported || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("Buddy Reminder", {
      body: item.title,
      tag: item.id,
      icon: "icons/icon-192.png",
      // eslint-disable-next-line no-undef
      showTrigger: new TimestampTrigger(when),
    });
  } catch (e) {
    // Experimental API — ignore failures, foreground polling still covers it.
  }
}

// Cancels a pending native alarm for this task — a no-op on web, where
// nothing schedulable in that sense exists to cancel. Called from
// saveUpdate() whenever a reminder is cleared or a task is completed, and
// from removeItem() on delete, so a finished or gone task never buzzes.
export async function cancelTrigger(id) {
  if (!native) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: numericIdFor(id) }] });
  } catch (e) {
    // best-effort
  }
}

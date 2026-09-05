// Local notifications for due reminders.
//
// There is no server and no push subscription here — everything is
// scheduled from the device itself. Two layers, both best-effort:
//
//  1. Foreground polling: while the app/tab is open, a timer checks for
//     newly-due items every 45s and fires a notification once per item.
//     This works everywhere Notifications are supported.
//
//  2. Notification Triggers (chromium-only, experimental): when
//     `showTrigger` exists, we additionally ask the OS to fire the
//     notification at the exact due time even if the tab/app is closed.
//     Not supported in Firefox or Safari (including iOS home-screen
//     PWAs, which have no Notifications API support at all as of
//     current iOS versions) — see README for the platform matrix.

const notifiedIds = new Set();

export const notificationsSupported = "Notification" in window;

export async function requestPermission() {
  if (!notificationsSupported) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return "denied";
  }
}

async function show(title, body, tag) {
  if (!notificationsSupported || Notification.permission !== "granted") return;
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
    // platform doesn't support it (e.g. iOS Safari) — fail silently,
    // the item still shows in the in-app list either way.
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

const triggersSupported = typeof Notification !== "undefined" && "TimestampTrigger" in window;
export const backgroundTriggersSupported = triggersSupported;

export async function scheduleTrigger(item) {
  if (!triggersSupported || Notification.permission !== "granted" || !item.dueAt) return;
  const when = new Date(item.dueAt).getTime();
  if (when <= Date.now()) return;
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

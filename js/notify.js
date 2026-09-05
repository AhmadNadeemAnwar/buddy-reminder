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

import { waLink } from "./whatsapp.js";
import { getAutomationPayload } from "./prefs.js";

const notifiedIds = new Set();

export const notificationsSupported = "Notification" in window;

// Marker an automation app matches on, so it fires only for WhatsApp
// reminders and ignores every other Buddy notification.
export const AUTOMATION_TAG = "[BUDDY-WA]";

// A task carrying a WhatsApp message gets a Send button right on the
// notification, so the reminder and the sending are one tap apart. The
// service worker opens the link — see its `notificationclick` handler.
// Action buttons are ignored on platforms that don't support them (iOS),
// where tapping the notification still opens the app.
function waOptions(item) {
  if (!item || !item.whatsapp) return {};
  const wa = item.whatsapp;
  return {
    actions: [{ action: "whatsapp", title: "Send on WhatsApp" }],
    data: { waUrl: waLink(wa.phone, wa.text || item.title) },
  };
}

// With the automation payload on, the link goes into the notification's
// visible text too. It has to be visible: an automation app can read a
// notification's title and body, but not the `data` the action button
// uses, so that's the only channel that reaches it.
function notificationBody(item) {
  if (!item) return "";
  const wa = item.whatsapp;
  if (!wa || !getAutomationPayload()) return item.title;
  return `${item.title}\n${AUTOMATION_TAG} ${waLink(wa.phone, wa.text || item.title)}`;
}

export async function requestPermission() {
  if (!notificationsSupported) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return "denied";
  }
}

async function show(title, body, tag, item) {
  if (!notificationsSupported || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      ...waOptions(item),
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
    show("Buddy Reminder", notificationBody(item), item.id, item);
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
      body: notificationBody(item),
      tag: item.id,
      icon: "icons/icon-192.png",
      ...waOptions(item),
      // eslint-disable-next-line no-undef
      showTrigger: new TimestampTrigger(when),
    });
  } catch (e) {
    // Experimental API — ignore failures, foreground polling still covers it.
  }
}

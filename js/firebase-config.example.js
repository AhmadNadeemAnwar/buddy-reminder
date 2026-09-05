// Copy this file to firebase-config.js (same folder) to turn on optional
// cross-device sync. firebase-config.js is gitignored — it holds your own
// project's keys, not a secret exactly, but there's no reason to commit it.
//
// 1. Go to https://console.firebase.google.com, create a project (free —
//    do NOT upgrade it off the "Spark" plan, which has no billing and no
//    credit card requirement).
// 2. Build > Firestore Database > Create database > start in test mode
//    (or set rules yourself — see README for a locked-down rule set).
// 3. Project settings > General > Your apps > Add app > Web, then copy
//    the firebaseConfig object it gives you into the export below.
//
// Leaving this file absent, or syncEnabled: false, keeps Buddy Reminder
// fully local-only with zero network dependency — the default.

export const syncEnabled = false;

export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// Optional cloud sync — free-tier Firebase Firestore only, additive and
// best-effort. If js/firebase-config.js doesn't exist, or syncEnabled is
// false, this whole module is a no-op and the app is 100% local. Nothing
// here ever blocks a UI action on the network: pushes are fire-and-forget,
// and a failure (offline, quota, misconfigured project) is swallowed —
// the local IndexedDB copy stays the source of truth either way.

const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
const FIRESTORE_SDK = "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let state = { enabled: false, col: null, fs: null };

export async function initSync({ onRemoteChange } = {}) {
  let config;
  try {
    config = await import("./firebase-config.js");
  } catch (e) {
    return { enabled: false, reason: "no-config" }; // firebase-config.js not created — expected default state
  }
  if (!config.syncEnabled || !config.firebaseConfig || !config.firebaseConfig.projectId) {
    return { enabled: false, reason: "disabled" };
  }

  try {
    const [{ initializeApp }, fs] = await Promise.all([import(FIREBASE_SDK), import(FIRESTORE_SDK)]);
    const app = initializeApp(config.firebaseConfig);
    const db = fs.getFirestore(app);
    const col = fs.collection(db, "items");
    state = { enabled: true, col, fs };

    if (onRemoteChange) {
      fs.onSnapshot(
        col,
        (snap) => {
          const items = snap.docs.map((d) => d.data());
          onRemoteChange(items);
        },
        () => {
          /* stream error — local data keeps working, next foreground push will retry */
        }
      );
    }
    return { enabled: true };
  } catch (e) {
    state = { enabled: false, col: null, fs: null };
    return { enabled: false, reason: "init-failed" };
  }
}

export function pushItem(item) {
  if (!state.enabled || !navigator.onLine) return;
  try {
    const ref = state.fs.doc(state.col, item.id);
    state.fs.setDoc(ref, item, { merge: true }).catch(() => {});
  } catch (e) {
    // best-effort only
  }
}

export function pushDelete(id) {
  if (!state.enabled || !navigator.onLine) return;
  try {
    state.fs.deleteDoc(state.fs.doc(state.col, id)).catch(() => {});
  } catch (e) {
    // best-effort only
  }
}

export function isSyncEnabled() {
  return state.enabled;
}

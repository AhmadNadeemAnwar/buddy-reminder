// IndexedDB wrapper — the single source of truth for Buddy Reminder.
// Every read/write hits this first; nothing in the UI waits on the network.

const DB_NAME = "buddy-reminder";
const DB_VERSION = 1;
const STORE = "items";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("dueAt", "dueAt");
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function newId() {
  return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const db = {
  async getAll() {
    const store = await tx("readonly");
    return promisify(store.getAll());
  },

  async put(item) {
    item.updatedAt = new Date().toISOString();
    const store = await tx("readwrite");
    await promisify(store.put(item));
    return item;
  },

  async add(partial) {
    const now = new Date().toISOString();
    const item = Object.assign(
      {
        id: newId(),
        title: "",
        // A task is just a task. `dueAt` (+ `hasTime`, `recurring`) is the
        // optional reminder attached to it — that's what puts it on the calendar.
        dueAt: null,
        hasTime: false,
        recurring: null,
        createdAt: now,
        completedAt: null,
        parentId: null,
        lastRecreatedAt: now,
        updatedAt: now,
      },
      partial
    );
    const store = await tx("readwrite");
    await promisify(store.add(item));
    return item;
  },

  async update(id, patch) {
    const store = await tx("readwrite");
    const existing = await promisify(store.get(id));
    if (!existing) return null;
    const updated = Object.assign(existing, patch, { updatedAt: new Date().toISOString() });
    const storeW = await tx("readwrite");
    await promisify(storeW.put(updated));
    return updated;
  },

  async remove(id) {
    const store = await tx("readwrite");
    return promisify(store.delete(id));
  },
};

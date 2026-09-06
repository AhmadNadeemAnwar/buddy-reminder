// Copies the tones into the Android project's res/raw/.
//
// They're already in www/sounds/ for the in-app preview, but that isn't
// enough for the notification itself: the local-notifications plugin
// resolves a notification's `sound` against res/raw first, then the *top
// level* of the web assets — it doesn't recurse, so www/sounds/bell.wav is
// invisible to it and it silently falls back to the default channel sound.
// res/raw is also simply where Android expects notification audio to live.
//
// sounds/ stays the single source of truth; res/raw is generated (and
// gitignored) so the two can't drift.

import { cpSync, rmSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "sounds");
const dest = join(root, "android", "app", "src", "main", "res", "raw");

if (!existsSync(src)) throw new Error("sync-native-sounds: sounds/ is missing");
if (!existsSync(join(root, "android"))) {
  console.log("No android/ platform — skipping native sound sync.");
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

// res/raw resource names must be lowercase [a-z0-9_], and the resource is
// addressed by the filename minus its extension.
const wavs = readdirSync(src).filter((f) => f.endsWith(".wav"));
for (const f of wavs) {
  const base = f.replace(/\.wav$/, "");
  if (!/^[a-z][a-z0-9_]*$/.test(base)) {
    throw new Error(`sync-native-sounds: "${f}" isn't a valid Android resource name (need lowercase a-z, 0-9, _)`);
  }
  cpSync(join(src, f), join(dest, f));
}

console.log(`res/raw: synced ${wavs.length} tone${wavs.length === 1 ? "" : "s"}.`);

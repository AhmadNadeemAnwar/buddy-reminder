// Builds the disposable `www/` folder Capacitor's webDir points at.
//
// The real source of truth is the repo root — that's what GitHub Pages
// serves, untouched. This script copies an explicit, reviewable list of
// exactly the files that make up the PWA payload into www/, rather than a
// wildcard copy of the root (which would also sweep up .git, node_modules,
// android/, package.json, this very script, etc.). www/ is gitignored and
// fully regenerable — never hand-edit anything inside it.

import { cpSync, rmSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wwwDir = join(root, "www");

const FILES = ["index.html", "manifest.json", "service-worker.js"];
const DIRS = ["css", "js", "icons"];

rmSync(wwwDir, { recursive: true, force: true });
mkdirSync(wwwDir, { recursive: true });

for (const f of FILES) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error(`build-www: expected file missing — ${f}`);
  cpSync(src, join(wwwDir, f));
}

for (const d of DIRS) {
  const src = join(root, d);
  if (!existsSync(src)) throw new Error(`build-www: expected directory missing — ${d}`);
  cpSync(src, join(wwwDir, d), { recursive: true });
}

// sounds/ also holds synth.py (how the tones were generated) — only the
// .wav output actually belongs in the shipped bundle.
const soundsSrc = join(root, "sounds");
if (!existsSync(soundsSrc)) throw new Error("build-www: expected directory missing — sounds");
const soundsDest = join(wwwDir, "sounds");
mkdirSync(soundsDest, { recursive: true });
const wavCount = readdirSync(soundsSrc).filter((f) => f.endsWith(".wav"));
for (const f of wavCount) {
  cpSync(join(soundsSrc, f), join(soundsDest, f));
}

console.log(`www/ built from ${FILES.length} files + ${DIRS.length} directories + ${wavCount.length} sounds.`);

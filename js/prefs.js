// Small standalone preferences that aren't visual theme — currently just
// whether voice capture creates the task the instant you stop talking, or
// leaves it for you to review and confirm. Kept separate from theme.js so
// that file stays scoped to what it says on the tin: appearance.

const VOICE_AUTO_KEY = "buddy-voice-auto-create";

function readBool(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === "true") return true;
    if (v === "false") return false;
    return fallback;
  } catch (e) {
    return fallback;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    // the choice still applies for this session, it just won't be remembered
  }
}

// Defaults to true — matches the auto-create behavior this app already ships.
export function getVoiceAutoCreate() {
  return readBool(VOICE_AUTO_KEY, true);
}

export function setVoiceAutoCreate(value) {
  persist(VOICE_AUTO_KEY, !!value);
}

const OWNER_NAME_KEY = "buddy-owner-name";
const ONBOARDED_KEY = "buddy-onboarded";

export function getOwnerName() {
  try {
    return localStorage.getItem(OWNER_NAME_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function setOwnerName(name) {
  persist(OWNER_NAME_KEY, name.trim());
}

export function isOnboarded() {
  return readBool(ONBOARDED_KEY, false);
}

export function setOnboarded() {
  persist(ONBOARDED_KEY, true);
}

// Optional local-LLM chat through Ollama. Off unless switched on, and even
// then only reached when you open the Buddy tab — nothing here runs in the
// background or on startup.
const OLLAMA_ON_KEY = "buddy-ollama-enabled";
const OLLAMA_URL_KEY = "buddy-ollama-url";
const OLLAMA_MODEL_KEY = "buddy-ollama-model";

function readString(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

export function getOllamaEnabled() {
  return readBool(OLLAMA_ON_KEY, false);
}

export function setOllamaEnabled(value) {
  persist(OLLAMA_ON_KEY, !!value);
}

export function getOllamaUrl() {
  return readString(OLLAMA_URL_KEY, "http://localhost:11434");
}

export function setOllamaUrl(url) {
  persist(OLLAMA_URL_KEY, String(url).trim().replace(/\/+$/, ""));
}

export function getOllamaModel() {
  return readString(OLLAMA_MODEL_KEY, "");
}

export function setOllamaModel(model) {
  persist(OLLAMA_MODEL_KEY, String(model).trim());
}


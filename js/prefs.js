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

// Turns a number saved the local way ("0300 1234567") into the full
// international one WhatsApp links require. Empty until it's set.
const COUNTRY_CODE_KEY = "buddy-country-code";

export function getCountryCode() {
  try {
    return localStorage.getItem(COUNTRY_CODE_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function setCountryCode(code) {
  persist(COUNTRY_CODE_KEY, String(code).replace(/\D/g, ""));
}

// Appends a machine-readable wa.me link to WhatsApp reminders so a phone
// automation app (MacroDroid, Tasker) can pick it up and do the send
// itself. Off by default — it's clutter in the notification for anyone not
// wiring that up.
const AUTOMATION_KEY = "buddy-automation-payload";

export function getAutomationPayload() {
  return readBool(AUTOMATION_KEY, false);
}

export function setAutomationPayload(value) {
  persist(AUTOMATION_KEY, !!value);
}

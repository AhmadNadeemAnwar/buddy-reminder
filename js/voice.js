// Web Speech API wrapper. Chrome's built-in recognizer calls out to a
// Google service to transcribe (it needs network even though the rest of
// the app doesn't) — so voice capture is treated as a nice-to-have that
// fails quietly, never as something the rest of the app depends on.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const voiceSupported = !!Recognition;

// Detected the same way notify.js does it — Capacitor's native host injects
// this global at runtime. Kept local so this stays a standalone wrapper.
const isNative = !!(
  typeof window !== "undefined" &&
  window.Capacitor &&
  window.Capacitor.isNativePlatform &&
  window.Capacitor.isNativePlatform()
);

// A listen ends when the speaker says it ends — they tap Stop — and not
// before. Nothing here guesses at whether a pause means "finished": people
// stop to think mid-sentence, and being cut off there is worse than holding
// the mic open a few seconds too long.
//
// The engines won't do that on their own. Chrome ends a listen on its own
// undocumented, unconfigurable end-of-speech cutoff, and Android's WebView
// is stricter still — it ignores `continuous` outright and aborts itself
// after roughly four seconds of quiet (measured on-device: start at 16ms,
// audiostart at 127ms, audioend + error:aborted + end at 4393ms). So on
// both, a run ending by itself is treated as an interruption rather than a
// result: we fold in whatever it heard and immediately listen again, which
// is what makes one continuous session out of the engine's short runs.
//
// The only backstop is a hard cap, so a mic left open by accident can't
// stay open indefinitely.
const MAX_SESSION_MS = 120000;

// A restart can't be issued from inside the `end` handler — the recognizer
// is still winding down and throws InvalidStateError. Waiting a tick and
// retrying is the standard way around it.
const RESTART_DELAY_MS = 120;

export function createVoiceInput({ onResult, onStart, onEnd, onError }) {
  if (!Recognition) return null;

  const recognition = new Recognition();
  // Worth asking for even on native, where it's ignored: on Chrome it's
  // what stops the engine ending the run at its own cutoff.
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  // Text carried over from earlier runs in this session. Each run reports
  // only its own results, so without this every restart would wipe out what
  // the speaker had already said.
  let settled = "";
  let current = "";
  let listening = false; // is a session open (as opposed to a single run)
  let heardAnything = false;
  let capTimer = null;
  let restartTimer = null;
  let ended = false;
  // A run that ends immediately having heard nothing means the engine isn't
  // actually working (mic grabbed by another app, service unavailable).
  // Restarting into that forever would hold the mic and drain the battery
  // for the full two minutes, so give up after a few.
  let runStartedAt = 0;
  let deadRuns = 0;
  const DEAD_RUN_MS = 400;
  const MAX_DEAD_RUNS = 5;

  function fullText() {
    return (settled + " " + current).trim();
  }

  function clearTimers() {
    clearTimeout(capTimer);
    clearTimeout(restartTimer);
    capTimer = null;
    restartTimer = null;
  }

  function finish() {
    if (ended) return; // `end` can arrive after we've already closed out
    ended = true;
    listening = false;
    clearTimers();
    onEnd && onEnd();
  }

  recognition.onstart = () => {
    // Only the first run of a session is a "start" as far as the UI is
    // concerned — the restarts in between are invisible to the speaker.
    runStartedAt = Date.now();
    if (!listening) {
      listening = true;
      ended = false;
      settled = "";
      current = "";
      heardAnything = false;
      deadRuns = 0;
      clearTimeout(capTimer);
      capTimer = setTimeout(() => stopSession(), MAX_SESSION_MS);
      onStart && onStart();
    }
  };

  recognition.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
    current = text;
    if (fullText()) heardAnything = true;
    onResult && onResult(fullText());
  };

  recognition.onend = () => {
    if (!listening) return finish();

    const heardThisRun = !!current.trim();
    deadRuns = heardThisRun || Date.now() - runStartedAt > DEAD_RUN_MS ? 0 : deadRuns + 1;
    if (deadRuns >= MAX_DEAD_RUNS) return finish();

    // The engine gave up on its own; keep the session going.
    if (heardThisRun) settled = fullText();
    current = "";
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!listening) return;
      try {
        recognition.start();
      } catch (e) {
        // Still winding down, or the engine is genuinely unavailable — the
        // session can't continue, so close it out with whatever we heard
        // rather than leaving the overlay up forever.
        finish();
      }
    }, RESTART_DELAY_MS);
  };

  recognition.onerror = (event) => {
    // `aborted` and `no-speech` are how a run signs off; they say nothing
    // about the session, which onend restarts. Reporting them would be
    // wrong twice over — the caller treats an error as fatal and would
    // throw away a transcript it had already received.
    if (event.error === "aborted" || event.error === "no-speech") return;
    // The engine can report a burst of these as it tears down (observed on
    // device: not-allowed and network 1ms apart when Android pulled the mic
    // back). The session is over on the first one; the rest are noise.
    if (!listening) return;

    listening = false;
    clearTimers();
    const reason =
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "blocked"
        : event.error === "network"
        ? "offline"
        : "unknown";
    // Words already captured are still worth keeping, so a late network
    // blip doesn't discard a finished sentence.
    if (heardAnything) return finish();
    ended = true; // closed out via onError; don't also fire onEnd from onend
    clearTimers();
    onError && onError(reason);
  };

  function stopSession() {
    listening = false;
    clearTimers();
    try {
      recognition.stop();
    } catch (e) {
      finish(); // never started, or already stopped — close the UI anyway
    }
  }

  return {
    start() {
      try {
        recognition.start();
      } catch (e) {
        onError && onError("unknown");
      }
    },
    stop: stopSession,
  };
}

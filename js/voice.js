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

// Chrome's own end-of-speech cutoff (what `continuous = false` relies on)
// is undocumented, not configurable, and noticeably shorter than a natural
// mid-sentence pause — it was ending the listen before people finished a
// sentence. `continuous = true` turns that built-in cutoff off entirely;
// we do our own silence detection on top of it instead, so the pause
// allowance is something this app actually controls. Bump this if it's
// still cutting people off, or lower it if it feels laggy to end.
//
// None of that holds in Android's WebView, which ignores `continuous`
// outright and endpoints on its own (measured: it stops ~4.4s into a silent
// listen). There our timer can only ever cut someone off *earlier* than the
// platform would — at 2.2s from the mic opening, mid-sentence — so on
// native we stay out of the way and let the recognizer decide when they're
// done.
const SILENCE_MS = 2200;

export function createVoiceInput({ onResult, onStart, onEnd, onError }) {
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = !isNative;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  // Whether this listen produced any words yet — see onerror.
  let heardAnything = false;

  let silenceTimer = null;
  function armSilenceTimer() {
    if (isNative) return; // the platform recognizer endpoints for us
    clearTimeout(silenceTimer);
    // Stopping (not aborting) finalizes whatever's been heard so far and
    // fires the normal onresult/onend sequence, same as Chrome's own
    // cutoff used to — nothing downstream needs to know this was us.
    silenceTimer = setTimeout(() => {
      try {
        recognition.stop();
      } catch (e) {
        /* already stopped */
      }
    }, SILENCE_MS);
  }
  function clearSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }

  recognition.onstart = () => {
    heardAnything = false;
    armSilenceTimer(); // also covers someone taking a moment before they start talking
    onStart && onStart();
  };
  recognition.onend = () => {
    clearSilenceTimer();
    onEnd && onEnd();
  };
  recognition.onresult = (event) => {
    armSilenceTimer(); // heard something — push the "are they done" clock back
    let text = "";
    for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
    if (text.trim()) heardAnything = true;
    onResult && onResult(text);
  };
  recognition.onerror = (event) => {
    clearSilenceTimer();
    // Android's recognizer signs off with `aborted` at the end of a listen,
    // including successful ones, and with `no-speech` when it times out.
    // Neither is worth reporting once we already have words: the caller
    // treats any error as fatal and would throw away the transcript it just
    // received. Staying quiet lets the normal onend path run instead.
    if ((event.error === "aborted" || event.error === "no-speech") && heardAnything) return;
    const reason =
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "blocked"
        : event.error === "network"
        ? "offline"
        : "unknown";
    onError && onError(reason);
  };

  return {
    start() {
      try {
        recognition.start();
      } catch (e) {
        onError && onError("unknown");
      }
    },
    stop() {
      clearSilenceTimer();
      recognition.stop();
    },
  };
}

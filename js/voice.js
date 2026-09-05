// Web Speech API wrapper. Chrome's built-in recognizer calls out to a
// Google service to transcribe (it needs network even though the rest of
// the app doesn't) — so voice capture is treated as a nice-to-have that
// fails quietly, never as something the rest of the app depends on.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const voiceSupported = !!Recognition;

// Chrome's own end-of-speech cutoff (what `continuous = false` relies on)
// is undocumented, not configurable, and noticeably shorter than a natural
// mid-sentence pause — it was ending the listen before people finished a
// sentence. `continuous = true` turns that built-in cutoff off entirely;
// we do our own silence detection on top of it instead, so the pause
// allowance is something this app actually controls. Bump this if it's
// still cutting people off, or lower it if it feels laggy to end.
const SILENCE_MS = 2200;

export function createVoiceInput({ onResult, onStart, onEnd, onError }) {
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  let silenceTimer = null;
  function armSilenceTimer() {
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
    onResult && onResult(text);
  };
  recognition.onerror = (event) => {
    clearSilenceTimer();
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

// Web Speech API wrapper. Chrome's built-in recognizer calls out to a
// Google service to transcribe (it needs network even though the rest of
// the app doesn't) — so voice capture is treated as a nice-to-have that
// fails quietly, never as something the rest of the app depends on.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const voiceSupported = !!Recognition;

export function createVoiceInput({ onResult, onStart, onEnd, onError }) {
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  recognition.onstart = () => onStart && onStart();
  recognition.onend = () => onEnd && onEnd();
  recognition.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
    onResult && onResult(text);
  };
  recognition.onerror = (event) => {
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
      recognition.stop();
    },
  };
}

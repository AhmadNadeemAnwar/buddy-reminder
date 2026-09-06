// Optional local-LLM chat, via Ollama (https://ollama.com).
//
// Same deal as sync.js: entirely additive, off unless you turn it on, and
// nothing in the app waits on it. Ollama runs on your own machine and the
// model never leaves it, so this doesn't cost anything and doesn't break
// the promise that Buddy's own thinking stays on-device.
//
// The catch is that Ollama listens on the computer, not the phone, and it
// refuses browser origins it wasn't told about — see the README for the
// OLLAMA_ORIGINS setup.

export const DEFAULT_URL = "http://localhost:11434";

function base(url) {
  return (url || DEFAULT_URL).replace(/\/+$/, "");
}

// Doubles as the reachability check — if this resolves, Ollama is up and
// reachable from this origin, and we know which models are installed.
export async function listModels(url, { signal } = {}) {
  const res = await fetch(`${base(url)}/api/tags`, { signal });
  if (!res.ok) throw new Error(`Ollama replied ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name).filter(Boolean);
}

// Streams a reply, calling onToken with each chunk as it arrives so the
// answer appears as it's written rather than after a long silence.
// Resolves with the full text. Ollama streams newline-delimited JSON.
export async function chat({ url, model, messages, onToken, signal }) {
  const res = await fetch(`${base(url)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama replied ${res.status}`);
  if (!res.body) throw new Error("No response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // A chunk can split mid-line, so keep the tail until its newline lands.
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let payload;
      try {
        payload = JSON.parse(trimmed);
      } catch (e) {
        continue; // partial or malformed line — skip it rather than blow up
      }
      if (payload.error) throw new Error(payload.error);
      const piece = payload.message && payload.message.content;
      if (piece) {
        full += piece;
        if (onToken) onToken(piece);
      }
    }
  }
  return full;
}

// What the model is told about you. Deliberately compact: a couple of
// hundred tasks would bury the actual question, so this sends the open
// work and what was finished recently, not the whole database.
export function buildContext(items, today, { dayLabel, describeWhen }) {
  const top = items.filter((it) => !it.parentId);
  const open = top.filter((it) => !(it.completedAt && !it.recurring));
  const doneRecently = top.filter(
    (it) => it.completedAt && !it.recurring && (today - new Date(it.completedAt)) / 86400000 <= 7
  );

  const line = (it) => {
    const when = describeWhen({
      dueAt: it.dueAt,
      hasTime: !!it.hasTime,
      intervalDays: it.recurring ? it.recurring.intervalDays : null,
    });
    return `- ${it.title}${when ? ` (${when})` : " (no reminder)"}`;
  };

  const parts = [
    "You are Buddy, a calm and friendly reminder companion.",
    "Answer briefly and practically about the person's tasks below.",
    "Never invent tasks that aren't listed. If asked to add or change something, explain that you can't yet and tell them to use the + button.",
    `Today is ${dayLabel(today, today)}, ${today.toDateString()}.`,
    "",
    open.length ? `Open tasks (${open.length}):` : "They have no open tasks.",
    ...open.slice(0, 60).map(line),
  ];
  if (doneRecently.length) {
    parts.push("", `Finished in the last week (${doneRecently.length}):`, ...doneRecently.slice(0, 20).map(line));
  }
  return parts.join("\n");
}

/**
 * Jev adapter handler for Crew OS.
 *
 * Jev (TypeSafe System One) is a decision model accessed via OpenRouter's
 * dedicated decisions endpoint — not a conversational agent. This handler
 * receives work/messages, sends them to Jev as decision state, and returns
 * the typed judgments (scores, choices, probabilities).
 *
 * Expects OPENROUTER_API_KEY in the environment (via EnvironmentFile).
 */

const JEV_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
const JEV_MODEL = "~typesafe/jev-latest";

function defaultQuestions(work) {
  const title = work.title || work.task || "Untitled";
  const detail = work.detail || work.body || work.text || "";
  return {
    priority: {
      type: "score",
      instructions: `Score the priority of this work item from 0 (ignore) to 10 (urgent). Title: ${title}. Detail: ${detail}`,
      criteria: ["ignore", "low", "normal", "high", "urgent"],
    },
    route: {
      type: "choice",
      instructions: `Who should handle this? Title: ${title}. Detail: ${detail}`,
      criteria: {
        jeff: "Chief of staff — substantive analysis, planning, coordination",
        relay: "Relay — quick ops, inbox, research, follow-ups",
        specialists: "A specialist agent — domain-specific deep work",
        matt: "Needs Matt's direct decision or input",
      },
    },
  };
}

export async function handle(command, { adapter }) {
  const verb = command.verb;
  if (!["work.start", "message.deliver", "handoff.accept"].includes(verb)) {
    throw new Error("Unsupported Jev command: " + verb);
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY / OPEN_ROUTER_API_KEY not set");

  const payload = command.payload || {};
  const state = {
    agent: "jev",
    verb,
    workId: command.workId || command.id,
    title: payload.title || payload.task || "",
    detail: payload.detail || payload.body || payload.text || "",
    from: payload.from || "owner",
  };

  // Allow callers to pass custom questions; fall back to triage defaults.
  const questions = payload.questions || defaultQuestions(payload);

  const res = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://boyerimpactsystems.com",
      "X-OpenRouter-Title": "Crew OS jev adapter",
    },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jev API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const answers = data.answers || {};

  // Build a human-readable summary of the judgments.
  const lines = [];
  for (const [id, ans] of Object.entries(answers)) {
    if (ans.choice) lines.push(`${id}: ${ans.choice} (confidence ${ans.confidence ?? "n/a"})`);
    else if (ans.score !== undefined) lines.push(`${id}: score ${ans.score} (confidence ${ans.confidence ?? "n/a"})`);
    else if (ans.noul !== undefined) lines.push(`${id}: ${ans.noul}`);
    else lines.push(`${id}: ${JSON.stringify(ans).slice(0, 120)}`);
  }

  return {
    summary: `Jev judgments — ${lines.join("; ") || "no answers"}`,
    answers,
    model: data.model,
  };
}

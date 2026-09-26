/**
 * Relay adapter handler for Crew OS.
 *
 * Relay (the cloud runtime) is a conversational agent, not a local daemon.
 * This handler keeps Relay "Connected" via heartbeats and queues incoming
 * work/messages into a local inbox. Relay picks up the inbox in conversation
 * with Matt and replies via the adapter API.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const INBOX = "/home/ubuntu/relay-inbox.jsonl";

async function inbox(entry) {
  await mkdir(dirname(INBOX), { recursive: true });
  await appendFile(
    INBOX,
    JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n",
    { mode: 0o600 },
  );
}

export async function handle(command, { adapter }) {
  const verb = command.verb;
  if (verb === "message.deliver") {
    const msg = command.payload || {};
    await inbox({
      kind: "message",
      messageId: msg.messageId || msg.id || command.id,
      from: msg.from || "owner",
      body: msg.body || msg.text || "",
    });
    return {
      summary:
        "Message queued in Relay's inbox. Relay will read and reply from the active conversation.",
    };
  }
  if (verb === "work.start") {
    const work = command.payload || {};
    await inbox({
      kind: "work",
      runId: command.id,
      title: work.title || work.task || "Untitled work",
      detail: work.detail || work.body || "",
    });
    // Acknowledge as accepted; Relay executes in conversation and reports back.
    return {
      summary:
        "Work queued in Relay's inbox. Relay executes in the active conversation and will report results.",
    };
  }
  if (verb === "handoff.accept") {
    await inbox({ kind: "handoff", runId: command.id, payload: command.payload || {} });
    return { summary: "Handoff queued in Relay's inbox." };
  }
  // Control verbs (pause/cancel/etc.): acknowledge without action.
  return { summary: `Relay acknowledged ${verb}; no local execution to control.` };
}

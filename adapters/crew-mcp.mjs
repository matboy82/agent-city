#!/usr/bin/env node
// crew-mcp server — exposes Crew OS Chief-of-Staff publishing tools to Dave.
// Runs as a stdio MCP server (newline-delimited JSON-RPC 2.0).
//
// The Crew OS agent credential is read server-side from the adapter config
// file and is NEVER exposed to the model. Tool inputs carry only the
// brief/message content; the credential is injected into the Authorization
// header on every call.
//
// Env:
//   CREW_ADAPTER_CONFIG  path to adapter config JSON {url, credential}
//                        (default: /opt/agent-city/data/adapter-dave.json)

import { readFile } from "node:fs/promises";

const CONFIG_PATH =
  process.env.CREW_ADAPTER_CONFIG || "/opt/agent-city/data/adapter-dave.json";

let CREW_URL, CREW_CREDENTIAL;
try {
  const cfg = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  CREW_URL = cfg.url;
  CREW_CREDENTIAL = cfg.credential;
  if (!CREW_URL || !CREW_CREDENTIAL) throw new Error("url/credential missing");
} catch (err) {
  console.error(`crew-mcp: cannot read adapter config ${CONFIG_PATH}: ${err.message}`);
  process.exit(1);
}

async function crewCall(action, input) {
  const r = await fetch(CREW_URL + "/api/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + CREW_CREDENTIAL,
      "X-Crew-Role": "agent",
    },
    body: JSON.stringify({ action, input }),
    signal: AbortSignal.timeout(20000),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
  return result;
}

const TOOLS = [
  {
    name: "publish_brief",
    description:
      "Publish your morning brief to the Crew OS Morning Brief page, where Matt reads it. " +
      "Use kind 'daily' for the 7:00 AM BIS Daily Brief and kind 'crew' for the Tue/Fri 7:30 AM Crew Briefing. " +
      "The body is markdown and is rendered on the page. " +
      "ALWAYS call this after compiling a brief — the brief is not delivered until it is published here. " +
      "Pass a stable idempotency_key (e.g. 'daily-2026-09-30') so retries never create duplicates.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["daily", "crew"],
          description: "'daily' = BIS Daily Brief, 'crew' = Crew Briefing.",
        },
        title: {
          type: "string",
          description: "Short title, e.g. 'BIS Daily Brief — Tue Sep 30'. Max 140 chars.",
        },
        body: {
          type: "string",
          description: "The full brief in markdown. Max 20000 chars.",
        },
        idempotency_key: {
          type: "string",
          description: "Required, min 8 chars. Same key = same brief; safe to retry. Use '<kind>-YYYY-MM-DD'.",
        },
      },
      required: ["kind", "title", "body", "idempotency_key"],
    },
  },
  {
    name: "message_owner",
    description:
      "Send Matt a direct chat message in Crew OS — it appears as a Dave chat bubble in your private conversation with him, with an unread badge until he opens it. " +
      "Use this to chat Matt the daily brief: send a tight chat-length summary (not the whole brief — the full brief lives on the Morning Brief page via publish_brief). " +
      "Keep it under 4000 chars. Rate-limited: one message per 5 minutes.",
    inputSchema: {
      type: "object",
      properties: {
        body: {
          type: "string",
          description: "The chat message to Matt. Max 4000 chars.",
        },
      },
      required: ["body"],
    },
  },
  {
    name: "request_approval",
    description:
      "File an approval card for Matt in the Crew OS 'Waiting on you' section. " +
      "Use this for every decision or watch item Matt owns that surfaces in your work: blockers Matt owns, items needing his approval " +
      "(outreach recipients/wording, government teaming paths, commit reviews), and status confirmations (e.g. SBA VetCert). " +
      "The card stays in 'Waiting on you' until Matt resolves it. " +
      "Omit workId for standalone Chief-of-Staff items (no work item needed). " +
      "ALWAYS pass a stable idempotency_key per logical item (e.g. 'watch-warm-outreach') so re-filing never duplicates; " +
      "include a date or version in the key when it is genuinely a NEW instance of a recurring item. " +
      "Kinds: DECISION (needs Matt's call), WATCH (FYI / monitor), ANSWER (needs info), MERGE (code review).",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short card title, e.g. 'Approve warm-outreach recipients'. Max 160 chars.",
        },
        context: {
          type: "string",
          description: "What Matt needs to know to decide — the evidence and options. Max 2000 chars.",
        },
        effect: {
          type: "string",
          description: "What happens if he approves / what is blocked until he decides. Max 1000 chars.",
        },
        kind: {
          type: "string",
          enum: ["DECISION", "WATCH", "ANSWER", "MERGE"],
          description: "DECISION = needs his call; WATCH = monitor; ANSWER = needs info; MERGE = code review.",
        },
        artifact: {
          type: "string",
          description: "Optional supporting text (draft wording, commit list, etc.). Max 10000 chars.",
        },
        tier: {
          type: "string",
          description: "Optional Jev tier: L1, L2, L3. DECISION items are scored automatically.",
        },
        idempotency_key: {
          type: "string",
          description: "Required, min 8 chars. Same key = same card; safe to re-file.",
        },
      },
      required: ["title", "context", "effect", "kind", "idempotency_key"],
    },
  },
];

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function respondError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n",
  );
}

async function handleToolCall(params) {
  const tool = TOOLS.find((t) => t.name === params.name);
  if (!tool) throw new Error(`Unknown tool: ${params.name}`);
  const args = params.arguments || {};
  const action = params.name;
  const result = await crewCall(action, args);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.jsonrpc !== "2.0" || msg.id === undefined) continue; // notification
    try {
      if (msg.method === "initialize") {
        respond(msg.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "crew-mcp", version: "1.0.0" },
        });
      } else if (msg.method === "tools/list") {
        respond(msg.id, { tools: TOOLS });
      } else if (msg.method === "tools/call") {
        respond(msg.id, await handleToolCall(msg.params || {}));
      } else {
        respondError(msg.id, -32601, `Method not found: ${msg.method}`);
      }
    } catch (err) {
      respond(msg.id, {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  }
});

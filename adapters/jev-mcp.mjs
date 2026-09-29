#!/usr/bin/env node
// crew-jev MCP server — exposes Crew OS ad-hoc Jev judgments to a Hermes agent.
// Runs as a stdio MCP server (newline-delimited JSON-RPC 2.0).
//
// The Crew OS agent credential is read server-side from the adapter config
// file and is NEVER exposed to the model. Tool inputs carry only the
// judgment parameters; the credential is injected into the Authorization
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
  console.error(`crew-jev: cannot read adapter config ${CONFIG_PATH}: ${err.message}`);
  process.exit(1);
}

async function crewCall(action, input) {
  const r = await fetch(CREW_URL + "/api/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CREW_CREDENTIAL}`,
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
    name: "request_jev_judgment",
    description:
      "Ask Jev (TypeSafe System One decision model) for a fast, typed judgment on a discretionary judgment call — e.g. which lead to prioritize, whether a draft plan is sound, how risky a proposal is. " +
      "Returns immediately with a ledgerId; scoring completes asynchronously in seconds. " +
      "ADVISORY ONLY: Jev is not approval and never overrides your judgment or Matt's. " +
      "Use get_jev_judgment to retrieve the result; wait at most 60 seconds, then proceed without it — never block work on Jev. " +
      "NEVER re-ask the same question to get a better score (score-shopping). The idempotency_key enforces this: reuse the same key for retries of the same question. " +
      "Do NOT use for routine execution steps — only genuine judgment calls.",
    inputSchema: {
      type: "object",
      properties: {
        detail: {
          type: "string",
          description: "What Jev should judge — the recommendation, draft, or situation (1-2000 chars).",
        },
        preset: {
          type: "string",
          enum: ["priority", "risk", "soundness"],
          description: "Preset question set. Default: priority (priority 0-10 score + who-should-handle-it routing).",
        },
        questions: {
          type: "object",
          description: "Custom questions instead of a preset. Score questions: {type:'score', instructions (must state a 0-N scale), criteria (array with exactly N+1 labels)}. Choice questions: {type:'choice', instructions, criteria (object)}.",
        },
        tier: { type: "string", description: "Ledger tier. Default: L3." },
        agentConfidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Your own confidence (0-1), used to compute disagreement with Jev.",
        },
        idempotency_key: {
          type: "string",
          description: "Required, min 8 chars. Same agent + same key = same ledger entry; no second scoring call. Use a stable key per distinct question.",
        },
      },
      required: ["detail", "idempotency_key"],
    },
  },
  {
    name: "get_jev_judgment",
    description:
      "Retrieve the result of a Jev judgment requested via request_jev_judgment. " +
      "Poll every ~5 seconds, at most 60 seconds total. If still 'scoring' after 60s or 'unscored', proceed without the score — Jev is advisory and must never block work. " +
      "You can only read your own entries.",
    inputSchema: {
      type: "object",
      properties: {
        ledger_id: { type: "string", description: "The ledgerId returned by request_jev_judgment." },
      },
      required: ["ledger_id"],
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
  const action =
    params.name === "request_jev_judgment" ? "request_jev_judgment" : "get_jev_judgment";
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
          serverInfo: { name: "crew-jev", version: "1.0.0" },
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

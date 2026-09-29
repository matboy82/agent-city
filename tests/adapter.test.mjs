import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Adapter, classifyFailure, retryAllowed, retryPolicy } from "../adapters/cli.mjs";

test("failure classes enforce bounded per-class retries", () => {
  const policy = retryPolicy({ attempts: 3, elapsed_minutes: 10, spend: 0 });
  assert.equal(classifyFailure(new Error("request timed out")), "TOOL_TIMEOUT");
  assert.equal(classifyFailure(new Error("permission denied")), "PERMISSION_DENIED");
  assert.equal(retryAllowed("TOOL_TIMEOUT", 1, policy, 100), true); // retry has no spend side effect
  const paid = retryPolicy({ attempts: 3, elapsed_minutes: 10, spend: 1 });
  assert.equal(retryAllowed("TOOL_TIMEOUT", 1, paid, 100), true);
  assert.equal(retryAllowed("TOOL_TIMEOUT", 3, paid, 100), false);
  assert.equal(retryAllowed("INVALID_ARGUMENTS", 1, paid, 100), false);
  assert.equal(retryAllowed("MISSING_CONTEXT", 1, paid, 100), false);
  assert.equal(retryAllowed("FAILED_CHECK", 2, paid, 100), true);
  assert.equal(retryAllowed("FAILED_CHECK", 3, paid, 100), false);
  assert.equal(retryAllowed("PERMISSION_DENIED", 1, paid, 100), false);
  assert.equal(retryAllowed("CONFLICTING_REQUIREMENTS", 1, paid, 100), false);
});

test("work timeout retries stop at budget and success completes once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "crew-adapter-retry-"));
  try {
    const adapter = new Adapter({ url: "http://localhost:4310", agentId: "dave", runtimeId: "test", credential: "test", statePath: join(dir, "state.json") });
    const acks = [];
    adapter.call = async (action, input) => { if (action === "ack_command") { acks.push(input); return input.status === "accepted" ? { runId: "run-1" } : {}; } return {}; };
    const command = { id: "retry-turn", status: "accepted", verb: "work.start", payload: { contract: { retry_budget: { attempts: 2, elapsed_minutes: 1, spend: 1 } } } };
    let attempts = 0;
    await assert.rejects(adapter.process(command, async () => { attempts++; throw new Error("request timeout"); }), /request timeout/);
    assert.equal(attempts, 2);
    assert.equal(acks.at(-1).failure_class, "TOOL_TIMEOUT");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a failed runtime turn is reported without allowing a blind replay", async () => {
  const dir = await mkdtemp(join(tmpdir(), "crew-adapter-"));
  try {
    const adapter = new Adapter({
      url: "http://localhost:4310",
      agentId: "jeff",
      runtimeId: "hermes-jeff",
      credential: "test",
      statePath: join(dir, "state.json"),
    });
    const acknowledged = [];
    adapter.call = async (action, input) => {
      if (action === "ack_command") acknowledged.push(input.status);
      return {};
    };
    const command = { id: "turn-1", status: "accepted", verb: "message.deliver", payload: {} };
    await assert.rejects(
      adapter.process(command, async () => { throw new Error("runtime exited"); }),
      /runtime exited/,
    );
    assert.deepEqual(acknowledged, ["running", "failed"]);
    assert.equal(adapter.state.commands[command.id].state, "uncertain");
    await adapter.process(command, async () => { throw new Error("replayed"); });
    assert.deepEqual(acknowledged, ["running", "failed"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a completed local turn survives a lost completion acknowledgment", async () => {
  const dir = await mkdtemp(join(tmpdir(), "crew-adapter-"));
  try {
    const adapter = new Adapter({
      url: "http://localhost:4310",
      agentId: "jeff",
      runtimeId: "hermes-jeff",
      credential: "test",
      statePath: join(dir, "state.json"),
    });
    adapter.call = async (action, input) => {
      if (action === "ack_command" && input.status === "completed")
        throw new Error("network interrupted");
      return {};
    };
    const command = { id: "turn-2", status: "accepted", verb: "work.start", payload: {} };
    await assert.rejects(
      adapter.process(command, async () => ({ summary: "verified result" })),
      /network interrupted/,
    );
    assert.equal(adapter.state.commands[command.id].state, "completed");
    assert.equal(adapter.state.commands[command.id].result, "verified result");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

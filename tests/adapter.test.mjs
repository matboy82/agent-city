import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Adapter } from "../adapters/cli.mjs";

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

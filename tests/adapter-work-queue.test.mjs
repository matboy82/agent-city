import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Adapter } from "../adapters/cli.mjs";

test("heartbeat forwards dynamic work queue and activity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "crew-adapter-"));
  try {
    const adapter = new Adapter({ url: "http://localhost:4310", agentId: "jeff", runtimeId: "hermes-jeff", credential: "test", statePath: join(dir, "state.json") });
    let sent;
    adapter.call = async (_action, input) => { sent = input; return {}; };
    const queue = [{ text: "Draft Q4 plan" }];
    const activity = [{ summary: "Reviewed operating plan" }];
    await adapter.heartbeat({ task: "Drafting Q4 operating plan", queue, activity, current_activity: "typing" });
    assert.equal(sent.current_task, "Drafting Q4 operating plan");
    assert.deepEqual(sent.queue, queue);
    assert.deepEqual(sent.activity, activity);
    assert.equal(sent.current_activity, "typing");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

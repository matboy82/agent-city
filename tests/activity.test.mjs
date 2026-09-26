import test from "node:test";
import assert from "node:assert/strict";
import { resolveActivity } from "../src/activity.ts";

test("animation follows connected verified work and never invents presence", () => {
  const agent = { id: "jeff", connection: "Disconnected", status: "active", currentTask: "Presenting a review" };
  assert.equal(resolveActivity(agent, [{ agentId: "jeff", status: "running" }]), "idle");
  agent.connection = "Connected";
  agent.status = "idle";
  assert.equal(resolveActivity(agent, []), "idle");
  agent.status = "active";
  assert.equal(resolveActivity(agent, []), "presenting");
  agent.currentTask = "Reading contract notes";
  assert.equal(resolveActivity(agent, []), "reading");
  agent.status = "waiting_on_matt";
  assert.equal(resolveActivity(agent, [{ agentId: "jeff", status: "running" }]), "idle");
  agent.status = "idle";
  agent.activity = "celebrating";
  assert.equal(resolveActivity(agent, []), "idle");
  assert.equal(resolveActivity(agent, [{ agentId: "jeff", status: "running" }]), "celebrating");
});

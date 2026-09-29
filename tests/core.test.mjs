import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { Core } from "../server/core.mjs";
const passphrase = "a long test-only passphrase";
function fixture() {
  const s = new Store(":memory:"),
    c = new Core(s);
  const owner = c.public("owner_setup", {
    passphrase,
    confirm: passphrase,
  }).token;
  const call = (action, b = {}) => c.ownerAction(action, b, owner);
  const pair = (agentId) => {
    const code = call("create_pairing_code", { agentId }).code;
    const credential = c.public("redeem_pairing_code", {
      code,
      runtime_id: `hermes-${agentId}`,
    }).credential;
    const act = (action, b = {}) => c.agentAction(action, b, credential);
    act("report_heartbeat", {
      agent_id: agentId,
      runtime_id: `hermes-${agentId}`,
      sequence: 0,
      status: "idle",
      last_seen: new Date().toISOString(),
      capabilities: ["work.execute"],
    });
    return { act, credential };
  };
  const dave = pair("dave");
  const create = () =>
    call("create_work_item", {
      title: "Verified mission",
      brief: "Read BIS context and return evidence",
      priority: "normal",
      goalId: "monthly",
      raci: {
        responsible: ["dave"],
        accountable: "matt",
        consulted: ["relay"],
        informed: ["jev"],
      },
    }).id;
  const dispatch = (workId) =>
    call("dispatch_work_item", {
      id: workId,
      revision: s.get("work", workId).revision,
      agentId: "dave",
      idempotency_key: `dispatch:${workId}`,
    });
  return { s, c, owner, call, pair, dave, create, dispatch };
}
test("owner auth, setup single use, private snapshot and logout", () => {
  const f = fixture();
  assert.throws(() => f.c.ownerAction("get_dashboard", {}, ""), /Sign in/);
  assert.throws(
    () => f.c.public("owner_setup", { passphrase, confirm: passphrase }),
    /already configured/,
  );
  assert.throws(
    () => f.c.public("owner_login", { passphrase: "wrong long passphrase" }),
    /Incorrect/,
  );
  const snapshot = f.call("get_dashboard");
  assert.equal(snapshot.agents.length, 4);
  assert(!JSON.stringify(snapshot).includes(f.dave.credential));
  assert(!JSON.stringify(snapshot).includes("credentialHash"));
  f.call("owner_logout");
  assert.throws(() => f.call("get_dashboard"), /Sign in/);
  f.s.close();
});
test("heartbeat work queue and activity are exposed on the agent snapshot", () => {
  const f = fixture();
  f.dave.act("report_heartbeat", {
    agent_id: "dave",
    runtime_id: "hermes-dave",
    sequence: 1,
    status: "active",
    last_seen: new Date().toISOString(),
    current_task: "Drafting a proposal",
    current_activity: "typing",
    activity: [{ summary: "Started proposal", detail: "For Friday review", time: new Date().toISOString(), source_key: "activity-1" }],
    queue: [{ text: "Review Q4 plan", detail: "Check numbers", time: "2026-09-30T09:00:00Z", source_key: "queue-1" }],
  });
  const agent = f.call("get_dashboard").agents.find((a) => a.id === "dave");
  assert.equal(agent.currentTask, "Drafting a proposal");
  assert.equal(agent.activity, "typing");
  assert.equal(agent.workQueue[0].text, "Review Q4 plan");
  assert.equal(agent.workQueue[0].time, "2026-09-30T09:00:00Z");
  assert.equal(agent.workActivity[0].summary, "Started proposal");
  assert.equal(agent.workActivity[0].detail, "For Friday review");
  f.s.close();
});
test("dispatch is idempotent and command/run/work states are distinct", () => {
  const f = fixture(),
    w = f.create(),
    command = f.dispatch(w);
  assert.equal(f.dispatch(w).id, command.id);
  assert.equal(f.s.get("work", w).status, "ready");
  assert.equal(f.s.list("run").length, 0);
  const accepted = f.dave.act("ack_command", {
    command_id: command.id,
    status: "accepted",
  });
  assert.equal(f.s.get("work", w).status, "claimed");
  assert.equal(f.s.list("run").length, 1);
  assert.equal(
    f.dave.act("ack_command", { command_id: command.id, status: "accepted" })
      .id,
    command.id,
  );
  f.dave.act("ack_command", {
    command_id: command.id,
    status: "running",
    run_id: accepted.runId,
  });
  assert.equal(f.s.get("work", w).status, "in_progress");
  f.dave.act("submit_artifact", {
    run_id: accepted.runId,
    idempotency_key: "artifact-one",
    title: "Evidence",
    uri: "https://example.com/evidence",
  });
  f.dave.act("ack_command", {
    command_id: command.id,
    status: "completed",
    run_id: accepted.runId,
    result: "Evidence delivered",
  });
  assert.equal(f.s.get("work", w).status, "waiting_approval");
  const a = f.s.list("approval")[0];
  f.call("resolve_approval", {
    id: a.id,
    decision: "approved",
    note: "Evidence inspected",
  });
  assert.equal(f.s.get("work", w).status, "done");
  assert.throws(() => f.s.db.exec("DELETE FROM audit"), /immutable/);
  f.s.close();
});
test("workflow templates automatically dispatch each next step without manual redispatch", () => {
  const f = fixture(), jev = f.pair("jev"), relay = f.pair("relay");
  f.call("save_template",{id:"two_steps",name:"Two steps",steps:[{agentId:"jev",handoff:"Score lead"},{agentId:"relay",handoff:"Draft response"}],completionCriteria:"Draft complete",maxLoops:1});
  const run = f.call("run_template", { templateId:"two_steps", title:"Triage lead", brief:"Review this inbound lead", goalId:"monthly" });
  const first = f.s.list("command")[0];
  assert.equal(first.agentId, "jev");
  const accept = jev.act("ack_command", { command_id:first.id, status:"accepted" });
  jev.act("ack_command", { command_id:first.id, status:"running", run_id:accept.runId });
  jev.act("ack_command", { command_id:first.id, status:"completed", run_id:accept.runId, result:"Lead score 8/10" });
  const next = f.s.list("command")[0];
  assert.equal(next.agentId, "relay");
  assert.equal(f.s.get("workflow", run.id).currentStep, 2);
  assert.equal(f.s.get("work", run.workId).templateProgress[0].status, "completed");
  const ack = relay.act("ack_command",{command_id:next.id,status:"accepted"});
  relay.act("ack_command",{command_id:next.id,status:"running",run_id:ack.runId});
  relay.act("ack_command",{command_id:next.id,status:"completed",run_id:ack.runId,result:"Draft ready"});
  assert.equal(f.s.list("approval").some(a=>a.kind==="RESULT" && a.status==="waiting"),true);
  f.call("resolve_approval",{id:f.s.list("approval").find(a=>a.kind==="RESULT").id,decision:"approved",note:"Approved"});
  assert.equal(f.s.get("workflow",run.id).status,"completed");
  f.s.close();
});
test("review loop sends reviewer feedback back to implementation until its loop limit", () => {
  const f = fixture(), jev = f.pair("jev"), relay = f.pair("relay");
  f.call("save_template", { id:"review_loop", name:"Review loop", steps:[{agentId:"jev",handoff:"Implement"},{agentId:"relay",handoff:"Review"}], completionCriteria:"Pass review", maxLoops:2 });
  const workflow = f.call("run_template", { templateId:"review_loop", title:"Review me", brief:"Make a small change", goalId:"monthly" });
  let command = f.s.list("command")[0];
  const complete = (agent, c, result) => { const run = agent.act("ack_command",{command_id:c.id,status:"accepted"}); agent.act("ack_command",{command_id:c.id,status:"running",run_id:run.runId}); agent.act("ack_command",{command_id:c.id,status:"completed",run_id:run.runId,result}); };
  complete(jev, command, "Implementation done");
  command = f.s.list("command")[0];
  complete(relay, command, "REVIEW: FAIL\nAdd the missing validation");
  assert.equal(f.s.list("command")[0].agentId,"jev");
  assert.equal(f.s.get("workflow",workflow.id).loopCount,2);
  assert.match(f.s.get("work",workflow.workId).brief,/missing validation/);
  command=f.s.list("command")[0];
  complete(jev,command,"Implementation revised");
  command=f.s.list("command")[0];
  complete(relay,command,"REVIEW: FAIL\nStill failing");
  assert.equal(f.s.get("workflow",workflow.id).status,"awaiting_approval");
  assert.equal(f.s.list("command").some(c=>c.agentId==="jev" && c.id!==command.id),true);
  f.s.close();
});
test("resetting a conversation session clears its runtime ID and stale hash warning", () => {
  const f = fixture();
  const conversation = f.call("start_agent_conversation", { agentId:"dave" });
  const message = f.call("send_agent_message", { agentId:"dave", conversationId:conversation.id, body:"hello" });
  f.dave.act("reply_message", { id:message.id, body:"hello", runtimeSessionId:"session-old", instructionHash:"a".repeat(64) });
  f.dave.act("report_heartbeat", { agent_id:"dave", runtime_id:"hermes-dave", sequence:1, status:"idle", last_seen:new Date().toISOString(), capabilities:["work.execute"], instruction_hash:"b".repeat(64) });
  assert.equal(f.call("get_dashboard").agents.find(a=>a.id==="dave").staleSession, true);
  f.call("reset_agent_session", { agentId:"dave" });
  assert.equal(f.s.get("conversation", conversation.id).runtimeSessionId, null);
  assert.equal(f.s.events().some(e=>e.type==="agent.session_reset"), true);
  f.s.close();
});
test("cannot skip acknowledgments, impersonate agent, or approve as agent", () => {
  const f = fixture(),
    relay = f.pair("relay"),
    w = f.create(),
    command = f.dispatch(w);
  assert.throws(
    () =>
      f.dave.act("ack_command", {
        command_id: command.id,
        status: "completed",
      }),
    /separately/,
  );
  assert.throws(
    () =>
      relay.act("ack_command", { command_id: command.id, status: "accepted" }),
    /another agent/,
  );
  assert.throws(
    () => f.dave.act("resolve_approval", {}),
    /Unknown agent action/,
  );
  assert.throws(
    () =>
      f.dave.act("report_heartbeat", {
        agent_id: "relay",
        runtime_id: "hermes-dave",
        sequence: 1,
        status: "idle",
        last_seen: new Date().toISOString(),
      }),
    /Identity mismatch/,
  );
  f.s.close();
});
test("expired leases block recovery and cannot be renewed or completed late", () => {
  const f = fixture(),
    w = f.create(),
    command = f.dispatch(w),
    ack = f.dave.act("ack_command", {
      command_id: command.id,
      status: "accepted",
    });
  const run = f.s.get("run", ack.runId);
  run.leaseUntil = "2000-01-01T00:00:00Z";
  f.s.put("run", run);
  f.c.recover();
  assert.equal(f.s.get("work", w).status, "blocked");
  assert.equal(f.s.get("command", command.id).status, "expired");
  assert.throws(
    () =>
      f.dave.act("ack_command", { command_id: command.id, status: "running" }),
    /terminal/,
  );
  f.s.close();
});
test("pairing one use, ten-minute expiry, immediate revocation", () => {
  const f = fixture();
  const code = f.call("create_pairing_code", { agentId: "dave" }).code;
  assert.throws(() => f.dave.act("poll_commands"), /revoked/);
  f.c.public("redeem_pairing_code", { code, runtime_id: "new" });
  assert.throws(
    () => f.c.public("redeem_pairing_code", { code, runtime_id: "new" }),
    /already used/,
  );
  const next = f.call("create_pairing_code", { agentId: "dave" });
  for (const p of f.s.list("pairing")) f.s.put("pairing", { ...p, expires: 0 });
  assert.throws(
    () =>
      f.c.public("redeem_pairing_code", { code: next.code, runtime_id: "new" }),
    /expired/,
  );
  f.s.close();
});
test("owner office presets duplicate a validated design between agents", () => {
  const f = fixture();
  const design = structuredClone(f.call("get_dashboard").themes.cozy_den);
  const presetId = f.call("save_office_preset", {
    name: "Warm studio",
    design,
  }).id;
  assert.equal(f.call("get_dashboard").officePresets[0].name, "Warm studio");
  const relay = f.s.get("agent", "relay");
  f.call("apply_office_preset", {
    presetId,
    agentId: "relay",
    revision: relay.revision,
  });
  assert.deepEqual(f.s.get("agent", "relay").ownerDesign, design);
  assert.throws(
    () =>
      f.call("apply_office_preset", {
        presetId,
        agentId: "relay",
        revision: relay.revision,
      }),
    /changed/,
  );
  f.call("delete_office_preset", { id: presetId });
  assert.equal(f.call("get_dashboard").officePresets.length, 0);
  f.s.close();
});
test("saved operational views are durable and validate filters", () => {
  const f = fixture();
  const id = f.call("save_operational_view", {
    name: "Needs me",
    filter: "needs_owner",
  }).id;
  assert.deepEqual(
    f.call("get_dashboard").savedViews.map((v) => v.name),
    ["Needs me"],
  );
  assert.throws(() =>
    f.call("save_operational_view", { name: "Other", filter: "invented" }),
  );
  f.call("delete_operational_view", { id });
  assert.equal(f.call("get_dashboard").savedViews.length, 0);
  f.s.close();
});
test("verified budget usage is idempotent and a hard limit blocks dispatch", () => {
  const f = fixture();
  const workId = f.create();
  const budgetId = f.call("save_budget", {
    name: "BIS testing",
    scope: "organization",
    scopeId: "bis",
    unit: "USD",
    period: "monthly",
    softLimit: 5,
    hardLimit: 10,
  }).id;
  const usage = {
    budgetId,
    amount: 10,
    note: "Verified provider invoice",
    idempotency_key: "budget-test-usage-1",
  };
  f.call("record_budget_usage", usage);
  assert.equal(f.call("record_budget_usage", usage).duplicate, true);
  assert.equal(f.call("get_dashboard").budgets[0].used, 10);
  assert.throws(() => f.dispatch(workId), /Budget hard limit reached/);
  assert.throws(
    () => f.call("delete_budget", { id: budgetId }),
    /recorded usage/,
  );
  f.s.close();
});
test("office strict validation, owner precedence and stale write protection", () => {
  const f = fixture();
  const d = {
    version: 1,
    theme: "cozy_den",
    palette: "warm",
    placements: [{ slot: "primary_desk", asset_id: "kenney.desk" }],
  };
  f.call("save_office_design", { agentId: "dave", revision: 0, design: d });
  assert.throws(
    () =>
      f.call("save_office_design", { agentId: "dave", revision: 0, design: d }),
    /changed/,
  );
  assert.throws(() =>
    f.call("save_office_design", {
      agentId: "dave",
      revision: 1,
      design: { ...d, evil: true },
    }),
  );
  assert.throws(() =>
    f.call("save_office_design", {
      agentId: "dave",
      revision: 1,
      design: {
        ...d,
        placements: [{ slot: "task_chair", asset_id: "kenney.desk" }],
      },
    }),
  );
  f.dave.act("report_heartbeat", {
    agent_id: "dave",
    runtime_id: "hermes-dave",
    sequence: 1,
    status: "idle",
    last_seen: new Date().toISOString(),
    office_design: { ...d, theme: "neutral" },
  });
  assert.equal(
    f.call("get_dashboard").agents.find((a) => a.id === "dave").effectiveDesign
      .theme,
    "cozy_den",
  );
  f.s.close();
});
test("global stop, policy gate, stale RACI and BIS scope", () => {
  const f = fixture(),
    w = f.create();
  assert.throws(
    () => f.call("set_work_raci", { id: w, revision: 7, raci: {} }),
    /changed/,
  );
  f.call("global_stop", { stopped: true });
  assert.throws(() => f.dispatch(w), /stopped/);
  f.call("global_stop", { stopped: false });
  const record = f.s.get("work", w);
  record.action = "publish";
  f.s.put("work", record);
  assert.throws(() => f.dispatch(w), /approval/);
  assert.throws(
    () =>
      f.call("link_cognition_record", {
        workId: w,
        scope: "personal",
        uri: "https://example.com",
      }),
    /BIS/,
  );
  f.s.close();
});
test("private messages have explicit queued, delivered, acknowledged and replied states", () => {
  const f = fixture();
  const m = f.call("send_agent_message", {
    agentId: "dave",
    body: "A private instruction",
  });
  assert.equal(f.s.get("message", m.id).status, "queued");
  const c = f.dave.act("poll_commands")[0];
  f.dave.act("ack_command", { command_id: c.id, status: "accepted" });
  assert.equal(f.s.get("message", m.id).status, "delivered");
  f.dave.act("ack_command", { command_id: c.id, status: "running" });
  assert.equal(f.s.get("message", m.id).status, "acknowledged");
  f.dave.act("reply_message", { id: m.id, body: "Received" });
  assert.equal(f.s.get("message", m.id).status, "replied");
  f.s.close();
});
test("private conversation sessions resume only their own agent and serialize turns", () => {
  const f = fixture();
  const first = f.call("start_agent_conversation", { agentId: "dave" });
  const message = f.call("send_agent_message", { agentId: "dave", conversationId: first.id, body: "Hello" });
  assert.throws(() => f.call("send_agent_message", { agentId: "dave", conversationId: first.id, body: "Too soon" }), /Wait for the current reply/);
  assert.throws(() => f.call("send_agent_message", { agentId: "relay", conversationId: first.id, body: "Wrong agent" }), /another agent/);
  const command = f.dave.act("poll_commands")[0];
  assert.equal(command.payload.runtimeSessionId, null);
  f.dave.act("reply_message", { id: message.id, body: "Hi", runtimeSessionId: "hermes-session-1" });
  const next = f.call("send_agent_message", { agentId: "dave", conversationId: first.id, body: "Continue" });
  const queued = f.s.list("command").find((c) => c.payload?.messageId === next.id);
  assert.equal(queued.payload.runtimeSessionId, "hermes-session-1");
  const fresh = f.call("start_agent_conversation", { agentId: "dave" });
  const newMessage = f.call("send_agent_message", { agentId: "dave", conversationId: fresh.id, body: "New topic" });
  const freshCommand = f.s.list("command").find((c) => c.payload?.messageId === newMessage.id);
  assert.equal(freshCommand.payload.runtimeSessionId, null);
  assert.equal(f.call("get_dashboard").conversations.length, 2);
  f.s.close();
});
test("handoff preserves accountability and changes ownership only on destination completion", () => {
  const f = fixture(),
    relay = f.pair("relay"),
    w = f.create();
  const h = f.dave.act("request_handoff", {
    workId: w,
    to: "relay",
    context: "BIS reference and evidence",
    idempotency_key: "handoff-test",
  });
  f.call("accept_handoff", { id: h.id, accept: true });
  assert.deepEqual(f.s.get("work", w).raci.responsible, ["dave"]);
  const command = relay.act("poll_commands")[0];
  for (const status of ["accepted", "running", "completed"])
    relay.act("ack_command", { command_id: command.id, status });
  assert.deepEqual(f.s.get("work", w).raci.responsible, ["relay"]);
  assert.equal(f.s.get("work", w).raci.accountable, "matt");
  f.s.close();
});
test("expired delivery and handoff release pending state without transferring ownership", () => {
  const f = fixture();
  f.pair("relay");
  const w = f.create();
  const m = f.call("send_agent_message", {
    agentId: "dave",
    body: "Pending note",
  });
  const h = f.dave.act("request_handoff", {
    workId: w,
    to: "relay",
    context: "Review context",
    idempotency_key: "expired-handoff",
  });
  f.call("accept_handoff", { id: h.id, accept: true });
  for (const c of f.s.active("command")) {
    c.expiresAt = new Date(Date.now() - 1000).toISOString();
    f.s.put("command", c);
  }
  f.c.recover();
  assert.equal(f.s.get("message", m.id).status, "expired");
  assert.equal(f.s.get("handoff", h.id).status, "expired");
  assert.equal(f.s.get("work", w).transferPending, undefined);
  assert.deepEqual(f.s.get("work", w).raci.responsible, ["dave"]);
  assert.equal(f.s.get("work", w).status, "blocked");
  f.s.close();
});
test("a fresh idempotency key cannot create duplicate queued execution", () => {
  const f = fixture(),
    w = f.create();
  f.dispatch(w);
  assert.throws(
    () =>
      f.call("dispatch_work_item", {
        id: w,
        revision: f.s.get("work", w).revision,
        agentId: "dave",
        idempotency_key: "a-new-key-for-same-work",
      }),
    /pending command/,
  );
  assert.equal(f.s.active("command").filter((c) => c.workId === w).length, 1);
  f.s.close();
});
test("redirection invalidates old policy approval and queues a fresh review", () => {
  const f = fixture();
  const w = f.call("create_work_item", {
    title: "Publish a result",
    brief: "Publish approved BIS work",
    priority: "normal",
    goalId: "monthly",
    action: "publish",
    raci: {
      responsible: ["dave"],
      accountable: "matt",
      consulted: [],
      informed: [],
    },
  }).id;
  const old = f.s.list("approval")[0];
  f.call("resolve_approval", {
    id: old.id,
    decision: "approved",
    note: "Original brief approved",
  });
  f.call("edit_work_item", {
    id: w,
    revision: 0,
    title: "Changed result",
    brief: "Different publication context",
    priority: "high",
  });
  assert.throws(() => f.dispatch(w), /approval/);
  assert(
    f.s
      .list("approval")
      .some((a) => a.status === "waiting" && a.workRevision === 1),
  );
  f.s.close();
});
test("project registration opens a project and only verified milestones advance it", () => {
  const f = fixture();
  const b = f.call("register_building", {
    name: "Launch",
    kind: "project_site",
    agentId: "unused",
    style: "workshop",
    goalId: "monthly",
  }).id;
  assert(!f.s.get("building", b).agentId);
  f.call("add_milestone", {
    id: b,
    revision: 0,
    title: "Owner-reviewed launch plan",
  });
  const m = f.s.get("building", b).milestones[0];
  assert.equal(m.status, "open");
  assert.throws(
    () =>
      f.call("close_milestone", {
        id: b,
        revision: 0,
        milestoneId: m.id,
        evidence: "https://example.com",
        note: "Reviewed",
      }),
    /changed/,
  );
  f.call("close_milestone", {
    id: b,
    revision: 1,
    milestoneId: m.id,
    evidence: "https://example.com",
    note: "Reviewed",
  });
  assert.equal(f.s.get("building", b).milestones[0].status, "closed");
  f.s.close();
});
test("office item positions are bounded, revisioned, and persist independently of design", () => {
  const f = fixture();
  f.call("save_office_positions", {
    agentId: "relay",
    revision: 0,
    positions: { task_chair: [0.25, 0, -0.5], desk_screen: [0, -0.1, 0.2] },
  });
  assert.deepEqual(
    f.s.get("agent", "relay").officePositions.task_chair,
    [0.25, 0, -0.5],
  );
  assert.throws(
    () =>
      f.call("save_office_positions", {
        agentId: "relay",
        revision: 0,
        positions: {},
      }),
    /changed/,
  );
  assert.throws(
    () =>
      f.call("save_office_positions", {
        agentId: "relay",
        revision: 1,
        positions: { task_chair: [99, 0, 0] },
      }),
    /too_big|less than or equal|3/,
  );
  f.s.close();
});
test("project lifecycle preserves a reusable plot and owner edits existing buildings", () => {
  const f = fixture();
  const id = f.call("register_building", {
    name: "Signal Studio",
    kind: "project_site",
    style: "studio",
    goalId: "monthly",
  }).id;
  const plot = f.s.get("building", id);
  assert.equal(plot.lifecycle, "planning");
  assert.deepEqual([plot.x, plot.z], [12, 0]);
  f.call("update_building", {
    id: "relay",
    revision: 0,
    name: "Relay Communications",
    style: "studio",
  });
  assert.equal(f.s.get("building", "relay").style, "studio");
  f.call("set_project_lifecycle", {
    id,
    revision: 0,
    lifecycle: "building",
    note: "Approved construction",
  });
  assert.throws(
    () =>
      f.call("set_project_lifecycle", {
        id,
        revision: 1,
        lifecycle: "complete",
        note: "Skip",
      }),
    /Cannot move/,
  );
  f.call("set_project_lifecycle", {
    id,
    revision: 1,
    lifecycle: "running",
    note: "Opened for work",
  });
  f.call("set_project_lifecycle", {
    id,
    revision: 2,
    lifecycle: "complete",
    note: "Delivered",
  });
  f.call("retire_project", { id, revision: 3, confirm: true });
  assert.equal(f.s.get("building", id).kind, "reserved_plot");
  assert.equal(f.s.get("building", id).projectHistory[0].name, "Signal Studio");
  assert.throws(
    () =>
      f.call("register_building", {
        name: "Wrong kind",
        kind: "agent_hq",
        agentId: "wrongkind",
        style: "lab",
        plotId: id,
      }),
    /Reserved plots accept projects only/,
  );
  const replacement = f.call("register_building", {
    name: "Next Venture",
    kind: "project_site",
    style: "lab",
    goalId: "monthly",
  }).id;
  assert.equal(replacement, id);
  assert.equal(f.s.get("building", id).x, plot.x);
  assert.equal(f.s.get("building", id).lifecycle, "planning");
  assert.equal(f.s.get("building", id).projectHistory[0].name, "Signal Studio");
  f.s.close();
});
test("city models and placements persist with revision and plot bounds", () => {
  const f = fixture();
  f.call("save_city_building", {
    id: "relay",
    revision: 0,
    model: "glass_atrium",
    position: [-8, 0.5, 7],
  });
  assert.equal(f.s.get("building", "relay").model, "glass_atrium");
  assert.deepEqual(
    [f.s.get("building", "relay").x, f.s.get("building", "relay").y],
    [-8, 0.5],
  );
  assert.throws(
    () =>
      f.call("save_city_building", {
        id: "relay",
        revision: 0,
        model: "campus",
        position: [-8, 0, 7],
      }),
    /changed/,
  );
  assert.throws(
    () =>
      f.call("save_city_building", {
        id: "relay",
        revision: 1,
        model: "campus",
        position: [7, 0, 6],
      }),
    /plots must remain clear/,
  );
  f.call("add_city_asset", { asset: "satellite_dish", position: [-11, 0, 9] });
  const asset = f.s.list("city_asset")[0];
  assert.equal(asset.asset, "satellite_dish");
  f.call("save_city_asset", {
    id: asset.id,
    revision: 0,
    asset: "landing_pad",
    position: [-12, 0, 10],
  });
  assert.deepEqual(f.s.get("city_asset", asset.id).position, [-12, 0, 10]);
  f.call("remove_city_asset", { id: asset.id, revision: 1 });
  assert.equal(f.s.get("city_asset", asset.id), null);
  f.s.close();
});
test("HQ building and desk placements persist with revision and clearance checks", () => {
  const f = fixture();
  const hq = f.c.snapshot().hq;
  assert.deepEqual(hq.position, [0, 0, 0]);
  f.call("save_hq", { revision: 0, model: "skyscraper", position: [1, 0, 0] });
  f.call("save_hq", { revision: 1, zones: { missions: [0.25, 0, -0.25] } });
  assert.equal(f.c.snapshot().hq.model, "skyscraper");
  assert.deepEqual(f.c.snapshot().hq.zones.missions, [0.25, 0, -0.25]);
  assert.throws(() => f.call("save_hq", { revision: 1, model: "warehouse" }), /changed/);
  assert.throws(() => f.call("save_hq", { revision: 2, zones: { missions: [8, 0, 0] } }), /too_big|less than or equal/);
  const occupied = f.s.list("building")[0];
  assert.throws(() => f.call("save_hq", { revision: 2, position: [occupied.x, 0, occupied.z] }), /clear/);
  f.s.close();
});
test("remove_agent cleans up the agent record and its references", () => {
  const f = fixture();
  f.s.put("agent", { id: "doomed", name: "Doomed", role: "Redundant", theme: "neutral", status: "idle", lastSeen: null, paused: false, revision: 0, sequence: -1, capabilities: [] });
  const doomed = f.pair("doomed");
  doomed.act("report_heartbeat", {
    agent_id: "doomed",
    runtime_id: "hermes-doomed",
    sequence: 1,
    status: "idle",
    last_seen: new Date().toISOString(),
    capabilities: ["work.execute"],
    avatar_image: {
      mime_type: "image/png",
      data_base64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    },
  });
  const wid = f.call("create_work_item", {
    title: "Doomed mission",
    brief: "Nothing to see here",
    priority: "low",
    goalId: "monthly",
    raci: {
      responsible: ["doomed", "dave"],
      accountable: "matt",
      consulted: ["doomed"],
      informed: [],
    },
  }).id;
  assert.throws(() => f.call("remove_agent", { agentId: "doomed" }), /Confirm/);
  const out = f.call("remove_agent", { agentId: "doomed", confirm: true });
  assert.equal(out.id, "doomed");
  assert.equal(f.s.get("agent", "doomed"), null);
  assert.equal(f.s.get("portrait", "doomed"), null);
  assert.equal(
    f.s.list("command").filter((c) => c.agentId === "doomed").length,
    0,
  );
  assert.equal(
    f.s.list("conversation").filter((c) => c.agentId === "doomed").length,
    0,
  );
  assert.equal(f.s.list("run").filter((r) => r.agentId === "doomed").length, 0);
  const w = f.s.get("work", wid);
  assert.deepEqual(w.raci.responsible, ["dave"]);
  assert.deepEqual(w.raci.consulted, []);
  const events = f.s.events("agent.removed", 0);
  assert.ok(events.some((e) => e.entity === "doomed"));
  f.s.close();
});
test("pairing gate follows the sitting chief of staff", () => {
  const f = fixture();
  assert.doesNotThrow(() => f.pair("relay"));
  f.s.close();
});

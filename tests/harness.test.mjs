import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { Core } from "../server/core.mjs";
import { denverWindow, jevAnalytics, canaryStatus } from "../server/harness.mjs";

test("Denver window uses exact zoned boundaries across standard and daylight time", () => {
  assert.equal(denverWindow("2026-01-12T08:59:59Z").open, false);
  assert.equal(denverWindow("2026-01-12T09:00:00Z").open, true);
  assert.equal(denverWindow("2026-01-12T10:59:59Z").open, true);
  assert.equal(denverWindow("2026-01-12T11:00:00Z").open, false);
  assert.equal(denverWindow("2026-07-12T07:59:59Z").open, false);
  assert.equal(denverWindow("2026-07-12T08:00:00Z").open, true);
  assert.equal(denverWindow("2026-07-12T09:59:59Z").open, true);
  assert.equal(denverWindow("2026-07-12T10:00:00Z").open, false);
  assert.equal(denverWindow("not a timestamp").valid, false);
});

test("Jev distinguishes unavailable ledger from available empty ledger", () => {
  const agents = [{ id: "nerby" }];
  assert.equal(jevAnalytics(null, agents).available, false);
  const empty = jevAnalytics([], agents, { coverageDenominators: { nerby: 0 } });
  assert.equal(empty.available, true);
  assert.equal(empty.total, 0);
  assert.equal(empty.byAgent[0].agreementRate, null);
  assert.equal(empty.byAgent[0].coverage.expected, 0);
  assert.equal(empty.byAgent[0].coverage.rate, null);
});

test("analytics measures actual denominator, labeled resolutions, disagreement and 30-day calibration", () => {
  const nowAt = Date.parse("2026-09-28T12:00:00Z");
  const event = { id: "e", agentId: "nerby", tier: "L1", createdAt: new Date(nowAt - 2 * 86400000).toISOString(), jevScore: 8, agentConfidence: .9, jevConfidence: .8, recommendation: "go", jevRecommendation: "no-go", label: "override", highSeverityMiss: true };
  const old = { ...event, id: "old", createdAt: new Date(nowAt - 31 * 86400000).toISOString(), label: "approve" };
  const result = jevAnalytics([event, old], [{ id: "nerby" }], { nowAt, coverageDenominators: { nerby: 10 } });
  const row = result.byAgent[0];
  assert.equal(row.scored, 2);
  assert.equal(row.coverage.expected, 10);
  assert.equal(row.coverage.rate, .2);
  assert.equal(row.disagreementCount, 2);
  assert.equal(row.escalationList[0].label, "override");
  assert.equal(row.escalationList[0].resolved, true);
  assert.equal(row.labels.override, 1);
  assert.equal(row.labels.approve, 1);
  assert.equal(row.agentCalibration.sampleSize, 0);
  assert.equal(row.agentCalibration.accuracy, null);
  assert.equal(row.jevCalibration.sampleSize, 0);
  assert.equal(row.jevCalibration.calibrationError, null);
  assert.equal(row.highSeverityMisses, 2);
  assert.equal(row.periods.week.total, 1);
  assert.ok(result.alerts.some(x => x.type === "coverage_gap"));
  assert.ok(result.alerts.some(x => x.type === "high_severity_miss"));
});

test("decision labels are not treated as correctness ground truth", () => {
  const result = jevAnalytics([
    { agentId: "nerby", createdAt: "2026-09-28T10:00:00Z", jevScore: 7, agentConfidence: .9, jevConfidence: .8, label: "approve" },
    { agentId: "nerby", createdAt: "2026-09-28T10:01:00Z", jevScore: 6, agentConfidence: .7, jevConfidence: .6, label: "override", correct: false },
  ], [{ id: "nerby" }], { nowAt: Date.parse("2026-09-28T12:00:00Z") });
  const row = result.byAgent[0];
  assert.equal(row.labels.approve, 1);
  assert.equal(row.agentCalibration.sampleSize, 1);
  assert.equal(row.agentCalibration.accuracy, 0);
  assert.equal(row.jevCalibration.sampleSize, 1);
});

test("canary requires Nerby and either 24 elapsed hours or five completed dispatches plus explicit Matt promotion", () => {
  const start = Date.parse("2026-09-27T12:00:00Z");
  const c = { status: "passed", agentId: "nerby", startedAt: new Date(start).toISOString(), completedDispatches: 0, mattPromotionApproved: false };
  assert.equal(canaryStatus(c, start + 86400000 - 1).eligible, false);
  assert.equal(canaryStatus(c, start + 86400000).eligible, true);
  c.completedDispatches = 5;
  assert.equal(canaryStatus(c, start + 1000).eligible, true);
  assert.equal(canaryStatus(c, start + 1000).promoteAllowed, false);
  c.mattPromotionApproved = true;
  assert.equal(canaryStatus(c, start + 1000).promoteAllowed, true);
  assert.equal(canaryStatus({ ...c, agentId: "jeff" }, start + 1000).promoteAllowed, false);
  assert.equal(canaryStatus({ ...c, status: "failed" }, start + 1000).promoteAllowed, false);
});

test("upgrade and capability changes create version-specific Matt approvals and profile-isolated pins", () => {
  const store = new Store(":memory:"), core = new Core(store);
  try {
    const upgrade = core.harness.requestRuntimeUpgrade("v0.22.0");
    const approval = store.get("approval", upgrade.approvalId);
    assert.equal(approval.targetId, upgrade.id);
    assert.match(approval.title, /v0\.22\.0/);
    assert.equal(upgrade.executionAllowed, false);
    const change = core.harness.requestCapabilityChange({ profileId: "jeff", capability: "research", version: "1.2.0", operation: "install" });
    assert.equal(store.get("approval", change.approvalId).status, "waiting");
    const p1 = core.harness.setPin("jeff", "research", "1.2.0");
    const p2 = core.harness.setPin("relay", "research", "2.0.0");
    assert.notEqual(p1.id, p2.id);
    assert.equal(store.get("capability_pin", p1.id).profileId, "jeff");
    assert.equal(store.get("capability_pin", p2.id).version, "2.0.0");
    assert.throws(() => core.harness.requestCapabilityChange({ profileId: "jeff", capability: "research", version: "1.2.0", operation: "invalid" }), /Invalid capability operation/);
  } finally { store.close(); }
});

test("owner request, approval, and dashboard flows stay staged and profile-scoped", () => {
  const store = new Store(":memory:"), core = new Core(store);
  try {
    const passphrase = "a sufficiently long owner passphrase";
    const token = core.public("owner_setup", { passphrase, confirm: passphrase }).token;
    const act = (name, input = {}) => core.ownerAction(name, input, token);
    const upgradeRequest = act("request_runtime_upgrade", { version: "v0.22.0" });
    const capabilityRequest = act("request_capability_change", { profileId: "jeff", capability: "research", version: "1.2.0", operation: "install" });
    const requested = act("get_dashboard");
    const upgrade = requested.harness.upgrades.find(x => x.id === upgradeRequest.id);
    const capability = requested.harness.installs.find(x => x.id === capabilityRequest.id);
    for (const id of [upgrade.approvalId, capability.approvalId]) act("resolve_approval", { id, decision: "approved", note: "Approved for staged preparation only." });
    act("set_capability_pin", { profileId: "jeff", capability: "research", version: "1.2.0" });
    act("set_capability_pin", { profileId: "relay", capability: "research", version: "2.0.0" });
    act("scan_capabilities", { items: [{ profileId: "jeff", capability: "research" }, { profileId: "relay", capability: "research" }] });
    const scan = act("get_dashboard").harness.scans[0];
    assert.deepEqual(scan.items.map(x => x.pinned.version), ["1.2.0", "2.0.0"]);
    act("record_harness_health", { status: "warning", checks: { ledger: "unavailable" } });
    const dashboard = act("get_dashboard");
    const health = dashboard.harness.healthChecks[0];
    assert.equal(dashboard.harness.upgrades.find(x => x.id === upgrade.id).status, "approved_staged");
    assert.equal(dashboard.harness.upgrades.find(x => x.id === upgrade.id).executionAllowed, false);
    assert.equal(dashboard.harness.installs.find(x => x.id === capability.id).status, "approved_staged");
    assert.equal(dashboard.harness.healthChecks[0].id, health.id);
    assert.equal(dashboard.harness.analytics.available, false);
    assert.equal(store.list("approval").filter(x => x.status === "waiting").length, 0);
    assert.throws(() => act("request_runtime_upgrade", { version: "v0.22.0-rc.1" }));
  } finally { store.close(); }
});

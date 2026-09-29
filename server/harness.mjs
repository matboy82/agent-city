import { assert, id, now } from "./store.mjs";

const DAY = 86400000;
const LABELS = ["approve", "override", "reject"];
const TIERS = ["L1", "L2", "L3"];
const timestamp = value => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export function denverWindow(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return { open: false, valid: false, localDate: null, localTime: null, conflict: "Denver time is an application validation only; the existing 4:10 AM UTC gate is unchanged." };
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const minute = Number(p.hour) * 60 + Number(p.minute);
  return { open: minute >= 120 && minute < 240, valid: true, localDate: `${p.year}-${p.month}-${p.day}`, localTime: `${p.hour}:${p.minute}`, conflict: "Denver 2–4 AM wall time is application validation only. The existing 4:10 AM UTC gate is unchanged; do not infer a schedule change." };
}

function calibrated(rows, confidenceField) {
  const eligible = rows.filter(x => typeof x[confidenceField] === "number" && x[confidenceField] >= 0 && x[confidenceField] <= 1 && typeof x.correct === "boolean");
  if (!eligible.length) return { sampleSize: 0, accuracy: null, meanConfidence: null, calibrationError: null };
  const accuracy = eligible.filter(x => x.correct).length / eligible.length;
  const meanConfidence = eligible.reduce((sum, x) => sum + x[confidenceField], 0) / eligible.length;
  return { sampleSize: eligible.length, accuracy, meanConfidence, calibrationError: accuracy - meanConfidence };
}

export function jevAnalytics(events, agents, { nowAt = Date.now(), coverageDenominators = null } = {}) {
  if (events === null || events === undefined) return { available: false, source: "jev_ledger", total: null, byAgent: [], byType: {}, fleetAgreement: null, labels: null, events: [], alerts: [], coverageDenominatorAvailable: coverageDenominators !== null };
  const valid = events.filter(x => x && x.status !== "unavailable");
  const scored = valid.filter(x => typeof x.jevScore === "number" && Number.isFinite(x.jevScore));
  const since = nowAt - 30 * DAY;
  const recent = rows => rows.filter(x => { const t = timestamp(x.createdAt); return Number.isFinite(t) && t >= since && t <= nowAt; });
  const rows = agents.map(a => {
    const own = valid.filter(x => x.agentId === a.id);
    const ownScored = own.filter(x => typeof x.jevScore === "number" && Number.isFinite(x.jevScore));
    const windowed = recent(ownScored);
    const labels = Object.fromEntries(LABELS.map(label => [label, own.filter(x => x.label === label).length]));
    const outcomeFor = (x, field) => typeof x[field] === "boolean" ? x[field] : null;
    const disagreements = own.filter(x => x.disagreement === true || x.escalated === true || (x.recommendation && x.jevRecommendation && x.recommendation !== x.jevRecommendation) || (typeof x.agentConfidence === "number" && typeof x.jevConfidence === "number" && Math.abs(x.agentConfidence - x.jevConfidence) > 0.3));
    const denominator = coverageDenominators?.[a.id] ?? own.length;
    const expected = Number.isInteger(denominator) && denominator >= 0 ? denominator : null;
    const rate = expected === null ? null : expected === 0 ? null : own.length / expected;
    const periods = ["day", "week"].map(period => {
      const duration = period === "day" ? DAY : 7 * DAY;
      const start = nowAt - duration;
      const subset = own.filter(x => { const t = timestamp(x.createdAt); return Number.isFinite(t) && t >= start && t <= nowAt; });
      return [period, { total: subset.length, byTier: Object.fromEntries(TIERS.map(tier => [tier, subset.filter(x => x.tier === tier).length])) }];
    });
    const outcomeRows = windowed.map(x => ({ ...x, correct: outcomeFor(x, "correct") }));
    return {
      agentId: a.id, scored: ownScored.length, byDay: Object.fromEntries(Array.from({ length: 30 }, (_, i) => { const start = new Date(nowAt - i * DAY); const key = start.toISOString().slice(0, 10); return [key, ownScored.filter(x => x.createdAt?.slice(0, 10) === key).length]; })),
      pending: own.filter(x => x.status === "scoring").length, unscored: own.filter(x => x.status === "unscored").length,
      periods: Object.fromEntries(periods), labels,
      agreementRate: own.some(x => typeof x.agreement === "boolean") ? own.filter(x => x.agreement === true).length / own.filter(x => typeof x.agreement === "boolean").length : null,
      disagreementCount: disagreements.length,
      escalationList: disagreements.map(x => ({ id: x.id, recommendation: x.recommendation ?? null, jevRecommendation: x.jevRecommendation ?? null, confidenceGap: typeof x.agentConfidence === "number" && typeof x.jevConfidence === "number" ? Math.abs(x.agentConfidence - x.jevConfidence) : null, escalated: x.escalated === true, label: LABELS.includes(x.label) ? x.label : null, resolved: LABELS.includes(x.label) })),
      agentCalibration: calibrated(outcomeRows, "agentConfidence"), jevCalibration: calibrated(outcomeRows, "jevConfidence"),
      labeledCount: Object.values(labels).reduce((sum, n) => sum + n, 0), labeledToward10: Object.values(labels).reduce((sum, n) => sum + n, 0), labeledToward30to50: Object.values(labels).reduce((sum, n) => sum + n, 0),
      highSeverityMisses: own.filter(x => x.highSeverityMiss === true).length,
      coverage: { scored: own.length, expected, rate, denominatorAvailable: expected !== null },
      trend: Array.from({ length: 7 }, (_, i) => { const day = new Date(nowAt - i * DAY).toISOString().slice(0, 10); return { day, count: own.filter(x => x.createdAt?.slice(0, 10) === day).length }; }),
    };
  });
  const agreementEvents = scored.filter(x => typeof x.agreement === "boolean");
  const labelCounts = Object.fromEntries(LABELS.map(label => [label, scored.filter(x => x.label === label).length]));
  const alerts = rows.flatMap(r => [
    ...(r.coverage.expected !== null && r.coverage.expected > 0 && r.coverage.rate < 0.5 ? [{ type: "coverage_gap", agentId: r.agentId, scored: r.coverage.scored, expected: r.coverage.expected, level: "L0" }] : []),
    ...(r.disagreementCount >= 3 ? [{ type: "disagreement_spike", agentId: r.agentId, count: r.disagreementCount, level: "L0" }] : []),
    ...(r.agentCalibration.calibrationError !== null && Math.abs(r.agentCalibration.calibrationError) > 0.2 ? [{ type: "calibration_drift", agentId: r.agentId, level: "L0" }] : []),
    ...(r.highSeverityMisses ? [{ type: "high_severity_miss", agentId: r.agentId, count: r.highSeverityMisses, level: "L0" }] : []),
  ]);
  return { available: true, source: "jev_ledger", total: scored.length, byAgent: rows, byType: Object.fromEntries(TIERS.map(t => [t, scored.filter(x => x.tier === t).length])), fleetAgreement: agreementEvents.length ? agreementEvents.filter(x => x.agreement).length / agreementEvents.length : null, labels: labelCounts, events: scored, alerts, coverageDenominatorAvailable: coverageDenominators !== null, weeklyRollup: { scored: recent(scored).filter(x => timestamp(x.createdAt) >= nowAt - 7 * DAY).length, byAgent: rows.map(r => ({ agentId: r.agentId, ...r.periods.week })) } };
}

export function canaryStatus(canary, at = Date.now()) {
  const dispatches = Number.isInteger(canary.completedDispatches) && canary.completedDispatches >= 0 ? canary.completedDispatches : 0;
  const started = timestamp(canary.startedAt);
  const elapsed = Number.isFinite(started) && at >= started + DAY;
  const eligible = elapsed || dispatches >= 5;
  const failed = canary.status === "failed";
  return { eligible: eligible && !failed, elapsed24Hours: !!elapsed, dispatches, failed, promoteAllowed: !failed && canary.status === "passed" && eligible && canary.agentId === "nerby" && canary.mattPromotionApproved === true };
}

export function createHarness(core) {
  const approvalFor = (kind, record, title, effect) => {
    const approval = { id: id(), kind, targetId: record.id, title, context: `Matt approval required. ${effect}`, effect, status: "waiting", createdAt: now(), harnessOperation: true };
    core.s.put("approval", approval);
    return approval;
  };
  return {
    analytics() {
      const rows = core.s.list("jev_ledger", 100000);
      const available = rows.length > 0 || core.s.get("jev_ledger", "_source")?.available === true;
      const source = available ? rows : null;
      const coverage = core.s.get("jev_coverage", "_denominators");
      const result = jevAnalytics(source, core.s.list("agent"), { coverageDenominators: coverage?.byAgent || null });
      if (result.available) result.pending = rows.filter(x => x.status === "scoring").length;
      return result;
    },
    requestRuntimeUpgrade(version) {
      assert(typeof version === "string" && /^v?\d+\.\d+\.\d+$/.test(version), "Specify an exact stable runtime version");
      const existing = core.s.list("runtime_upgrade").find(x => x.version === version && x.status === "awaiting_approval");
      if (existing) return existing;
      const record = { id: id(), version, status: "awaiting_approval", approvalStatus: "waiting", createdAt: now(), executionAllowed: false, window: "America/Denver 02:00 inclusive–04:00 exclusive", preflight: { required: true, completed: false }, snapshot: { required: true, completed: false }, rollback: { required: true, completed: false }, canary: { agentId: "nerby", status: "not_started", startedAt: null, completedDispatches: 0, mattPromotionApproved: false } };
      core.s.put("runtime_upgrade", record);
      const approval = approvalFor("RUNTIME_UPGRADE", record, `Approve Hermes runtime ${version}`, "Approve this exact version's staged preparation only; this application does not execute an upgrade.");
      record.approvalId = approval.id; core.s.put("runtime_upgrade", record); return record;
    },
    scanCapabilities(items) {
      assert(Array.isArray(items), "Capability scan must be an array");
      const pins = core.s.list("capability_pin");
      const result = { id: id(), items: items.map(item => ({ ...item, pinned: pins.find(pin => pin.capability === item.capability && (!item.profileId || pin.profileId === item.profileId)) || null })), createdAt: now() };
      core.s.put("capability_scan", result); return result;
    },
    requestCapabilityChange({ profileId, capability, version, operation }) {
      core.require("agent", profileId);
      assert(/^[a-zA-Z0-9._-]{1,100}$/.test(capability) && /^[a-zA-Z0-9._-]{1,100}$/.test(version), "Invalid capability or version");
      assert(["install", "uninstall"].includes(operation), "Invalid capability operation");
      const record = { id: id(), profileId, capability, version, operation, status: "awaiting_approval", approvalStatus: "waiting", createdAt: now(), smokeTest: { required: operation === "install", completed: false } };
      core.s.put("capability_install", record);
      record.approvalId = approvalFor("CAPABILITY_CHANGE", record, `${operation === "install" ? "Install" : "Uninstall"} ${capability} ${version} for ${profileId}`, `Approve this ${operation} for profile ${profileId} only.`).id;
      core.s.put("capability_install", record); return record;
    },
    setPin(profileId, capability, version) {
      core.require("agent", profileId); assert(/^[a-zA-Z0-9._-]{1,100}$/.test(capability) && /^[a-zA-Z0-9._-]{1,100}$/.test(version), "Invalid capability pin");
      const existing = core.s.list("capability_pin").find(pin => pin.profileId === profileId && pin.capability === capability);
      const record = { id: existing?.id || `${profileId}:${capability}`, profileId, capability, version, updatedAt: now() };
      core.s.put("capability_pin", record); return record;
    },
    recordHealth(result) {
      assert(result && ["healthy", "warning", "failed", "unavailable"].includes(result.status), "Invalid health result");
      const record = { id: id(), createdAt: now(), status: result.status, checks: result.checks || {}, level: "L0", delivery: "briefing_only" };
      core.s.put("harness_health", record); return record;
    },
  };
}

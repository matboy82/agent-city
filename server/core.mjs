import { z } from "zod";
import {
  assert,
  Fault,
  id,
  now,
  hash,
  secret,
  passwordRecord,
  checkPassword,
} from "./store.mjs";
import {
  workSchema,
  heartbeatSchema,
  design,
  raci,
  safeUrl,
  OFFICE_ASSETS,
  OFFICE_THEME_DESIGNS,
  officeDesignFromLegacy,
} from "./contracts.mjs";
const terminal = ["completed", "failed", "expired", "canceled"];
const stamp = () => Date.now();
const denverMonth = (value) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));
  return (
    parts.find((p) => p.type === "year").value +
    "-" +
    parts.find((p) => p.type === "month").value
  );
};
export class Core {
  constructor(store) {
    this.s = store;
  }
  require(kind, key) {
    const r = this.s.get(kind, key);
    assert(r, `${kind} not found`, 404);
    return r;
  }
  version(r, rev) {
    assert(
      Number.isInteger(rev) && r.revision === rev,
      "This record changed. Refresh before saving.",
      409,
    );
  }
  owner(token) {
    const s = this.s.get("session", hash(token || ""));
    assert(s && s.expires > stamp(), "Sign in to continue", 401);
    return "matt";
  }
  agent(token) {
    const a = this.s
      .list("agent")
      .find((a) => a.credentialHash === hash(token || ""));
    assert(a, "Invalid or revoked agent credential", 401);
    return a;
  }
  session() {
    const token = secret();
    this.s.put("session", { id: hash(token), expires: stamp() + 43200000 });
    return { token };
  }
  public(action, b) {
    if (action === "owner_access_status")
      return { configured: !!this.s.get("owner", "matt") };
    if (action === "owner_setup" || action === "owner_login") {
      const p = z.string().min(16).max(512).parse(b.passphrase);
      return this.s.tx(() => {
        const owner = this.s.get("owner", "matt");
        if (action === "owner_setup") {
          assert(!owner, "Owner already configured", 409);
          assert(p === b.confirm, "Passphrases do not match");
          this.s.put("owner", { id: "matt", ...passwordRecord(p) });
        } else
          assert(owner && checkPassword(p, owner), "Incorrect passphrase", 401);
        this.s.event("matt", action, "owner");
        return this.session();
      });
    }
    if (action === "redeem_pairing_code")
      return this.s.tx(() => {
        const code = this.s.get(
          "pairing",
          hash(z.string().max(200).parse(b.code)),
        );
        assert(
          code && code.expires > stamp() && !code.used,
          "Pairing code expired or already used",
          401,
        );
        const a = this.require("agent", code.agentId);
        const token = secret();
        a.credentialHash = hash(token);
        a.runtimeId = z.string().min(1).max(100).parse(b.runtime_id);
        a.transport = "https";
        a.sequence = -1;
        this.s.put("agent", a);
        this.s.put("pairing", { ...code, used: true });
        this.s.event(a.id, "agent.paired", a.id);
        return { agent_id: a.id, credential: token };
      });
    throw new Fault("Unknown action", 404);
  }
  snapshot() {
    const work = this.s.list("work");
    const runs = this.s.list("run");
    const agents = this.s.list("agent").map(({ credentialHash, ...a }) => ({
      ...a,
      connection: !a.lastSeen
        ? "Never connected"
        : stamp() - Date.parse(a.lastSeen) > 600000
          ? "Disconnected"
          : stamp() - Date.parse(a.lastSeen) > 180000
            ? "Stale"
            : "Connected",
      effectiveDesign:
        a.ownerDesign ||
        a.agentDesign ||
        OFFICE_THEME_DESIGNS[a.theme] ||
        OFFICE_THEME_DESIGNS.neutral,
      operationalState:
        !a.lastSeen || stamp() - Date.parse(a.lastSeen) > 600000
          ? "disconnected"
          : a.status === "waiting_on_matt"
            ? "waiting"
            : runs.some((r) => r.agentId === a.id && r.status === "running")
              ? "active"
              : work.some(
                    (w) =>
                      w.raci.responsible.includes(a.id) &&
                      w.status === "blocked",
                  )
                ? "blocked"
                : a.status,
      designSource: a.ownerDesign
        ? "Owner override"
        : a.agentDesign
          ? "Agent design"
          : "Theme default",
    }));
    const budgetEntries = this.s.list("budget_entry", 100000);
    return {
      agents,
      config: this.require("config", "bis"),
      hq: this.s.get("hq", "main") || { id: "main", revision: 0, position: [0, 0, 0], model: "campus", zones: {} },
      buildings: this.s.list("building"),
      cityAssets: this.s.list("city_asset"),
      work: this.s.list("work"),
      runs: this.s.list("run"),
      commands: this.s.list("command"),
      approvals: this.s.list("approval"),
      handoffs: this.s.list("handoff"),
      artifacts: this.s.list("artifact"),
      messages: this.s.list("message"),
      goals: this.s.list("goal"),
      queue: this.s.list("queue"),
      routines: this.s.list("routine"),
      references: this.s.list("reference"),
      officePresets: this.s.list("office_preset"),
      savedViews: this.s.list("saved_view"),
      budgets: this.s
        .list("budget")
        .map((b) => ({ ...b, used: this.budgetUsed(b, budgetEntries) })),
      budgetEntries,
      events: this.s.events(),
      sync: this.s.get("sync", "latest"),
      catalog: OFFICE_ASSETS,
      themes: OFFICE_THEME_DESIGNS,
    };
  }
  budgetUsed(budget, entries = this.s.list("budget_entry", 100000)) {
    const month = denverMonth(now());
    return entries
      .filter(
        (entry) =>
          entry.budgetId === budget.id &&
          (budget.period === "total" || denverMonth(entry.at) === month),
      )
      .reduce((sum, entry) => sum + entry.amount, 0);
  }
  enqueue(agentId, verb, workId, payload = {}, dedupe = id()) {
    const previous = this.s.commandByKey(dedupe);
    if (previous) return JSON.parse(previous);
    const c = {
      id: id(),
      agentId,
      verb,
      workId,
      payload,
      idempotencyKey: dedupe,
      status: "queued",
      issuedAt: now(),
      expiresAt: new Date(stamp() + 3600000).toISOString(),
    };
    this.s.put("command", c);
    this.s.event("matt", "command.queued", c.id, { agentId, verb, workId });
    return c;
  }
  validateRaci(value) {
    const r = raci.parse(value);
    for (const a of [...r.responsible, ...r.consulted, ...r.informed])
      this.require("agent", a);
    assert(
      new Set(r.responsible).size === r.responsible.length,
      "Duplicate responsible agent",
    );
    return r;
  }
  policyReview(w) {
    if (!["send", "publish", "merge", "spend"].includes(w.action)) return;
    for (const a of this.s
      .list("approval")
      .filter(
        (a) =>
          a.workId === w.id && a.kind === "POLICY" && a.status === "waiting",
      ))
      this.s.put("approval", {
        ...a,
        status: "superseded",
        resolution: "Mission context or responsibility changed",
        resolvedAt: now(),
      });
    this.s.put("approval", {
      id: id(),
      workId: w.id,
      workRevision: w.policyRevision,
      kind: "POLICY",
      title: "Allow " + w.action + ": " + w.title,
      context: w.brief,
      effect: "Dispatch " + w.action + " in BIS scope",
      status: "waiting",
      createdAt: now(),
    });
  }
  dispatch(w, agentId, idem) {
    const prior = this.s.commandByKey(idem);
    const existing = prior ? JSON.parse(prior) : null;
    if (existing) {
      assert(
        existing.workId === w.id,
        "Idempotency key belongs to another task",
        409,
      );
      return existing;
    }
    assert(
      !this.require("config", "bis").stopped,
      "Dispatch queue is stopped",
      409,
    );
    assert(!w.paused, "Mission is paused", 409);
    assert(
      !w.transferPending,
      "Handoff is awaiting destination acknowledgment",
      409,
    );
    assert(
      !this.s
        .active("command")
        .some((c) => c.workId === w.id && c.verb === "work.start"),
      "Work already has a pending command",
      409,
    );
    const a = this.require("agent", agentId);
    assert(!a.paused, "Agent is paused", 409);
    assert(
      a.credentialHash || a.transport === "google_drive",
      "Connect the agent before dispatch",
      409,
    );
    assert(w.raci.responsible.includes(a.id), "Agent is not Responsible");
    assert(w.scope === "bis", "Cross-boundary dispatch denied", 403);
    assert(
      a.capabilities.includes(w.capability),
      "Agent has not advertised the required capability",
      409,
    );
    assert(
      (a.allowedCapabilities || ["work.execute"]).includes(w.capability),
      "Owner policy denies this capability",
      403,
    );
    for (const budget of this.s.list("budget")) {
      const applies =
        budget.scope === "organization" ||
        (budget.scope === "agent" && budget.scopeId === a.id) ||
        (budget.scope === "mission" && budget.scopeId === w.id);
      if (applies)
        assert(
          this.budgetUsed(budget) < budget.hardLimit,
          `Budget hard limit reached: ${budget.name}`,
          409,
        );
    }
    assert(
      ["planned", "ready", "blocked"].includes(w.status),
      "Work is already dispatched or terminal",
      409,
    );
    assert(
      !this.s
        .active("run")
        .some((r) => r.workId === w.id && !terminal.includes(r.status)),
      "Work already has an execution lease",
      409,
    );
    if (["send", "publish", "merge", "spend"].includes(w.action))
      assert(
        this.s
          .list("approval")
          .some(
            (a) =>
              a.workId === w.id &&
              a.kind === "POLICY" &&
              a.status === "approved" &&
              a.workRevision === w.policyRevision,
          ),
        "Owner approval is required for this action",
        403,
      );
    w.status = "ready";
    w.revision++;
    this.s.put("work", w);
    return this.enqueue(
      a.id,
      "work.start",
      w.id,
      {
        brief: w.brief,
        capability: w.capability,
        scope: w.scope,
        action: w.action,
      },
      idem,
    );
  }
  ownerAction(action, b, token) {
    this.owner(token);
    if (action === "get_dashboard" || action === "get_hq_snapshot")
      return this.snapshot();
    if (action === "get_events")
      return this.s.events(
        String(b.search || "").slice(0, 100),
        Math.max(0, Math.min(100000, Number(b.offset) || 0)),
      );
    if (action === "get_office_catalog")
      return { assets: OFFICE_ASSETS, themes: OFFICE_THEME_DESIGNS };
    return this.s.tx(() => {
      let r;
      switch (action) {
        case "owner_logout":
          this.s.remove("session", hash(token));
          return { ok: true };
        case "create_work_item": {
          const value = workSchema.parse(b);
          this.require("goal", value.goalId);
          if (value.parentId) this.require("work", value.parentId);
          value.raci = this.validateRaci(value.raci);
          r = {
            ...value,
            id: id(),
            status: "planned",
            revision: 0,
            policyRevision: 0,
            createdAt: now(),
            paused: false,
          };
          this.s.put("work", r);
          if (["send", "publish", "merge", "spend"].includes(r.action))
            this.s.put("approval", {
              id: id(),
              workId: r.id,
              workRevision: 0,
              kind: "POLICY",
              title: `Allow ${r.action}: ${r.title}`,
              context: r.brief,
              effect: `Dispatch ${r.action} in BIS scope`,
              status: "waiting",
              createdAt: now(),
            });
          break;
        }
        case "set_work_raci": {
          r = this.require("work", b.id);
          this.version(r, b.revision);
          assert(
            ["planned", "ready", "blocked"].includes(r.status),
            "Pause or finish active execution before reassignment",
            409,
          );
          r.raci = this.validateRaci(b.raci);
          r.revision++;
          r.policyRevision++;
          this.policyReview(r);
          r.status = "planned";
          for (const c of this.s
            .list("command")
            .filter((c) => c.workId === r.id && c.status === "queued"))
            this.s.put("command", { ...c, status: "canceled" });
          this.s.put("work", r);
          break;
        }
        case "dispatch_work_item": {
          const w = this.require("work", b.id);
          const idem = z.string().min(8).max(200).parse(b.idempotency_key);
          const old = this.s.commandByKey(idem);
          if (old) {
            const prior = JSON.parse(old);
            assert(
              prior.workId === w.id,
              "Idempotency key belongs to another task",
              409,
            );
            return prior;
          }
          this.version(w, b.revision);
          r = this.dispatch(w, b.agentId, idem);
          break;
        }
        case "update_work_item_status": {
          r = this.require("work", b.id);
          this.version(r, b.revision);
          assert(
            ["pause", "resume", "cancel", "retry"].includes(b.operation),
            "Invalid operation",
          );
          if (b.operation === "retry") {
            assert(
              !this.s.active("run").some((x) => x.workId === r.id),
              "Stop the active run before retrying",
              409,
            );
            assert(
              ["blocked"].includes(r.status),
              "Only failed or expired work can retry",
            );
            r.status = "planned";
            r.paused = false;
          } else if (b.operation === "resume") {
            r.paused = false;
            for (const a of r.raci.responsible)
              this.enqueue(a, "work.resume", r.id);
          } else {
            r.paused = true;
            const active = this.s
              .list("command")
              .filter((c) => c.workId === r.id && !terminal.includes(c.status));
            for (const c of active) {
              if (c.status === "queued") {
                c.status = "canceled";
                this.s.put("command", c);
              } else
                this.enqueue(c.agentId, `work.${b.operation}`, r.id, {
                  runId: c.runId,
                });
            }
            if (b.operation === "cancel") {
              if (
                this.s
                  .active("run")
                  .some(
                    (x) => x.workId === r.id && !terminal.includes(x.status),
                  )
              )
                r.stopRequested = "cancel";
              else r.status = "canceled";
            }
          }
          r.revision++;
          this.s.put("work", r);
          break;
        }
        case "create_pairing_code": {
          r = this.require("agent", b.agentId);
          if (r.id !== "jeff")
            assert(
              this.require("agent", "jeff").lastSeen,
              "Connect Jeff first",
            );
          delete r.credentialHash;
          this.s.put("agent", r);
          for (const p of this.s.list("pairing"))
            if (p.agentId === r.id) this.s.remove("pairing", p.id);
          const code = secret();
          this.s.put("pairing", {
            id: hash(code),
            agentId: r.id,
            expires: stamp() + 600000,
            used: false,
          });
          this.s.event("matt", "pairing.created", r.id);
          return { code, expiresAt: new Date(stamp() + 600000).toISOString() };
        }
        case "disconnect_agent": {
          r = this.require("agent", b.agentId);
          delete r.credentialHash;
          r.lastSeen = null;
          r.transport = null;
          for (const p of this.s.list("pairing"))
            if (p.agentId === r.id) this.s.remove("pairing", p.id);
          this.s.put("agent", r);
          break;
        }
        case "pause_agent": {
          r = this.require("agent", b.agentId);
          r.paused = !!b.paused;
          this.s.put("agent", r);
          if (r.paused) this.enqueue(r.id, "agent.pause", null);
          break;
        }
        case "global_stop": {
          r = this.require("config", "bis");
          r.stopped = !!b.stopped;
          r.revision++;
          this.s.put("config", r);
          if (r.stopped)
            for (const a of this.s.list("agent").filter((a) => a.lastSeen))
              this.enqueue(a.id, "agent.pause", null);
          break;
        }
        case "send_agent_message": {
          this.require("agent", b.agentId);
          if (b.workId) this.require("work", b.workId);
          r = {
            id: id(),
            agentId: b.agentId,
            workId: b.workId || null,
            body: z.string().trim().min(1).max(4000).parse(b.body),
            scope: "private",
            status: "queued",
            author: "matt",
            createdAt: now(),
          };
          this.s.put("message", r);
          this.enqueue(b.agentId, "message.deliver", b.workId || null, {
            messageId: r.id,
            body: r.body,
          });
          break;
        }
        case "promote_thread": {
          r = this.require("message", b.id);
          assert(b.workId, "Choose a mission");
          this.require("work", b.workId);
          r.scope = "team";
          r.workId = b.workId;
          this.s.put("message", r);
          break;
        }
        case "preview_office_design":
          return { design: design(b.design), persisted: false };
        case "save_office_preset": {
          const name = z.string().trim().min(1).max(80).parse(b.name);
          const presetDesign = design(b.design);
          r = b.id ? this.require("office_preset", b.id) : { id: id() };
          r.name = name;
          r.design = presetDesign;
          r.updatedAt = now();
          this.s.put("office_preset", r);
          break;
        }
        case "delete_office_preset": {
          r = this.require("office_preset", b.id);
          this.s.remove("office_preset", r.id);
          break;
        }
        case "save_operational_view": {
          r = {
            id: id(),
            name: z.string().trim().min(1).max(60).parse(b.name),
            filter: z
              .enum([
                "needs_owner",
                "failed",
                "blocked",
                "disconnected",
                "stale",
                "active",
              ])
              .parse(b.filter),
            createdAt: now(),
          };
          this.s.put("saved_view", r);
          break;
        }
        case "delete_operational_view": {
          r = this.require("saved_view", b.id);
          this.s.remove("saved_view", r.id);
          break;
        }
        case "save_budget": {
          const scope = z
            .enum(["organization", "agent", "mission", "routine"])
            .parse(b.scope);
          const scopeId =
            scope === "organization"
              ? "bis"
              : z.string().min(1).max(100).parse(b.scopeId);
          if (scope !== "organization")
            this.require(
              { agent: "agent", mission: "work", routine: "routine" }[scope],
              scopeId,
            );
          const softLimit = z
            .number()
            .nonnegative()
            .finite()
            .parse(Number(b.softLimit));
          const hardLimit = z
            .number()
            .positive()
            .finite()
            .parse(Number(b.hardLimit));
          assert(
            softLimit <= hardLimit,
            "Soft limit must not exceed hard limit",
          );
          r = {
            id: id(),
            name: z.string().trim().min(1).max(80).parse(b.name),
            scope,
            scopeId,
            unit: z
              .enum(["USD", "tokens", "minutes", "API calls"])
              .parse(b.unit),
            period: z.enum(["monthly", "total"]).parse(b.period),
            softLimit,
            hardLimit,
            createdAt: now(),
          };
          this.s.put("budget", r);
          break;
        }
        case "record_budget_usage": {
          const budget = this.require("budget", b.budgetId);
          const key = z.string().min(8).max(100).parse(b.idempotency_key);
          const previous = this.s
            .list("budget_entry", 100000)
            .find((entry) => entry.idempotencyKey === key);
          if (previous) {
            assert(
              previous.budgetId === budget.id,
              "Usage key belongs to another budget",
              409,
            );
            return { ok: true, id: previous.id, duplicate: true };
          }
          r = {
            id: id(),
            budgetId: budget.id,
            idempotencyKey: key,
            amount: z.number().positive().finite().parse(Number(b.amount)),
            note: z.string().trim().min(1).max(400).parse(b.note),
            at: now(),
          };
          this.s.put("budget_entry", r);
          break;
        }
        case "delete_budget": {
          r = this.require("budget", b.id);
          assert(
            !this.s
              .list("budget_entry", 100000)
              .some((entry) => entry.budgetId === r.id),
            "Budget with recorded usage cannot be deleted",
          );
          this.s.remove("budget", r.id);
          break;
        }
        case "apply_office_preset": {
          const preset = this.require("office_preset", b.presetId);
          r = this.require("agent", b.agentId);
          this.version(r, b.revision);
          r.ownerDesign = structuredClone(preset.design);
          r.revision++;
          r.designUpdatedAt = now();
          this.s.put("agent", r);
          break;
        }
        case "save_office_design":
        case "clear_office_override":
        case "reset_office_default": {
          r = this.require("agent", b.agentId);
          this.version(r, b.revision);
          if (action === "save_office_design") r.ownerDesign = design(b.design);
          else {
            delete r.ownerDesign;
            if (action === "reset_office_default") {
              assert(b.confirm === true, "Confirm discarding both designs");
              delete r.agentDesign;
            }
          }
          r.revision++;
          r.designUpdatedAt = now();
          this.s.put("agent", r);
          break;
        }
        case "save_office_positions": {
          r = this.require("agent", b.agentId);
          this.version(r, b.revision);
          const slots = [
            "primary_desk",
            "task_chair",
            "desk_screen",
            "desk_accessory",
            "plant_corner",
            "library",
            "lounge_seating",
            "coffee_table",
            "floor_rug",
            "floor_lamp",
            "feature_prop",
            "wall_display",
          ];
          const positions = z
            .partialRecord(
              z.enum(slots),
              z.tuple([
                z.number().finite().min(-3).max(3),
                z.number().finite().min(-1.5).max(1.5),
                z.number().finite().min(-3).max(3),
              ]),
            )
            .parse(b.positions);
          r.officePositions = positions;
          r.revision++;
          r.designUpdatedAt = now();
          this.s.put("agent", r);
          break;
        }
        case "set_agent_avatar": {
          r = this.require("agent", b.agentId);
          const v = z
            .string()
            .max(2800000)
            .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
            .parse(b.image);
          const bytes = Buffer.from(v.split(",")[1], "base64");
          assert(
            bytes.length <= 2000000 &&
              ((bytes[0] === 137 &&
                bytes[1] === 80 &&
                bytes[2] === 78 &&
                bytes[3] === 71) ||
                (bytes[0] === 255 && bytes[1] === 216)),
            "Invalid image",
          );
          this.s.put("portrait", { id: r.id, image: v });
          r.avatarUpdatedAt = now();
          r.avatar = `/api/portrait/${r.id}`;
          this.s.put("agent", r);
          break;
        }
        case "resolve_approval": {
          r = this.require("approval", b.id);
          assert(r.status === "waiting", "Already resolved", 409);
          assert(
            ["approved", "rejected"].includes(b.decision),
            "Invalid decision",
          );
          if (r.kind === "RESULT") {
            const w = this.require("work", r.workId);
            assert(
              w.lastRunId === r.runId &&
                w.status === "waiting_approval" &&
                !this.s.active("run").some((x) => x.workId === w.id),
              "This result is no longer the current reviewable run",
              409,
            );
          }
          r.status = b.decision;
          r.resolution = z.string().trim().min(1).max(2000).parse(b.note);
          r.resolvedAt = now();
          this.s.put("approval", r);
          if (r.workId) {
            const w = this.require("work", r.workId);
            if (r.kind !== "POLICY") {
              w.status =
                r.status === "approved"
                  ? r.kind === "RESULT"
                    ? "done"
                    : this.s
                          .active("run")
                          .some(
                            (x) => x.workId === w.id && x.status === "running",
                          )
                      ? "in_progress"
                      : "planned"
                  : "blocked";
              w.revision++;
              this.s.put("work", w);
            }
          }
          break;
        }
        case "accept_handoff": {
          r = this.require("handoff", b.id);
          assert(r.status === "requested", "Already decided", 409);
          if (!b.accept) r.status = "rejected";
          else {
            const w = this.require("work", r.workId);
            assert(
              !this.require("config", "bis").stopped,
              "Dispatch queue is stopped",
              409,
            );
            assert(
              !this.s.active("run").some((x) => x.workId === w.id) &&
                !this.s
                  .active("command")
                  .some((x) => x.workId === w.id && x.verb === "work.start"),
              "Finish queued or running work before accepting handoff",
              409,
            );
            assert(!w.transferPending, "Another handoff is pending", 409);
            w.transferPending = r.id;
            w.revision++;
            this.s.put("work", w);
            const target = this.require("agent", r.to);
            assert(
              !target.paused && target.capabilities.includes(w.capability),
              "Destination unavailable or lacks capability",
              409,
            );
            r.status = "queued";
            this.enqueue(
              r.to,
              "handoff.accept",
              w.id,
              { handoffId: r.id, context: r.context },
              `handoff:${r.id}`,
            );
          }
          this.s.put("handoff", r);
          break;
        }
        case "add_queue_item":
          r = {
            id: id(),
            category: "manual",
            text: z.string().trim().min(1).max(240).parse(b.text),
            createdAt: now(),
          };
          this.s.put("queue", r);
          break;
        case "remove_queue_item":
          r = this.require("queue", b.id);
          assert(r.category === "manual", "Only manual rows can be removed");
          this.s.remove("queue", r.id);
          break;
        case "update_goal_progress": {
          r = this.require("goal", b.id);
          r.current = z.number().nonnegative().parse(b.current);
          r.status = z.string().min(1).max(200).parse(b.evidence);
          r.updatedAt = now();
          this.s.put("goal", r);
          break;
        }
        case "register_building": {
          const v = z
            .object({
              name: z.string().min(1).max(80),
              kind: z.enum(["project_site", "agent_hq"]),
              agentId: z
                .string()
                .regex(/^[a-z][a-z0-9_-]{1,39}$/)
                .optional(),
              style: z.enum([
                "command",
                "exchange",
                "tower",
                "lab",
                "studio",
                "workshop",
              ]),
              model: z
                .enum([
                  "campus",
                  "hangar_a",
                  "hangar_b",
                  "glass_atrium",
                  "detailed_hub",
                  "skyscraper",
                  "office_building",
                  "big_box",
                  "warehouse",
                ])
                .default("campus"),
              goalId: z.string().optional(),
              plotId: z.string().optional(),
            })
            .strict()
            .parse(b);
          if (v.goalId) this.require("goal", v.goalId);
          if (v.plotId)
            assert(
              v.kind === "project_site",
              "Reserved plots accept projects only",
            );
          if (v.kind === "project_site") delete v.agentId;
          const available =
            v.kind === "project_site"
              ? v.plotId
                ? this.require("building", v.plotId)
                : this.s
                    .list("building")
                    .find((site) => site.kind === "reserved_plot")
              : null;
          if (available)
            assert(
              available.kind === "reserved_plot",
              "That campus plot is already in use",
              409,
            );
          const occupied = this.s
            .list("building")
            .filter((site) => site.id !== available?.id);
          const campusPlots = [
            [12, 0],
            [-12, 0],
            [0, 10],
            [0, -10],
            [-12, 12],
            [12, 12],
          ];
          const plot = campusPlots.find(
            ([x, z]) =>
              !occupied.some(
                (site) =>
                  Math.abs(site.x - x) < 6.5 && Math.abs(site.z - z) < 4.5,
              ),
          ) || [
            ((occupied.length % 3) - 1) * 9,
            18 + Math.floor(occupied.length / 3) * 8,
          ];
          r = {
            ...v,
            id: available?.id || id(),
            x: available?.x ?? plot[0],
            z: available?.z ?? plot[1],
            accent: "#2768df",
            revision: (available?.revision || 0) + (available ? 1 : 0),
            ...(available?.projectHistory
              ? { projectHistory: available.projectHistory }
              : {}),
            ...(v.kind === "project_site"
              ? { lifecycle: "planning", milestones: [] }
              : {}),
          };
          delete r.plotId;
          if (v.kind === "agent_hq") {
            assert(
              v.agentId && !this.s.get("agent", v.agentId),
              "Use a new agent ID",
            );
            this.s.put("agent", {
              id: v.agentId,
              name: v.name,
              role: "Unconfigured",
              theme: "neutral",
              status: "idle",
              lastSeen: null,
              paused: false,
              revision: 0,
              sequence: -1,
              capabilities: [],
            });
          }
          this.s.put("building", r);
          break;
        }
        case "update_building": {
          r = this.require("building", b.id);
          this.version({ revision: r.revision || 0 }, b.revision);
          assert(
            r.kind !== "reserved_plot",
            "Claim this plot with a new project first",
          );
          r.name = z.string().trim().min(1).max(80).parse(b.name);
          r.style = z
            .enum(["command", "exchange", "tower", "lab", "studio", "workshop"])
            .parse(b.style);
          r.model = z
            .enum([
              "campus",
              "hangar_a",
              "hangar_b",
              "glass_atrium",
              "detailed_hub",
              "skyscraper",
              "office_building",
              "big_box",
              "warehouse",
            ])
            .default("campus")
            .parse(b.model);
          const goalId = z.string().max(100).optional().parse(b.goalId);
          if (goalId) this.require("goal", goalId);
          r.goalId = goalId || undefined;
          r.revision = (r.revision || 0) + 1;
          this.s.put("building", r);
          break;
        }
        case "save_city_building": {
          r = this.require("building", b.id);
          this.version({ revision: r.revision || 0 }, b.revision);
          const position = z
            .tuple([
              z.number().finite().min(-40).max(40),
              z.number().finite().min(0).max(2),
              z.number().finite().min(-40).max(40),
            ])
            .parse(b.position);
          const model = z
            .enum([
              "campus",
              "hangar_a",
              "hangar_b",
              "glass_atrium",
              "detailed_hub",
              "skyscraper",
              "office_building",
              "big_box",
              "warehouse",
            ])
            .parse(b.model);
          assert(
            !this.s
              .list("building")
              .some(
                (other) =>
                  other.id !== r.id &&
                  Math.abs(other.x - position[0]) < 6 &&
                  Math.abs(other.z - position[2]) < 5,
              ),
            "Building plots must remain clear of each other",
          );
          assert(
            Math.abs(position[0] - (this.s.get("hq", "main")?.position?.[0] || 0)) > 4 ||
              Math.abs(position[2] - (this.s.get("hq", "main")?.position?.[2] || 0)) > 4,
            "Keep the HQ plaza clear",
          );
          r.x = position[0];
          r.y = position[1];
          r.z = position[2];
          r.model = model;
          r.revision = (r.revision || 0) + 1;
          this.s.put("building", r);
          break;
        }
        case "save_hq": {
          r = this.s.get("hq", "main") || { id: "main", revision: 0, position: [0, 0, 0], model: "campus", zones: {} };
          this.version(r, b.revision);
          if (b.position) {
            const position = z.tuple([
              z.number().finite().min(-30).max(30),
              z.number().finite().min(0).max(2),
              z.number().finite().min(-30).max(30),
            ]).parse(b.position);
            assert(!this.s.list("building").some((other) =>
              Math.abs(other.x - position[0]) < 6 && Math.abs(other.z - position[2]) < 5
            ), "Keep the HQ clear of other buildings");
            r.position = position;
          }
          if (b.model) r.model = z.enum([
            "campus", "hangar_a", "hangar_b", "glass_atrium", "detailed_hub",
            "skyscraper", "office_building", "big_box", "warehouse",
          ]).parse(b.model);
          if (b.zones) {
            const zones = z.record(z.string(), z.tuple([
              z.number().finite().min(-1).max(1),
              z.number().finite().min(-0.5).max(1),
              z.number().finite().min(-0.7).max(0.7),
            ])).parse(b.zones);
            assert(Object.keys(zones).every((zone) => ["missions", "dispatch", "ops", "handoffs", "team", "review"].includes(zone)), "Unknown HQ zone");
            r.zones = zones;
          }
          r.revision++;
          this.s.put("hq", r);
          break;
        }
        case "add_city_asset": {
          assert(
            this.s.list("city_asset").length < 80,
            "Campus asset limit reached",
          );
          const asset = z
            .enum([
              "planter",
              "small_tree",
              "satellite_dish",
              "rock_cluster",
              "landing_pad",
            ])
            .parse(b.asset);
          const position = z
            .tuple([
              z.number().finite().min(-40).max(40),
              z.number().finite().min(0).max(5),
              z.number().finite().min(-40).max(40),
            ])
            .parse(b.position);
          r = { id: id(), asset, position, revision: 0 };
          this.s.put("city_asset", r);
          break;
        }
        case "save_city_asset": {
          r = this.require("city_asset", b.id);
          this.version(r, b.revision);
          r.asset = z
            .enum([
              "planter",
              "small_tree",
              "satellite_dish",
              "rock_cluster",
              "landing_pad",
            ])
            .parse(b.asset);
          r.position = z
            .tuple([
              z.number().finite().min(-40).max(40),
              z.number().finite().min(0).max(5),
              z.number().finite().min(-40).max(40),
            ])
            .parse(b.position);
          r.revision++;
          this.s.put("city_asset", r);
          break;
        }
        case "remove_city_asset": {
          r = this.require("city_asset", b.id);
          this.version(r, b.revision);
          this.s.remove("city_asset", r.id);
          break;
        }
        case "set_project_lifecycle": {
          r = this.require("building", b.id);
          assert(
            r.kind === "project_site",
            "Only project sites have a lifecycle",
          );
          this.version({ revision: r.revision || 0 }, b.revision);
          const next = z
            .enum(["planning", "building", "running", "complete"])
            .parse(b.lifecycle);
          const current = r.lifecycle || "planning";
          const transitions = {
            planning: ["building"],
            building: ["planning", "running"],
            running: ["building", "complete"],
            complete: ["running"],
          };
          assert(
            transitions[current]?.includes(next),
            `Cannot move project from ${current} to ${next}`,
          );
          const note = z.string().trim().min(1).max(500).parse(b.note);
          r.lifecycle = next;
          r.lifecycleHistory = [
            ...(r.lifecycleHistory || []),
            { from: current, to: next, note, at: now() },
          ].slice(-30);
          r.revision = (r.revision || 0) + 1;
          this.s.put("building", r);
          break;
        }
        case "retire_project": {
          r = this.require("building", b.id);
          assert(
            r.kind === "project_site",
            "Only project sites can be retired",
          );
          this.version({ revision: r.revision || 0 }, b.revision);
          assert(b.confirm === true, "Confirm retiring this project");
          r.projectHistory = [
            ...(r.projectHistory || []),
            {
              name: r.name,
              goalId: r.goalId,
              style: r.style,
              milestones: r.milestones || [],
              lifecycleHistory: r.lifecycleHistory || [],
              retiredAt: now(),
            },
          ].slice(-10);
          r.kind = "reserved_plot";
          r.name = "Ready for next project";
          r.lifecycle = "ready";
          delete r.goalId;
          delete r.milestones;
          delete r.lifecycleHistory;
          r.revision = (r.revision || 0) + 1;
          this.s.put("building", r);
          break;
        }
        case "add_milestone": {
          r = this.require("building", b.id);
          assert(
            r.kind === "project_site",
            "Milestones belong to project sites",
          );
          this.version({ revision: r.revision || 0 }, b.revision);
          const title = z.string().min(1).max(160).parse(b.title);
          r.milestones = [
            ...(r.milestones || []),
            { id: id(), title, status: "open", createdAt: now() },
          ];
          assert(r.milestones.length <= 24, "Maximum 24 named milestones");
          r.revision = (r.revision || 0) + 1;
          this.s.put("building", r);
          break;
        }
        case "close_milestone": {
          r = this.require("building", b.id);
          this.version({ revision: r.revision || 0 }, b.revision);
          const milestone = r.milestones?.find((m) => m.id === b.milestoneId);
          assert(
            milestone && milestone.status === "open",
            "Milestone is not open",
            409,
          );
          milestone.evidence = safeUrl.parse(b.evidence);
          milestone.note = z.string().min(1).max(1000).parse(b.note);
          milestone.status = "closed";
          milestone.closedAt = now();
          r.revision = (r.revision || 0) + 1;
          this.s.put("building", r);
          break;
        }
        case "link_cognition_record": {
          this.require("work", b.workId);
          assert(b.scope === "bis", "Only BIS references are permitted", 403);
          r = {
            id: id(),
            workId: b.workId,
            uri: safeUrl.parse(b.uri),
            authority: z.string().min(1).max(100).parse(b.authority),
            recordType: z.string().min(1).max(100).parse(b.recordType),
            revision: String(b.revision || ""),
            scope: "bis",
            createdAt: now(),
          };
          this.s.put("reference", r);
          break;
        }
        case "pause_routine": {
          r = this.require("routine", b.id);
          r.enabled = !b.paused;
          this.s.put("routine", r);
          break;
        }
        case "edit_work_item": {
          r = this.require("work", b.id);
          this.version(r, b.revision);
          assert(
            !this.s
              .active("run")
              .some((x) => x.workId === r.id && !terminal.includes(x.status)),
            "Finish or stop the active run before redirecting",
            409,
          );
          assert(
            !["done", "canceled"].includes(r.status),
            "Terminal work cannot be redirected",
            409,
          );
          r.title = z.string().min(1).max(160).parse(b.title);
          r.brief = z.string().min(1).max(2000).parse(b.brief);
          r.priority = z
            .enum(["low", "normal", "high", "urgent"])
            .parse(b.priority);
          r.revision++;
          r.policyRevision++;
          this.policyReview(r);
          r.status = "planned";
          for (const c of this.s
            .list("command")
            .filter((c) => c.workId === r.id && c.status === "queued"))
            this.s.put("command", { ...c, status: "canceled" });
          this.s.put("work", r);
          break;
        }
        case "set_agent_policy": {
          r = this.require("agent", b.agentId);
          this.version(r, b.revision);
          r.allowedCapabilities = z
            .array(z.string().min(1).max(100))
            .max(40)
            .parse(b.capabilities);
          r.revision++;
          this.s.put("agent", r);
          break;
        }
        case "save_routine": {
          this.require("goal", b.goalId);
          this.require("agent", b.agentId);
          r = {
            id: b.id || id(),
            title: z.string().min(1).max(160).parse(b.title),
            brief: z.string().min(1).max(2000).parse(b.brief),
            goalId: b.goalId,
            agentId: b.agentId,
            time: z
              .string()
              .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
              .parse(b.time),
            timezone: "America/Denver",
            enabled: !!b.enabled,
            owner: "matt",
            lastResult: null,
          };
          this.s.put("routine", r);
          break;
        }
        default:
          throw new Fault("Unknown owner action", 404);
      }
      this.s.event("matt", action, r?.id || "bis", { revision: r?.revision });
      return { ok: true, id: r?.id };
    });
  }
  claim(a, c) {
    assert(c.agentId === a.id, "Command belongs to another agent", 403);
    assert(Date.parse(c.expiresAt) > stamp(), "Command expired", 409);
    assert(!terminal.includes(c.status), "Command is terminal", 409);
    if (c.runId) {
      const r = this.require("run", c.runId);
      assert(
        r.runtimeId === a.runtimeId,
        "Runtime does not own this lease",
        409,
      );
      assert(
        Date.parse(r.leaseUntil) > stamp(),
        "Lease expired; recovery required",
        409,
      );
      return r;
    }
    if (c.verb === "handoff.accept") {
      assert(
        !a.paused && !this.require("config", "bis").stopped,
        "Dispatch is paused",
        409,
      );
    }
    if (c.verb === "work.start") {
      const w = this.require("work", c.workId);
      assert(
        w.status === "ready",
        "Work is no longer ready for this command",
        409,
      );
      assert(
        !w.paused && !a.paused && !this.require("config", "bis").stopped,
        "Dispatch is paused",
        409,
      );
      assert(
        !this.s
          .active("run")
          .some((r) => r.workId === w.id && !terminal.includes(r.status)),
        "Another run owns this work",
        409,
      );
      const r = {
        id: id(),
        workId: w.id,
        commandId: c.id,
        agentId: a.id,
        runtimeId: a.runtimeId,
        status: "accepted",
        leaseUntil: new Date(stamp() + 120000).toISOString(),
        createdAt: now(),
      };
      this.s.put("run", r);
      c.runId = r.id;
      w.lastRunId = r.id;
      w.status = "claimed";
      w.revision++;
      this.s.put("work", w);
      this.s.put("command", c);
      return r;
    }
    return null;
  }
  ack(a, b) {
    const c = this.require("command", b.command_id);
    assert(c.agentId === a.id, "Command belongs to another agent", 403);
    assert(
      ["accepted", "running", "completed", "failed"].includes(b.status),
      "Invalid acknowledgment",
    );
    if (c.status === b.status) return c;
    assert(!terminal.includes(c.status), "Command already terminal", 409);
    const order = {
      queued: 0,
      accepted: 1,
      running: 2,
      completed: 3,
      failed: 3,
    };
    assert(
      order[b.status] > order[c.status],
      "Acknowledgment cannot go backwards",
      409,
    );
    assert(
      b.status === "failed" || order[b.status] === order[c.status] + 1,
      "Acknowledge accepted, running and completed separately",
      409,
    );
    const run = this.claim(a, c);
    if (run) {
      assert(!b.run_id || b.run_id === run.id, "Wrong run", 409);
      run.status = b.status;
      run.leaseUntil = new Date(stamp() + 120000).toISOString();
      run.result =
        typeof b.result === "string" ? b.result.slice(0, 2000) : null;
      this.s.put("run", run);
      const w = this.require("work", c.workId);
      w.status = {
        accepted: "claimed",
        running: "in_progress",
        completed: "waiting_approval",
        failed: "blocked",
      }[b.status];
      w.revision++;
      this.s.put("work", w);
      if (
        b.status === "completed" &&
        !this.s
          .list("approval")
          .some(
            (p) =>
              p.workId === w.id &&
              p.kind === "RESULT" &&
              p.status === "waiting",
          )
      )
        this.s.put("approval", {
          id: id(),
          kind: "RESULT",
          workId: w.id,
          runId: run.id,
          title: `Review: ${w.title}`,
          context:
            run.result ||
            "Runtime reported completion. Inspect evidence before approval.",
          effect: "Mark mission done",
          status: "waiting",
          createdAt: now(),
        });
    }
    c.status = b.status;
    c.result = typeof b.result === "string" ? b.result.slice(0, 2000) : null;
    c.updatedAt = now();
    this.s.put("command", c);
    if (c.verb === "message.deliver") {
      const m = this.require("message", c.payload.messageId);
      if (m.status !== "replied")
        m.status =
          b.status === "accepted"
            ? "delivered"
            : b.status === "running"
              ? "acknowledged"
              : b.status === "completed"
                ? "acknowledged"
                : "failed";
      this.s.put("message", m);
    }
    if (c.verb === "handoff.accept" && b.status === "completed") {
      const h = this.require("handoff", c.payload.handoffId);
      h.status = "completed";
      this.s.put("handoff", h);
      const w = this.require("work", h.workId);
      assert(w.transferPending === h.id, "Handoff is no longer current", 409);
      delete w.transferPending;
      w.raci.responsible = [h.to];
      w.status = "planned";
      w.revision++;
      this.s.put("work", w);
    }
    if (c.verb === "handoff.accept" && b.status === "failed") {
      const h = this.require("handoff", c.payload.handoffId);
      h.status = "failed";
      this.s.put("handoff", h);
      const w = this.require("work", h.workId);
      if (w.transferPending === h.id) delete w.transferPending;
      w.revision++;
      this.s.put("work", w);
    }
    if (
      ["work.pause", "work.cancel", "agent.pause"].includes(c.verb) &&
      b.status === "completed"
    ) {
      for (const r of this.s
        .active("run")
        .filter(
          (r) =>
            r.agentId === a.id &&
            (!c.workId || r.workId === c.workId) &&
            !terminal.includes(r.status),
        )) {
        r.status = "canceled";
        this.s.put("run", r);
        const original = this.require("command", r.commandId);
        original.status = "canceled";
        this.s.put("command", original);
        const w = this.require("work", r.workId);
        w.status = c.verb === "work.cancel" ? "canceled" : "blocked";
        w.revision++;
        this.s.put("work", w);
      }
    }
    this.s.event(a.id, `command.${b.status}`, c.id, {
      workId: c.workId,
      runId: c.runId,
    });
    return c;
  }
  agentAction(action, b, token) {
    const agent = this.agent(token);
    return this.s.tx(() => this.agentOperation(action, b, agent));
  }
  agentOperation(action, b, a) {
    if (action === "get_office_catalog")
      return { assets: OFFICE_ASSETS, themes: OFFICE_THEME_DESIGNS };
    if (action === "poll_commands")
      return this.s
        .active("command")
        .filter(
          (c) =>
            c.agentId === a.id &&
            !terminal.includes(c.status) &&
            Date.parse(c.expiresAt) > stamp() &&
            (!this.require("config", "bis").stopped ||
              !["work.start", "handoff.accept"].includes(c.verb)) &&
            (!a.paused || !["work.start", "handoff.accept"].includes(c.verb)),
        )
        .sort((x, y) => x.issuedAt.localeCompare(y.issuedAt))
        .slice(0, 30);
    if (action === "claim_command") {
      const c = this.require("command", b.command_id);
      return this.claim(a, c);
    }
    if (action === "ack_command") return this.ack(a, b);
    if (action === "report_heartbeat") {
      const v = heartbeatSchema.parse(b);
      if (v.protocol_version === 2)
        assert(
          v.runtime_id && Number.isInteger(v.sequence),
          "Protocol v2 requires runtime ID and sequence",
        );
      v.runtime_id = v.runtime_id || a.runtimeId;
      assert(
        v.agent_id === a.id && v.runtime_id === a.runtimeId,
        "Identity mismatch",
        403,
      );
      assert(
        Math.abs(stamp() - Date.parse(v.last_seen)) < 600000,
        "Heartbeat observation outside ten-minute window",
      );
      if (v.sequence === undefined) {
        assert(
          !a.lastLegacyObserved || v.last_seen > a.lastLegacyObserved,
          "Legacy observation was already processed",
          409,
        );
        v.sequence = a.sequence + 1;
        a.lastLegacyObserved = v.last_seen;
      }
      if (v.sequence <= a.sequence)
        return { ok: true, duplicate: true, sequence: a.sequence };
      const proposed = v.office_design
        ? design(v.office_design)
        : v.office_theme
          ? officeDesignFromLegacy(v.office_theme, v.decor_items)
          : null;
      if (v.sequence > a.sequence + 1 && a.sequence >= 0)
        this.s.event(a.id, "heartbeat.sequence_gap", a.id, {
          expected: a.sequence + 1,
          received: v.sequence,
        });
      Object.assign(a, {
        sequence: v.sequence,
        lastSeen: now(),
        observedAt: v.last_seen,
        status: v.status,
        activity: v.current_activity,
        currentTask: v.current_task || null,
        capabilities: v.capabilities,
      });
      if (v.avatar_image) {
        const bytes = Buffer.from(v.avatar_image.data_base64, "base64");
        assert(
          bytes.length <= 2000000 &&
            ((v.avatar_image.mime_type === "image/png" &&
              bytes[0] === 137 &&
              bytes[1] === 80 &&
              bytes[2] === 78 &&
              bytes[3] === 71) ||
              (v.avatar_image.mime_type === "image/jpeg" &&
                bytes[0] === 255 &&
                bytes[1] === 216)),
          "Invalid portrait",
        );
        this.s.put("portrait", {
          id: a.id,
          image:
            "data:" +
            v.avatar_image.mime_type +
            ";base64," +
            v.avatar_image.data_base64,
        });
        a.avatar = "/api/portrait/" + a.id;
        a.avatarUpdatedAt = now();
      }
      if (proposed) {
        a.agentDesign = proposed;
        a.revision++;
        a.designUpdatedAt = now();
      }
      this.s.put("agent", a);
      if (v.current_run_id) {
        const r = this.require("run", v.current_run_id);
        assert(
          r.agentId === a.id && r.runtimeId === a.runtimeId,
          "Run identity mismatch",
          403,
        );
        assert(
          !terminal.includes(r.status) && Date.parse(r.leaseUntil) > stamp(),
          "Run lease expired",
          409,
        );
        r.leaseUntil = new Date(stamp() + 120000).toISOString();
        this.s.put("run", r);
      }
      for (const activity of v.activity) {
        const key =
          a.id +
          ":activity:" +
          (activity.source_key || hash(JSON.stringify(activity)));
        if (!this.s.get("dedupe", key)) {
          this.s.put("dedupe", { id: key });
          this.s.event(a.id, "activity.reported", a.id, {
            summary: activity.summary,
            detail: activity.detail,
            observedAt: activity.time,
          });
        }
      }
      for (const item of v.queue) {
        const key =
          a.id + ":queue:" + (item.source_key || hash(JSON.stringify(item)));
        if (!this.s.get("queue", key))
          this.s.put("queue", {
            id: key,
            category: "recurring",
            agentId: a.id,
            text: item.text,
            detail: item.detail,
            timeLabel: item.time,
            createdAt: now(),
          });
      }
      for (const event of v.events) {
        const eid = `${a.id}:${event.id}`;
        if (!this.s.get("dedupe", eid)) {
          this.s.put("dedupe", { id: eid });
          this.s.event(a.id, `agent.${event.type}`, a.id, {
            summary: event.summary,
          });
        }
      }
      for (const ack of v.command_acks) this.ack(a, ack);
      return { ok: true, sequence: a.sequence };
    }
    if (action === "request_approval") {
      const w = this.require("work", b.workId);
      assert(
        w.raci.responsible.includes(a.id),
        "Only Responsible agent may request review",
        403,
      );
      if (b.runId) {
        const run = this.require("run", b.runId);
        assert(
          run.agentId === a.id && run.workId === w.id,
          "Run ownership mismatch",
          403,
        );
      }
      const approval = {
        id: a.id + ":" + z.string().min(8).max(100).parse(b.idempotency_key),
        workId: w.id,
        runId: b.runId || null,
        kind: z.enum(["MERGE", "DECISION", "ANSWER", "WATCH"]).parse(b.kind),
        title: z.string().min(1).max(160).parse(b.title),
        context: z.string().min(1).max(2000).parse(b.context),
        effect: z.string().min(1).max(1000).parse(b.effect),
        status: "waiting",
        createdAt: now(),
      };
      const old = this.s.get("approval", approval.id);
      if (old) return old;
      this.s.put("approval", approval);
      w.status = "waiting_approval";
      w.revision++;
      this.s.put("work", w);
      this.s.event(a.id, "approval.requested", approval.id, { workId: w.id });
      return approval;
    }
    if (action === "submit_artifact") {
      const r = this.require("run", b.run_id);
      assert(
        r.agentId === a.id && r.runtimeId === a.runtimeId,
        "Run ownership mismatch",
        403,
      );
      assert(
        ["running", "completed"].includes(r.status),
        "Run must have started",
      );
      const key = z.string().min(8).max(100).parse(b.idempotency_key),
        artifactId = `${a.id}:${key}`;
      const old = this.s.get("artifact", artifactId);
      if (old) return old;
      const artifact = {
        id: artifactId,
        workId: r.workId,
        runId: r.id,
        agentId: a.id,
        title: z.string().min(1).max(160).parse(b.title),
        uri: safeUrl.parse(b.uri),
        revision: String(b.revision || "1"),
        createdAt: now(),
      };
      this.s.put("artifact", artifact);
      this.s.event(a.id, "artifact.delivered", artifact.id, {
        workId: r.workId,
        runId: r.id,
      });
      return artifact;
    }
    if (action === "request_handoff") {
      const w = this.require("work", b.workId);
      assert(
        w.raci.responsible.includes(a.id),
        "Only Responsible agent can request handoff",
        403,
      );
      this.require("agent", b.to);
      assert(a.id !== b.to, "Choose a different agent");
      assert(
        !this.s
          .active("run")
          .some((r) => r.workId === w.id && !terminal.includes(r.status)),
        "Finish or stop the current run before handoff",
        409,
      );
      const h = {
        id: `${a.id}:${z.string().min(8).max(100).parse(b.idempotency_key)}`,
        from: a.id,
        to: b.to,
        workId: w.id,
        context: z.string().min(1).max(2000).parse(b.context),
        status: "requested",
        createdAt: now(),
      };
      const old = this.s.get("handoff", h.id);
      if (old) return old;
      this.s.put("handoff", h);
      this.s.event(a.id, "handoff.requested", h.id);
      return h;
    }
    if (action === "reply_message") {
      const m = this.require("message", b.id);
      assert(
        m.agentId === a.id,
        "Private message belongs to another agent",
        403,
      );
      m.reply = z.string().min(1).max(4000).parse(b.body);
      m.status = "replied";
      this.s.put("message", m);
      this.s.event(a.id, "message.replied", m.id);
      return { ok: true };
    }
    throw new Fault("Unknown agent action", 404);
  }
  recover() {
    this.s.tx(() => {
      for (const r of this.s.active("run"))
        if (
          !terminal.includes(r.status) &&
          Date.parse(r.leaseUntil) < stamp()
        ) {
          r.status = "expired";
          this.s.put("run", r);
          const c = this.require("command", r.commandId);
          c.status = "expired";
          this.s.put("command", c);
          const w = this.require("work", r.workId);
          w.status = "blocked";
          w.revision++;
          this.s.put("work", w);
          this.s.event("system", "run.expired", r.id, {
            reason: "Lease expired; inspect external effects before retry",
          });
        }
      for (const c of this.s.active("command"))
        if (!terminal.includes(c.status) && Date.parse(c.expiresAt) < stamp()) {
          c.status = "expired";
          this.s.put("command", c);
          if (c.verb === "message.deliver") {
            const m = this.require("message", c.payload.messageId);
            if (m.status !== "replied") m.status = "expired";
            this.s.put("message", m);
          }
          if (c.verb === "handoff.accept") {
            const h = this.require("handoff", c.payload.handoffId);
            h.status = "expired";
            this.s.put("handoff", h);
            const w = this.require("work", h.workId);
            if (w.transferPending === h.id) delete w.transferPending;
            this.s.put("work", w);
          }
          if (c.workId) {
            const w = this.require("work", c.workId);
            w.status = "blocked";
            w.revision++;
            this.s.put("work", w);
          }
          this.s.event("system", "command.expired", c.id);
        }
    });
  }
}

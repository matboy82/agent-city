import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Store, assert, now, hash } from "../server/store.mjs";
import { design, officeDesignFromLegacy } from "../server/contracts.mjs";
const tables = [
  "activities",
  "approvals",
  "queue_items",
  "crew",
  "agent_connections",
  "city_buildings",
  "agent_messages",
  "goals",
  "organizations",
  "work_items",
  "work_assignments",
  "commands",
  "handoffs",
  "artifacts",
  "operational_events",
];
const instant = (v) =>
  v === null || v === undefined
    ? null
    : new Date(typeof v === "number" ? v : v).toISOString();
const decode = (v) => (typeof v === "string" ? JSON.parse(v) : v);
export function inspectLegacy(path) {
  const source = new DatabaseSync(resolve(path), { readOnly: true });
  try {
    const present = new Set(
      source
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => r.name),
    );
    const rows = {};
    for (const table of tables)
      rows[table] = present.has(table)
        ? source.prepare(`SELECT * FROM ${table}`).all()
        : [];
    return rows;
  } finally {
    source.close();
  }
}
export function importLegacy(sourcePath, destinationPath) {
  assert(
    resolve(sourcePath) !== resolve(destinationPath),
    "Source and destination must differ",
  );
  assert(
    !existsSync(destinationPath),
    "Import requires a new destination database",
  );
  const rows = inspectLegacy(sourcePath);
  const s = new Store(destinationPath);
  try {
    s.tx(() => {
      for (const table of tables)
        for (const row of rows[table]) {
          assert(
            !row.organization_id || row.organization_id === "bis",
            "Refusing non-BIS data",
          );
          const clean = { ...row };
          delete clean.token_hash;
          delete clean.token_hint;
          delete clean.code_hash;
          delete clean.avatar_data;
          const key = `${table}:${row.id ?? row.key ?? row.agent_id ?? hash(JSON.stringify(clean))}`;
          s.put("legacy_archive", {
            id: key,
            table,
            source: clean,
            importedAt: now(),
          });
        }
      for (const c of rows.crew) {
        const existing = s.get("agent", c.key) || {};
        s.put("agent", {
          ...existing,
          id: c.key,
          name: c.name,
          role: c.role,
          currentTask: c.detail,
          status: "idle",
          lastSeen: null,
          paused: true,
          revision: 0,
          sequence: -1,
          capabilities: [],
          theme: "neutral",
        });
      }
      for (const c of rows.agent_connections) {
        const a = s.get("agent", c.agent_id) || {
          id: c.agent_id,
          name: c.display_name,
          role: "Imported agent",
          paused: true,
          revision: 0,
          sequence: -1,
          capabilities: [],
        };
        a.theme = c.office_theme || "neutral";
        a.status = "idle";
        a.lastSeen = null;
        a.legacyLastSeen = instant(c.last_seen);
        a.currentTask = c.current_task;
        a.transport = null;
        a.revision = c.office_design_revision || 0;
        try {
          a.agentDesign = c.agent_office_design
            ? design(decode(c.agent_office_design))
            : officeDesignFromLegacy(a.theme, decode(c.decor_items || "[]"));
          if (c.owner_office_design)
            a.ownerDesign = design(decode(c.owner_office_design));
        } catch {
          a.designImportWarning =
            "Invalid legacy design retained in archive; theme default used";
        }
        s.put("agent", a);
      }
      for (const g of rows.goals)
        s.put("goal", {
          id: g.key,
          name: g.name,
          current: g.current || 0,
          target: g.target || 1,
          unit: g.unit || "",
          status: g.status_line || "Imported",
          updatedAt: instant(g.updated_at),
        });
      for (const b of rows.city_buildings)
        s.put("building", {
          id: String(b.id),
          name: b.name,
          agentId: b.agent_id,
          kind: b.kind,
          style: b.style,
          x: b.position_x || 0,
          z: b.position_z || 0,
          accent: b.accent || "#2768df",
          legacyProjectGoal: b.project_goal,
        });
      for (const w of rows.work_items) {
        const assignments = rows.work_assignments.filter(
          (a) => a.work_item_id === w.id,
        );
        const roles = {
          responsible: [],
          accountable: "matt",
          consulted: [],
          informed: [],
        };
        for (const a of assignments)
          if (a.role !== "accountable" && roles[a.role])
            roles[a.role].push(a.agent_id);
        s.put("work", {
          id: w.id,
          title: w.title,
          brief: w.brief,
          status: ["done", "canceled"].includes(w.status)
            ? w.status
            : "blocked",
          legacyStatus: w.status,
          priority: w.priority,
          revision: w.revision,
          policyRevision: 0,
          raci: roles,
          goalId: w.goal_ref || "monthly",
          parentId: w.parent_id,
          scope: "bis",
          capability: "work.execute",
          action: "read",
          paused: true,
          createdAt: instant(w.created_at),
          migrationReviewRequired: true,
        });
      }
      for (const c of rows.commands)
        s.put("command", {
          id: c.id,
          agentId: c.target_agent_id,
          workId: c.work_item_id,
          verb: c.verb,
          payload: decode(c.payload),
          status: ["completed", "failed", "expired", "canceled"].includes(
            c.status,
          )
            ? c.status
            : "expired",
          legacyStatus: c.status,
          idempotencyKey: c.idempotency_key,
          expiresAt: instant(c.expires_at),
          issuedAt: instant(c.created_at),
          result: c.result,
        });
      for (const a of rows.approvals)
        s.put("approval", {
          id: "legacy:" + a.id,
          kind: a.kind,
          title: a.title,
          context: a.context,
          effect: a.effect,
          status: a.status === "waiting" ? "waiting" : "resolved",
          resolution: a.resolution,
          sourceKey: a.source_key,
          createdAt: instant(a.created_at),
          resolvedAt: instant(a.resolved_at),
        });
      for (const q of rows.queue_items)
        s.put("queue", {
          id: "legacy:" + q.id,
          category: q.category,
          text: q.text,
          detail: q.detail,
          timeLabel: q.time_label,
          sourceKey: q.source_key,
          createdAt: instant(q.created_at),
        });
      for (const m of rows.agent_messages)
        s.put("message", {
          id: "legacy:" + m.id,
          agentId: m.agent_id,
          body: m.body,
          scope: "private",
          status: "recorded",
          author: "matt",
          workId: null,
          createdAt: instant(m.created_at),
        });
      for (const a of rows.artifacts)
        s.put("artifact", {
          id: a.id,
          workId: a.work_item_id,
          runId: a.run_id,
          agentId: a.agent_id,
          title: a.name,
          uri: a.uri,
          revision: a.revision,
          createdAt: instant(a.created_at),
        });
      for (const h of rows.handoffs)
        s.put("handoff", {
          id: h.id,
          workId: h.work_item_id,
          from: h.from_agent_id,
          to: h.to_agent_id,
          context: h.context,
          status:
            h.status === "proposed"
              ? "requested"
              : h.status === "accepted"
                ? "requested"
                : h.status,
          createdAt: instant(h.created_at),
        });
      for (const a of rows.activities)
        s.event(a.agent, "legacy.activity", String(a.id), {
          summary: a.summary,
          detail: a.detail,
          occurredAt: instant(a.occurred_at),
        });
      for (const ev of rows.operational_events)
        s.event(ev.actor, "legacy." + ev.event_type, ev.entity_id, {
          payload: decode(ev.payload),
          occurredAt: instant(ev.created_at),
        });
      const config = s.get("config", "bis");
      config.stopped = true;
      s.put("config", config);
      s.event("migration", "legacy.imported", "bis", {
        counts: Object.fromEntries(tables.map((t) => [t, rows[t].length])),
        recovery:
          "All agents disconnected, dispatch stopped, unfinished work blocked pending owner reconciliation",
      });
    });
    return Object.fromEntries(tables.map((t) => [t, rows[t].length]));
  } finally {
    s.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const [source, destination, apply] = process.argv.slice(2);
  assert(
    source,
    "Usage: node scripts/import-legacy.mjs <source.sqlite> [new-destination.sqlite] [--apply]",
  );
  const rows = inspectLegacy(source);
  if (apply === "--apply") {
    assert(destination, "A new destination path is required");
    console.log(JSON.stringify(importLegacy(source, destination)));
  } else
    console.log(
      JSON.stringify({
        dryRun: true,
        counts: Object.fromEntries(tables.map((t) => [t, rows[t].length])),
      }),
    );
}

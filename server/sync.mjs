import { readFile } from "node:fs/promises";
import { now, id } from "./store.mjs";
export const denverParts = (date = new Date()) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
export class Scheduler {
  constructor(core) {
    this.core = core;
    this.busy = false;
  }
  async tick() {
    const p = denverParts();
    const day = `${p.year}-${p.month}-${p.day}`;
    if (
      `${p.hour}:${p.minute}` >= "05:55" &&
      !this.core.s.get("schedule", day)
    ) {
      this.core.s.put("schedule", { id: day, startedAt: now() });
      await this.refresh("schedule");
    }
    for (const r of this.core.s.list("routine"))
      if (r.enabled && r.lastDay !== day && `${p.hour}:${p.minute}` >= r.time) {
        this.core.s.tx(() => {
          const w = {
            id: id(),
            title: r.title,
            brief: r.brief,
            contract: { objective: r.title, inputs: ["Routine definition", "BIS workspace context"], constraints: ["BIS only", "Owner dispatch required"], deliverable: r.brief, done_when: ["Routine deliverable is prepared"], approval_required: [] },
            priority: "normal",
            goalId: r.goalId,
            raci: {
              responsible: [r.agentId],
              accountable: "matt",
              consulted: [],
              informed: [],
            },
            capability: "work.execute",
            scope: "bis",
            action: "read",
            status: "planned",
            revision: 0,
            policyRevision: 0,
            createdAt: now(),
            paused: false,
            receipts: [],
            routineId: r.id,
          };
          this.core.s.put("work", w);
          r.lastDay = day;
          r.lastResult = "Planned for owner dispatch";
          r.lastWorkId = w.id;
          this.core.s.put("routine", r);
          this.core.s.event("scheduler", "routine.planned", r.id, {
            workId: w.id,
          });
        });
      }
  }
  async refresh(reason) {
    if (this.busy) return { status: "running" };
    this.busy = true;
    const s = this.core.s;
    const result = {
      id: "latest",
      status: "running",
      reason,
      startedAt: now(),
      sources: [],
    };
    if (reason === "schedule" || reason === "manual") {
      result.receiptBrief = this.core.receiptBrief();
      result.openHarnessImprovements = this.core.s.list("work").filter(w => w.harnessImprovementFor && !["done", "canceled"].includes(w.status)).map(w => ({ id: w.id, title: w.title, status: w.status, owner: w.raci?.responsible?.[0] || "dave" }));
    }
    s.put("sync", result);
    try {
      const config = process.env.CREW_SYNC_CONFIG
        ? JSON.parse(process.env.CREW_SYNC_CONFIG)
        : {};
      const providers = [];
      if (process.env.CREW_MAILBOX_CONFIG)
        providers.push([
          "Agent mailboxes",
          async () => {
            const config = JSON.parse(
              await readFile(process.env.CREW_MAILBOX_CONFIG, "utf8"),
            );
            const { bridge } = await import("../adapters/drive-bridge.mjs");
            const results = await bridge(this.core, config.bindings);
            if (results.some((r) => r.status === "failed"))
              throw new Error("Mailbox validation failed");
          },
        ]);
      if (process.env.CREW_SCHEDULES_FILE)
        providers.push([
          "Runtime schedules",
          async () => {
            const raw = await readFile(process.env.CREW_SCHEDULES_FILE, "utf8");
            if (Buffer.byteLength(raw) > 100000)
              throw new Error("Schedule snapshot too large");
            const rows = JSON.parse(raw);
            if (!Array.isArray(rows) || rows.length > 100)
              throw new Error("Invalid schedules");
            s.tx(() => {
              for (const item of rows) {
                if (item.system === true) continue;
                if (
                  typeof item.id !== "string" ||
                  typeof item.title !== "string" ||
                  typeof item.status !== "string" ||
                  !item.observedAt ||
                  !Number.isFinite(Date.parse(item.observedAt))
                )
                  throw new Error("Invalid schedule");
                const key = "schedule:" + item.id;
                s.put("queue", {
                  id: key,
                  category: "recurring",
                  text: item.title.slice(0, 240),
                  detail: item.status.slice(0, 100),
                  timeLabel: String(item.time || ""),
                  observedAt: item.observedAt,
                  createdAt: now(),
                });
              }
            });
          },
        ]);
      if (config.githubRepo && process.env.GITHUB_TOKEN)
        providers.push([
          "GitHub",
          async () => {
            if (!/^[\w.-]+\/[\w.-]+$/.test(config.githubRepo))
              throw new Error("Invalid repository");
            const headers = {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              Accept: "application/vnd.github+json",
            };
            const response = await fetch(
              `https://api.github.com/repos/${config.githubRepo}/pulls?state=all&per_page=50`,
              { headers, signal: AbortSignal.timeout(15000) },
            );
            if (!response.ok) throw new Error("GitHub read failed");
            const prs = await response.json();
            const commitsResponse = await fetch(
              `https://api.github.com/repos/${config.githubRepo}/commits?sha=main&per_page=20`,
              { headers, signal: AbortSignal.timeout(15000) },
            );
            if (!commitsResponse.ok) throw new Error("Commit read failed");
            const commits = await commitsResponse.json();
            s.tx(() => {
              for (const commit of commits) {
                const key = "commit:" + config.githubRepo + ":" + commit.sha;
                if (!s.get("dedupe", key)) {
                  s.put("dedupe", { id: key });
                  s.event("github", "source.commit", key, {
                    summary: commit.commit.message.split("\n")[0].slice(0, 240),
                    observedAt: commit.commit.committer.date,
                    uri: commit.html_url,
                  });
                }
              }
            });
            s.tx(() => {
              for (const pr of prs) {
                const key = `github:${config.githubRepo}:${pr.number}`;
                const existing = s.get("approval", key);
                if (pr.state === "open")
                  s.put("approval", {
                    ...existing,
                    id: key,
                    kind: "MERGE",
                    title: pr.title,
                    context: pr.html_url,
                    effect: "Review externally; Crew OS does not merge",
                    status: existing?.status || "waiting",
                    createdAt: existing?.createdAt || now(),
                    sourceKey: key,
                  });
                else if (existing && existing.status === "waiting")
                  s.put("approval", {
                    ...existing,
                    status: "resolved",
                    resolution: "Source pull request is closed",
                    resolvedAt: now(),
                  });
              }
            });
          },
        ]);
      if (process.env.CREW_CALENDAR_FILE)
        providers.push([
          "BIS Calendar file",
          async () => {
            const raw = await readFile(process.env.CREW_CALENDAR_FILE, "utf8");
            if (Buffer.byteLength(raw) > 100000)
              throw new Error("Calendar file too large");
            const items = JSON.parse(raw);
            if (!Array.isArray(items) || items.length > 100)
              throw new Error("Invalid calendar file");
            const rows = [];
            for (const e of items) {
              if (
                typeof e.id !== "string" ||
                typeof e.summary !== "string" ||
                !e.start ||
                !Number.isFinite(Date.parse(e.start))
              )
                continue;
              const p = denverParts(new Date(e.start));
              rows.push({
                id: `calfile:${e.id}`,
                category: "agenda",
                text: (e.summary || "Calendar event").slice(0, 240),
                timeLabel: e.allDay ? "All day" : `${p.hour}:${p.minute}`,
                group: "BIS",
                start: e.start,
                end: e.end && Number.isFinite(Date.parse(e.end)) ? e.end : null,
                createdAt: now(),
              });
            }
            for (const row of rows) {
              if (!row.start || !row.end) continue;
              row.conflicts = rows
                .filter(
                  (other) =>
                    other.id !== row.id &&
                    other.start &&
                    other.end &&
                    Date.parse(other.start) < Date.parse(row.end) &&
                    Date.parse(other.end) > Date.parse(row.start),
                )
                .map((other) => other.id);
              row.tightTransition = rows.some(
                (other) =>
                  other.id !== row.id &&
                  other.start &&
                  Date.parse(other.start) >= Date.parse(row.end) &&
                  Date.parse(other.start) - Date.parse(row.end) < 900000,
              );
            }
            s.tx(() => {
              for (const row of s.list("queue"))
                if (row.category === "agenda") s.remove("queue", row.id);
              for (const row of rows) s.put("queue", row);
            });
          },
        ]);
      if (config.calendarIds?.length && process.env.GOOGLE_ACCESS_TOKEN)
        providers.push([
          "Google Calendar",
          async () => {
            const rows = [];
            for (const calendar of config.calendarIds) {
              const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&timeMax=${encodeURIComponent(new Date(Date.now() + 86400000).toISOString())}`,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
                  },
                  signal: AbortSignal.timeout(15000),
                },
              );
              if (!response.ok) throw new Error("Calendar read failed");
              for (const e of (await response.json()).items || []) {
                const start = e.start?.dateTime || e.start?.date;
                if (!start) continue;
                const p = denverParts(new Date(start));
                const today = denverParts();
                if (
                  e.start.date
                    ? e.start.date !==
                      `${today.year}-${today.month}-${today.day}`
                    : p.day !== today.day ||
                      p.month !== today.month ||
                      p.year !== today.year
                )
                  continue;
                rows.push({
                  id: `calendar:${calendar.id}:${e.id}`,
                  category: "agenda",
                  text: e.summary || "Calendar event",
                  timeLabel: e.start.date ? "All day" : `${p.hour}:${p.minute}`,
                  group: calendar.group || "BIS",
                  start: e.start.dateTime || null,
                  end: e.end?.dateTime || null,
                  createdAt: now(),
                });
              }
            }
            for (const row of rows) {
              if (!row.start || !row.end) continue;
              row.conflicts = rows
                .filter(
                  (other) =>
                    other.id !== row.id &&
                    other.start &&
                    other.end &&
                    Date.parse(other.start) < Date.parse(row.end) &&
                    Date.parse(other.end) > Date.parse(row.start),
                )
                .map((other) => other.id);
              row.tightTransition = rows.some(
                (other) =>
                  other.id !== row.id &&
                  other.start &&
                  Date.parse(other.start) >= Date.parse(row.end) &&
                  Date.parse(other.start) - Date.parse(row.end) < 900000,
              );
            }
            s.tx(() => {
              for (const row of s.list("queue"))
                if (row.category === "agenda") s.remove("queue", row.id);
              for (const row of rows) s.put("queue", row);
            });
          },
        ]);
      for (const [name, run] of providers) {
        try {
          await run();
          result.sources.push({ name, status: "completed" });
        } catch {
          result.sources.push({ name, status: "failed" });
        }
      }
      result.status = !providers.length
        ? "unconfigured"
        : result.sources.some((p) => p.status === "failed")
          ? "failed"
          : "completed";
      result.completedAt = now();
      s.put("sync", result);
      s.event("scheduler", `sync.${result.status}`, "brief", {
        reason,
        sources: result.sources,
      });
      return result;
    } catch {
      result.status = "failed";
      result.completedAt = now();
      s.put("sync", result);
      return result;
    } finally {
      this.busy = false;
    }
  }
}

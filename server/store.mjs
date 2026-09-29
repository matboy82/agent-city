import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export class Fault extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function assert(ok, message, status = 400) {
  if (!ok) throw new Fault(message, status);
}
export class Store {
  constructor(path) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(kind,id));
   CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,at TEXT NOT NULL,actor TEXT NOT NULL,type TEXT NOT NULL,entity TEXT NOT NULL,detail TEXT NOT NULL);
   CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit is immutable'); END;
   CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit is immutable'); END;
   CREATE INDEX IF NOT EXISTS audit_entity ON audit(entity,seq); CREATE INDEX IF NOT EXISTS records_status ON records(kind,json_extract(data,'$.status')); CREATE INDEX IF NOT EXISTS records_work ON records(kind,json_extract(data,'$.workId')); CREATE UNIQUE INDEX IF NOT EXISTS command_idempotency ON records(json_extract(data,'$.idempotencyKey')) WHERE kind='command';`);
    if (!this.get("config", "bis"))
      this.tx(() => {
        this.put("config", {
          id: "bis",
          name: "BIS",
          stopped: false,
          revision: 0,
        });
        const crew = [
          [
            "dave",
            "Dave",
            "Chief of staff",
            "The War Room",
            "command_center",
            -7,
            -5,
            "command",
          ],
          [
            "jefferson",
            "Jefferson",
            "Trading desk",
            "The Exchange",
            "trading_floor",
            7,
            -5,
            "exchange",
          ],
          [
            "relay",
            "Relay",
            "Outside-world operations",
            "The Tower",
            "comms_loft",
            -7,
            6,
            "tower",
          ],
          [
            "jev",
            "Jev",
            "Fast scoring & judgment",
            "The Lab",
            "research_lab",
            7,
            6,
            "lab",
          ],
        ];
        for (const [key, name, role, building, theme, x, z, style] of crew) {
          this.put("agent", {
            id: key,
            name,
            role,
            theme,
            status: "idle",
            lastSeen: null,
            paused: false,
            revision: 0,
            sequence: -1,
            capabilities: [],
            activity: "idle",
            avatar: ["dave", "relay"].includes(key)
              ? `/assets/${key}.png`
              : null,
          });
          this.put("building", {
            id: key,
            name: building,
            agentId: key,
            kind: "agent_hq",
            style,
            x,
            z,
            accent: "#2768df",
          });
        }
        this.put("goal", {
          id: "monthly",
          name: "Build recurring revenue",
          current: 0,
          target: 2000,
          unit: "USD / month",
          status: "Awaiting verified progress",
        });
        for (const template of [
          { id: "review_loop", name: "Review loop", steps: [{agentId:"nerby",handoff:"Implementation result"},{agentId:"chad",handoff:"Review findings"}], completionCriteria:"Reviewer approves", maxLoops:3 },
          { id: "crew_briefing", name: "Crew briefing", steps: [{agentId:"dave",handoff:"Collected updates"},{agentId:"jev",handoff:"Red team assessment"},{agentId:"dave",handoff:"Final briefing"}], completionCriteria:"Briefing delivered", maxLoops:1 },
          { id: "lead_triage", name: "Lead triage", steps: [{agentId:"jev",handoff:"Score and rationale"},{agentId:"relay",handoff:"Draft outreach"},{agentId:"relay",handoff:"Approval queue"}], completionCriteria:"Draft queued for owner approval", maxLoops:1 },
        ]) this.put("template", template);
      });
    this.tx(() => {
        for (const template of [
          { id: "review_loop", name: "Review loop", steps: [{agentId:"nerby",handoff:"Implementation result"},{agentId:"chad",handoff:"Review findings"}], completionCriteria:"Reviewer approves", maxLoops:3 },
          { id: "crew_briefing", name: "Crew briefing", steps: [{agentId:"dave",handoff:"Collected updates"},{agentId:"jev",handoff:"Red team assessment"},{agentId:"dave",handoff:"Final briefing"}], completionCriteria:"Briefing delivered", maxLoops:1 },
          { id: "lead_triage", name: "Lead triage", steps: [{agentId:"jev",handoff:"Score and rationale"},{agentId:"relay",handoff:"Draft outreach"},{agentId:"relay",handoff:"Approval queue"}], completionCriteria:"Draft queued for owner approval", maxLoops:1 },
        ]) if (!this.get("template", template.id)) this.put("template", template);
      });
  }
  get(kind, key) {
    const row = this.db
      .prepare("SELECT data FROM records WHERE kind=? AND id=?")
      .get(kind, key);
    return row ? JSON.parse(row.data) : null;
  }
  list(kind, limit = 500) {
    return this.db
      .prepare(
        "SELECT data FROM records WHERE kind=? ORDER BY rowid DESC LIMIT ?",
      )
      .all(kind, limit)
      .map((r) => JSON.parse(r.data));
  }
  put(kind, value) {
    this.db
      .prepare(
        "INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      )
      .run(kind, value.id, JSON.stringify(value));
    return value;
  }
  active(kind) {
    return this.db
      .prepare(
        "SELECT data FROM records WHERE kind=? AND json_extract(data,'$.status') IN ('queued','accepted','running') ORDER BY rowid",
      )
      .all(kind)
      .map((r) => JSON.parse(r.data));
  }
  commandByKey(key) {
    return this.db
      .prepare(
        "SELECT data FROM records WHERE kind='command' AND json_extract(data,'$.idempotencyKey')=? LIMIT 1",
      )
      .get(key)?.data;
  }
  remove(kind, key) {
    this.db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, key);
  }
  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  event(actor, type, entity, detail = {}) {
    this.db
      .prepare(
        "INSERT INTO audit(id,at,actor,type,entity,detail) VALUES(?,?,?,?,?,?)",
      )
      .run(id(), now(), actor, type, entity, JSON.stringify(detail));
  }
  events(search = "", offset = 0) {
    return this.db
      .prepare(
        "SELECT * FROM audit WHERE type LIKE ? OR entity LIKE ? OR actor LIKE ? ORDER BY seq DESC LIMIT 100 OFFSET ?",
      )
      .all(...Array(3).fill(`%${search}%`), offset)
      .map((r) => ({ ...r, detail: JSON.parse(r.detail) }));
  }
  close() {
    this.db.close();
  }
}
export function passwordRecord(passphrase) {
  const salt = randomBytes(24).toString("hex");
  return { salt, digest: scryptSync(passphrase, salt, 64).toString("hex") };
}
export function checkPassword(passphrase, record) {
  return timingSafeEqual(
    Buffer.from(record.digest, "hex"),
    scryptSync(passphrase, record.salt, 64),
  );
}
export function secret() {
  return randomBytes(32).toString("base64url");
}

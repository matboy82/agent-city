import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { importLegacy } from "../scripts/import-legacy.mjs";
import { Store } from "../server/store.mjs";
test("migration is non-destructive, archives records, and never upgrades undelivered notes", () => {
  const dir = mkdtempSync(join(tmpdir(), "crew-migration-"));
  try {
    const src = join(dir, "old.sqlite"),
      dest = join(dir, "new.sqlite");
    const db = new DatabaseSync(src);
    db.exec(
      "CREATE TABLE agent_messages(id INTEGER,agent_id TEXT,body TEXT,created_at INTEGER); INSERT INTO agent_messages VALUES(1,'jeff','Original undelivered note',1000);",
    );
    db.close();
    const counts = importLegacy(src, dest);
    assert.equal(counts.agent_messages, 1);
    const s = new Store(dest);
    assert.equal(s.get("message", "legacy:1").status, "recorded");
    assert.equal(s.get("config", "bis").stopped, true);
    assert.equal(s.list("legacy_archive").length, 1);
    s.close();
    const original = new DatabaseSync(src, { readOnly: true });
    assert.equal(
      original.prepare("SELECT count(*) n FROM agent_messages").get().n,
      1,
    );
    original.close();
    assert.throws(() => importLegacy(src, dest), /new destination/);
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    rmSync(dir, { recursive: true, force: true });
  }
});

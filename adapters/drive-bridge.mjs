import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  rename,
  stat,
  lstat,
  realpath,
} from "node:fs/promises";
import { Core } from "../server/core.mjs";
import { Store, assert, now } from "../server/store.mjs";
// Run beside the server, on a private per-agent Drive sync/mount. Directory ACLs are the transport boundary.
// Configuration lives outside the shared mailbox. The file itself never carries an agent credential.
export async function bridge(core, bindings) {
  const roots = new Set(),
    agents = new Set();
  for (const binding of bindings) {
    assert(!agents.has(binding.agentId), "One mailbox binding per agent");
    agents.add(binding.agentId);
    const root = resolve(binding.path);
    assert(!roots.has(root), "Mailboxes must be isolated");
    for (const other of roots)
      assert(
        !root.startsWith(other + "/") &&
          !root.startsWith(other + "\\") &&
          !other.startsWith(root + "/") &&
          !other.startsWith(root + "\\"),
        "Mailbox folders cannot overlap",
      );
    roots.add(root);
  }
  const results = [];
  for (const binding of bindings) {
    try {
      const root = await realpath(resolve(binding.path));
      assert((await stat(root)).isDirectory(), "Mailbox is missing");
      const a = core.require("agent", binding.agentId);
      assert(!a.credentialHash, "Revoke HTTPS transport before enabling Drive");
      a.runtimeId = binding.runtimeId;
      a.transport = "google_drive";
      core.s.put("agent", a);
      const statusPath = resolve(root, "heartbeat.json");
      try {
        const info = await lstat(statusPath);
        assert(
          info.isFile() && !info.isSymbolicLink() && info.size < 100000,
          "Invalid heartbeat file",
        );
        const raw = await readFile(statusPath, "utf8");
        assert(Buffer.byteLength(raw) < 100000, "Heartbeat too large");
        const heartbeat = JSON.parse(raw);
        assert(
          heartbeat.agent_id === binding.agentId &&
            heartbeat.runtime_id === binding.runtimeId,
          "Mailbox identity mismatch",
        );
        core.s.tx(() =>
          core.agentOperation(
            "report_heartbeat",
            heartbeat,
            core.require("agent", binding.agentId),
          ),
        );
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      const inbox = resolve(root, "inbox"),
        outbox = resolve(root, "outbox"),
        receipts = resolve(root, "receipts");
      await Promise.all([
        mkdir(inbox, { recursive: true }),
        mkdir(outbox, { recursive: true }),
        mkdir(receipts, { recursive: true }),
      ]);
      for (const dir of [inbox, outbox, receipts]) {
        const info = await lstat(dir);
        assert(
          info.isDirectory() &&
            !info.isSymbolicLink() &&
            (await realpath(dir)) === dir,
          "Mailbox child directories cannot be links",
        );
      }
      const atomic = async (target, payload) => {
        const temp = target + "." + randomUUID() + ".tmp";
        await writeFile(temp, JSON.stringify(payload), { flag: "wx" });
        await rename(temp, target);
      };
      const commands = core.s.tx(() =>
        core.agentOperation(
          "poll_commands",
          {},
          core.require("agent", binding.agentId),
        ),
      );
      for (const command of commands) {
        const target = resolve(inbox, command.id + ".json");
        await atomic(target, { protocol_version: 2, ...command });
      }
      for (const name of (await readdir(outbox))
        .filter((n) => /^[a-zA-Z0-9_-]{1,100}\.json$/.test(n))
        .slice(0, 50)) {
        const key = `drive:${binding.agentId}:${name}`;
        const prior = core.s.get("dedupe", key);
        if (prior) {
          await atomic(resolve(receipts, name), {
            ok: true,
            at: now(),
            result: prior.result,
          });
          continue;
        }
        const file = resolve(outbox, name);
        const info = await lstat(file);
        assert(
          info.isFile() && !info.isSymbolicLink() && info.size < 100000,
          "Invalid envelope file",
        );
        const raw = await readFile(file, "utf8");
        assert(Buffer.byteLength(raw) < 100000, "Envelope too large");
        const envelope = JSON.parse(raw);
        assert(
          [
            "ack_command",
            "submit_artifact",
            "request_handoff",
            "reply_message",
          ].includes(envelope.action),
          "Unsupported mailbox action",
        );
        const result = core.s.tx(() => {
          const r = core.agentOperation(
            envelope.action,
            envelope.input,
            core.require("agent", binding.agentId),
          );
          core.s.put("dedupe", { id: key, result: r });
          return r;
        });
        await atomic(resolve(receipts, name), { ok: true, at: now(), result });
      }
      results.push({ agentId: binding.agentId, status: "completed" });
    } catch {
      results.push({ agentId: binding.agentId, status: "failed" });
      core.s.event("bridge", "mailbox.failed", binding.agentId, {
        reason: "Invalid mailbox, identity, envelope, or filesystem access",
      });
    }
  }
  return results;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  assert(
    process.env.CREW_MAILBOX_CONFIG,
    "Set CREW_MAILBOX_CONFIG to an absolute private configuration file",
  );
  const config = JSON.parse(
    await readFile(process.env.CREW_MAILBOX_CONFIG, "utf8"),
  );
  const store = new Store(process.env.CREW_DB || "data/crew.sqlite");
  const core = new Core(store);
  const r = await bridge(core, config.bindings);
  console.log(JSON.stringify(r));
  store.close();
}

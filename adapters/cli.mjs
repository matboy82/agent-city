import { readFile, writeFile, mkdir, rename, chmod } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
export class Adapter {
  constructor({ url, agentId, runtimeId, credential, statePath }) {
    this.url = url.replace(/\/$/, "");
    if (
      !this.url.startsWith("https://") &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(this.url)
    )
      throw new Error("Remote adapters require HTTPS");
    this.agentId = agentId;
    this.runtimeId = runtimeId;
    this.credential = credential;
    this.statePath = statePath;
    this.state = { sequence: 0, commands: {} };
  }
  async load() {
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  async save() {
    const snapshot = JSON.stringify(this.state);
    this.saving = (this.saving || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.statePath), { recursive: true });
        await writeFile(this.statePath + ".tmp", snapshot, { mode: 0o600 });
        await rename(this.statePath + ".tmp", this.statePath);
      });
    return this.saving;
  }
  async call(action, input = {}) {
    const r = await fetch(this.url + "/api/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.credential}`,
        "X-Crew-Role": "agent",
      },
      body: JSON.stringify({ action, input }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
    return result;
  }
  async heartbeat({
    status = "idle",
    task = null,
    runId = null,
    queue = [],
    activity = [],
    current_activity = null,
    capabilities = ["work.execute"],
    officeDesign,
    instructionHash,
  } = {}) {
    const sequence = ++this.state.sequence;
    await this.save();
    return this.call("report_heartbeat", {
      protocol_version: 2,
      agent_id: this.agentId,
      runtime_id: this.runtimeId,
      sequence,
      last_seen: new Date().toISOString(),
      status,
      current_task: task,
      current_run_id: runId,
      capabilities,
      queue: queue.slice(0, 20),
      activity: activity.slice(0, 20),
      ...(instructionHash ? { instruction_hash: instructionHash } : {}),
      ...(officeDesign ? { office_design: officeDesign } : {}),
      ...(current_activity ? { current_activity } : {}),
    });
  }
  async ack(command, status, runId, result, metadata = {}) {
    return this.call("ack_command", {
      command_id: command.id,
      status,
      ...(runId ? { run_id: runId } : {}),
      ...(result ? { result: result.slice(0, 2000) } : {}),
      ...(metadata.budgetSeconds ? { budget_seconds: metadata.budgetSeconds } : {}),
      ...(metadata.exitReason ? { exit_reason: metadata.exitReason } : {}),
      ...(metadata.errorLines ? { error_lines: metadata.errorLines.slice(0, 1000) } : {}),
      ...(metadata.tokens ? { tokens: metadata.tokens } : {}),
      ...(metadata.failureClass ? { failure_class: metadata.failureClass } : {}),
    });
  }
  async process(command, handler) {
    const prior = this.state.commands[command.id];
    if (prior?.state === "completed") {
      if (command.status === "running")
        await this.ack(command, "completed", prior.runId, prior.result);
      return;
    }
    if (prior?.state === "executing" || prior?.state === "uncertain") return;
    let runId = prior?.runId;
    if (command.status === "queued") {
      const ack = await this.ack(command, "accepted");
      runId = ack.runId;
    }
    if (command.status === "queued" || command.status === "accepted")
      await this.ack(command, "running", runId);
    this.state.commands[command.id] = { state: "executing", runId };
    await this.save();
    let leaseError = null;
    const heartbeat = setInterval(() => {
      void this.heartbeat({
        status: "active",
        task: command.payload?.brief || command.verb,
        runId,
      }).catch((e) => {
        leaseError = e;
      });
    }, 30000);
    try {
      let result;
      if (command.verb === "work.start") {
        const policy = retryPolicy(command.payload?.contract?.retry_budget);
        const started = Date.now();
        for (let attempt = 1; ; attempt++) {
          try {
            result = await handler(command, { runId, adapter: this, shouldStop: () => !!leaseError });
            break;
          } catch (error) {
            const failureClass = classifyFailure(error);
            this.state.commands[command.id] = { state: "executing", runId, attempts: attempt, failureClass, lastError: String(error.message || error).slice(0, 500) };
            await this.save();
            if (!retryAllowed(failureClass, attempt, policy, Date.now() - started)) {
              error.failureClass = failureClass;
              error.retryAttempts = attempt;
              throw error;
            }
            const delay = Math.min(5000, 500 * 2 ** (attempt - 1));
            await new Promise((resolveWait) => setTimeout(resolveWait, delay));
            if (leaseError) throw leaseError;
          }
        }
      } else result = await handler(command, {
        runId,
        adapter: this,
        shouldStop: () => !!leaseError,
      });
      if (leaseError) throw leaseError;
      if (result?.artifact) {
        if (!runId) throw new Error("Artifact requires a run");
        await this.call("submit_artifact", {
          run_id: runId,
          idempotency_key: command.id,
          title: result.artifact.title,
          uri: result.artifact.uri,
          revision: result.artifact.revision || "1",
        });
      }
      const summary = command.payload?.scoring
        ? JSON.stringify(result)
        : String(result?.summary || "Runtime handler returned successfully");
      this.state.commands[command.id] = {
        state: "completed",
        runId,
        result: summary,
      };
      await this.save();
      await this.ack(command, "completed", runId, summary, { budgetSeconds: result?.budgetSeconds, exitReason: "completed", tokens: result?.tokens });
    } catch (e) {
      if (this.state.commands[command.id]?.state === "completed") throw e;
      this.state.commands[command.id] = { state: "uncertain", runId };
      await this.save();
      try {
        await this.ack(
          command,
          "failed",
          runId,
          "Runtime stopped without a verified result; reconcile external effects before retry.",
          { exitReason: e.code === "BUDGET_EXCEEDED" ? "budget_exceeded" : "error", budgetSeconds: e.budgetSeconds, errorLines: `class=${e.failureClass || classifyFailure(e)} attempts=${e.retryAttempts || 1}; ${e.message}`, failureClass: e.failureClass || classifyFailure(e) },
        );
      } catch {
        // Keep the local uncertain record if the server cannot accept the failure.
      }
      throw e;
    } finally {
      clearInterval(heartbeat);
    }
  }
}
const [mode, url, agentId, code] = process.argv.slice(2);
export function classifyFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (error?.code === "BUDGET_EXCEEDED" || /timed? ?out|timeout|deadline/.test(message)) return "TOOL_TIMEOUT";
  if (/permission denied|forbidden|not authorized|403/.test(message)) return "PERMISSION_DENIED";
  if (/invalid argument|bad request|422|400/.test(message)) return "INVALID_ARGUMENTS";
  if (/not found|missing (file|context|source)|enoent/.test(message)) return "MISSING_CONTEXT";
  if (/test failed|check failed|verification failed|assertion/.test(message)) return "FAILED_CHECK";
  if (/conflict|contradict|incompatible requirements/.test(message)) return "CONFLICTING_REQUIREMENTS";
  return "UNCHANGED_REPEATED_FAILURE";
}
export function retryPolicy(budget = {}) {
  return {
    attempts: Math.min(3, Math.max(1, Number.isInteger(budget.attempts) ? budget.attempts : 3)),
    elapsedMs: Math.min(10, Math.max(1, Number.isInteger(budget.elapsed_minutes) ? budget.elapsed_minutes : 10)) * 60_000,
    maxSpend: Number.isFinite(budget.spend) ? Math.max(0, budget.spend) : 0,
  };
}
export function retryAllowed(failureClass, attempt, policy, elapsedMs) {
  if (attempt >= policy.attempts || elapsedMs >= policy.elapsedMs) return false;
  if (failureClass === "TOOL_TIMEOUT") return true;
  if (["INVALID_ARGUMENTS", "MISSING_CONTEXT"].includes(failureClass)) return attempt < 1;
    if (failureClass === "FAILED_CHECK") return attempt <= 2;
  return false;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const credentials = resolve(
    process.env.CREW_ADAPTER_CONFIG || "data/adapter.json",
  );
  if (mode === "pair") {
    if (!url || !agentId || !code)
      throw new Error(
        "Usage: npm run adapter -- pair <url> <agent-id> <one-time-code>",
      );
    const runtimeId = process.env.CREW_RUNTIME_ID || `hermes-${agentId}`;
    const probe = new Adapter({
      url,
      agentId,
      runtimeId,
      credential: "",
      statePath: credentials + ".state",
    });
    const r = await probe.call("redeem_pairing_code", {
      code,
      runtime_id: runtimeId,
    });
    await mkdir(dirname(credentials), { recursive: true });
    await writeFile(
      credentials,
      JSON.stringify({
        url,
        agentId: r.agent_id,
        runtimeId,
        credential: r.credential,
      }),
      { mode: 0o600 },
    );
    await chmod(credentials, 0o600);
    console.log(
      "Paired. Credential saved to the configured local adapter file; not printed.",
    );
  } else if (mode === "run") {
    const config = JSON.parse(await readFile(credentials, "utf8"));
    const adapter = new Adapter({
      ...config,
      statePath: credentials + ".state",
    });
    await adapter.load();
    if (!process.env.CREW_HANDLER)
      throw new Error(
        "Set CREW_HANDLER to a local module exporting an async handle(command, context) function. No execution is simulated.",
      );
    const handler = (
      await import(pathToFileURL(resolve(process.env.CREW_HANDLER)).href)
    ).handle;
    const handlerModule = await import(pathToFileURL(resolve(process.env.CREW_HANDLER)).href);
    const getInstructionHash = handlerModule.instructionHash;
    if (typeof handler !== "function")
      throw new Error("Handler must export handle");
    const inflight = new Map();
    while (true) {
      try {
        const probe = await handler({ verb: "status.probe" }, { adapter });
        await adapter.heartbeat({
          status: process.env.CREW_STATUS || (inflight.size ? "active" : "idle"),
          task: probe?.current_task || null,
          queue: probe?.queue || [],
          activity: probe?.activity || [],
          current_activity: probe?.current_activity || null,
          instructionHash: typeof getInstructionHash === "function" ? await getInstructionHash() : undefined,
        });
        const commands = await adapter.call("poll_commands");
        for (const command of commands) {
          if (inflight.has(command.id)) continue;
          const control = ["agent.pause", "work.pause", "work.cancel"].includes(
            command.verb,
          );
          if (!control && inflight.size) continue;
          const task = adapter
            .process(command, handler)
            .catch((e) => console.error("Adapter operation failed:", e.message))
            .finally(() => inflight.delete(command.id));
          inflight.set(command.id, task);
        }
      } catch (e) {
        console.error("Adapter operation failed:", e.message);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  } else
    console.log(
      "Modes: pair <url> <agent-id> <code> | run. See adapters/README.md.",
    );
}

import { spawn } from "node:child_process";
import { resolve, join, sep } from "node:path";
import { mkdir, writeFile, realpath, stat } from "node:fs/promises";
const running = new Map();
export async function resolveHermesWorkspace(path) {
  if (!path)
    throw new Error("Set CREW_HERMES_WORKSPACE to the BIS working directory");
  const workspace = await realpath(resolve(path));
  if (!(await stat(workspace)).isDirectory())
    throw new Error("Hermes workspace must be a directory");
  if (workspace.toLowerCase().split(sep).includes("personal-cognition"))
    throw new Error("Personal-Cognition cannot be a Hermes BIS workspace");
  try {
    if ((await stat(join(workspace, "Personal-Cognition"))).isDirectory())
      throw new Error("Select BIS-Cognition, not the Shared Cognition parent");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return workspace;
}
export async function handle(command, { adapter, shouldStop }) {
  if (["agent.pause", "work.pause", "work.cancel"].includes(command.verb)) {
    const children = [...running.values()].filter(
      (r) => !command.workId || r.workId === command.workId,
    );
    await Promise.all(
      children.map(async (r) => {
        r.stopping = true;
        r.child.kill("SIGTERM");
        await r.closed;
      }),
    );
    return {
      summary:
        "Hermes processes owned by this adapter have exited. External background effects require separate reconciliation.",
    };
  }
  if (command.verb === "work.resume")
    return {
      summary:
        "Resume acknowledged. A paused execution must be retried from its durable context.",
    };
  if (
    !["work.start", "message.deliver", "handoff.accept"].includes(command.verb)
  )
    throw new Error("Unsupported Hermes command");
  if (command.verb === "handoff.accept")
    return {
      summary:
        "Hermes adapter accepted the handoff context; work awaits a new dispatch.",
    };
  const executable =
    process.env.CREW_HERMES_BIN ||
    (process.platform === "win32"
      ? resolve(process.env.LOCALAPPDATA || "", "hermes/bin/hermes.exe")
      : "hermes");
  const profile = process.env.CREW_HERMES_PROFILE || adapter.agentId;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(profile))
    throw new Error("Invalid Hermes profile");
  const workspace = await resolveHermesWorkspace(
    process.env.CREW_HERMES_WORKSPACE,
  );
  const args = [
    "--profile",
    profile,
    "chat",
    "--query-file",
    "-",
    "--format",
    "stream-json",
    "--in",
    workspace,
  ];
  if (process.env.CREW_HERMES_TOOLSETS)
    args.push("--toolsets", process.env.CREW_HERMES_TOOLSETS);
  const budget = Number(
    process.env.CREW_HERMES_RUN_BUDGET ||
      (command.verb === "message.deliver" ? 600 : 1800),
  );
  if (!Number.isInteger(budget) || budget < 60 || budget > 7200)
    throw new Error("CREW_HERMES_RUN_BUDGET must be 60–7200 seconds");
  args.push("--run-budget", String(budget));
  // Never use top-level --oneshot/-z or --yolo: Hermes' top-level oneshot bypasses approvals.
  const env = { ...process.env };
  delete env.HERMES_YOLO_MODE;
  delete env.CREW_HANDLER;
  const child = spawn(executable, args, {
    cwd: workspace,
    shell: false,
    windowsHide: true,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let final = null,
    buffer = "",
    size = 0,
    settle;
  const closed = new Promise((r) => (settle = r));
  const entry = { child, closed, workId: command.workId, stopping: false };
  running.set(command.id, entry);
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    size += Buffer.byteLength(chunk);
    if (size > 10000000) {
      entry.stopping = true;
      child.kill();
      return;
    }
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      try {
        const event = JSON.parse(line);
        if (event.type === "result") final = event;
      } catch {}
    }
  });
  // Tool output can include source contents or secrets. Do not forward it into Crew OS logs.
  child.stderr.resume();
  const guard = setInterval(() => {
    if (shouldStop()) {
      entry.stopping = true;
      child.kill("SIGTERM");
    }
  }, 1000);
  const result = new Promise((resolveResult, reject) => {
    child.on("error", () =>
      reject(
        new Error(
          "Hermes could not start; check configured executable and profile",
        ),
      ),
    );
    child.on("close", (code) => {
      settle();
      if (entry.stopping)
        return reject(
          new Error(
            "Hermes execution interrupted; inspect external effects before retry",
          ),
        );
      if (code !== 0 || !final || final.exit_code !== 0)
        return reject(
          new Error("Hermes did not report a successful terminal result"),
        );
      resolveResult(final);
    });
  });
  const context = {
    organization: "BIS",
    command_id: command.id,
    idempotency_key: command.idempotencyKey,
    action: command.payload?.action || "message",
    scope: "bis",
    brief: command.payload?.brief || command.payload?.body,
    context: command.payload?.context,
  };
  child.stdin.end(
    "Crew OS owner-authorized work packet. Read and follow the BIS workspace AGENTS.md and its startup sequence before substantive work. Remain within BIS scope; do not access personal cognition. Honor existing runtime approval boundaries. Return actual results and canonical evidence references. Do not claim work you did not perform.\n\n" +
      JSON.stringify(context),
  );
  try {
    const terminal = await result;
    if (command.verb === "message.deliver") {
      await adapter.call("reply_message", {
        id: command.payload.messageId,
        body: terminal.text.slice(0, 4000) || "Hermes returned no text",
      });
      return { summary: "Hermes replied to the private message" };
    }
    const dir = resolve(dirnameFromState(adapter.statePath), "results");
    await mkdir(dir, { recursive: true });
    await writeFile(
      resolve(dir, command.id + ".json"),
      JSON.stringify({
        commandId: command.id,
        sessionId: terminal.session_id,
        text: terminal.text,
        tokens: terminal.tokens,
        createdAt: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );
    return {
      summary:
        terminal.text.slice(0, 1800) ||
        "Hermes completed the turn; inspect its session for evidence",
    };
  } finally {
    clearInterval(guard);
    running.delete(command.id);
  }
}
function dirnameFromState(path) {
  return resolve(path, "..");
}

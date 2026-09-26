export type ActivityMode =
  | "typing"
  | "presenting"
  | "walking"
  | "reading"
  | "on_call"
  | "celebrating"
  | "idle";

// A visible action needs a live heartbeat or a verified running record. Task text
// only chooses the pose; it does not create presence, progress, or completion.
export function resolveActivity(
  agent: Record<string, any>,
  runs: Record<string, any>[],
): ActivityMode {
  if (agent.connection !== "Connected" || agent.status === "waiting_on_matt")
    return "idle";
  const running = runs.some(
    (run) => run.agentId === agent.id && run.status === "running",
  );
  if (agent.status !== "active" && !running) return "idle";
  if (agent.activity && agent.activity !== "idle") return agent.activity;
  const task = String(agent.currentTask || "").toLowerCase();
  if (/\b(call|calling|meeting|interview|sync|phone|zoom|standup)\b/.test(task))
    return "on_call";
  if (/\b(present|presenting|presentation|demo|briefing|pitch)\b/.test(task))
    return "presenting";
  if (/\b(read|reading|review|reviewing|audit|auditing|study|studying|document|spec|book)\b/.test(task))
    return "reading";
  if (/\b(walk|walking|deliver|delivering|field|visit|visiting|outreach|errand)\b/.test(task))
    return "walking";
  return task || running ? "typing" : "idle";
}

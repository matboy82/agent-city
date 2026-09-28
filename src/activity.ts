export type ActivityMode =
  | "typing"
  | "presenting"
  | "walking"
  | "reading"
  | "on_call"
  | "celebrating"
  | "idle";

// Keep pose resolution in one data-driven map so the client vocabulary is easy
// to extend alongside the heartbeat contract.
export const ACTIVITY_POSES: Record<string, ActivityMode> = {
  typing: "typing",
  presenting: "presenting",
  walking: "walking",
  reading: "reading",
  on_call: "on_call",
  celebrating: "celebrating",
  idle: "idle",
};

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
  const reported = ACTIVITY_POSES[agent.activity];
  if (reported && reported !== "idle") return reported;
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

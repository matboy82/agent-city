import "./style.css";
type Row = Record<string, any>;
const app = document.querySelector<HTMLDivElement>("#app")!;
let token = "",
  data: Row = {},
  view = localStorage.getItem("crew.view") || "city",
  selected = "",
  tab = "missions",
  dusk = localStorage.getItem("crew.dusk") === "true",
  flat = localStorage.getItem("crew.flat") === "true",
  reduced =
    localStorage.getItem("crew.motion") === "true" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;
const portraitUrls = new Map<string, string>();
const previewDesigns = new Map<string, Row>();
let navCollapsed = localStorage.getItem("crew.navCollapsed") === "true";
let activityFilter = localStorage.getItem("crew.activityFilter") || "all";
let expanded = false;
let world: {
    dispose: () => void;
    zoom: (direction: number) => void;
    reset: () => void;
  } | null = null,
  worldKey = "",
  renderVersion = 0,
  refreshTimer: ReturnType<typeof setInterval>;
const icons: Record<string, string> = {
  nav: "M3 5h18M3 12h18M3 19h18",
  city: "M3 21V9l6-3v15m0-9 6-4v13m0-17 6 3v14M1 21h22",
  hq: "M3 21V6l9-4 9 4v15M8 21v-7h8v7M7 8h2m6 0h2M7 11h2m6 0h2",
  crew: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 8",
  activity: "m3 12 4 0 3-8 4 16 3-8h4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  pause: "M8 5v14M16 5v14",
  search: "M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
};
const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.city}"/></svg>`;
const e = (v: any) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const label = (s: string) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const time = (v: string) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Denver",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(v))
    : "Never connected";
const badge = (v: string) =>
  `<span class="badge ${["active", "Connected", "done", "completed", "approved"].includes(v) ? "good" : ["failed", "blocked", "rejected", "expired"].includes(v) ? "bad" : ["waiting_approval", "waiting_on_matt", "queued", "Stale"].includes(v) ? "warn" : ""}"><i></i>${e(label(v))}</span>`;
const button = (text: string, action: string, extra = "", cls = "") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const avatar = (a: Row, size = "") =>
  a.avatar && !a.avatar.startsWith("/api")
    ? `<img class="avatar ${size}" src="${e(a.avatar)}" alt="${e(a.name)}'s supplied portrait">`
    : `<span class="avatar neutral ${size}" aria-label="${e(a.name)} — portrait not supplied">${e(a.name?.slice(0, 2).toUpperCase())}</span>`;
async function api(action: string, input: Row = {}) {
  const r = await fetch("/api/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, input }),
  });
  const value = await r.json();
  if (!r.ok) {
    if (r.status === 401 && token) {
      token = "";
      clearInterval(refreshTimer);
      void boot();
    }
    throw new Error(value.error || "Request failed");
  }
  return value;
}
function toast(message: string, error = false) {
  document.querySelector(".toast")?.remove();
  const div = document.createElement("div");
  div.className = "toast" + (error ? " error" : "");
  div.setAttribute("role", "status");
  div.textContent = message;
  document.body.append(div);
  setTimeout(() => div.remove(), 6000);
}
async function refresh() {
  data = await api("get_dashboard");
  for (const a of data.agents) {
    if (previewDesigns.has(a.id)) {
      a.effectiveDesign = previewDesigns.get(a.id);
      a.designSource = "Unsaved preview";
    }
    if (a.avatar?.startsWith("/api/")) {
      const key = a.id + ":" + (a.avatarUpdatedAt || "");
      let url = portraitUrls.get(key);
      if (!url) {
        const response = await fetch(a.avatar, {
          headers: { Authorization: "Bearer " + token },
        });
        if (response.ok) {
          url = URL.createObjectURL(await response.blob());
          portraitUrls.set(key, url);
        }
      }
      if (url) a.avatar = url;
    }
  }
}
function presentationKey(snapshot: Row) {
  return JSON.stringify(snapshot, (key, value) =>
    ["sequence", "lastSeen", "observedAt"].includes(key) ? undefined : value,
  );
}
function sceneKey() {
  if (flat) return "";
  if (view === "office") {
    const a = agent(selected);
    return JSON.stringify([
      view,
      selected,
      dusk,
      reduced,
      a?.connection,
      a?.activity,
      a?.currentTask,
      a?.name,
      a?.effectiveDesign,
      a?.designSource,
      a?.revision,
      data.work.filter((w: Row) => w.raci.responsible.includes(selected))
        .length,
    ]);
  }
  if (view === "city")
    return JSON.stringify([
      view,
      dusk,
      reduced,
      data.buildings,
      data.agents.map((a: Row) => [a.id, a.connection, a.operationalState]),
    ]);
  if (view === "hq")
    return JSON.stringify([
      view,
      dusk,
      reduced,
      data.work.length,
      data.approvals.filter((a: Row) => a.status === "waiting").length,
      data.handoffs.filter((h: Row) => h.status !== "completed").length,
      data.runs.filter((r: Row) => r.status === "running").length,
      data.messages.filter((m: Row) => m.scope === "team").length,
      data.commands.filter((c: Row) => c.status === "queued").length,
    ]);
  return "";
}
const pending = () =>
  (data.approvals || []).filter((a: Row) => a.status === "waiting");
const agent = (id: string) => data.agents?.find((a: Row) => a.id === id);
const empty = (title: string, text: string) =>
  `<div class="empty"><span class="empty-symbol">${icon("activity")}</span><h3>${title}</h3><p>${text}</p></div>`;
const heading = (
  kicker: string,
  title: string,
  description: string,
  actions = "",
) =>
  `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
function roster() {
  return data.agents
    .slice()
    .reverse()
    .map(
      (a: Row) =>
        `<button class="crew-row" data-action="office" data-id="${e(a.id)}">${avatar(a)}<span><strong>${e(a.name)}</strong><small>${e(a.role)}</small>${a.currentTask ? `<small class="task-preview">${e(a.currentTask.slice(0, 65))}</small>` : ""}</span><span class="crew-state">${badge(a.connection)}${a.connection === "Connected" ? badge(a.operationalState) : ""}<small>${a.lastSeen ? time(a.lastSeen) : "Awaiting first heartbeat"}</small></span></button>`,
    )
    .join("");
}
function reviewCards(limit = 100) {
  return (
    pending()
      .slice(0, limit)
      .map(
        (a: Row) =>
          `<article class="review-card"><div class="row"><span class="eyebrow">${e(a.kind)}</span>${badge("waiting_approval")}</div><h3>${e(a.title)}</h3><p>${e(a.context)}</p><small>${e(a.effect)}</small><div class="actions">${button("Review decision", "review", `data-id="${e(a.id)}"`, "primary")}</div></article>`,
      )
      .join("") ||
    empty(
      "You’re all clear",
      "Approvals and questions will appear here when your crew needs you.",
    )
  );
}
function timeline(events: Row[] = data.events) {
  return (
    events
      .slice(0, 25)
      .map(
        (ev: Row) =>
          `<div class="event"><span class="event-dot"></span><div><strong>${e(label(ev.type.replaceAll(".", " ")))}</strong><p>${e(ev.detail.summary || ev.detail.reason || data.work.find((w: Row) => w.id === (ev.detail.workId || ev.entity))?.title || data.commands.find((c: Row) => c.id === ev.entity)?.verb || data.messages.find((m: Row) => m.id === ev.entity)?.body?.slice(0, 120) || agent(ev.entity)?.name || ev.entity)}</p><small>${e(ev.actor)} · ${time(ev.at)}</small></div></div>`,
      )
      .join("") ||
    empty("A clean slate", "Verified work and agent updates will appear here.")
  );
}
const operationalFilters = [
  ["all", "Audit trail"],
  ["needs_owner", "Needs Matt"],
  ["failed", "Failed"],
  ["blocked", "Blocked"],
  ["disconnected", "Disconnected"],
  ["stale", "Stale"],
  ["active", "Active"],
];
function filteredActivity() {
  if (activityFilter === "needs_owner") return reviewCards();
  if (activityFilter === "failed")
    return data.commands.some((c: Row) => c.status === "failed" || c.status === "expired")
      ? commandRows(data.commands.filter((c: Row) => c.status === "failed" || c.status === "expired"))
      : empty("No failed commands", "There are no failed or expired commands.");
  if (activityFilter === "blocked" || activityFilter === "active") {
    const matching = data.work.filter((w: Row) => activityFilter === "blocked" ? w.status === "blocked" : ["claimed", "in_progress"].includes(w.status));
    return matching.map(workCard).join("") || empty("No matching missions", "Work in this state will appear here.");
  }
  const agents = data.agents.filter((a: Row) => a.connection.toLowerCase() === activityFilter.toLowerCase());
  return agents.map((a: Row) => `<button class="crew-row" data-action="office" data-id="${e(a.id)}">${avatar(a)}<strong>${e(a.name)}</strong>${badge(a.connection)}</button>`).join("") || empty("No matching agents", "Connection changes will appear here.");
}
function activityControls() {
  return `<div class="actions operational-filters">${operationalFilters.map(([id, title]) => button(title, "activity-filter", `data-filter="${id}" aria-pressed="${activityFilter === id}"`, activityFilter === id ? "primary" : "")).join("")}${button("Save this view", "save-view")}</div><div class="actions saved-views">${(data.savedViews || []).map((v: Row) => `${button(e(v.name), "activity-filter", `data-filter="${e(v.filter)}"`)}${button("×", "delete-view", `data-id="${e(v.id)}" aria-label="Delete saved view ${e(v.name)}"`)}`).join("")}</div>`;
}
function city() {
  return `${heading("YOUR OPERATING WORLD", "Good to see you, Matt.", "A place for your crew. A clear view of what comes next.", button(icon("plus") + " New mission", "new-mission", "", "primary"))}<div class="city-layout"><section class="world-card"><div class="world-title"><div><span class="eyebrow">BIS CAMPUS</span><h2>A world built around your work.</h2></div><span class="live-label"><i></i> LIVE STATE</span></div><div class="world-stage" id="world-stage"><canvas id="world" aria-label="Interactive BIS city. Equivalent building buttons below."></canvas><div class="world-loading" id="world-loading">Preparing your campus…</div></div><div class="world-tools">${button(icon("sun") + (dusk ? " Day" : " Dusk"), "dusk")}${button(flat ? "3D campus" : "2D view", "flat")}<span>Drag to orbit · Scroll to explore</span></div><div class="building-strip">${button("BIS HQ " + icon("arrow"), "nav", 'data-view="hq"', "hq-building")}${data.buildings.map((b: Row) => button(e(b.name), "building", `data-id="${e(b.id)}"`)).join("")}</div></section></div>`;
}
function morningBrief() {
  return `<aside class="brief"><div class="row"><span class="eyebrow">${new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "long", month: "short", day: "numeric" }).format(new Date())}</span>${button("↻", "sync", 'aria-label="Refresh morning brief"', "icon-button")}</div><h2>Morning Brief<span class="blue">.</span></h2><div class="brief-numbers"><div><strong>${data.agents.filter((a: Row) => a.connection === "Connected" && a.status === "active").length}</strong><small>active agents</small></div><div><strong>${pending().length}</strong><small>need you</small></div><div><strong>${data.queue.length}</strong><small>on the agenda</small></div></div><div class="section-title"><h3>Waiting on you</h3><span>${pending().length.toString().padStart(2, "0")}</span></div>${reviewCards(2)}<div class="section-title"><h3>Queued for today</h3>${button(icon("plus"), "add-queue", 'aria-label="Add queue item"', "icon-button")}</div><div class="queue-list">${
    data.queue
      .slice(0, 6)
      .map(
        (q: Row) =>
          `<div class="queue-row"><span class="queue-time">${e(q.timeLabel || "ANYTIME")}</span><span>${e(q.text)}${q.group ? `<small class="queue-group">${e(q.group)}${q.conflicts?.length ? " · Schedule conflict" : q.tightTransition ? " · Tight transition" : ""}</small>` : ""}</span>${q.category === "manual" ? button("×", "remove-queue", `data-id="${e(q.id)}" aria-label="Remove ${e(q.text)}"`, "icon-button") : ""}</div>`,
      )
      .join("") ||
    '<p class="muted compact">Room for something meaningful.<br>Add your first item to today’s queue.</p>'
  }</div><p class="sync-state">${data.sync ? "Last refresh: " + e(data.sync.status) + " · " + time(data.sync.startedAt) : "Sources not configured · no imported agenda"}</p></aside>`;
}
function goalsPanel() {
  return `<section class="panel goal-panel"><div class="section-title"><h2>The bigger picture</h2><span class="eyebrow">BIS GOALS</span></div>${data.goals.map((g: Row) => `<span class="eyebrow">${e(g.name)}</span><div class="goal-value">$${Number(g.current).toLocaleString()}<span> / $${Number(g.target).toLocaleString()}</span></div><progress value="${g.current}" max="${g.target}" aria-label="${e(g.name)}"></progress><p>${e(g.status)}</p>${button("Update verified progress " + icon("arrow"), "goal", `data-id="${e(g.id)}"`, "text-button")}`).join("")}<div class="goal-art"><span></span><span></span><span></span><span></span></div></section>`;
}
function focusedPage() {
  if (view === "brief")
    return `${heading("DAILY FOCUS", "Morning Brief", "Your crew, decisions and agenda in one place.")}<div class="focused-brief">${morningBrief()}</div><section class="panel spaced"><h2>While you were away</h2>${timeline(data.events.slice(0, 10))}</section>`;
  if (view === "goals")
    return `${heading("BIS GOALS", "The bigger picture", "Progress backed by verified results.")}${goalsPanel()}`;
  if (view === "reviews")
    return `${heading("NEEDS MATT", "Waiting on you", "Review decisions and evidence before work moves forward.")}<div class="mission-grid">${reviewCards()}</div>`;
  return `${heading("DAILY FOCUS", "Today's agenda", "Scheduled and manually queued work.")}<section class="panel">${button("Add queue item", "add-queue", "", "primary")}${data.queue.map((q: Row) => `<div class="queue-row"><span>${e(q.timeLabel || "ANYTIME")}</span><strong>${e(q.text)}</strong><small>${e(q.group || "")}</small>${q.category === "manual" ? button("Remove", "remove-queue", `data-id="${e(q.id)}"`) : ""}</div>`).join("") || empty("Nothing queued", "Add an item or refresh your connected sources.")}</section>`;
}
const zones = [
  ["missions", "Mission table"],
  ["dispatch", "Dispatch board"],
  ["ops", "Live ops"],
  ["handoffs", "Handoff bay"],
  ["team", "Collaboration"],
  ["review", "Review room"],
];
function workCard(w: Row) {
  return `<article class="mission-card"><div class="row"><span class="priority ${e(w.priority)}">${e(w.priority)} priority</span>${badge(w.status)}</div><button class="mission-title" data-action="mission" data-id="${e(w.id)}">${e(w.title)}</button><p>${e(w.brief)}</p><div class="mission-footer"><span>${w.raci.responsible.map((a: string) => e(agent(a)?.name || a)).join(", ")} <small>→ Matt accountable</small></span><span>rev ${w.revision}</span></div>${w.paused ? '<p class="warning">Paused · new dispatch blocked</p>' : ""}<div class="actions">${["planned", "ready", "blocked"].includes(w.status) ? button("Dispatch " + icon("arrow"), "dispatch", `data-id="${e(w.id)}"`, "primary small") : ""}${button("Inspect", "mission", `data-id="${e(w.id)}"`, "small")}${!["done", "canceled"].includes(w.status) ? button(w.paused ? "Resume" : "Pause", "work-control", `data-id="${e(w.id)}" data-operation="${w.paused ? "resume" : "pause"}"`, "small") : ""}</div></article>`;
}
function artifacts(rows: Row[]) {
  return (
    rows
      .map(
        (a) =>
          `<div class="artifact"><span class="artifact-icon">${icon("link")}</span><div><a href="${e(a.uri)}" target="_blank" rel="noopener noreferrer">${e(a.title)} ↗</a><small>${e(a.agentId)} · revision ${e(a.revision)} · ${time(a.createdAt)}</small></div></div>`,
      )
      .join("") || '<p class="muted">No delivered artifacts yet.</p>'
  );
}
function commandRows(rows: Row[]) {
  return (
    rows
      .slice(0, 20)
      .map(
        (c) =>
          `<div class="command-row"><div><strong>${e(c.verb)}</strong><small>${e(c.agentId)} · ${time(c.issuedAt)}</small></div>${badge(c.status)}</div>`,
      )
      .join("") || '<p class="muted">No commands issued.</p>'
  );
}
function messageCard(m: Row) {
  return `<article class="message"><div class="row"><strong>${e(m.author === "matt" ? "Matt" : m.author)}</strong>${badge(m.status)}</div><p>${e(m.body)}</p><small>${time(m.createdAt)} · ${e(m.scope)}</small>${m.reply ? `<blockquote><strong>${e(agent(m.agentId)?.name)}</strong><p>${e(m.reply)}</p></blockquote>` : ""}${m.scope === "private" ? button("Promote to mission thread", "promote", `data-id="${e(m.id)}"`, "text-button small") : ""}</article>`;
}
function hq() {
  let content = "";
  if (tab === "missions" || tab === "dispatch")
    content = `<div class="mission-grid">${data.work.map(workCard).join("") || empty("Your next mission starts here", "Create a mission, assign responsibility, and dispatch it to a connected agent.")}</div>`;
  if (tab === "review")
    content = `<div class="mission-grid">${reviewCards()}</div><h2 class="spaced">Delivered evidence</h2>${artifacts(data.artifacts)}`;
  if (tab === "ops")
    content = `<div class="lower-grid"><section class="panel"><h2>Runtime health</h2>${roster()}</section><section class="panel"><h2>Command delivery</h2>${commandRows(data.commands)}</section></div><section class="panel spaced">${timeline()}</section>`;
  if (tab === "handoffs")
    content =
      data.handoffs
        .map(
          (h: Row) =>
            `<article class="panel"><div class="row"><h3>${e(agent(h.from)?.name)} → ${e(agent(h.to)?.name)}</h3>${badge(h.status)}</div><p>${e(h.context)}</p>${h.status === "requested" ? button("Accept handoff", "handoff", `data-id="${e(h.id)}" data-accept="true"`, "primary") + button("Reject", "handoff", `data-id="${e(h.id)}" data-accept="false"`) : ""}</article>`,
        )
        .join("") ||
      empty(
        "No handoffs in flight",
        "Context and ownership transfer only after a destination acknowledgment.",
      );
  if (tab === "team")
    content = `<section class="panel"><h2>Mission conversations</h2>${
      data.messages
        .filter((m: Row) => m.scope === "team")
        .map(messageCard)
        .join("") ||
      empty(
        "A shared place to think",
        "Promote an office note into a mission thread explicitly.",
      )
    }</section>`;
  return `${heading("BIS HEADQUARTERS", "Move the team forward.", "Responsibility, execution, and evidence. All in one place.", button(icon("plus") + " New mission", "new-mission", "", "primary"))}${pending().length ? `<div class="attention-bar">${pending().length} decisions need your attention. ${button("Open review room →", "tab", 'data-tab="review"', "text-button")}</div>` : ""}<section class="world-card hq-world"><div class="world-title"><div><span class="eyebrow">THE SHARED FLOOR</span><h2>One team. Six ways to move work forward.</h2></div></div><div class="world-stage" id="world-stage"><canvas id="world" aria-label="BIS HQ zones; equivalent controls below"></canvas><div class="world-loading" id="world-loading">Preparing headquarters…</div></div></section><nav class="tabs" aria-label="HQ zones">${zones.map(([id, name]) => button(name, "tab", `data-tab="${id}" aria-current="${tab === id ? "page" : "false"}"`, tab === id ? "active" : "")).join("")}</nav>${content}`;
}
function office(details = false) {
  const a = agent(selected);
  if (!a) return empty("Agent not found", "Return to the city.");
  const work = data.work.filter((w: Row) =>
    [...w.raci.responsible, ...w.raci.consulted, ...w.raci.informed].includes(
      a.id,
    ),
  );
  return `${button("← Back to city", "nav", 'data-view="city"', "text-button back")}${heading(a.role, details ? `${e(a.name)} - details` : `${e(a.name)}’s office`, a.currentTask || "No task reported. This space is ready when they are.", (details ? button("Enter office", "office", `data-id="${e(a.id)}"`) : "") + button("Design office", "design", `data-id="${e(a.id)}"`) + button("Connection", "connect", `data-id="${e(a.id)}"`, "primary"))}<div class="office-layout ${details ? "detail-layout" : ""}">${details ? "" : `<section class="world-card office-world"><div class="world-title"><div class="row">${avatar(a)}<div><h2>${e(a.name)}</h2>${badge(a.connection)}</div></div><span class="eyebrow">${e(label(a.effectiveDesign.theme))}</span></div><div class="world-stage" id="world-stage"><canvas id="world" aria-label="Agent office; operational controls are below"></canvas><div id="world-loading" class="world-loading">Preparing office…</div></div><div class="world-tools">${button(icon("sun") + (dusk ? " Day" : " Dusk"), "dusk")}${button(flat ? "3D office" : "2D view", "flat")}<span>${e(a.designSource)} · revision ${a.revision}</span></div></section>`}<section class="panel conversation"><div class="section-title"><h2>Direct conversation</h2><span class="eyebrow">PRIVATE</span></div><p class="muted compact">A note is queued until the runtime confirms delivery.</p><div class="messages">${
    data.messages
      .filter((m: Row) => m.agentId === a.id && m.scope === "private")
      .reverse()
      .map(messageCard)
      .join("") ||
    empty(
      "Open a conversation",
      `Send ${e(a.name)} a note. Delivery state is tracked here.`,
    )
  }</div><form id="message-form"><label class="sr-only" for="message-body">Message ${e(a.name)}</label><textarea id="message-body" name="body" placeholder="What’s on your mind?" required maxlength="4000"></textarea><button class="primary" type="submit">Send note ${icon("arrow")}</button></form></section></div><div class="lower-grid"><section class="panel"><h2>Assigned work</h2>${work.map(workCard).join("") || '<p class="muted">No assigned missions.</p>'}</section><section class="panel"><h2>Runtime & boundaries</h2><dl><dt>Connection</dt><dd>${e(a.connection)}</dd><dt>Last heartbeat</dt><dd>${time(a.lastSeen)}</dd><dt>Runtime</dt><dd>${e(a.runtimeId || "Not paired")}</dd><dt>Sequence</dt><dd>${a.sequence >= 0 ? a.sequence : "—"}</dd><dt>Capabilities</dt><dd>${e(a.capabilities.join(", ") || "Not advertised")}</dd><dt>Data boundary</dt><dd>BIS only</dd></dl><h3>Evidence</h3>${artifacts(data.artifacts.filter((x: Row) => x.agentId === a.id))}</section></div>`;
}
function crew() {
  return `${heading("PEOPLE & RUNTIMES", "Meet your crew.", "Distinct identities. Shared direction. Honest connection states.", button("Register building", "building-new"))}<div class="crew-grid">${data.agents
    .slice()
    .reverse()
    .map(
      (a: Row) =>
        `<article class="agent-card"><div class="agent-portrait">${avatar(a, "large")}<span class="agent-number">${e(a.id.toUpperCase())}</span></div><div class="agent-info"><div class="row"><h2>${e(a.name)}</h2>${badge(a.connection)}</div><p>${e(a.role)}</p><div class="agent-task">${e(a.currentTask || "No task reported")}<small>${a.lastSeen ? "Last seen " + time(a.lastSeen) : "Never connected"}</small></div><div class="actions">${button("Enter office " + icon("arrow"), "office", `data-id="${e(a.id)}"`, "primary")}${button("Connect", "connect", `data-id="${e(a.id)}"`)}</div></div></article>`,
    )
    .join("")}</div>`;
}
function budgetPanel() {
  return `<section class="panel spaced"><div class="section-title"><h2>Resource budgets</h2>${button("Add budget", "budget-new", "", "primary")}</div><p class="muted">Usage is recorded from verified amounts, never guessed from agent activity. Reaching a hard limit blocks matching mission dispatch.</p><div class="budget-grid">${(data.budgets || []).map((b: Row) => {
    const used = Number(b.used || 0);
    const state = used >= b.hardLimit ? "Hard limit reached" : used >= b.softLimit ? "Soft limit reached" : "Within budget";
    return `<article class="budget-card"><div class="row"><strong>${e(b.name)}</strong>${badge(state)}</div><p>${e(label(b.scope))} · ${e(b.period)} · ${e(b.unit)}</p><strong>${used.toLocaleString()} / ${Number(b.hardLimit).toLocaleString()} ${e(b.unit)}</strong><progress value="${Math.min(used, b.hardLimit)}" max="${b.hardLimit}" aria-label="${e(b.name)} usage"></progress><small>Soft warning at ${Number(b.softLimit).toLocaleString()} · ${Math.max(0, b.hardLimit - used).toLocaleString()} remaining</small><div class="actions">${button("Record usage", "budget-usage", `data-id="${e(b.id)}"`)}${used ? "" : button("Delete", "budget-delete", `data-id="${e(b.id)}"`)}</div>${data.budgetEntries.filter((entry: Row) => entry.budgetId === b.id).slice(-3).reverse().map((entry: Row) => `<small>${time(entry.at)} · ${e(entry.note)} · ${Number(entry.amount).toLocaleString()} ${e(b.unit)}</small>`).join("")}</article>`;
  }).join("") || '<p class="muted">No resource budgets configured.</p>'}</div></section>`;
}
function settings() {
  return `${heading("WORKSPACE", "Make it yours.", "BIS · America/Denver · portable, persistent storage")}<div class="lower-grid"><section class="panel"><h2>Experience</h2><div class="setting"><span>Lighting<small>Bright day or a quieter dusk</small></span>${button(dusk ? "Dusk" : "Day", "dusk")}</div><div class="setting"><span>Graphics<small>All operational controls work in 2D</small></span>${button(flat ? "2D interface" : "3D world", "flat")}</div><div class="setting"><span>Reduced motion<small>Keep state. Reduce movement.</small></span>${button(reduced ? "On" : "Off", "motion")}</div><h2 class="spaced">Owner access</h2><p class="muted">Sessions expire after 12 hours. Your passphrase has no reset flow.</p>${button("Sign out", "logout")}</section><section class="panel"><h2>Morning synchronization</h2><p>Daily at 5:55 AM America/Denver. Source refresh runs on the server without an open browser.</p><p class="muted">Configure read-only Google Calendar and GitHub access on the server.</p>${button("Refresh now", "sync", "", "primary")}<pre>${e(JSON.stringify(data.sync || { status: "unconfigured" }, null, 2))}</pre></section></div><section class="panel spaced"><div class="section-title"><h2>Routines</h2>${button("Add routine", "routine")}</div>${data.routines.map((r: Row) => `<div class="queue-row"><strong>${e(r.title)}</strong><span>${e(r.time)} Denver · ${r.enabled ? "Enabled" : "Disabled"} · ${e(r.lastResult || "Not run")}</span>${button(r.enabled ? "Pause" : "Enable", "pause-routine", `data-id="${e(r.id)}"`)}</div>`).join("") || '<p class="muted">No recurring work. Routines create planned work for owner dispatch.</p>'}</section><section class="panel spaced"><h2>Assets & credits</h2><p>Furniture Kit and Space Kit by <a href="https://kenney.nl/assets" target="_blank" rel="noopener">Kenney</a> · CC0. Supplied Jeff and Relay portraits and prototype character assets preserved from the Crew OS experiment.</p><div class="credit-grid">${Object.values(
    data.catalog,
  )
    .map(
      (a: any) =>
        `<span>${e(a.label)}<small>${e(a.author)} · ${e(a.license)}</small></span>`,
    )
    .join("")}</div></section>${budgetPanel()}`;
}
function project() {
  const b = data.buildings.find((b: Row) => b.id === selected);
  if (!b) return empty("Project not found", "Return to the city.");
  const work = data.work.filter((w: Row) => b.goalId && w.goalId === b.goalId);
  return `${button("← Back to city", "nav", 'data-view="city"', "text-button")}${heading("PROJECT WORKSPACE", e(b.name), "Work and evidence linked by goal ID.", button("Add milestone", "milestone-new", `data-id="${e(b.id)}"`))}<section class="panel"><h2>Verified milestones</h2>${(b.milestones || []).map((m: Row) => `<div class="command-row"><div><strong>${e(m.title)}</strong><small>${m.closedAt ? time(m.closedAt) : "Open · no progress inferred"}</small></div>${m.status === "closed" ? badge("completed") : button("Verify completion", "milestone-close", `data-id="${e(b.id)}" data-milestone="${e(m.id)}"`)}</div>`).join("") || '<p class="muted">Add named milestones. Construction advances only when completion is verified.</p>'}</section><div class="mission-grid spaced">${work.map(workCard).join("") || empty("No linked work", "Create work linked to this project’s goal.")}</div><section class="panel spaced"><h2>Project evidence</h2>${artifacts(data.artifacts.filter((a: Row) => work.some((w: Row) => w.id === a.workId)))}</section>`;
}

async function render(preserveWorld = false) {
  const version = ++renderVersion;
  const nextWorldKey = sceneKey();
  const retainedStage =
    preserveWorld && world && nextWorldKey === worldKey
      ? document.querySelector<HTMLElement>(".world-stage")
      : null;
  retainedStage?.remove();
  if (!retainedStage) {
    world?.dispose();
    world = null;
    worldKey = "";
  }
  document.body.classList.toggle("dusk", dusk);
  document.body.classList.toggle("reduced", reduced);
  localStorage.setItem(
    "crew.view",
    ["office", "project", "agent"].includes(view) ? "city" : view,
  );
  document.body.classList.toggle("nav-collapsed", navCollapsed);
  if (!["city", "office", "hq"].includes(view)) await setExpanded(false, false);
  app.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#" data-action="nav" data-view="city"><span class="brand-mark">C<span>•</span></span><span>crew<span class="brand-light">os</span><small>BIS WORKSPACE</small></span></a><div class="sidebar-caption">WORKSPACE</div><nav aria-label="Main navigation">${[
    ["city", "The city"],
    ["hq", "BIS HQ"],
    ["crew", "Your crew"],
    ["activity", "Activity"],
  ]
    .map(([id, title]) =>
      button(
        icon(id) +
          `<span>${title}</span>` +
          (id === "hq" && pending().length ? `<b>${pending().length}</b>` : ""),
        "nav",
        `data-view="${id}" title="${title}" aria-label="${title}" aria-current="${view === id ? "page" : "false"}"`,
        view === id ? "nav-link active" : "nav-link",
      ),
    )
    .join(
      "",
    )}</nav><div class="focus-navigation"><div class="sidebar-caption">FOCUS</div><nav aria-label="Focus pages">${[
    ["brief", "Morning Brief"],
    ["agenda", "Today's agenda"],
    ["reviews", "Waiting on you"],
    ["goals", "Goals"],
  ]
    .map(([id, title]) =>
      button(
        icon(id === "goals" ? "activity" : id === "reviews" ? "pause" : "sun") +
          `<span>${title}</span>`,
        "nav",
        `data-view="${id}" title="${title}" aria-label="${title}" aria-current="${view === id ? "page" : "false"}"`,
        "nav-link" + (view === id ? " active" : ""),
      ),
    )
    .join(
      "",
    )}</nav></div><div class="sidebar-bottom"><div class="workspace-health"><span class="health-dot"></span><div>All work, one place.<small>${data.agents.filter((a: Row) => a.connection === "Connected").length} of ${data.agents.length} agents connected</small></div></div>${button(icon("settings") + "<span>Settings & credits</span>", "nav", 'data-view="settings" aria-label="Settings and credits" title="Settings and credits"', view === "settings" ? "nav-link active" : "nav-link")}<div class="owner"><span class="owner-avatar">M</span><div><strong>Matt</strong><small>Workspace owner</small></div>${button("↪", "logout", 'aria-label="Sign out"', "icon-button")}</div></div></aside><div class="main-shell"><header class="topbar">${button(icon("nav"), "toggle-nav", `aria-label="${navCollapsed ? "Expand" : "Collapse"} navigation" aria-expanded="${!navCollapsed}"`, "icon-button nav-toggle")}<div class="breadcrumb">BIS <span>/</span> ${e(view === "office" ? agent(selected)?.name : view === "hq" ? "Headquarters" : label(view))}</div><div class="topbar-right">${button(icon("settings"), "nav", 'data-view="settings" aria-label="Settings and credits"', "mobile-settings icon-button")}<span class="timezone">${new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" }).format(new Date())} <small>DENVER</small></span>${button(icon("pause") + (data.config.stopped ? " Dispatch stopped" : " Stop dispatch"), "stop", "", data.config.stopped ? "stop-button stopped" : "stop-button")}</div></header><main>${view === "city" ? city() : view === "hq" ? hq() : view === "office" ? office() : view === "agent" ? office(true) : ["brief", "agenda", "reviews", "goals"].includes(view) ? focusedPage() : view === "crew" ? crew() : view === "settings" ? settings() : view === "project" ? project() : heading("AUDIT TRAIL", "Every action has a history.", "Immutable records from the owner, agents, and scheduler.") + '<section class="panel"><label class="search-field">' + icon("search") + '<input id="event-search" placeholder="Search event, actor, or entity…" aria-label="Search activity"></label><div id="event-results">' + timeline() + "</div></section>"}</main><footer>BIS / CREW OS <span>Built for real work. Made to feel alive.</span><span>America/Denver</span></footer></div></div>`;
  if (retainedStage)
    document.querySelector(".world-stage")?.replaceWith(retainedStage);
  if (view === "activity") {
    const search = document.querySelector<HTMLElement>(".search-field");
    search?.insertAdjacentHTML("beforebegin", activityControls());
    if (search) search.hidden = activityFilter !== "all";
    if (activityFilter !== "all")
      document.querySelector<HTMLElement>("#event-results")!.innerHTML = filteredActivity();
  }
  const viewer = document.querySelector<HTMLElement>(".world-card");
  if (viewer) {
    viewer.classList.toggle("expanded-viewer", expanded);
    viewer.insertAdjacentHTML(
      "afterbegin",
      `<div class="viewer-controls">${view === "office" ? button("Agent details", "agent-detail", `data-id="${e(selected)}"`) : ""}${view !== "city" ? button("Return to city", "nav", 'data-view="city"') : ""}${button("&minus;", "zoom-out", 'aria-label="Zoom out"')}${button("+", "zoom-in", 'aria-label="Zoom in"')}${button("Reset view", "reset-camera")}${button(expanded ? "Exit full screen" : "Full screen", "fullscreen", `aria-pressed="${expanded}"`)}</div>`,
    );
  }
  focusViewer();
  if (retainedStage) return;
  if (view === "city" || view === "office" || view === "hq") {
    if (flat) {
      showFallback();
      return;
    }
    try {
      const { mountWorld } = await import("./world");
      if (version !== renderVersion) return;
      const mounted = await mountWorld(document.querySelector("#world")!, {
        data,
        agent: view === "office" ? agent(selected) : null,
        headquarters: view === "hq",
        dusk,
        reduced,
        onSelect: (id: string) => {
          if (id.startsWith("agent:")) {
            selected = id.slice(6);
            view = "agent";
          } else if (id.startsWith("project:")) {
            selected = id.slice(8);
            view = "project";
          } else if (id.startsWith("zone:")) {
            view = "hq";
            tab = id.slice(5);
          } else if (id === "hq") {
            view = "hq";
          } else {
            selected = id;
            view = "office";
          }
          void render();
        },
        onError: () => showFallback(),
      });
      if (version !== renderVersion) mounted.dispose();
      else {
        world = mounted;
        worldKey = nextWorldKey;
      }
    } catch {
      showFallback();
    }
  }
}
async function setExpanded(value: boolean, remount = true) {
  if (value && matchMedia("(max-width: 700px)").matches) window.scrollTo(0, 0);
  expanded = value;
  document.body.classList.toggle("viewer-open", value);
  const card = document.querySelector<HTMLElement>(".world-card");
  card?.classList.toggle("expanded-viewer", value);
  focusViewer();
  const control = card?.querySelector<HTMLElement>(
    '[data-action="fullscreen"]',
  );
  if (control) {
    control.textContent = value ? "Exit full screen" : "Full screen";
    control.setAttribute("aria-pressed", String(value));
  }
  if (
    value &&
    !matchMedia("(max-width: 700px)").matches &&
    !document.fullscreenElement
  ) {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* viewport expansion also works without the browser API */
    }
  } else if (!value && document.fullscreenElement)
    await document.exitFullscreen();
  if (remount && card) await render();
}
function focusViewer() {
  document
    .querySelectorAll<HTMLElement>("[data-viewer-inert]")
    .forEach((el) => {
      el.inert = false;
      delete el.dataset.viewerInert;
    });
  if (!expanded) return;
  let current: HTMLElement | null = document.querySelector(".world-card");
  while (current && current !== document.body) {
    for (const sibling of current.parentElement?.children || []) {
      if (
        sibling !== current &&
        sibling instanceof HTMLElement &&
        !sibling.inert
      ) {
        sibling.inert = true;
        sibling.dataset.viewerInert = "true";
      }
    }
    current = current.parentElement;
  }
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && expanded) void setExpanded(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && expanded) void setExpanded(false);
});
function showFallback() {
  const el = document.querySelector("#world-loading");
  if (el) {
    el.innerHTML = `<div class="fallback-campus"><span class="eyebrow">OPERATIONS AT A GLANCE</span><h2>${flat ? "A clearer perspective." : "3D unavailable. Your controls are ready."}</h2><div>${data.agents.map((a: Row) => `<button data-action="office" data-id="${e(a.id)}">${avatar(a)}<strong>${e(a.name)}</strong>${badge(a.connection)}</button>`).join("")}</div></div>`;
    el.classList.add("fallback");
  }
  document.querySelector("canvas")?.setAttribute("hidden", "");
}
function modal(title: string, body: string, submit?: string) {
  document.querySelector("dialog")?.remove();
  const d = document.createElement("dialog");
  d.innerHTML = `<div class="dialog-heading"><h2>${title}</h2>${button(icon("close"), "close", 'aria-label="Close dialog"', "icon-button")}</div><div class="dialog-body">${body}</div>${submit ? `<div class="dialog-footer"><button type="submit" form="dialog-form" class="primary">${submit}</button></div>` : ""}`;
  document.body.append(d);
  d.showModal();
  d.addEventListener("click", (ev) => {
    if (ev.target === d) d.close();
  });
  d.addEventListener("close", () => d.remove());
}
const input = (name: string, title: string, type = "text", value = "") =>
  `<label>${title}<input name="${name}" type="${type}" value="${e(value)}" required ${type === "password" ? 'minlength="16" maxlength="512" autocomplete="current-password"' : ""}></label>`;
const select = (
  name: string,
  title: string,
  options: [string, string][],
  value = "",
) =>
  `<label>${title}<select name="${name}">${options.map(([id, title]) => `<option value="${e(id)}" ${id === value ? "selected" : ""}>${e(title)}</option>`).join("")}</select></label>`;
function openForm(
  title: string,
  submit: string,
  html: string,
  handler: (f: FormData) => Promise<void>,
) {
  modal(
    title,
    `<form id="dialog-form">${html}<p class="form-error" role="alert"></p></form>`,
    submit,
  );
  document
    .querySelector("#dialog-form")!
    .addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target as HTMLFormElement);
      const btn = document.querySelector<HTMLButtonElement>(
        '[form="dialog-form"]',
      )!;
      btn.disabled = true;
      try {
        await handler(f);
        document.querySelector("dialog")?.close();
        await refresh();
        await render();
      } catch (err) {
        document.querySelector(".form-error")!.textContent = (
          err as Error
        ).message;
      } finally {
        btn.disabled = false;
      }
    });
}
async function act(action: string, b: Row = {}) {
  await api(action, b);
  if (
    [
      "save_office_design",
      "apply_office_preset",
      "clear_office_override",
      "reset_office_default",
    ].includes(action)
  )
    previewDesigns.delete(b.agentId);
  await refresh();
  await render();
}
document.addEventListener("click", async (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  );
  if (!target) return;
  ev.preventDefault();
  const { action, id, operation } = target.dataset;
  try {
    if (action === "close") {
      document.querySelector("dialog")?.close();
      return;
    }
    if (action === "fullscreen") {
      await setExpanded(!expanded);
      return;
    }
    if (action === "zoom-in" || action === "zoom-out") {
      world?.zoom(action === "zoom-in" ? -1 : 1);
      return;
    }
    if (action === "reset-camera") {
      world?.reset();
      return;
    }
    if (action === "toggle-nav") {
      navCollapsed = !navCollapsed;
      localStorage.setItem("crew.navCollapsed", String(navCollapsed));
      document.body.classList.toggle("nav-collapsed", navCollapsed);
      target.setAttribute(
        "aria-label",
        `${navCollapsed ? "Expand" : "Collapse"} navigation`,
      );
      target.setAttribute("aria-expanded", String(!navCollapsed));
      return;
    }
    if (action === "activity-filter") {
      activityFilter = target.dataset.filter || "all";
      localStorage.setItem("crew.activityFilter", activityFilter);
      await render();
      return;
    }
    if (action === "save-view") {
      openForm(
        "Save operational view", "Save view",
        input("name", "View name") + select("filter", "Filter", operationalFilters.slice(1) as [string, string][], activityFilter === "all" ? "needs_owner" : activityFilter),
        async (f) => { await api("save_operational_view", Object.fromEntries(f)); },
      );
      return;
    }
    if (action === "delete-view") {
      await act("delete_operational_view", { id });
      return;
    }
    if (action === "budget-new") {
      const targets: [string, string][] = [
        ["organization:bis", "BIS organization"],
        ...data.agents.map((a: Row) => [`agent:${a.id}`, `Agent · ${a.name}`] as [string, string]),
        ...data.work.map((w: Row) => [`mission:${w.id}`, `Mission · ${w.title}`] as [string, string]),
        ...data.routines.map((r: Row) => [`routine:${r.id}`, `Routine · ${r.title}`] as [string, string]),
      ];
      openForm("New resource budget", "Create budget",
        input("name", "Budget name") + select("target", "Applies to", targets) +
        select("unit", "Unit", [["USD", "USD"], ["tokens", "Model tokens"], ["minutes", "Minutes"], ["API calls", "API calls"]]) +
        select("period", "Period", [["monthly", "Monthly · Denver"], ["total", "Total"]]) +
        '<label>Soft warning<input name="softLimit" type="number" min="0" step="any" required></label><label>Hard limit<input name="hardLimit" type="number" min="0.01" step="any" required></label>',
        async (f) => {
          const [scope, scopeId] = String(f.get("target")).split(":");
          await api("save_budget", { name: f.get("name"), scope, scopeId, unit: f.get("unit"), period: f.get("period"), softLimit: Number(f.get("softLimit")), hardLimit: Number(f.get("hardLimit")) });
        });
      return;
    }
    if (action === "budget-usage") {
      openForm("Record verified usage", "Record usage",
        '<label>Amount<input name="amount" type="number" min="0.01" step="any" required></label>' + input("note", "Evidence or note"),
        async (f) => { await api("record_budget_usage", { budgetId: id, amount: Number(f.get("amount")), note: f.get("note"), idempotency_key: crypto.randomUUID() }); });
      return;
    }
    if (action === "budget-delete") {
      await act("delete_budget", { id });
      return;
    }
    if (action === "agent-detail") {
      selected = id!;
      view = "agent";
      await render();
      return;
    }
    if (action === "nav") {
      view = target.dataset.view!;
      await render();
      return;
    }
    if (action === "office") {
      selected = id!;
      view = "office";
      await render();
      return;
    }
    if (action === "building") {
      const b = data.buildings.find((b: Row) => b.id === id);
      selected = b.agentId || b.id;
      view = b.agentId ? "office" : "project";
      await render();
      return;
    }
    if (action === "tab") {
      tab = target.dataset.tab!;
      await render();
      return;
    }
    if (action === "dusk") {
      dusk = !dusk;
      localStorage.setItem("crew.dusk", String(dusk));
      await render();
      return;
    }
    if (action === "flat") {
      flat = !flat;
      localStorage.setItem("crew.flat", String(flat));
      await render();
      return;
    }
    if (action === "motion") {
      reduced = !reduced;
      localStorage.setItem("crew.motion", String(reduced));
      await render();
      return;
    }
    if (action === "logout") {
      await api("owner_logout");
      token = "";
      clearInterval(refreshTimer);
      world?.dispose();
      await boot();
      return;
    }
    if (action === "stop") {
      await act("global_stop", { stopped: !data.config.stopped });
      toast(
        data.config.stopped
          ? "New dispatch halted. Runtime stop acknowledgments appear in Live Ops."
          : "Dispatch queue reopened.",
      );
      return;
    }
    if (action === "sync") {
      target.setAttribute("disabled", "");
      const r = await api("refresh_morning_brief");
      await refresh();
      await render();
      toast(
        r.status === "unconfigured"
          ? "No sources configured. Set server connection settings."
          : `Refresh ${r.status}`,
        r.status === "failed",
      );
      return;
    }
    if (action === "new-mission") {
      openForm(
        "Create a mission",
        "Create mission",
        input("title", "Mission title") +
          '<label>Brief<textarea name="brief" required maxlength="2000" placeholder="The smallest context needed to do good work"></textarea></label>' +
          select(
            "goalId",
            "Goal",
            data.goals.map((g: Row) => [g.id, g.name]),
          ) +
          select(
            "responsible",
            "Responsible",
            data.agents.map((a: Row) => [a.id, a.name]),
          ) +
          '<div class="form-grid">' +
          select(
            "priority",
            "Priority",
            ["normal", "high", "urgent", "low"].map((v) => [v, label(v)]),
          ) +
          select(
            "action",
            "Action",
            ["read", "test", "draft", "send", "publish", "merge", "spend"].map(
              (v) => [v, label(v)],
            ),
          ) +
          "</div>" +
          input("capability", "Required capability", "text", "work.execute") +
          '<div class="form-grid">' +
          select("consulted", "Consulted", [
            ["", "None"],
            ...data.agents.map((a: Row) => [a.id, a.name]),
          ]) +
          select("informed", "Informed", [
            ["", "None"],
            ...data.agents.map((a: Row) => [a.id, a.name]),
          ]) +
          '</div><p class="muted">Matt is Accountable. BIS scope only. Privileged actions require approval.</p>',
        async (f) => {
          await api("create_work_item", {
            title: f.get("title"),
            brief: f.get("brief"),
            goalId: f.get("goalId"),
            priority: f.get("priority"),
            capability: f.get("capability"),
            action: f.get("action"),
            raci: {
              responsible: [f.get("responsible")],
              accountable: "matt",
              consulted: f.get("consulted") ? [f.get("consulted")] : [],
              informed: f.get("informed") ? [f.get("informed")] : [],
            },
          });
          view = "hq";
          tab = "missions";
        },
      );
      return;
    }
    if (action === "dispatch") {
      const w = data.work.find((w: Row) => w.id === id);
      await act("dispatch_work_item", {
        id,
        revision: w.revision,
        agentId: w.raci.responsible[0],
        idempotency_key: `dispatch:${w.id}:${w.revision}`,
      });
      toast("Command queued. Awaiting runtime acknowledgment.");
      return;
    }
    if (action === "work-control") {
      const w = data.work.find((w: Row) => w.id === id);
      await act("update_work_item_status", {
        id,
        revision: w.revision,
        operation,
      });
      document.querySelector("dialog")?.close();
      toast("Control recorded. Runtime acknowledgment is tracked separately.");
      return;
    }
    if (action === "mission") {
      const w = data.work.find((w: Row) => w.id === id);
      modal(
        e(w.title),
        `<p>${e(w.brief)}</p><div class="row">${badge(w.status)}<span>Revision ${w.revision}</span></div><h3>Responsibility</h3><dl>${Object.entries(
          w.raci,
        )
          .map(
            ([k, v]) =>
              `<dt>${label(k)}</dt><dd>${e(Array.isArray(v) ? v.map((a) => agent(a)?.name || a).join(", ") || "—" : v)}</dd>`,
          )
          .join("")}</dl><h3>Execution attempts</h3>${
          data.runs
            .filter((r: Row) => r.workId === id)
            .map(
              (r: Row) =>
                `<div class="command-row"><div>${e(r.agentId)}<small>Lease: ${time(r.leaseUntil)}</small></div>${badge(r.status)}</div>`,
            )
            .join("") || '<p class="muted">No run has been accepted.</p>'
        }<h3>Commands</h3>${commandRows(data.commands.filter((c: Row) => c.workId === id))}<h3>Evidence</h3>${artifacts(data.artifacts.filter((a: Row) => a.workId === id))}<h3>Cognition references</h3>${
          data.references
            .filter((r: Row) => r.workId === id)
            .map(
              (r: Row) =>
                `<p><a href="${e(r.uri)}" target="_blank" rel="noopener">${e(r.authority)} · ${e(r.recordType)}</a></p>`,
            )
            .join("") || '<p class="muted">No external references.</p>'
        }<div class="actions">${button("Edit mission", "edit-mission", `data-id="${e(id)}"`)}${button("Edit RACI", "raci", `data-id="${e(id)}"`)}${button("Link reference", "reference", `data-id="${e(id)}"`)}${w.status === "blocked" ? button("Retry", "work-control", `data-id="${e(id)}" data-operation="retry"`) : ""}${!["done", "canceled"].includes(w.status) ? button("Cancel mission", "work-control", `data-id="${e(id)}" data-operation="cancel"`, "danger") : ""}</div>`,
      );
      return;
    }
    if (action === "edit-mission") {
      const w = data.work.find((w: Row) => w.id === id);
      openForm(
        "Edit mission",
        "Save changes",
        input("title", "Title", "text", w.title) +
          '<label>Brief<textarea name="brief" required>' +
          e(w.brief) +
          "</textarea></label>" +
          select(
            "priority",
            "Priority",
            ["low", "normal", "high", "urgent"].map((v) => [v, label(v)]),
            w.priority,
          ),
        async (f) => {
          await api("edit_work_item", {
            id,
            revision: w.revision,
            ...Object.fromEntries(f),
          });
        },
      );
      return;
    }
    if (action === "pause-routine") {
      const r = data.routines.find((r: Row) => r.id === id);
      await act("pause_routine", { id, paused: r.enabled });
      return;
    }
    if (action === "raci") {
      const w = data.work.find((w: Row) => w.id === id);
      openForm(
        "Responsibility map",
        "Save RACI",
        ["responsible", "consulted", "informed"]
          .map(
            (role) =>
              `<fieldset><legend>${label(role)}</legend>${data.agents.map((a: Row) => `<label class="checkbox"><input type="checkbox" name="${role}" value="${e(a.id)}" ${w.raci[role].includes(a.id) ? "checked" : ""}>${e(a.name)}</label>`).join("")}</fieldset>`,
          )
          .join("") + "<p>Accountable: Matt</p>",
        async (f) => {
          await api("set_work_raci", {
            id,
            revision: w.revision,
            raci: {
              responsible: f.getAll("responsible"),
              consulted: f.getAll("consulted"),
              informed: f.getAll("informed"),
              accountable: "matt",
            },
          });
        },
      );
      return;
    }
    if (action === "reference") {
      openForm(
        "Link canonical context",
        "Link reference",
        input("uri", "Canonical URL", "url") +
          input("authority", "Authority", "text", "BIS Shared Cognition") +
          input("recordType", "Record type", "text", "document") +
          input("revision", "Revision", "text", "1"),
        async (f) => {
          await api("link_cognition_record", {
            workId: id,
            scope: "bis",
            ...Object.fromEntries(f),
          });
        },
      );
      return;
    }
    if (action === "review") {
      const a = data.approvals.find((a: Row) => a.id === id);
      openForm(
        "Review decision",
        "Record decision",
        `<h3>${e(a.title)}</h3><p>${e(a.context)}</p><p><strong>Effect:</strong> ${e(a.effect)}</p>${artifacts(data.artifacts.filter((r: Row) => r.workId === a.workId))}` +
          select("decision", "Decision", [
            ["approved", "Approve"],
            ["rejected", "Request revision / reject"],
          ]) +
          '<label>Durable decision note<textarea name="note" required maxlength="2000"></textarea></label>',
        async (f) => {
          await api("resolve_approval", {
            id,
            decision: f.get("decision"),
            note: f.get("note"),
          });
        },
      );
      return;
    }
    if (action === "handoff") {
      await act("accept_handoff", {
        id,
        accept: target.dataset.accept === "true",
      });
      return;
    }
    if (action === "add-queue") {
      openForm(
        "Add to today",
        "Add item",
        input("text", "Queue item"),
        async (f) => {
          await api("add_queue_item", { text: f.get("text") });
        },
      );
      return;
    }
    if (action === "remove-queue") {
      await act("remove_queue_item", { id });
      return;
    }
    if (action === "goal") {
      const g = data.goals.find((g: Row) => g.id === id);
      openForm(
        "Verified goal progress",
        "Update progress",
        input("current", "Current monthly revenue (USD)", "number", g.current) +
          input("evidence", "Evidence / source note"),
        async (f) => {
          await api("update_goal_progress", {
            id,
            current: Number(f.get("current")),
            evidence: f.get("evidence"),
          });
        },
      );
      return;
    }
    if (action === "connect") {
      const a = agent(id!);
      modal(
        `Connect ${e(a.name)}`,
        `<p>${e(a.connection)} · ${time(a.lastSeen)}</p><h3>Hermes / HTTPS adapter</h3><p>Generate a one-time code, then redeem it from the runtime. It expires after 10 minutes. Re-pairing immediately revokes the old credential.</p><code>${e(location.origin)}/api/actions</code><div class="actions">${button("Generate pairing code", "pair", `data-id="${e(id)}"`, "primary")}${button(a.paused ? "Resume assignments" : "Pause agent", "pause-agent", `data-id="${e(id)}"`)}${button("Revoke connection", "revoke", `data-id="${e(id)}"`, "danger")}</div><h3>Isolated Drive mailbox</h3><p class="muted">Use the server-side mailbox bridge described in adapters/README.md. Each agent needs its own private folder and server-side mapping; no credential belongs in a heartbeat file.</p>`,
      );
      return;
    }
    if (action === "pair") {
      const r = await api("create_pairing_code", { agentId: id });
      modal(
        "Pairing code",
        `<p>Give this code to ${e(agent(id!)?.name)} through your trusted runtime. Visible only here; expires ${time(r.expiresAt)}.</p><code class="pair-code">${e(r.code)}</code><p>Runtime command:</p><pre>npm run adapter -- pair ${e(location.origin)} ${e(id)} &lt;code&gt;</pre>`,
      );
      setTimeout(() => document.querySelector(".pair-code")?.remove(), 600000);
      return;
    }
    if (action === "pause-agent") {
      await act("pause_agent", { agentId: id, paused: !agent(id!)?.paused });
      document.querySelector("dialog")?.close();
      return;
    }
    if (action === "revoke") {
      await act("disconnect_agent", { agentId: id });
      document.querySelector("dialog")?.close();
      return;
    }
    if (action === "design") {
      openDesign(id!);
      return;
    }
    if (action === "promote") {
      openForm(
        "Promote private note",
        "Promote to team",
        select(
          "workId",
          "Mission",
          data.work.map((w: Row) => [w.id, w.title]),
        ) + "<p>This makes the note part of a shared mission thread.</p>",
        async (f) => {
          await api("promote_thread", { id, workId: f.get("workId") });
        },
      );
      return;
    }
    if (action === "building-new") {
      openForm(
        "Register a building",
        "Register",
        input("name", "Name") +
          select("kind", "Kind", [
            ["project_site", "Project site"],
            ["agent_hq", "Agent HQ"],
          ]) +
          input(
            "agentId",
            "New agent ID (used for agent HQ)",
            "text",
            "new-agent",
          ) +
          select(
            "style",
            "Architecture",
            ["command", "exchange", "tower", "lab", "studio", "workshop"].map(
              (v) => [v, label(v)],
            ),
          ) +
          select(
            "goalId",
            "Goal",
            data.goals.map((g: Row) => [g.id, g.name]),
          ),
        async (f) => {
          await api("register_building", Object.fromEntries(f));
        },
      );
      return;
    }
    if (action === "milestone-new") {
      const b = data.buildings.find((b: Row) => b.id === id);
      openForm(
        "Named milestone",
        "Add milestone",
        input("title", "Milestone title"),
        async (f) => {
          await api("add_milestone", {
            id,
            revision: b.revision || 0,
            title: f.get("title"),
          });
        },
      );
      return;
    }
    if (action === "milestone-close") {
      const b = data.buildings.find((b: Row) => b.id === id);
      openForm(
        "Verify milestone",
        "Record completion",
        input("evidence", "Evidence URL", "url") +
          input("note", "Verification note"),
        async (f) => {
          await api("close_milestone", {
            id,
            revision: b.revision || 0,
            milestoneId: target.dataset.milestone,
            ...Object.fromEntries(f),
          });
        },
      );
      return;
    }
    if (action === "routine") {
      openForm(
        "Daily routine",
        "Save routine",
        input("title", "Title") +
          input("brief", "Brief") +
          input("time", "Denver time", "time", "09:00") +
          select(
            "agentId",
            "Agent",
            data.agents.map((a: Row) => [a.id, a.name]),
          ) +
          select(
            "goalId",
            "Goal",
            data.goals.map((g: Row) => [g.id, g.name]),
          ),
        async (f) => {
          await api("save_routine", {
            ...Object.fromEntries(f),
            enabled: true,
          });
        },
      );
      return;
    }
  } catch (err) {
    toast((err as Error).message, true);
  }
});
function openDesign(id: string) {
  const a = agent(id)!;
  let draft = structuredClone(a.effectiveDesign);
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
  modal(
    "Design your office",
    `<p class="muted">${e(a.designSource)} · revision ${a.revision}. Preview changes before saving an owner override.</p><form id="design-form">${select(
      "theme",
      "Theme",
      Object.keys(data.themes).map((v) => [v, label(v)]),
      draft.theme,
    )}${select(
      "palette",
      "Palette",
      ["bis_blue", "graphite", "signal_green", "warm"].map((v) => [
        v,
        label(v),
      ]),
      draft.palette,
    )}<div class="form-grid">${slots
      .map((slot) =>
        select(
          slot,
          label(slot),
          [
            ["", "Theme fallback"],
            ...Object.values(data.catalog)
              .filter((v: any) => v.allowed_slots.includes(slot))
              .map((v: any) => [v.id, v.label] as [string, string]),
          ],
          draft.placements.find((p: Row) => p.slot === slot)?.asset_id || "",
        ),
      )
      .join(
        "",
      )}</div><h3>Saved office layouts</h3><p class="muted">Save this design once, then apply it to any office.</p><div class="form-grid"><label>Preset name<input id="preset-name" maxlength="80" placeholder="e.g. Blue studio"></label>${select("preset", "Saved layout", [["", "Choose a layout"], ...(data.officePresets || []).map((p: Row) => [p.id, p.name])])}</div><div class="actions"><button type="button" id="save-preset">Save layout</button><button type="button" id="load-preset">Load into editor</button><button type="button" id="apply-preset">Apply to this office</button><button type="button" id="delete-preset">Delete layout</button></div><div class="actions"><button type="button" id="preview-design">Preview</button><button class="primary" type="submit">Save override</button><button type="button" id="clear-design">Use agent design</button><button type="button" id="reset-design">Reset both designs</button></div><p id="design-status" role="status"></p><label>Upload supplied portrait<input id="portrait-upload" type="file" accept="image/png,image/jpeg"></label></form>`,
  );
  const f = document.querySelector<HTMLFormElement>("#design-form")!;
  const read = () => {
    const fd = new FormData(f);
    return {
      version: 1,
      theme: fd.get("theme"),
      palette: fd.get("palette"),
      placements: slots
        .filter((s) => fd.get(s))
        .map((s) => ({ slot: s, asset_id: fd.get(s) })),
    };
  };
  const handle = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      document.querySelector("#design-status")!.textContent = (
        err as Error
      ).message;
    }
  };
  const chosenPreset = () => {
    const presetId = (f.elements.namedItem("preset") as HTMLSelectElement).value;
    const preset = (data.officePresets || []).find((p: Row) => p.id === presetId);
    if (!preset) throw new Error("Choose a saved layout first");
    return preset;
  };
  document.querySelector("#save-preset")!.addEventListener("click", () => void handle(async () => {
    const name = (document.querySelector<HTMLInputElement>("#preset-name")!.value || "").trim();
    await api("save_office_preset", { name, design: read() });
    await refresh();
    openDesign(id);
    document.querySelector("#design-status")!.textContent = "Layout saved for every office.";
  }));
  document.querySelector("#load-preset")!.addEventListener("click", () => void handle(async () => {
    draft = structuredClone(chosenPreset().design);
    (f.elements.namedItem("theme") as HTMLSelectElement).value = draft.theme;
    (f.elements.namedItem("palette") as HTMLSelectElement).value = draft.palette;
    for (const slot of slots)
      (f.elements.namedItem(slot) as HTMLSelectElement).value =
        draft.placements.find((p: Row) => p.slot === slot)?.asset_id || "";
    document.querySelector("#design-status")!.textContent = "Layout loaded into the editor. Preview or save it when ready.";
  }));
  document.querySelector("#apply-preset")!.addEventListener("click", () => void handle(async () => {
    await act("apply_office_preset", { presetId: chosenPreset().id, agentId: id, revision: a.revision });
    document.querySelector("dialog")?.close();
  }));
  document.querySelector("#delete-preset")!.addEventListener("click", () => void handle(async () => {
    await api("delete_office_preset", { id: chosenPreset().id });
    await refresh();
    openDesign(id);
    document.querySelector("#design-status")!.textContent = "Saved layout deleted.";
  }));
  f.querySelector('[name="theme"]')!.addEventListener("change", () => {
    const theme = (f.elements.namedItem("theme") as HTMLSelectElement).value;
    draft = data.themes[theme];
    for (const slot of slots)
      (f.elements.namedItem(slot) as HTMLSelectElement).value =
        draft.placements.find((p: Row) => p.slot === slot)?.asset_id || "";
  });
  document.querySelector("#preview-design")!.addEventListener(
    "click",
    () =>
      void handle(async () => {
        const result = await api("preview_office_design", { design: read() });
        a.effectiveDesign = result.design;
        previewDesigns.set(id, result.design);
        document.querySelector("dialog")?.close();
        await render();
        toast(
          "Unsaved preview. Reopen Design office to save or refresh to discard.",
        );
      }),
  );
  f.addEventListener("submit", (ev) => {
    ev.preventDefault();
    void handle(async () => {
      await act("save_office_design", {
        agentId: id,
        revision: a.revision,
        design: read(),
      });
      document.querySelector("dialog")?.close();
    });
  });
  document.querySelector("#clear-design")!.addEventListener(
    "click",
    () =>
      void handle(async () => {
        await act("clear_office_override", {
          agentId: id,
          revision: a.revision,
        });
        document.querySelector("dialog")?.close();
      }),
  );
  document.querySelector("#reset-design")!.addEventListener("click", () => {
    if (confirm("Discard both the owner override and accepted agent design?"))
      void handle(async () => {
        await act("reset_office_default", {
          agentId: id,
          revision: a.revision,
          confirm: true,
        });
        document.querySelector("dialog")?.close();
      });
  });
  document.querySelector("#portrait-upload")!.addEventListener(
    "change",
    (ev) =>
      void handle(async () => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (file.size > 2000000) throw new Error("Portrait must be below 2 MB");
        const image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await api("set_agent_avatar", { agentId: id, image });
        document.querySelector("#design-status")!.textContent =
          "Portrait saved.";
      }),
  );
}
document.addEventListener("submit", (ev) => {
  if ((ev.target as HTMLElement).id !== "message-form") return;
  ev.preventDefault();
  const f = ev.target as HTMLFormElement;
  void act("send_agent_message", {
    agentId: selected,
    body: new FormData(f).get("body"),
  }).catch((err) => toast(err.message, true));
});
let searchTimeout: ReturnType<typeof setTimeout>;
document.addEventListener("input", (ev) => {
  if ((ev.target as HTMLElement).id === "event-search") {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const rows = await api("get_events", {
        search: (ev.target as HTMLInputElement).value,
      });
      const el = document.querySelector("#event-results");
      if (el) el.innerHTML = timeline(rows);
    }, 250);
  }
});
document.addEventListener("keydown", (ev) => {
  if (
    ev.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      (ev.target as HTMLElement).tagName,
    )
  ) {
    ev.preventDefault();
    view = "activity";
    void render().then(() =>
      document.querySelector<HTMLInputElement>("#event-search")?.focus(),
    );
  }
});
async function boot() {
  const status = await api("owner_access_status");
  app.innerHTML = `<div class="auth"><div class="auth-art"><div class="auth-brand">crew<span>os</span></div><div><span class="eyebrow">BIS WORKSPACE</span><h1>Great work.<br>Good company.</h1><p>Your crew, your missions, your world.<br>One place to bring it all together.</p></div><small>PRIVATE BY DESIGN. BUILT AROUND YOU.</small></div><div class="auth-panel"><div class="eyebrow">${status.configured ? "WELCOME BACK" : "A NEW CHAPTER"}</div><h2>${status.configured ? "Your world is waiting." : "Make yourself at home."}</h2><p>${status.configured ? "Sign in to your private BIS workspace." : "Choose an owner passphrase with at least 16 characters. There is no password reset flow."}</p><form id="auth-form">${input("passphrase", "Owner passphrase", "password")}${status.configured ? "" : input("confirm", "Confirm passphrase", "password")}<p class="form-error" role="alert"></p><button class="primary" type="submit">${status.configured ? "Enter workspace" : "Create workspace"} ${icon("arrow")}</button></form><small>LOCAL OR SERVER. THE SAME CREW OS.</small></div></div>`;
  document
    .querySelector("#auth-form")!
    .addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target as HTMLFormElement;
      const b = f.querySelector("button")!;
      b.disabled = true;
      try {
        const result = await api(
          status.configured ? "owner_login" : "owner_setup",
          Object.fromEntries(new FormData(f)),
        );
        token = result.token;
        await refresh();
        await render();
        refreshTimer = setInterval(async () => {
          if (document.hidden || document.querySelector("dialog")) return;
          try {
            const old = presentationKey(data);
            await refresh();
            if (
              presentationKey(data) !== old &&
              !["INPUT", "TEXTAREA", "SELECT"].includes(
                document.activeElement?.tagName || "",
              )
            )
              await render(true);
          } catch {}
        }, 15000);
      } catch (err) {
        f.querySelector(".form-error")!.textContent = (err as Error).message;
      } finally {
        b.disabled = false;
      }
    });
}
void boot().catch((err) => {
  app.textContent = "Unable to connect to Crew OS. " + err.message;
});

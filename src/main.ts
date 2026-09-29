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
const profilePortraits = new Set(["angela", "arthur", "calvin", "chad", "irene", "jefferson", "jev", "dave", "jonathan", "mark", "nerby", "opal", "proctor", "rachel", "sally", "steve", "ted", "triton", "video", "zack"]);
const previewDesigns = new Map<string, Row>();
const chatSelection = new Map<string, string>();
let navCollapsed = localStorage.getItem("crew.navCollapsed") === "true";
const mobileQuery = matchMedia("(max-width: 700px)");
let mobile = mobileQuery.matches;
if (mobile) navCollapsed = false;
let mode = localStorage.getItem("crew.mode") || (flat ? "2d" : "3d");
if (mobile) mode = "2d";
let chatAgent = "";
let activityFilter = localStorage.getItem("crew.activityFilter") || "all";
let briefDockOpen = localStorage.getItem("crew.briefDock") === "true";
let officeEditing = false;
let officePositionDraft: Record<string, number[]> = {};
let officeSelectedSlot = "primary_desk";
let cityEditing = false;
let citySelected = "";
let cityDraft: Row = {};
let hqEditing = false;
let hqSelectedZone = "missions";
let hqZoneDraft: Record<string, number[]> = {};
let expanded = false;
let world: {
    dispose: () => void;
    zoom: (direction: number) => void;
    reset: () => void;
    moveItem: (slot: string, offset: number[]) => void;
    moveCityItem: (key: string, position: number[]) => void;
    updateActivity: (agent: Row, runs: Row[]) => void;
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
// Tiny markdown renderer for agent-published briefs: headings, bold/italic,
// unordered lists, rules, paragraphs. Input is HTML-escaped first, so output is safe.
const md = (src: string) => {
  const lines = String(src ?? "").split("\n");
  let html = "", inList = false;
  const inline = (t: string) =>
    e(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  for (const line of lines) {
    const t = line.trim();
    const hashes = t.match(/^#+/);
    if (hashes && /^#+\s/.test(t)) {
      if (inList) { html += "</ul>"; inList = false; }
      const lv = Math.min(hashes[0].length + 2, 6);
      html += `<h${lv}>${inline(t.replace(/^#+\s*/, ""))}</h${lv}>`;
    } else if (/^---+$/.test(t)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<hr>";
    } else if (/^[-*]\s+/.test(t)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(t.replace(/^[-*]\s+/, ""))}</li>`;
    } else if (!t) {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${inline(t)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
};
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
const WORK_STALE_MS = 15 * 60 * 1000;
const ACTIVITY_LABELS: Record<string, string> = {
  typing: "Working at desk",
  presenting: "Presenting",
  walking: "Walking",
  reading: "Reading",
  on_call: "On a call",
  celebrating: "Celebrating",
  idle: "Idle",
};
function relativeTime(v: string) {
  const elapsed = Math.max(0, Date.now() - Date.parse(v));
  if (!Number.isFinite(elapsed)) return "time unavailable";
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  return `${Math.floor(elapsed / 86_400_000)} days ago`;
}
const badge = (v: string) =>
  `<span class="badge ${["active", "Connected", "done", "completed", "approved"].includes(v) ? "good" : ["failed", "blocked", "rejected", "expired"].includes(v) ? "bad" : ["waiting_approval", "waiting_on_matt", "queued", "Stale"].includes(v) ? "warn" : ""}"><i></i>${e(label(v))}</span>`;
const button = (text: string, action: string, extra = "", cls = "") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
declare const __CHARACTER_ASSET_VERSION__: string;
const avatar = (a: Row, size = "") =>
  (a.avatar && !a.avatar.startsWith("/api")) || profilePortraits.has(a.id)
    ? `<img class="avatar ${size}" loading="lazy" src="${e(a.avatar && !a.avatar.startsWith("/assets/") ? a.avatar : profilePortraits.has(a.id) ? `/assets/portraits/${a.id}.jpg?v=${__CHARACTER_ASSET_VERSION__}` : a.avatar)}" alt="${e(a.name)}'s portrait">`
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
  data.cityAssets = Array.isArray(data.cityAssets) ? data.cityAssets : [];
  data.hq ||= { id: "main", revision: 0, position: [0, 0, 0], model: "campus", zones: {} };
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
      a?.name,
      a?.effectiveDesign,
      a?.officePositions,
      a?.designSource,
      a?.revision,
      ACTIVITY_LABELS[a?.activity] || "Idle",
    ]);
  }
  if (view === "city")
    return JSON.stringify([
      view,
      dusk,
      reduced,
      data.buildings,
      data.cityAssets,
      data.hq,
      cityPreviewKey(),
      data.agents.map((a: Row) => [a.id, a.connection, a.operationalState]),
    ]);
  if (view === "hq")
    return JSON.stringify([
      view,
      dusk,
      reduced,
      data.hq,
      hqEditing ? hqZoneDraft : null,
      data.work.length,
      data.approvals.filter((a: Row) => a.status === "waiting").length,
      data.handoffs.filter((h: Row) => h.status !== "completed").length,
      data.runs.filter((r: Row) => r.status === "running").length,
      data.messages.filter((m: Row) => m.scope === "team").length,
      data.commands.filter((c: Row) => c.status === "queued").length,
      data.artifacts.map((a: Row) => [a.id, a.createdAt]),
      data.handoffs.map((h: Row) => [h.id, h.status]),
      data.agents.map((a: Row) => [a.id, a.connection, a.status, a.activity, a.currentTask]),
      data.runs.map((r: Row) => [r.id, r.agentId, r.status]),
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
          `<article class="review-card"><div class="row"><span class="eyebrow">${e(a.kind)}${a.tier ? ` · ${e(a.tier)}` : ""}${a.jevScore != null ? ` · Jev ${a.jevScore}/10` : a.jevScoring === "scoring" ? " · Jev scoring…" : ""}</span>${badge("waiting_approval")}</div><h3>${e(a.title)}</h3><p>${e(a.context)}</p>${a.artifact ? `<pre>${e(a.artifact)}</pre>` : ""}<small>${e(a.effect)}${a.requestedBy ? ` · ${e(agent(a.requestedBy)?.name || a.requestedBy)}` : ""}</small><div class="actions">${button("Review decision", "review", `data-id="${e(a.id)}"`, "primary")}</div></article>`,
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
    return data.commands.some(
      (c: Row) => c.status === "failed" || c.status === "expired",
    )
      ? commandRows(
          data.commands.filter(
            (c: Row) => c.status === "failed" || c.status === "expired",
          ),
        )
      : empty("No failed commands", "There are no failed or expired commands.");
  if (activityFilter === "blocked" || activityFilter === "active") {
    const matching = data.work.filter((w: Row) =>
      activityFilter === "blocked"
        ? w.status === "blocked"
        : ["claimed", "in_progress"].includes(w.status),
    );
    return (
      matching.map(workCard).join("") ||
      empty("No matching missions", "Work in this state will appear here.")
    );
  }
  const agents = data.agents.filter(
    (a: Row) => a.connection.toLowerCase() === activityFilter.toLowerCase(),
  );
  return (
    agents
      .map(
        (a: Row) =>
          `<button class="crew-row" data-action="office" data-id="${e(a.id)}">${avatar(a)}<strong>${e(a.name)}</strong>${badge(a.connection)}</button>`,
      )
      .join("") ||
    empty("No matching agents", "Connection changes will appear here.")
  );
}
function activityControls() {
  return `<div class="actions operational-filters">${operationalFilters.map(([id, title]) => button(title, "activity-filter", `data-filter="${id}" aria-pressed="${activityFilter === id}"`, activityFilter === id ? "primary" : "")).join("")}${button("Save this view", "save-view")}</div><div class="actions saved-views">${(data.savedViews || []).map((v: Row) => `${button(e(v.name), "activity-filter", `data-filter="${e(v.filter)}"`)}${button("×", "delete-view", `data-id="${e(v.id)}" aria-label="Delete saved view ${e(v.name)}"`)}`).join("")}</div>`;
}
function activity() {
  return `${heading("AUDIT TRAIL", "Every action has a history.", "Immutable records from the owner, agents, and scheduler.")}<section class="panel"><label class="search-field"><input id="event-search" placeholder="Search event, actor, or entity…" aria-label="Search activity"></label><div id="event-results">${timeline()}</div></section>`;
}
function city() {
  return `${heading("YOUR OPERATING WORLD", "Good to see you, Matt.", "A place for your crew. A clear view of what comes next.", button(icon("plus") + " New mission", "new-mission", "", "primary"))}<div class="city-layout ${cityEditing ? "editing-city" : ""}"><section class="world-card"><div class="world-title"><div><span class="eyebrow">BIS CAMPUS</span><h2>A world built around your work.</h2><div class="office-name-actions">${button(cityEditing ? "Stop editing city" : "Edit city", "toggle-city-edit", `aria-pressed="${cityEditing}"`)}</div></div><span class="live-label"><i></i> LIVE STATE</span></div><div class="world-stage" id="world-stage"><canvas id="world" aria-label="Interactive BIS city. Choose a building from the dropdown below."></canvas><div class="world-loading" id="world-loading">Preparing your campus…</div></div><div class="world-tools">${button(icon("sun") + (dusk ? " Day" : " Dusk"), "dusk")}${button(flat ? "3D campus" : "2D view", "flat")}<span>Drag to orbit · Scroll to explore</span></div><div class="building-strip"><label for="city-building-nav">Open a building</label><select id="city-building-nav" aria-label="Open a building"><option value="">Choose a building…</option><option value="hq">BIS HQ</option>${data.buildings.map((b: Row) => `<option value="building:${e(b.id)}">${e(b.name)}</option>`).join("")}</select></div></section>${cityEditing ? cityEditor() : ""}</div>`;
}
function briefDock() {
  return `<aside class="brief-dock" id="brief-dock" aria-label="Floating morning brief"><div class="brief-dock-handle" id="brief-dock-handle"><strong>Morning Brief</strong><span>Drag to move</span>${button("×", "toggle-brief-dock", 'aria-label="Close brief panel"')}</div><div class="brief-dock-body"><div class="brief-dock-stats"><span><strong>${pending().length}</strong> need you</span><span><strong>${data.queue.length}</strong> queued</span></div><h3>Waiting on you</h3>${reviewCards(1)}<h3>Next on the agenda</h3>${
    data.queue
      .slice(0, 3)
      .map(
        (q: Row) =>
          `<p class="brief-dock-item"><small>${e(q.timeLabel || "ANYTIME")}</small> ${e(q.text)}</p>`,
      )
      .join("") || '<p class="muted">Nothing queued.</p>'
  }${button("Open focused brief ?", "nav", 'data-view="brief"', "text-button")}</div></aside>`;
}
function daveBriefs() {
  const briefs: Record<string, Row> = data.morningBriefs || {};
  const kinds: [string, string][] = [["daily", "Daily brief"], ["crew", "Crew briefing"]];
  const rendered = kinds
    .map(([kind, labelText]) => {
      const b = briefs[kind];
      if (!b) return "";
      return `<details class="brief-published"${kind === "daily" ? " open" : ""}><summary><strong>${e(labelText)}</strong><span>${e(b.title)}</span><small>${time(b.createdAt)}</small></summary><div class="brief-body">${md(b.body)}</div></details>`;
    })
    .join("");
  return `<div class="section-title"><h3>Dave's brief</h3><span class="eyebrow">CHIEF OF STAFF</span></div>${
    rendered ||
    '<p class="muted">No brief published yet. Dave publishes the daily brief at 7:00 AM and the crew briefing Tue/Fri at 7:30 AM.</p>'
  }`;
}
function morningBrief() {
  return `<aside class="brief"><div class="row"><span class="eyebrow">${new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "long", month: "short", day: "numeric" }).format(new Date())}</span>${button("?", "sync", 'aria-label="Refresh morning brief"', "icon-button")}</div><h2>Morning Brief<span class="blue">.</span></h2><div class="brief-numbers"><div><strong>${data.agents.filter((a: Row) => a.connection === "Connected" && a.status === "active").length}</strong><small>active agents</small></div><div><strong>${pending().length}</strong><small>need you</small></div><div><strong>${data.queue.length}</strong><small>on the agenda</small></div></div>${daveBriefs()}<div class="section-title"><h3>Waiting on you</h3><span>${pending().length.toString().padStart(2, "0")}</span></div>${reviewCards(2)}<section class="receipt-brief"><h3>Recent run receipts</h3>${(data.receiptBrief?.receipts || []).slice(0, 3).map((r: Row) => `<p><strong>${e(r.title)}</strong> · ${r.notVerified?.length ? `${r.notVerified.length} checks not verified` : `${r.verified?.length || 0} checks verified`}</p>`).join("") || '<p class="muted">No completed runs have receipts yet.</p>'}<h3>Harness improvements for Dave</h3>${(data.receiptBrief?.openHarnessImprovements || []).slice(0, 3).map((w: Row) => `<p>${e(w.title)} · ${e(w.status)}</p>`).join("") || '<p class="muted">No open improvement tasks.</p>'}</section><div class="section-title"><h3>Queued for today</h3>${button(icon("plus"), "add-queue", 'aria-label="Add queue item"', "icon-button")}</div><div class="queue-list">${
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
    return `${heading("DAILY FOCUS", "Morning Brief", "Your crew, decisions and agenda in one place.")}<div class="focused-brief">${morningBrief()}</div><section class="panel spaced"><h2>While you were away</h2><div class="away-list" role="region" aria-label="Recent activity" tabindex="0">${timeline(data.events.slice(0, 10))}</div></section>`;
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
const buildingStyles: [string, string][] = [
  ["command", "Command hub · operations"],
  ["exchange", "Exchange · markets"],
  ["tower", "Signal tower · communications"],
  ["lab", "Research lab · analysis"],
  ["studio", "Creative studio · design"],
  ["workshop", "Build workshop · delivery"],
];
const buildingModels: [string, string][] = [
  ["campus", "Blue and white campus architecture"],
  ["hangar_a", "Open hangar pavilion"],
  ["hangar_b", "Deep hangar"],
  ["glass_atrium", "Round glass atrium"],
  ["detailed_hub", "Detailed operations hub"],
  ["skyscraper", "Glass skyscraper"],
  ["office_building", "Multi-story office building"],
  ["big_box", "Big-box campus building"],
  ["warehouse", "Warehouse and loading bays"],
];
const cityAssetModels: [string, string][] = [
  ["planter", "Campus planter"],
  ["small_tree", "Small tree"],
  ["satellite_dish", "Satellite dish"],
  ["rock_cluster", "Rock garden"],
  ["landing_pad", "Landing pad"],
];
function selectCity(key: string) {
  citySelected = key;
  const row = key === "hq" ? data.hq : key.startsWith("building:")
    ? data.buildings.find((b: Row) => b.id === key.slice(9))
    : data.cityAssets.find((a: Row) => a.id === key.slice(6));
  cityDraft = row
    ? key === "hq"
      ? { position: [...row.position], model: row.model || "campus" }
      : key.startsWith("building:")
      ? { position: [row.x, row.y || 0, row.z], model: row.model || "campus" }
      : { position: [...row.position], asset: row.asset }
    : {};
}
function cityPreviewKey() {
  if (!cityEditing || !citySelected) return "";
  const row = citySelected === "hq" ? data.hq : citySelected.startsWith("building:")
    ? data.buildings.find((b: Row) => b.id === citySelected.slice(9))
    : data.cityAssets.find((a: Row) => a.id === citySelected.slice(6));
  if (!row || !cityDraft.position) return "";
  const savedPosition = citySelected === "hq" || citySelected.startsWith("asset:")
    ? row.position
    : [row.x, row.y || 0, row.z];
  const savedModel = citySelected.startsWith("asset:") ? row.asset : row.model || "campus";
  const draftModel = citySelected.startsWith("asset:") ? cityDraft.asset : cityDraft.model;
  return draftModel !== savedModel || cityDraft.position.some((n: number, i: number) => n !== savedPosition[i])
    ? JSON.stringify([citySelected, draftModel, cityDraft.position])
    : "";
}
function switchCitySelection(key: string) {
  const hadUnsavedPreview = Boolean(cityPreviewKey());
  selectCity(key);
  void render(!hadUnsavedPreview);
}
function cityEditor() {
  const building = citySelected === "hq" || citySelected.startsWith("building:");
  const row = citySelected === "hq" ? data.hq : building
    ? data.buildings.find((b: Row) => b.id === citySelected.slice(9))
    : data.cityAssets.find((a: Row) => a.id === citySelected.slice(6));
  const options = [
    ["hq", "BIS HQ"],
    ...data.buildings.map((b: Row) => [`building:${b.id}`, b.name]),
    ...data.cityAssets.map((a: Row) => [
      `asset:${a.id}`,
      `${label(a.asset)} · ${a.id.slice(0, 6)}`,
    ]),
  ];
  return `<div class="position-editor city-editor"><div class="row"><strong>City editor</strong><small>Click a building or asset to select it</small></div><label>Selected item<select id="city-item">${options.map(([id, name]) => `<option value="${e(id)}" ${id === citySelected ? "selected" : ""}>${e(name)}</option>`).join("")}</select></label>${
    row
      ? `<label>${building ? "Building model" : "Asset model"}<select id="city-model">${(building ? buildingModels : cityAssetModels).map(([id, name]) => `<option value="${e(id)}" ${id === (building ? cityDraft.model : cityDraft.asset) ? "selected" : ""}>${e(name)}</option>`).join("")}</select></label><div class="position-values" id="city-values">Position: ${cityDraft.position.map((n: number) => n.toFixed(2)).join(" / ")} m</div><label>Step<select id="city-step"><option value="0.1">10 cm</option><option value="0.5" selected>50 cm</option><option value="1">1 m</option></select></label><div class="position-arrows">${[
          ["Left", 0, -1],
          ["Right", 0, 1],
          ["Down", 1, -1],
          ["Up", 1, 1],
          ["Back", 2, -1],
          ["Front", 2, 1],
        ]
          .map(([name, axis, direction]) =>
            button(
              String(name),
              "city-move",
              `data-axis="${axis}" data-direction="${direction}"`,
            ),
          )
          .join(
            "",
          )}</div><div class="actions">${button("Reset position", "city-reset")}${button("Save item", "city-save", "", "primary")}${building && citySelected !== "hq" ? button("Building details", "building-edit", `data-id="${e(row.id)}"`) : !building ? button("Remove asset", "city-remove") : ""}</div>`
      : ""
  }<div class="actions"><select id="city-add-model" aria-label="Asset to add">${cityAssetModels.map(([id, name]) => `<option value="${id}">${e(name)}</option>`).join("")}</select>${button("Add campus asset", "city-add", "", "primary")}</div><small>Model and position changes preview in the city. Save each item to keep it.</small></div>`;
}
function workCard(w: Row) {
  return `<article class="mission-card"><div class="row"><span class="priority ${e(w.priority)}">${e(w.priority)} priority</span>${badge(w.status)}</div><button class="mission-title" data-action="mission" data-id="${e(w.id)}">${e(w.title)}</button><p>${e(w.brief)}</p>${data.commands.find((c: Row) => c.workId === w.id && c.verb === "work.start") ? `<small>Dispatch: ${e(label(data.commands.find((c: Row) => c.workId === w.id && c.verb === "work.start").exitReason || data.commands.find((c: Row) => c.workId === w.id && c.verb === "work.start").status))} ? ${data.commands.find((c: Row) => c.workId === w.id && c.verb === "work.start").runtimeSeconds ?? 0}s</small>` : ""}${w.templateProgress ? `<ol>${w.templateProgress.map((step: Row) => `<li>${e(agent(step.agentId)?.name || step.agentId)} ? ${e(label(step.status))}</li>`).join("")}</ol>` : ""}<div class="mission-footer"><span>${w.raci.responsible.map((a: string) => e(agent(a)?.name || a)).join(", ")} <small>? Matt accountable</small></span><span>rev ${w.revision}</span></div>${w.paused ? '<p class="warning">Paused · new dispatch blocked</p>' : ""}<div class="actions">${["planned", "ready", "blocked"].includes(w.status) ? button("Dispatch " + icon("arrow"), "dispatch", `data-id="${e(w.id)}"`, "primary small") : ""}${button("Inspect", "mission", `data-id="${e(w.id)}"`, "small")}${!["done", "canceled"].includes(w.status) ? button(w.paused ? "Resume" : "Pause", "work-control", `data-id="${e(w.id)}" data-operation="${w.paused ? "resume" : "pause"}"`, "small") : ""}</div></article>`;
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
          `<div class="command-row"><div><strong>${e(c.verb)}</strong><small>${e(c.agentId)} · ${time(c.issuedAt)}${c.runtimeSeconds != null ? ` · Ran ${c.runtimeSeconds}s${c.budgetSeconds ? ` of ${c.budgetSeconds}s` : ""} — ${e(label(c.exitReason || c.status))}` : ""}${c.errorLines ? `<br>${e(c.errorLines)}` : ""}</small></div>${badge(c.status)}</div>`,
      )
      .join("") || '<p class="muted">No commands issued.</p>'
  );
}
function messageCard(m: Row) {
  return `<article class="message"><div class="row"><strong>${e(m.author === "matt" ? "Matt" : m.author)}</strong>${badge(m.status)}</div><p>${e(m.body)}</p><small>${time(m.createdAt)} · ${e(m.scope)}</small>${m.reply ? `<blockquote><strong>${e(agent(m.agentId)?.name)}</strong><p>${e(m.reply)}</p></blockquote>` : ""}${m.scope === "private" ? button("Promote to mission thread", "promote", `data-id="${e(m.id)}"`, "text-button small") : ""}</article>`;
}
function conversationId(agentId: string) {
  const saved = chatSelection.get(agentId);
  const conversations = (data.conversations || []).filter((c: Row) => c.agentId === agentId);
  return saved && (saved === "legacy" || conversations.some((c: Row) => c.id === saved))
    ? saved
    : conversations.sort((a: Row, b: Row) => b.createdAt.localeCompare(a.createdAt))[0]?.id || "legacy";
}
function chatMessages(agentId: string, conversation: string) {
  const rows = data.messages.filter((m: Row) => m.agentId === agentId && m.scope === "private" &&
    (conversation === "legacy" ? !m.conversationId : m.conversationId === conversation));
  rows.sort((a: Row, b: Row) => a.createdAt.localeCompare(b.createdAt));
  return rows.map((m: Row) => `<div class="chat-turn">${(() => {
    const mine = !m.author || m.author === "matt";
    if (!mine)
      return `<article class="chat-bubble theirs"><strong>${e(agent(agentId)?.name || m.author)}</strong><p>${e(m.body)}</p><small>${time(m.createdAt)} \u00b7 sent to you</small></article>`;
    return `<article class="chat-bubble mine"><strong>You</strong><p>${e(m.body)}</p><small>${time(m.createdAt)} \u00b7 ${e(label(m.status))}</small></article>${m.reply ? `<article class="chat-bubble theirs"><strong>${e(agent(agentId)?.name || agentId)}</strong><p>${e(m.reply)}</p><small>Reply received</small></article>` : ""}`;
  })()}</div>`).join("") || empty("Start a conversation", "Send a message to begin this session.");
}
function chatMarkup(agentId: string) {
  const conversation = conversationId(agentId);
  const conversations = (data.conversations || []).filter((c: Row) => c.agentId === agentId).sort((a: Row, b: Row) => b.createdAt.localeCompare(a.createdAt));
  const hasLegacy = data.messages.some((m: Row) => m.agentId === agentId && m.scope === "private" && !m.conversationId);
  const pending = data.messages.some((m: Row) => m.conversationId === conversation && ["queued", "delivered", "acknowledged"].includes(m.status));
  const active = agent(agentId)?.connection === "Connected";
  return `<div class="chat-header"><label>Session<select id="chat-session">${conversations.map((c: Row, index: number) => `<option value="${e(c.id)}" ${c.id === conversation ? "selected" : ""}>${index === 0 ? "Latest" : "Earlier"} · ${time(c.createdAt)}</option>`).join("")}${hasLegacy || !conversations.length ? `<option value="legacy" ${conversation === "legacy" ? "selected" : ""}>Earlier notes</option>` : ""}</select></label>${button("New session", "new-chat-session")}</div><div class="messages" id="chat-messages" role="log" aria-label="Conversation with ${e(agent(agentId)?.name)}">${chatMessages(agentId, conversation)}</div><div class="chat-presence" id="chat-presence" aria-live="polite">${pending ? `<span class="typing-dots"><i></i><i></i><i></i></span>${active ? agent(agentId)?.activity === "typing" ? "Typing a reply" : "Working on your reply" : "Waiting for agent connection"}` : active ? "Connected · ready to chat" : "Offline · messages queue until connected"}</div>`;
}
function conversationsPage() {
  const agents = data.agents.slice().reverse();
  const active = agent(chatAgent) || agents[0];
  if (!active) return empty("No agents yet", "Register a crew member to start a conversation.");
  const unread = (id: string) => data.messages.filter((m: Row) => m.agentId === id && m.scope === "private" && (m.reply || (m.author && m.author !== "matt" && m.status === "delivered"))).length;
  return `${heading("CREW MESSAGING", "Conversations", "Pick a teammate and continue a private conversation.")}<div class="inbox-layout"><nav class="inbox-agents" aria-label="Conversations">${agents.map((a: Row) => `<button class="inbox-agent ${a.id === active.id ? "active" : ""}" data-action="chat-agent" data-id="${e(a.id)}">${avatar(a)}<span><strong>${e(a.name)}</strong><small>${e(a.currentTask || a.role)}</small></span>${unread(a.id) ? `<b>${unread(a.id)}</b>` : ""}</button>`).join("")}</nav><section class="panel conversation inbox-thread"><div class="section-title"><div class="row">${avatar(active)}<div><h2>${e(active.name)}</h2><small>${e(active.role)} · ${e(active.connection)}</small></div></div><span class="eyebrow">PRIVATE</span></div><div id="chat-pane">${chatMarkup(active.id)}</div><form id="message-form"><label class="sr-only" for="message-body">Message ${e(active.name)}</label><textarea id="message-body" name="body" placeholder="Message ${e(active.name)}…" required maxlength="4000"></textarea><div class="chat-compose-actions"><small>Enter to send · Shift+Enter for a new line</small><button class="primary" type="submit">Send ${icon("arrow")}</button></div></form></section></div>`;
}
function announcementsPage() {
  const groups = new Map<string, Row[]>();
  for (const message of data.messages.filter((m: Row) => m.scope === "crew")) {
    const key = message.broadcastId || message.id;
    groups.set(key, [...(groups.get(key) || []), message]);
  }
  const broadcasts = [...groups.entries()].sort((a, b) => (b[1][0]?.createdAt || "").localeCompare(a[1][0]?.createdAt || ""));
  return `${heading("CREW MESSAGING", "Crew announcements", "Owner-sent notes delivered to every active crew member.")}<section class="panel announcement-compose"><h2>New announcement</h2><form id="broadcast-form"><label for="broadcast-title">Title <small>Optional</small></label><input id="broadcast-title" name="title" maxlength="120" placeholder="A short heading"><label for="broadcast-body">Announcement</label><textarea id="broadcast-body" name="body" maxlength="4000" required placeholder="Write an update for the crew…"></textarea><div class="chat-compose-actions"><small>Delivered individually with a receipt for each agent.</small><button class="primary" type="submit">Send to crew ${icon("arrow")}</button></div></form></section><section class="panel spaced"><div class="section-title"><h2>Announcement history</h2></div>${broadcasts.map(([, rows]) => {
    const first = rows[0];
    const delivered = rows.filter((m) => ["delivered", "acknowledged", "replied"].includes(m.status)).length;
    return `<article class="crew-announcement"><div class="section-title"><div><h3>${e(first.title || "Crew announcement")}</h3><small>${e(first.author === "matt" ? "Matt" : first.author)} · ${time(first.createdAt)}</small></div><span class="eyebrow">${delivered}/${rows.length} delivered</span></div><p>${e(first.body)}</p><details><summary>Delivery receipts (${rows.length})</summary><ul>${rows.map((m) => `<li><span>${e(agent(m.agentId)?.name || m.agentId)}</span>${badge(m.status)}</li>`).join("")}</ul></details></article>`;
  }).join("") || empty("No announcements yet", "Your crew-wide announcements will appear here with per-agent delivery receipts.")}</section>`;
}
function dashboard2d() {
  const running = data.runs.filter((r: Row) => r.status === "running").length;
  const connected = data.agents.filter((a: Row) => a.connection === "Connected").length;
  const waiting = pending();
  return `${heading("BIS WORKSPACE", "Your workspace.", "The latest from your crew and the work in motion.", button(icon("plus") + " New mission", "new-mission", "", "primary"))}${(data.usageAlerts || []).map((u: Row) => `<section class="panel spaced"><strong>Usage alert ? ${e(agent(u.agentId)?.name || u.agentId)}</strong><p>${u.today} dispatches today vs ${u.average.toFixed(1)} daily average over the prior week.</p></section>`).join("")}<div class="dashboard-stats"><button class="dashboard-stat" data-action="nav" data-view="crew"><small>CONNECTED CREW</small><strong>${connected}<span> / ${data.agents.length}</span></strong><em>${data.agents.length - connected} offline</em></button><button class="dashboard-stat" data-action="nav" data-view="reviews"><small>NEEDS YOUR REVIEW</small><strong>${waiting.length}</strong><em>${waiting.length ? "Decisions waiting" : "All clear"}</em></button><button class="dashboard-stat" data-action="nav" data-view="activity"><small>RUNNING NOW</small><strong>${running}</strong><em>${data.work.filter((w: Row) => !["done", "canceled"].includes(w.status)).length} open missions</em></button><button class="dashboard-stat" data-action="nav" data-view="agenda"><small>ON TODAY'S AGENDA</small><strong>${data.queue.length}</strong><em>Scheduled and queued</em></button></div><div class="dashboard-grid"><section class="panel"><div class="section-title"><h2>Waiting on you</h2>${button("See all", "nav", 'data-view="reviews"', "text-button")}</div>${reviewCards(3)}</section><section class="panel"><div class="section-title"><h2>Today's agenda</h2>${button("View agenda", "nav", 'data-view="agenda"', "text-button")}</div>${data.queue.slice(0, 5).map((q: Row) => `<div class="queue-row"><span class="queue-time">${e(q.timeLabel || "ANYTIME")}</span><span>${e(q.text)}${q.group ? `<small class="queue-group">${e(q.group)}</small>` : ""}</span></div>`).join("") || '<p class="muted">Nothing queued. Add an item to keep the day moving.</p>'}</section><section class="panel"><div class="section-title"><h2>Active crew</h2>${button("All crew", "nav", 'data-view="crew"', "text-button")}</div><div class="dashboard-crew">${data.agents.filter((a: Row) => a.connection === "Connected").slice(0, 6).map((a: Row) => `<button class="dashboard-person" data-action="chat-agent" data-id="${e(a.id)}">${avatar(a)}<span><strong>${e(a.name)}</strong><small>${e(a.currentTask || a.role)}</small></span>${badge(a.operationalState || a.connection)}</button>`).join("") || '<p class="muted">No agents connected right now.</p>'}</div></section><section class="panel"><div class="section-title"><h2>Recent activity</h2>${button("Open audit trail", "nav", 'data-view="activity"', "text-button")}</div><div class="dashboard-timeline">${timeline(data.events.slice(0, 5))}</div></section></div>`;
}
function updateChatPane(scroll = false) {
  if (view !== "office" && view !== "agent" && view !== "conversations") return;
  const recipient = view === "conversations" ? chatAgent : selected;
  const pane = document.querySelector<HTMLElement>("#chat-pane");
  if (!pane) return;
  const log = pane.querySelector<HTMLElement>("#chat-messages");
  const bottom = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 64;
  const previous = log?.scrollTop || 0;
  pane.innerHTML = chatMarkup(recipient);
  const next = pane.querySelector<HTMLElement>("#chat-messages");
  if (next) next.scrollTop = scroll || bottom ? next.scrollHeight : previous;
  const pending = data.messages.some((m: Row) => m.conversationId === conversationId(recipient) && ["queued", "delivered", "acknowledged"].includes(m.status));
  const send = document.querySelector<HTMLButtonElement>("#message-form button[type=submit]");
  if (send) send.disabled = pending;
}
function hqPositionEditor() {
  const offset = hqZoneDraft[hqSelectedZone] || [0, 0, 0];
  return `<div class="position-editor"><div class="row"><strong>HQ room editor</strong><small>Click a desk or choose a zone</small></div><label>Desk<select id="hq-zone-item">${zones.map(([id, name]) => `<option value="${id}" ${id === hqSelectedZone ? "selected" : ""}>${name}</option>`).join("")}</select></label><div class="position-values" id="hq-position-values">Offset: ${offset.map((v) => v.toFixed(2)).join(" / ")} m</div><label>Step<select id="hq-step"><option value="0.1">10 cm</option><option value="0.25" selected>25 cm</option><option value="0.5">50 cm</option></select></label><div class="position-arrows">${[["Left",0,-1],["Right",0,1],["Down",1,-1],["Up",1,1],["Back",2,-1],["Front",2,1]].map(([name,axis,direction]) => button(String(name), "hq-move", `data-axis="${axis}" data-direction="${direction}"`)).join("")}</div><div class="actions">${button("Reset desk", "hq-reset")}${button("Save room", "hq-save", "", "primary")}</div><small>Changes preview in the room. Save to keep them.</small></div>`;
}
function hq() {
  let content = "";
  if (tab === "missions" || tab === "dispatch")
    content = `<div class="mission-grid">${data.work.map(workCard).join("") || empty("Your next mission starts here", "Create a mission, assign responsibility, and dispatch it to a connected agent.")}</div>`;
  if (tab === "review")
    content = `<div class="mission-grid">${reviewCards()}</div><h2 class="spaced">Delivered evidence</h2>${artifacts(data.artifacts)}`;
  if (tab === "ops")
    content = `<div class="lower-grid"><section class="panel"><h2>Runtime health</h2>${roster()}</section><section class="panel"><h2>Command delivery</h2>${commandRows(data.commands)}</section></div><section class="panel spaced"><h2>Event log</h2><div class="hq-event-log" role="region" aria-label="HQ event log" tabindex="0">${timeline()}</div></section>`;
  if (tab === "handoffs")
    content =
      data.handoffs
        .map(
          (h: Row) =>
            `<article class="panel"><div class="row"><h3>${e(agent(h.from)?.name)} ? ${e(agent(h.to)?.name)}</h3>${badge(h.status)}</div><p>${e(h.context)}</p>${h.status === "requested" ? button("Accept handoff", "handoff", `data-id="${e(h.id)}" data-accept="true"`, "primary") + button("Reject", "handoff", `data-id="${e(h.id)}" data-accept="false"`) : ""}</article>`,
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
  return `${heading("BIS HEADQUARTERS", "Move the team forward.", "Responsibility, execution, and evidence. All in one place.", button(icon("plus") + " New mission", "new-mission", "", "primary"))}${pending().length ? `<div class="attention-bar">${pending().length} decisions need your attention. ${button("Open review room →", "tab", 'data-tab="review"', "text-button")}</div>` : ""}<section class="world-card hq-world"><div class="world-title"><div><span class="eyebrow">THE SHARED FLOOR</span><h2>One team. Six ways to move work forward.</h2><div class="office-name-actions">${button(hqEditing ? "Stop editing HQ" : "Edit HQ", "toggle-hq-edit", `aria-pressed="${hqEditing}"`)}</div></div></div><div class="world-stage" id="world-stage"><canvas id="world" aria-label="BIS HQ zones; equivalent controls below"></canvas><div class="world-loading" id="world-loading">Preparing headquarters…</div></div>${hqEditing ? hqPositionEditor() : ""}</section><nav class="tabs" aria-label="HQ zones">${zones.map(([id, name]) => button(name, "tab", `data-tab="${id}" aria-current="${tab === id ? "page" : "false"}"`, tab === id ? "active" : "")).join("")}</nav><section class="hq-zone-content" id="hq-zone-content" tabindex="-1"><div class="section-title"><h2>${e(zones.find(([id]) => id === tab)?.[1] || "HQ")}</h2><span class="eyebrow">HQ STATION</span></div>${content}</section>`;
}
function officePositionEditor(a: Row) {
  const placements = [
    ...data.themes[a.effectiveDesign.theme].placements,
    ...a.effectiveDesign.placements,
  ];
  const slots = [...new Set(placements.map((p: Row) => p.slot))];
  if (!slots.includes(officeSelectedSlot)) officeSelectedSlot = slots[0];
  const offset = officePositionDraft[officeSelectedSlot] || [0, 0, 0];
  return `<div class="position-editor"><div class="row"><strong>Position editor</strong><small>Click an item or choose it below</small></div><label>Item<select id="position-slot">${slots.map((slot: string) => `<option value="${e(slot)}" ${slot === officeSelectedSlot ? "selected" : ""}>${e(label(slot))}</option>`).join("")}</select></label><div class="position-values" id="position-values">Offset: ${offset.map((v: number) => v.toFixed(2)).join(" / ")} m</div><div class="position-step"><label>Step<select id="position-step"><option value="0.05">5 cm</option><option value="0.1" selected>10 cm</option><option value="0.25">25 cm</option></select></label></div><div class="position-arrows">${[
    ["Left", 0, -1],
    ["Right", 0, 1],
    ["Down", 1, -1],
    ["Up", 1, 1],
    ["Back", 2, -1],
    ["Front", 2, 1],
  ]
    .map(([name, axis, direction]) =>
      button(
        String(name),
        "office-move",
        `data-axis="${axis}" data-direction="${direction}"`,
      ),
    )
    .join(
      "",
    )}</div><div class="actions">${button("Reset item", "office-reset-item")}${button("Save positions", "office-save-positions", "", "primary")}</div><small>Changes preview immediately. Save to keep them.</small></div>`;
}
function office(details = false) {
  const a = agent(selected);
  if (!a) return empty("Agent not found", "Return to the city.");
  const work = data.work.filter((w: Row) =>
    [...w.raci.responsible, ...w.raci.consulted, ...w.raci.informed].includes(
      a.id,
    ),
  );
  const building = data.buildings.find((b: Row) => b.agentId === a.id);
  const heartbeatAt = a.observedAt || a.lastSeen;
  const stale = !heartbeatAt || Date.now() - Date.parse(heartbeatAt) > WORK_STALE_MS;
  const queue = Array.isArray(a.workQueue) ? a.workQueue.slice(0, 20) : [];
  const activity = Array.isArray(a.workActivity) ? a.workActivity.slice(0, 20) : [];
  const workDisplay = `<div class="crew-live-work ${stale ? "is-stale" : ""}" aria-label="${stale ? "Work data is stale" : "Live work data"}"><section class="panel live-work-panel"><div class="section-title"><h2>Assigned work</h2><span class="eyebrow">${stale ? "STALE" : "LIVE"}</span></div>${stale ? `<p class="work-updated">Last updated ${heartbeatAt ? e(relativeTime(heartbeatAt)) : "never"}</p>` : ""}<div class="current-task"><small>NOW WORKING ON</small><strong>${e(a.currentTask || "Idle — ready for the next assignment")}</strong></div><div class="work-list">${queue.map((item: Row) => `<article class="work-item"><strong>${e(item.text)}</strong>${item.detail ? `<p>${e(item.detail)}</p>` : ""}${item.time ? `<small>${e(time(item.time))}</small>` : ""}</article>`).join("") || '<p class="muted">No assigned work</p>'}</div></section><section class="panel live-activity-panel"><div class="section-title"><h2>Recent activity</h2></div>${activity.length ? `<ol class="live-activity-list">${activity.map((item: Row) => `<li><strong>${e(item.summary)}</strong>${item.time ? `<small>${e(time(item.time))}</small>` : ""}${item.detail ? `<details><summary>Details</summary><p>${e(item.detail)}</p></details>` : ""}</li>`).join("")}</ol>` : '<p class="muted">No recent activity</p>'}</section></div>`;
  return `${button("← Back to city", "nav", 'data-view="city"', "text-button back")}${heading(a.role, details ? `${e(a.name)} - details` : `${e(a.name)}’s office`, a.currentTask || "No task reported. This space is ready when they are.", (details ? button("Enter office", "office", `data-id="${e(a.id)}"`) : "") + button("Design office", "design", `data-id="${e(a.id)}"`) + (building ? button("Edit building", "building-edit", `data-id="${e(building.id)}"`) : "") + button("Connection", "connect", `data-id="${e(a.id)}"`, "primary"))}<div class="office-layout ${details ? "detail-layout" : ""}">${details ? "" : `<section class="world-card office-world ${officeEditing ? "office-editing" : ""}"><div class="world-title"><div class="row">${avatar(a)}<div><h2>${e(a.name)}</h2><small class="office-activity">${e(ACTIVITY_LABELS[a.activity] || "Idle")}</small><div class="office-name-actions">${button("? " + (officeEditing ? "Stop editing positions" : "Edit positions"), "toggle-office-edit", `aria-pressed="${officeEditing}"`)}</div>${badge(a.connection)}</div></div><span class="eyebrow">${e(label(a.effectiveDesign.theme))}</span></div><div class="world-stage" id="world-stage"><canvas id="world" aria-label="Agent office; operational controls are below"></canvas><div id="world-loading" class="world-loading">Preparing office…</div></div>${officeEditing ? officePositionEditor(a) : ""}<div class="world-tools">${button(icon("sun") + (dusk ? " Day" : " Dusk"), "dusk")}${button(flat ? "3D office" : "2D view", "flat")}<span>${e(a.designSource)} · revision ${a.revision}</span></div></section>`}<section class="panel conversation"><div class="section-title"><h2>Direct conversation</h2><span class="eyebrow">PRIVATE</span></div><div id="chat-pane">${chatMarkup(a.id)}</div><form id="message-form"><label class="sr-only" for="message-body">Message ${e(a.name)}</label><textarea id="message-body" name="body" placeholder="Message ${e(a.name)}…" required maxlength="4000"></textarea><div class="chat-compose-actions"><small>Enter to send · Shift+Enter for a new line</small><button class="primary" type="submit">Send message ${icon("arrow")}</button></div></form></section></div>${workDisplay}<div class="crew-office-bottom"><section class="panel"><h2>Assigned missions</h2>${work.map(workCard).join("") || '<p class="muted">No assigned missions.</p>'}</section><section class="panel runtime-boundaries"><h2>Runtime & boundaries</h2><dl><dt>Connection</dt><dd>${e(a.connection)}</dd><dt>Last heartbeat</dt><dd>${time(a.lastSeen)}</dd><dt>Runtime</dt><dd>${e(a.runtimeId || "Not paired")}</dd><dt>Sequence</dt><dd>${a.sequence >= 0 ? a.sequence : "—"}</dd><dt>Capabilities</dt><dd>${e(a.capabilities.join(", ") || "Not advertised")}</dd><dt>Data boundary</dt><dd>BIS only</dd></dl><h3>Evidence</h3>${artifacts(data.artifacts.filter((x: Row) => x.agentId === a.id))}</section></div>`;
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
  return `<section class="panel spaced"><div class="section-title"><h2>Resource budgets</h2>${button("Add budget", "budget-new", "", "primary")}</div><p class="muted">Usage is recorded from verified amounts, never guessed from agent activity. Reaching a hard limit blocks matching mission dispatch.</p><div class="budget-grid">${
    (data.budgets || [])
      .map((b: Row) => {
        const used = Number(b.used || 0);
        const state =
          used >= b.hardLimit
            ? "Hard limit reached"
            : used >= b.softLimit
              ? "Soft limit reached"
              : "Within budget";
        return `<article class="budget-card"><div class="row"><strong>${e(b.name)}</strong>${badge(state)}</div><p>${e(label(b.scope))} · ${e(b.period)} · ${e(b.unit)}</p><strong>${used.toLocaleString()} / ${Number(b.hardLimit).toLocaleString()} ${e(b.unit)}</strong><progress value="${Math.min(used, b.hardLimit)}" max="${b.hardLimit}" aria-label="${e(b.name)} usage"></progress><small>Soft warning at ${Number(b.softLimit).toLocaleString()} · ${Math.max(0, b.hardLimit - used).toLocaleString()} remaining</small><div class="actions">${button("Record usage", "budget-usage", `data-id="${e(b.id)}"`)}${used ? "" : button("Delete", "budget-delete", `data-id="${e(b.id)}"`)}</div>${data.budgetEntries
          .filter((entry: Row) => entry.budgetId === b.id)
          .slice(-3)
          .reverse()
          .map(
            (entry: Row) =>
              `<small>${time(entry.at)} · ${e(entry.note)} · ${Number(entry.amount).toLocaleString()} ${e(b.unit)}</small>`,
          )
          .join("")}</article>`;
      })
      .join("") || '<p class="muted">No resource budgets configured.</p>'
  }</div></section>`;
}
function usagePanel() {
  const rows = data.usage || [];
  return `<section class="panel spaced"><h2>Agent usage · last 30 days</h2><p class="muted">Runtime and dispatch counts come from completed Crew OS commands. Token totals are approximate when the runtime reports them.</p><div class="budget-grid">${rows.map((u: Row) => { const recent = u.days[0] || {}; const prior = u.days.slice(1, 8); const average = prior.reduce((n: number, d: Row) => n + d.dispatches, 0) / 7; const spike = average > 0 && recent.dispatches >= 3 * average; return `<article class="budget-card"><div class="row"><strong>${e(agent(u.agentId)?.name || u.agentId)}</strong>${spike ? badge("Usage spike") : ""}</div><p>Today: ${recent.dispatches || 0} dispatches · ${recent.runtimeSeconds || 0}s · ${recent.tokens || 0} approximate tokens</p><small>${u.days.reduce((n: number, d: Row) => n + d.budgetHits, 0)} budget hits in 30 days</small></article>`; }).join("")}</div></section>`;
}
function harnessPanel() {
  const h = data.harness || {}, a = h.analytics || {};
  return `<section class="panel spaced"><h2>Harness management</h2><p class="muted">${e(h.scheduleNote || "Denver 2–4 AM wall time is app-validated only; existing UTC gate unchanged.")}</p><p>Upgrade requests, capability approvals, per-profile pins, install audit, and L0 health records are shown from the application store.</p>${(h.upgrades || []).map((u: Row) => `<article class="budget-card"><strong>${e(u.version)}</strong> · ${e(u.status)} · approval ${e(u.approvalStatus)}<p>Canary: ${e(u.canary.agentId)} · ${e(u.canary.status)} · ${u.canary.completedDispatches} completed dispatches</p></article>`).join("") || '<p class="muted">No staged upgrades.</p>'}${(h.pins || []).map((p: Row) => `<p>${e(p.profileId)} · ${e(p.capability)} @ ${e(p.version)}</p>`).join("") || '<p class="muted">No profile pins recorded.</p>'}${(h.installs || []).map((i: Row) => `<p>${e(i.operation)} ${e(i.capability)} @ ${e(i.version)} for ${e(i.profileId)} · ${e(i.status)}</p>`).join("")}</section><section class="panel spaced"><h2>Jev decision ledger</h2>${!a.available ? '<p class="badge warn">Unavailable: the Crew OS store has no decision-ledger integration; metrics are intentionally not fabricated.</p>' : `<p>${a.total} scored judgments · agreement ${a.fleetAgreement === null ? "n/a" : Math.round(a.fleetAgreement * 100) + "%"}</p>${a.alerts.map((x: Row) => `<p class="badge warn">L0 ${e(x.type)} · ${e(x.agentId || "fleet")}</p>`).join("")}${a.byAgent.map((r: Row) => `<article class="budget-card"><strong>${e(agent(r.agentId)?.name || r.agentId)}</strong><p>Scored ${r.scored}; coverage ${r.coverage.denominatorAvailable ? `${r.coverage.scored}/${r.coverage.expected}` : "denominator unavailable"}; disagreements ${r.disagreementCount}; human labels ${r.labeledCount}; high severity misses ${r.highSeverityMisses}</p><p>Rolling 30d calibration: agent ${r.agentCalibration.accuracy ?? "n/a"} (n=${r.agentCalibration.sampleSize}), Jev ${r.jevCalibration.accuracy ?? "n/a"} (n=${r.jevCalibration.sampleSize}). Week ${r.periods.week.total}, day ${r.periods.day.total}; accumulation ${r.labeledToward10} toward 10 / ${r.labeledToward30to50} toward 30–50.</p>${r.escalationList.map((x: Row) => `<small>${e(x.recommendation)} / Jev ${e(x.jevRecommendation)} · ${x.resolved ? `Matt ${e(x.label)}` : "awaiting Matt label"}</small>`).join("<br>")}</article>`).join("")}`}</section><section class="panel spaced"><h2>Harness health · L0 briefing only</h2>${(h.healthChecks || []).slice(0, 1).map((x: Row) => `<p>${e(x.status)} · ${time(x.createdAt)} · no paging</p>`).join("") || '<p class="muted">No health result recorded.</p>'}</section>`;
}
function templatePanel() {
  return `<section class="panel spaced"><div class="section-title"><h2>Dispatch templates</h2>${button("Manage pause exemptions", "pause-exemptions")}${button("Add template", "template-new")}</div>${(data.templates || []).map((t: Row) => `<div class="command-row"><div><strong>${e(t.name)}</strong><small>${t.steps.map((s: Row) => e(s.agentId)).join(" → ")} · ${e(t.completionCriteria)}</small></div>${button("Run", "template-run", `data-id="${e(t.id)}"`, "primary")}</div>`).join("")}</section>`;
}
function settings() {
  return `${heading("WORKSPACE", "Make it yours.", "BIS · America/Denver · portable, persistent storage")}<div class="lower-grid"><section class="panel"><h2>Experience</h2><div class="setting"><span>Lighting<small>Bright day or a quieter dusk</small></span>${button(dusk ? "Dusk" : "Day", "dusk")}</div><div class="setting"><span>Graphics<small>All operational controls work in 2D</small></span>${button(flat ? "2D interface" : "3D world", "flat")}</div><div class="setting"><span>Reduced motion<small>Keep state. Reduce movement.</small></span>${button(reduced ? "On" : "Off", "motion")}</div><h2 class="spaced">Owner access</h2><p class="muted">Sessions expire after 12 hours. Your passphrase has no reset flow.</p>${button("Sign out", "logout")}</section><section class="panel"><h2>Morning synchronization</h2><p>Daily at 5:55 AM America/Denver. Source refresh runs on the server without an open browser.</p><p class="muted">Configure read-only Google Calendar and GitHub access on the server.</p>${button("Refresh now", "sync", "", "primary")}<pre>${e(JSON.stringify(data.sync || { status: "unconfigured" }, null, 2))}</pre></section></div><section class="panel spaced"><div class="section-title"><h2>Routines</h2>${button("Add routine", "routine")}</div>${data.routines.map((r: Row) => `<div class="queue-row"><strong>${e(r.title)}</strong><span>${e(r.time)} Denver · ${r.enabled ? "Enabled" : "Disabled"} · ${e(r.lastResult || "Not run")}</span>${button(r.enabled ? "Pause" : "Enable", "pause-routine", `data-id="${e(r.id)}"`)}</div>`).join("") || '<p class="muted">No recurring work. Routines create planned work for owner dispatch.</p>'}</section><section class="panel spaced"><h2>Assets & credits</h2><p>Furniture Kit and Space Kit by <a href="https://kenney.nl/assets" target="_blank" rel="noopener">Kenney</a> · CC0. Campus street lights, rooftop equipment and HQ console from <a href="https://quaternius.com/packs/cyberpunkgamekit.html" target="_blank" rel="noopener">Quaternius Cyberpunk Game Kit</a> · CC0. Jeff and Relay use supplied portraits and locally authored full-body models; Jefferson and Jev now have matching articulated character models and portraits.</p><div class="credit-grid">${Object.values(
    data.catalog,
  )
    .map(
      (a: any) =>
        `<span>${e(a.label)}<small>${e(a.author)} · ${e(a.license)}</small></span>`,
    )
    .join("")}</div></section>${budgetPanel()}${usagePanel()}${templatePanel()}`;
}
function project() {
  const b = data.buildings.find((b: Row) => b.id === selected);
  if (!b) return empty("Project not found", "Return to the city.");
  if (b.kind === "reserved_plot")
    return `${button("← Back to city", "nav", 'data-view="city"', "text-button back")}${heading("RESERVED PLOT", "Ready for next project.", "This campus plot keeps its place after a project retires.", button("Start a project here", "building-new", `data-id="${e(b.id)}"`, "primary"))}<section class="panel"><h2>Plot history</h2>${
      (b.projectHistory || [])
        .slice()
        .reverse()
        .map(
          (entry: Row) =>
            `<p>${e(entry.name)} · retired ${time(entry.retiredAt)}</p>`,
        )
        .join("") || '<p class="muted">No previous project on this plot.</p>'
    }</section>`;
  const work = data.work.filter((w: Row) => b.goalId && w.goalId === b.goalId);
  const lifecycle = b.lifecycle || "planning";
  const nextStates: Record<string, string[]> = {
    planning: ["building"],
    building: ["planning", "running"],
    running: ["building", "complete"],
    complete: ["running"],
  };
  const stateActions = (nextStates[lifecycle] || [])
    .map((state: string) =>
      button(
        state === "building"
          ? "Start construction"
          : state === "running"
            ? "Open for work"
            : state === "complete"
              ? "Mark complete"
              : "Return to planning",
        "project-state",
        `data-id="${e(b.id)}" data-state="${state}"`,
      ),
    )
    .join("");
  return `${button("← Back to city", "nav", 'data-view="city"', "text-button")}${heading("PROJECT WORKSPACE", e(b.name), "Work and evidence linked by goal ID.", button("Edit building", "building-edit", `data-id="${e(b.id)}"`) + button("Add milestone", "milestone-new", `data-id="${e(b.id)}"`))}<section class="panel lifecycle-panel"><div class="row"><h2>Building lifecycle</h2>${badge(lifecycle)}</div><p>Planning shows a prepared plot. Construction shows scaffolding. Running and complete show the finished ${e(label(b.style))} building.</p><div class="actions">${stateActions}${button("Retire project", "project-retire", `data-id="${e(b.id)}"`)}</div>${(
    b.lifecycleHistory || []
  )
    .slice(-4)
    .reverse()
    .map(
      (change: Row) =>
        `<small>${time(change.at)} · ${e(label(change.from))} → ${e(label(change.to))}: ${e(change.note)}</small>`,
    )
    .join(
      "",
    )}</section><section class="panel spaced"><h2>Verified milestones</h2>${(b.milestones || []).map((m: Row) => `<div class="command-row"><div><strong>${e(m.title)}</strong><small>${m.closedAt ? time(m.closedAt) : "Open · no progress inferred"}</small></div>${m.status === "closed" ? badge("completed") : button("Verify completion", "milestone-close", `data-id="${e(b.id)}" data-milestone="${e(m.id)}"`)}</div>`).join("") || '<p class="muted">Add named milestones. Lifecycle transitions are owner controlled.</p>'}</section><div class="mission-grid spaced">${work.map(workCard).join("") || empty("No linked work", "Create work linked to this project’s goal.")}</div><section class="panel spaced"><h2>Project evidence</h2>${artifacts(data.artifacts.filter((a: Row) => work.some((w: Row) => w.id === a.workId)))}</section>`;
}

async function render(preserveWorld = false) {
  const pageScrollY = window.scrollY;
  const elementScroll = Array.from(document.querySelectorAll<HTMLElement>("body *"))
    .filter((el) => {
      const style = getComputedStyle(el);
      return el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(style.overflowY) && (el.id || el.classList.length > 0);
    })
    .map((el) => {
      const selector = el.id ? `#${CSS.escape(el.id)}` : `.${Array.from(el.classList).map(name => CSS.escape(name)).join(".")}`;
      const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
      return { selector, index: matches.indexOf(el), top: el.scrollTop, left: el.scrollLeft };
    });
  mobile = mobileQuery.matches;
  if (mobile) {
    navCollapsed = false;
    mode = "2d";
    if (["city", "hq", "office", "project", "agent"].includes(view)) view = "dashboard";
  }
  if (view !== "office") officeEditing = false;
  if (view !== "city") cityEditing = false;
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
    ["office", "project", "agent"].includes(view) ? (mobile ? "dashboard" : "city") : view,
  );
  document.body.classList.toggle("nav-collapsed", !mobile && navCollapsed);
  const menuLabel = mobile ? (navCollapsed ? "Open menu" : "Close menu") : (navCollapsed ? "Expand navigation" : "Collapse navigation");
  if (!["city", "office", "hq"].includes(view)) await setExpanded(false, false);
  app.innerHTML = `<div class="shell ${mobile ? "mobile-workspace" : ""} ${mode === "2d" ? "two-d-mode" : "three-d-mode"}"><aside class="sidebar ${mobile ? (navCollapsed ? "menu-closed" : "menu-open") : ""}"><a class="brand" href="#" data-action="nav" data-view="${mobile || mode === "2d" ? "dashboard" : "city"}"><span class="brand-mark">C<span>•</span></span><span>crew<span class="brand-light">os</span><small>BIS WORKSPACE</small></span></a><div class="sidebar-caption">WORKSPACE</div><nav aria-label="Main navigation">${[
    ["dashboard", "Overview"],
    ["conversations", "Chat"],
    ["announcements", "Crew announcements"],
    ["crew", "Your crew"],
    ["activity", "Activity"],
    ["harness", "Harness & Jev"],
  ]
    .map(([id, title]) =>
      button(
        icon(id === "dashboard" ? "activity" : id === "conversations" ? "crew" : id) +
          `<span>${title}</span>` +
          (id === "reviews" && pending().length ? `<b>${pending().length}</b>` : ""),
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
    )}</nav></div><div class="sidebar-bottom"><div class="workspace-health"><span class="health-dot"></span><div>All work, one place.<small>${data.agents.filter((a: Row) => a.connection === "Connected").length} of ${data.agents.length} agents connected</small></div></div>${button(icon("settings") + "<span>Settings</span>", "nav", 'data-view="settings" aria-label="Settings and credits" title="Settings and credits"', view === "settings" ? "nav-link active" : "nav-link")}<div class="owner"><span class="owner-avatar">M</span><div><strong>Matt</strong><small>Workspace owner</small></div>${button("?", "logout", 'aria-label="Sign out"', "icon-button")}</div></div></aside><div class="main-shell"><header class="topbar">${button(icon("nav"), "toggle-nav", `aria-label="${menuLabel}" aria-expanded="${!navCollapsed}"`, "icon-button nav-toggle")}<div class="breadcrumb">BIS <span>/</span> ${e(view === "office" ? agent(selected)?.name : view === "hq" ? "Headquarters" : view === "dashboard" ? "Overview" : label(view))}</div><div class="topbar-right">${button(icon("settings"), "nav", 'data-view="settings" aria-label="Settings and credits"', "mobile-settings icon-button")}<span class="timezone">${new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" }).format(new Date())} <small>DENVER</small></span>${!mobile ? button(mode === "2d" ? "3D City" : "2D Workspace", "mode", "", "mode-toggle") : ""}${button(icon("pause") + (data.config.stopped ? " Dispatch stopped" : " Stop dispatch"), "stop", "", data.config.stopped ? "stop-button stopped" : "stop-button")}</div></header><main>${view === "harness" ? harnessPanel() : view === "dashboard" ? dashboard2d() : view === "conversations" ? conversationsPage() : view === "announcements" ? announcementsPage() : view === "city" ? city() : view === "hq" ? hq() : view === "office" ? office() : view === "agent" ? office(true) : ["brief", "agenda", "reviews", "goals"].includes(view) ? focusedPage() : view === "crew" ? crew() : view === "settings" ? settings() : view === "project" ? project() : view === "activity" ? activity() : heading("AUDIT TRAIL", "Every action has a history.", "Immutable records from the owner, agents, and scheduler.") + '<section class="panel"><label class="search-field">' + icon("search") + '<input id="event-search" placeholder="Search event, actor, or entity…" aria-label="Search activity"></label><div id="event-results">' + timeline() + "</div></section>"}</main><footer>BIS / CREW OS <span>Built for real work. Made to feel alive.</span><span>America/Denver</span></footer></div></div>`;
   if (retainedStage)
    document.querySelector(".world-stage")?.replaceWith(retainedStage);
  window.scrollTo(0, pageScrollY);
  for (const saved of elementScroll) {
    const el = document.querySelectorAll<HTMLElement>(saved.selector)[saved.index];
    if (el) {
      el.scrollTop = saved.top;
      el.scrollLeft = saved.left;
    }
  }
  if (["office", "agent", "conversations"].includes(view)) {
    const recipient = view === "conversations" ? chatAgent : selected;
    const a = agent(recipient);
    const header = document.querySelector("#chat-pane .chat-header");
    if (header && a && data.conversations.some((c: Row) => c.agentId === a.id && c.runtimeSessionId)) {
      header.insertAdjacentHTML("beforeend", button("Reset session", "reset-session", `data-id="${e(a.id)}"`));
      if (a.staleSession) header.insertAdjacentHTML("afterend", '<p class="badge warn">Session predates latest instructions — reset recommended</p>');
    }
  }
  if (view === "activity") {
    const search = document.querySelector<HTMLElement>(".search-field");
    search?.insertAdjacentHTML("beforebegin", activityControls());
    if (search) search.hidden = activityFilter !== "all";
    if (activityFilter !== "all")
      document.querySelector<HTMLElement>("#event-results")!.innerHTML =
        filteredActivity();
  }
  const viewer = document.querySelector<HTMLElement>(".world-card");
  if (viewer) {
    viewer.classList.toggle("expanded-viewer", expanded);
    viewer.insertAdjacentHTML(
      "afterbegin",
      `<div class="viewer-controls">${view === "office" ? button("Agent details", "agent-detail", `data-id="${e(selected)}"`) : ""}${view !== "city" ? button("Return to city", "nav", 'data-view="city"') : ""}${button("&minus;", "zoom-out", 'aria-label="Zoom out"')}${button("+", "zoom-in", 'aria-label="Zoom in"')}${button("Reset view", "reset-camera")}${button(expanded ? "Exit full screen" : "Full screen", "fullscreen", `aria-pressed="${expanded}"`)}</div>`,
    );
    if (view === "city") {
      viewer
        .querySelector(".viewer-controls")
        ?.insertAdjacentHTML(
          "afterbegin",
          button(
            briefDockOpen ? "Hide brief" : "Show brief",
            "toggle-brief-dock",
            `aria-pressed="${briefDockOpen}"`,
          ),
        );
      if (briefDockOpen) {
        viewer.insertAdjacentHTML("beforeend", briefDock());
        const dock = viewer.querySelector<HTMLElement>("#brief-dock")!;
        const saved = JSON.parse(
          localStorage.getItem("crew.briefDockPosition") || "null",
        );
        const place = (x: number, y: number) => {
          dock.style.left = `${Math.max(8, Math.min(x, viewer.clientWidth - dock.offsetWidth - 8))}px`;
          dock.style.top = `${Math.max(55, Math.min(y, viewer.clientHeight - dock.offsetHeight - 8))}px`;
        };
        place(
          Number.isFinite(saved?.x) ? saved.x : viewer.clientWidth - 340,
          Number.isFinite(saved?.y) ? saved.y : 100,
        );
        const handle = dock.querySelector<HTMLElement>("#brief-dock-handle")!;
        handle.addEventListener("pointerdown", (event) => {
          if (
            (event.target as HTMLElement).closest("button") ||
            innerWidth < 701
          )
            return;
          const originX = parseFloat(dock.style.left),
            originY = parseFloat(dock.style.top);
          const startX = event.clientX,
            startY = event.clientY;
          handle.setPointerCapture(event.pointerId);
          const move = (next: PointerEvent) =>
            place(
              originX + next.clientX - startX,
              originY + next.clientY - startY,
            );
          const finish = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", finish);
            localStorage.setItem(
              "crew.briefDockPosition",
              JSON.stringify({
                x: parseFloat(dock.style.left),
                y: parseFloat(dock.style.top),
              }),
            );
          };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", finish);
        });
      }
    }
  }
  document
    .querySelector<HTMLSelectElement>("#position-slot")
    ?.addEventListener("change", (event) => {
      officeSelectedSlot = (event.target as HTMLSelectElement).value;
      const offset = officePositionDraft[officeSelectedSlot] || [0, 0, 0];
      document.querySelector("#position-values")!.textContent =
        `Offset: ${offset.map((v) => v.toFixed(2)).join(" / ")} m`;
    });
  document
    .querySelector<HTMLSelectElement>("#city-item")
    ?.addEventListener("change", (event) => {
      switchCitySelection((event.target as HTMLSelectElement).value);
    });
  document
    .querySelector<HTMLSelectElement>("#city-building-nav")
    ?.addEventListener("change", (event) => {
      const destination = (event.target as HTMLSelectElement).value;
      if (!destination) return;
      if (destination === "hq") view = "hq";
      else {
        const building = data.buildings.find((b: Row) => b.id === destination.slice(9));
        if (!building) return;
        selected = building.agentId || building.id;
        view = building.agentId ? "office" : "project";
      }
      void render();
    });
  document
    .querySelector<HTMLSelectElement>("#city-model")
    ?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (citySelected === "hq" || citySelected.startsWith("building:")) cityDraft.model = value;
      else cityDraft.asset = value;
      void render();
    });
  document.querySelector<HTMLSelectElement>("#hq-zone-item")?.addEventListener("change", (event) => {
    hqSelectedZone = (event.target as HTMLSelectElement).value;
    const offset = hqZoneDraft[hqSelectedZone] || [0, 0, 0];
    document.querySelector("#hq-position-values")!.textContent = `Offset: ${offset.map((v) => v.toFixed(2)).join(" / ")} m`;
  });
  if (view === "office" || view === "agent" || view === "conversations") updateChatPane(true);
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
        data:
          view === "city" && cityEditing && citySelected === "hq"
            ? { ...data, hq: { ...data.hq, position: cityDraft.position, model: cityDraft.model } }
            : view === "hq" && hqEditing
            ? { ...data, hq: { ...data.hq, zones: hqZoneDraft } }
            : view === "city" && cityEditing && citySelected.startsWith("building:")
            ? {
                ...data,
                buildings: data.buildings.map((b: Row) =>
                  b.id === citySelected.slice(9)
                    ? {
                        ...b,
                        model: cityDraft.model,
                        x: cityDraft.position[0],
                        y: cityDraft.position[1],
                        z: cityDraft.position[2],
                      }
                    : b,
                ),
              }
            : view === "city" &&
                cityEditing &&
                citySelected.startsWith("asset:")
              ? {
                  ...data,
                  cityAssets: data.cityAssets.map((a: Row) =>
                    a.id === citySelected.slice(6)
                      ? {
                          ...a,
                          asset: cityDraft.asset,
                          position: cityDraft.position,
                        }
                      : a,
                  ),
                }
              : data,
        agent: view === "office" ? agent(selected) : null,
        headquarters: view === "hq",
        dusk,
        reduced,
        positionDraft: officeEditing ? officePositionDraft : undefined,
        onSelect: (id: string) => {
          if (cityEditing && view === "city") {
            if (id === "hq") {
              switchCitySelection("hq");
              return;
            }
            const building = data.buildings.find(
              (b: Row) => b.agentId === id || `project:${b.id}` === id,
            );
            if (building) switchCitySelection(`building:${building.id}`);
            else if (id.startsWith("cityasset:"))
              switchCitySelection(`asset:${id.slice(10)}`);
            else return;
            return;
          }
          if (id.startsWith("furniture:")) {
            if (officeEditing) {
              officeSelectedSlot = id.slice(10);
              const control =
                document.querySelector<HTMLSelectElement>("#position-slot");
              if (control) {
                control.value = officeSelectedSlot;
                control.dispatchEvent(new Event("change"));
              }
            }
            return;
          }
          if (officeEditing && id.startsWith("agent:")) return;
          if (id.startsWith("agent:")) {
            selected = id.slice(6);
            view = "agent";
          } else if (id.startsWith("project:")) {
            selected = id.slice(8);
            view = "project";
          } else if (id.startsWith("zone:")) {
            view = "hq";
            tab = id.slice(5);
            if (hqEditing) {
              hqSelectedZone = tab;
              void render(true);
              return;
            }
            void render(true);
            return;
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
    } catch (error) {
      console.error("World mount failed", error);
      showFallback();
    }
  }
}
async function setExpanded(value: boolean, remount = true) {
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
    if (view === "office") {
      const a = agent(selected);
      el.innerHTML = a
        ? `<div class="fallback-office"><span class="eyebrow">${flat ? "2D OFFICE" : "OFFICE VIEW"}</span><div class="fallback-office-identity">${avatar(a, "large")}<div><h2>${e(a.name)}'s office</h2><p>${e(a.role)}</p>${badge(a.connection)}</div></div><div class="fallback-office-work"><small>CURRENT WORK</small><strong>${e(a.currentTask || "Ready for the next assignment")}</strong><span>${e(label(a.effectiveDesign.theme))} · ${e(a.designSource)} design</span></div>${button("View agent details " + icon("arrow"), "agent-detail", `data-id="${e(a.id)}"`, "primary")}</div>`
        : "";
    } else if (view === "hq") {
      el.innerHTML = `<div class="fallback-office"><span class="eyebrow">BIS HEADQUARTERS</span><h2>Headquarters in 2D</h2><p>Choose a room or desk below to inspect live operations.</p></div>`;
    } else {
      el.innerHTML = `<div class="fallback-campus"><span class="eyebrow">OPERATIONS AT A GLANCE</span><h2>${flat ? "A clearer perspective." : "3D unavailable. Your controls are ready."}</h2><div>${data.agents.map((a: Row) => `<button data-action="office" data-id="${e(a.id)}">${avatar(a)}<strong>${e(a.name)}</strong>${badge(a.connection)}</button>`).join("")}</div></div>`;
    }
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
    if (action === "new-chat-session") {
      const recipient = view === "conversations" ? chatAgent : selected;
      const result = await api("start_agent_conversation", { agentId: recipient });
      chatSelection.set(recipient, result.id);
      await refresh();
      updateChatPane(true);
      document.querySelector<HTMLTextAreaElement>("#message-body")?.focus();
      return;
    }
    if (action === "template-run") {
      const t = (data.templates || []).find((x: Row) => x.id === id);
      if (!t) throw new Error("Template not found");
      openForm(`Run ${t.name}`, "Create workflow", input("title", "Task title") + `<label>Task brief<textarea name="brief" required maxlength="2000"></textarea></label>` + select("goalId", "Goal", data.goals.map((g: Row) => [g.id, g.name])) + select("agentId", "First step agent", t.steps.map((s: Row) => [s.agentId, agent(s.agentId)?.name || s.agentId])), async f => { await api("run_template", { templateId: id, ...Object.fromEntries(f) }); await refresh(); await render(); });
      return;
    }
    if (action === "template-new") {
      openForm("New dispatch template", "Save template", input("id", "Template ID") + input("name", "Name") + '<label>Steps JSON<textarea name="steps" required>[{"agentId":"dave","handoff":"Deliver the result for the next step"}]</textarea></label>' + input("completionCriteria", "Completion criteria") + input("maxLoops", "Maximum loops", "number"), async f => { let steps; try { steps = JSON.parse(String(f.get("steps"))); } catch { throw new Error("Steps must be valid JSON"); } await api("save_template", { id: f.get("id"), name: f.get("name"), steps, completionCriteria:f.get("completionCriteria"), maxLoops:Number(f.get("maxLoops") || 1) }); await refresh(); await render(); });
      return;
    }
    if (action === "reset-session") {
      const a = agent(id || selected);
      if (!a || !confirm(`Reset ${a.name}'s session? This ends the agent's current conversation context. Unsaved in-progress work in that session is lost.`)) return;
      await api("reset_agent_session", { agentId: a.id });
      await refresh();
      await render();
      toast("Agent session reset. The next message starts fresh.");
      return;
    }
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
      document.body.classList.toggle("nav-collapsed", !mobile && navCollapsed);
  const menuLabel = mobile ? (navCollapsed ? "Open menu" : "Close menu") : (navCollapsed ? "Expand navigation" : "Collapse navigation");
      if (mobile) document.querySelector(".mobile-workspace .sidebar")?.classList.toggle("menu-closed", navCollapsed);
      target.setAttribute(
        "aria-label",
        `${mobile ? (navCollapsed ? "Open menu" : "Close menu") : (navCollapsed ? "Expand navigation" : "Collapse navigation")}`,
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
    if (action === "toggle-brief-dock") {
      briefDockOpen = !briefDockOpen;
      localStorage.setItem("crew.briefDock", String(briefDockOpen));
      await render(true);
      return;
    }
    if (action === "toggle-office-edit") {
      officeEditing = !officeEditing;
      if (officeEditing) {
        officePositionDraft = structuredClone(
          agent(selected)?.officePositions || {},
        );
        officeSelectedSlot = "primary_desk";
        await render(true);
      } else await render();
      return;
    }
    if (action === "toggle-city-edit") {
      cityEditing = !cityEditing;
      if (cityEditing) selectCity("hq");
      await render(true);
      return;
    }
    if (action === "toggle-hq-edit") {
      hqEditing = !hqEditing;
      if (hqEditing) hqZoneDraft = structuredClone(data.hq.zones || {});
      await render(true);
      return;
    }
    if (action === "hq-move" || action === "hq-reset") {
      const offset = action === "hq-reset" ? [0, 0, 0] : [...(hqZoneDraft[hqSelectedZone] || [0, 0, 0])];
      if (action === "hq-move") {
        const axis = Number(target.dataset.axis);
        const limits = [1, 1, 0.7];
        const step = Number(document.querySelector<HTMLSelectElement>("#hq-step")?.value || 0.25);
        offset[axis] = Math.max(axis === 1 ? -0.5 : -limits[axis], Math.min(limits[axis], Math.round((offset[axis] + Number(target.dataset.direction) * step) * 100) / 100));
      }
      hqZoneDraft[hqSelectedZone] = offset;
      await render();
      return;
    }
    if (action === "hq-save") {
      await api("save_hq", { revision: data.hq.revision, zones: hqZoneDraft });
      await refresh();
      hqZoneDraft = structuredClone(data.hq.zones || {});
      await render();
      toast("HQ room saved.");
      return;
    }
    if (action === "city-move" || action === "city-reset") {
      if (!citySelected) return;
      const row = citySelected === "hq" ? data.hq : citySelected.startsWith("building:")
        ? data.buildings.find((b: Row) => b.id === citySelected.slice(9))
        : data.cityAssets.find((a: Row) => a.id === citySelected.slice(6));
      const position =
        action === "city-reset"
          ? citySelected === "hq"
            ? [...row.position]
            : citySelected.startsWith("building:")
            ? [row.x, row.y || 0, row.z]
            : [...row.position]
          : [...cityDraft.position];
      if (action === "city-move") {
        const axis = Number(target.dataset.axis);
        const step = Number(
          document.querySelector<HTMLSelectElement>("#city-step")?.value || 0.5,
        );
        const min = axis === 1 ? 0 : -40;
        const max =
          axis === 1 ? (citySelected === "hq" || citySelected.startsWith("building:") ? 2 : 5) : citySelected === "hq" ? 30 : 40;
        position[axis] = Math.max(
          min,
          Math.min(
            max,
            Math.round(
              (position[axis] + Number(target.dataset.direction) * step) * 100,
            ) / 100,
          ),
        );
      }
      cityDraft.position = position;
      if (citySelected === "hq") await render();
      else world?.moveCityItem(citySelected, position);
      document.querySelector("#city-values")!.textContent =
        `Position: ${position.map((n: number) => n.toFixed(2)).join(" / ")} m`;
      return;
    }
    if (action === "city-save") {
      const building = citySelected === "hq" || citySelected.startsWith("building:");
      const row = citySelected === "hq" ? data.hq : building
        ? data.buildings.find((b: Row) => b.id === citySelected.slice(9))
        : data.cityAssets.find((a: Row) => a.id === citySelected.slice(6));
      await api(citySelected === "hq" ? "save_hq" : building ? "save_city_building" : "save_city_asset", {
        id: row.id,
        revision: row.revision || 0,
        position: cityDraft.position,
        ...(building ? { model: cityDraft.model } : { asset: cityDraft.asset }),
      });
      await refresh();
      selectCity(citySelected);
      await render();
      toast("City item saved.");
      return;
    }
    if (action === "city-add") {
      const asset =
        document.querySelector<HTMLSelectElement>("#city-add-model")!.value;
      const anchor = citySelected.startsWith("building:")
        ? data.buildings.find((b: Row) => b.id === citySelected.slice(9))
        : null;
      await api("add_city_asset", {
        asset,
        position: [anchor ? anchor.x + 3.5 : 5, 0, anchor ? anchor.z + 3 : 10],
      });
      await refresh();
      selectCity(`asset:${data.cityAssets[0].id}`);
      await render();
      return;
    }
    if (action === "city-remove") {
      const row = data.cityAssets.find(
        (a: Row) => a.id === citySelected.slice(6),
      );
      await api("remove_city_asset", { id: row.id, revision: row.revision });
      await refresh();
      selectCity("hq");
      await render();
      return;
    }
    if (action === "office-move" || action === "office-reset-item") {
      const offset = [
        ...(officePositionDraft[officeSelectedSlot] || [0, 0, 0]),
      ];
      if (action === "office-reset-item") offset.fill(0);
      else {
        const axis = Number(target.dataset.axis),
          direction = Number(target.dataset.direction);
        const step = Number(
          document.querySelector<HTMLSelectElement>("#position-step")?.value ||
            0.1,
        );
        const limit = axis === 1 ? 1.5 : 3;
        offset[axis] = Math.max(
          -limit,
          Math.min(
            limit,
            Math.round((offset[axis] + direction * step) * 100) / 100,
          ),
        );
      }
      officePositionDraft[officeSelectedSlot] = offset;
      world?.moveItem(officeSelectedSlot, offset);
      document.querySelector("#position-values")!.textContent =
        `Offset: ${offset.map((v) => v.toFixed(2)).join(" / ")} m`;
      return;
    }
    if (action === "office-save-positions") {
      await api("save_office_positions", {
        agentId: selected,
        revision: agent(selected)?.revision,
        positions: officePositionDraft,
      });
      officeEditing = false;
      await refresh();
      await render();
      toast("Office positions saved.");
      return;
    }
    if (action === "save-view") {
      openForm(
        "Save operational view",
        "Save view",
        input("name", "View name") +
          select(
            "filter",
            "Filter",
            operationalFilters.slice(1) as [string, string][],
            activityFilter === "all" ? "needs_owner" : activityFilter,
          ),
        async (f) => {
          await api("save_operational_view", Object.fromEntries(f));
        },
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
        ...data.agents.map(
          (a: Row) =>
            [`agent:${a.id}`, `Agent · ${a.name}`] as [string, string],
        ),
        ...data.work.map(
          (w: Row) =>
            [`mission:${w.id}`, `Mission · ${w.title}`] as [string, string],
        ),
        ...data.routines.map(
          (r: Row) =>
            [`routine:${r.id}`, `Routine · ${r.title}`] as [string, string],
        ),
      ];
      openForm(
        "New resource budget",
        "Create budget",
        input("name", "Budget name") +
          select("target", "Applies to", targets) +
          select("unit", "Unit", [
            ["USD", "USD"],
            ["tokens", "Model tokens"],
            ["minutes", "Minutes"],
            ["API calls", "API calls"],
          ]) +
          select("period", "Period", [
            ["monthly", "Monthly · Denver"],
            ["total", "Total"],
          ]) +
          '<label>Soft warning<input name="softLimit" type="number" min="0" step="any" required></label><label>Hard limit<input name="hardLimit" type="number" min="0.01" step="any" required></label>',
        async (f) => {
          const [scope, scopeId] = String(f.get("target")).split(":");
          await api("save_budget", {
            name: f.get("name"),
            scope,
            scopeId,
            unit: f.get("unit"),
            period: f.get("period"),
            softLimit: Number(f.get("softLimit")),
            hardLimit: Number(f.get("hardLimit")),
          });
        },
      );
      return;
    }
    if (action === "budget-usage") {
      openForm(
        "Record verified usage",
        "Record usage",
        '<label>Amount<input name="amount" type="number" min="0.01" step="any" required></label>' +
          input("note", "Evidence or note"),
        async (f) => {
          await api("record_budget_usage", {
            budgetId: id,
            amount: Number(f.get("amount")),
            note: f.get("note"),
            idempotency_key: crypto.randomUUID(),
          });
        },
      );
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
      if (view === "conversations" && !chatAgent) chatAgent = data.agents[0]?.id || "";
      await render();
      return;
    }
    if (action === "office") {
      if (mobile || mode === "2d") { chatAgent = id!; selected = id!; view = "conversations"; await render(); return; }
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
    if (action === "mode") {
      mode = mode === "2d" ? "3d" : "2d";
      flat = mode === "2d";
      localStorage.setItem("crew.mode", mode);
      localStorage.setItem("crew.flat", String(flat));
      view = mode === "2d" ? "dashboard" : "city";
      await render();
      return;
    }
    if (action === "chat-agent") {
      chatAgent = target.dataset.id || "";
      selected = chatAgent;
      view = "conversations";
      await api("ack_owner_messages", { agentId: chatAgent }).catch(() => {});
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
      let mode = data.config.stopMode || "drain";
      if (!data.config.stopped) {
        const choice = prompt("Pause mode: type drain or kill. Drain is the default.", "drain");
        if (!choice) return;
        mode = choice.trim().toLowerCase();
        if (!["drain", "kill"].includes(mode)) { toast("Choose drain or kill.", true); return; }
        if (!confirm(mode === "drain" ? "Pause new work and let in-flight runs finish or reach their budget?" : "Pause new work and terminate in-flight runs?")) return;
      }
      await act("global_stop", { stopped: !data.config.stopped, mode, exemptions: data.config.exemptions || [] });
      toast(
        data.config.stopped
          ? "New dispatch halted. Runtime stop acknowledgments appear in Live Ops."
          : "Dispatch queue reopened.",
      );
      return;
    }
    if (action === "pause-exemptions") {
      const value = prompt(`Agent IDs allowed to keep working during a crew pause (comma separated):\n${data.agents.map((a: Row) => a.id).join(", ")}`, (data.config.exemptions || []).join(", "));
      if (value === null) return;
      const exemptions = value.split(",").map((x: string) => x.trim()).filter(Boolean);
      await api("global_stop", { stopped: data.config.stopped, exemptions, mode: "drain" });
      await refresh(); await render();
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
          '<h3>Task contract</h3>' +
          '<label>Objective<input name="objective" required maxlength="500"></label>' +
          '<label>Inputs (one per line)<textarea name="contractInputs" required></textarea></label>' +
          '<label>Constraints (one per line)<textarea name="constraints" required placeholder="BIS only\nNo personal cognition\n$0 spend"></textarea></label>' +
          '<label>Deliverable<input name="deliverable" required maxlength="1000"></label>' +
          '<label>Done when (one checkable condition per line)<textarea name="done_when" required></textarea></label>' +
          '<label>Approval required (one per line)<textarea name="approval_required" placeholder="Matt approval before sending"></textarea></label>' +
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
            contract: {
              objective: f.get("objective"),
              inputs: String(f.get("contractInputs") || "").split("\n").map((x) => x.trim()).filter(Boolean),
              constraints: String(f.get("constraints") || "").split("\n").map((x) => x.trim()).filter(Boolean),
              deliverable: f.get("deliverable"),
              done_when: String(f.get("done_when") || "").split("\n").map((x) => x.trim()).filter(Boolean),
              approval_required: String(f.get("approval_required") || "").split("\n").map((x) => x.trim()).filter(Boolean),
            },
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
        `<p>${e(w.brief)}</p><div class="row">${badge(w.status)}<span>Revision ${w.revision}</span></div><h3>Task contract</h3>${w.contract ? `<p><strong>Objective:</strong> ${e(w.contract.objective)}</p><p><strong>Deliverable:</strong> ${e(w.contract.deliverable)}</p><p><strong>Inputs:</strong> ${e((w.contract.inputs || []).join(" · "))}</p><p><strong>Constraints:</strong> ${e((w.contract.constraints || []).join(" · "))}</p><p><strong>Retry budget:</strong> ${(w.contract.retry_budget?.attempts || 3)} attempts / ${(w.contract.retry_budget?.elapsed_minutes || 10)} minutes · max spend $${w.contract.retry_budget?.spend || 0} · destructive scope: ${e(w.contract.retry_budget?.destructive_scope || "None")}</p><ul>${(w.contract.done_when || []).map((x: string) => `<li>${e(x)}</li>`).join("")}</ul><p><strong>Approval required:</strong> ${e((w.contract.approval_required || []).join(" · ") || "None specified")}</p>` : '<p class="warning">Legacy work item has no contract.</p>'}<h3>Run receipts</h3>${(w.receipts || []).map((r: Row) => `<article class="command-row"><strong>${e(r.objective)}</strong><p>Changed: ${e(r.changed)}</p><p>Verified: ${e((r.verified || []).map((x: Row) => `${x.condition}: ${x.evidence}`).join("; ") || "None")}</p><p>Not verified: ${e((r.notVerified || []).map((x: Row) => `${x.condition}: ${x.evidence}`).join("; ") || "None")}</p><p>Risks: ${e(r.risks)}</p><p>Approval needed: ${e(r.approvalNeeded)}</p></article>`).join("") || '<p class="muted">No run receipts yet.</p>'}<h3>Responsibility</h3><dl>${Object.entries(
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
          (a.artifact ? `<label>Edit artifact before approval<textarea name="artifact" maxlength="10000">${e(a.artifact)}</textarea></label>` : "") +
          '<label>Durable decision note<textarea name="note" required maxlength="2000"></textarea></label>',
        async (f) => {
          await api("resolve_approval", {
            id,
            decision: f.get("decision"),
            note: f.get("note"),
            artifact: f.get("artifact"),
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
          select(
            "kind",
            "Kind",
            id
              ? [["project_site", "Project site"]]
              : [
                  ["project_site", "Project site"],
                  ["agent_hq", "Agent HQ"],
                ],
          ) +
          (id ? "" : '<label id="agent-id-field" hidden>New agent ID<input name="agentId" type="text" pattern="[a-z][a-z0-9_-]{1,39}" minlength="2" maxlength="40" disabled><small>Only needed when creating an agent HQ.</small></label>') +
          select("style", "Architecture by work type", buildingStyles) +
          select("model", "Building model", buildingModels) +
          select(
            "goalId",
            "Goal",
            data.goals.map((g: Row) => [g.id, g.name]),
          ),
        async (f) => {
          await api("register_building", {
            ...Object.fromEntries(f),
            ...(id ? { plotId: id } : {}),
          });
        },
      );
      const kind = document.querySelector<HTMLSelectElement>('#dialog-form select[name="kind"]');
      const agentId = document.querySelector<HTMLInputElement>('#dialog-form input[name="agentId"]');
      if (kind && agentId) {
        const updateAgentId = () => {
          const needed = kind.value === "agent_hq";
          agentId.closest("label")!.hidden = !needed;
          agentId.disabled = !needed;
          agentId.required = needed;
        };
        kind.addEventListener("change", updateAgentId);
        updateAgentId();
      }
      return;
    }
    if (action === "building-edit") {
      const b = data.buildings.find((row: Row) => row.id === id);
      openForm(
        "Edit campus building",
        "Save building",
        input("name", "Building name", "text", b.name) +
          select(
            "style",
            "Architecture by work type",
            buildingStyles,
            b.style,
          ) +
          select(
            "model",
            "Building model",
            buildingModels,
            b.model || "campus",
          ) +
          select(
            "goalId",
            "Linked goal",
            [["", "None"], ...data.goals.map((g: Row) => [g.id, g.name])],
            b.goalId || "",
          ),
        async (f) => {
          await api("update_building", {
            id,
            revision: b.revision || 0,
            ...Object.fromEntries(f),
          });
        },
      );
      return;
    }
    if (action === "project-state") {
      const b = data.buildings.find((row: Row) => row.id === id);
      const state = target.dataset.state!;
      openForm(
        `Move to ${label(state)}`,
        "Update project state",
        `<p>The city building will change to the ${e(label(state))} appearance.</p>${input("note", "Owner decision or evidence")}`,
        async (f) => {
          await api("set_project_lifecycle", {
            id,
            revision: b.revision || 0,
            lifecycle: state,
            note: f.get("note"),
          });
        },
      );
      return;
    }
    if (action === "project-retire") {
      const b = data.buildings.find((row: Row) => row.id === id);
      if (
        !confirm(
          `Retire ${b.name}? Its plot will remain ready for the next project.`,
        )
      )
        return;
      await act("retire_project", {
        id,
        revision: b.revision || 0,
        confirm: true,
      });
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
    const presetId = (f.elements.namedItem("preset") as HTMLSelectElement)
      .value;
    const preset = (data.officePresets || []).find(
      (p: Row) => p.id === presetId,
    );
    if (!preset) throw new Error("Choose a saved layout first");
    return preset;
  };
  document.querySelector("#save-preset")!.addEventListener(
    "click",
    () =>
      void handle(async () => {
        const name = (
          document.querySelector<HTMLInputElement>("#preset-name")!.value || ""
        ).trim();
        await api("save_office_preset", { name, design: read() });
        await refresh();
        openDesign(id);
        document.querySelector("#design-status")!.textContent =
          "Layout saved for every office.";
      }),
  );
  document.querySelector("#load-preset")!.addEventListener(
    "click",
    () =>
      void handle(async () => {
        draft = structuredClone(chosenPreset().design);
        (f.elements.namedItem("theme") as HTMLSelectElement).value =
          draft.theme;
        (f.elements.namedItem("palette") as HTMLSelectElement).value =
          draft.palette;
        for (const slot of slots)
          (f.elements.namedItem(slot) as HTMLSelectElement).value =
            draft.placements.find((p: Row) => p.slot === slot)?.asset_id || "";
        document.querySelector("#design-status")!.textContent =
          "Layout loaded into the editor. Preview or save it when ready.";
      }),
  );
  document.querySelector("#apply-preset")!.addEventListener(
    "click",
    () =>
      void handle(async () => {
        await act("apply_office_preset", {
          presetId: chosenPreset().id,
          agentId: id,
          revision: a.revision,
        });
        document.querySelector("dialog")?.close();
      }),
  );
  document.querySelector("#delete-preset")!.addEventListener(
    "click",
    () =>
      void handle(async () => {
        await api("delete_office_preset", { id: chosenPreset().id });
        await refresh();
        openDesign(id);
        document.querySelector("#design-status")!.textContent =
          "Saved layout deleted.";
      }),
  );
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
  if ((ev.target as HTMLElement).id === "broadcast-form") {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const send = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    const values = new FormData(form);
    send.disabled = true;
    void (async () => {
      try {
        const result = await api("send_crew_broadcast", {
          title: String(values.get("title") || "").trim() || undefined,
          body: String(values.get("body") || "").trim(),
        });
        form.reset();
        await refresh();
        await render();
        toast(`Announcement sent to ${result.recipientCount} crew members.`);
      } catch (err) {
        send.disabled = false;
        toast((err as Error).message, true);
      }
    })();
    return;
  }
  if ((ev.target as HTMLElement).id !== "message-form") return;
  ev.preventDefault();
  const f = ev.target as HTMLFormElement;
  const body = String(new FormData(f).get("body") || "").trim();
  if (!body) return;
  const send = f.querySelector<HTMLButtonElement>("button[type=submit]")!;
  send.disabled = true;
  const recipient = view === "conversations" ? chatAgent : selected;
  void (async () => {
    try {
      let conversation = conversationId(recipient);
      if (conversation === "legacy") {
        const created = await api("start_agent_conversation", { agentId: recipient });
        conversation = created.id;
        chatSelection.set(recipient, conversation);
      }
      await api("send_agent_message", { agentId: recipient, conversationId: conversation, body });
      f.reset();
      await refresh();
      if (view === "conversations") await render(); else updateChatPane(true);
    } catch (err) {
      send.disabled = false;
      toast((err as Error).message, true);
    }
  })();
});
document.addEventListener("change", (ev) => {
  if ((ev.target as HTMLElement).id === "chat-session") {
    const recipient = view === "conversations" ? chatAgent : selected;
    chatSelection.set(recipient, (ev.target as HTMLSelectElement).value);
    updateChatPane(true);
  }
});
mobileQuery.addEventListener("change", () => { mobile = mobileQuery.matches; void render(); });
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
  if (ev.target instanceof HTMLTextAreaElement && ev.target.id === "message-body" && ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    ev.target.form?.requestSubmit();
    return;
  }
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
            const previousScene = sceneKey();
            await refresh();
            if (view === "office" && sceneKey() === previousScene) {
              const current = agent(selected);
              if (current) world?.updateActivity(current, data.runs);
              if (presentationKey(data) !== old) updateChatPane();
              return;
            }
            if (view === "conversations") {
              if (presentationKey(data) !== old) updateChatPane();
              return;
            }
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

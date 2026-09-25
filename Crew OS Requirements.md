# Crew OS complete product requirements

**Purpose:** A build-neutral specification for comparing independent implementations of Crew OS.

**Product stance:** Crew OS should feel like a world, behave like an operating console, and record work like a control plane.

**North star:** Open Crew OS, understand the whole team in under one minute, direct work without switching tools, and enter any agent’s office for precise one-to-one interaction.

**Specification snapshot:** September 25, 2026. The current source baseline is private repository `matboy82/crew-os`, `main` commit `abe9a68761bb2866575ea82ce17bf0b4a7517b30`. This document combines the current baseline with every accepted or explicitly proposed feature from the city, office/decor, agent-connection, and BIS HQ design work. It describes the intended product; it does not claim every requirement is complete or verified in the deployed build.

## Requirement language and status

- **MUST:** Required for a conforming core implementation.
- **SHOULD:** Expected unless the implementation documents a strong reason not to.
- **MAY:** Optional extension.
- **Baseline:** Capability represented in the current source or deployed design.
- **Target:** Accepted end-state requirement that may be partial or not yet connected end to end.
- **Deferred:** Deliberately outside the first complete release, but preserved as a proposed idea.

---

## 1. Product boundaries and locked decisions

- **PRD-001 — One control surface [MUST, Target]:** Crew OS is Matt’s private BIS mission-control app for agents running in Muse, on local machines, in cloud jobs, or behind APIs.

- **PRD-002 — Three interaction layers [MUST, Target]:** The city answers “Where is attention needed?”, BIS HQ answers “What should the team do next?”, and an individual office answers “What does this agent need?”

- **PRD-003 — Quality-of-life objective [MUST, Target]:** The app must be faster and more pleasant than managing the crew through separate terminals and text files.

- **PRD-004 — Fun through truth [MUST, Target]:** Gamification and animation must visualize real operational state. The system must never invent presence, progress, handoffs, or completion.

- **PRD-005 — System of record [MUST, Locked]:** The Crew OS database is authoritative for Crew OS commands, work items, runs, RACI assignments, approvals, messages, events, office manifests, and UI state. Shared cognition is authoritative for all other work. Crew OS stores references and sync metadata for external work, not competing copies.

- **PRD-006 — Organization scope [MUST, Locked]:** Ship BIS as the explicit day-one organization. Keep schema, policies, adapters, branding, asset catalogs, and migrations configurable enough for later isolated client forks. Do not turn the BIS release into a shared multi-tenant product.

- **PRD-007 — Paperclip relationship [MUST, Locked]:** Borrow control-plane patterns from Paperclip—bring-your-own-agent adapters, goal-aware work, heartbeats, task ownership, governance, budgets, persistent state, and audit trails—but do not embed or depend on Paperclip for the first Crew OS release.

- **PRD-008 — 3D is never required [MUST, Locked]:** Every operational control must also exist in a fast, accessible 2D interface. A WebGL failure must never block control of the crew.

- **PRD-009 — Owner authority [MUST, Locked]:** Matt is the final owner and approval authority. No agent may approve its own privileged action, erase audit history, or cross an organization/data boundary without owner policy.

- **PRD-010 — Agent identity ownership [MUST, Locked]:** Each agent chooses or supplies its own avatar and office identity. Crew OS may validate and render that identity but must not fabricate an agent’s identity from a portrait.

---

## 2. Primary actors and initial crew

- **ACT-001 — Owner:** Matt creates missions, assigns responsibility, dispatches work, reviews evidence, resolves approvals, sends notes, changes office overrides, and pauses or revokes agents.

- **ACT-002 — Agent:** An AI runtime reports presence, accepts commands, performs work, publishes events and artifacts, requests handoffs or approvals, and proposes its avatar and office design.

- **ACT-003 — Adapter:** A transport-specific component binds one runtime to one Crew OS agent and implements identity, heartbeat, command delivery, acknowledgments, recovery, and evidence submission.

- **ACT-004 — Scheduled sync:** A server-side automation refreshes read-only external facts and valid agent heartbeat files before the morning briefing.

- **ACT-005 — Initial crew [MUST]:** The first implementation must support Jeff, Jefferson, Relay, and Jev while keeping agent IDs data-driven.

| Agent | Function | Initial HQ |
| --- | --- | --- |
| Jeff | Chief of staff | The War Room |
| Jefferson | Trading desk | The Exchange |
| Relay | Outside-world operations | The Tower |
| Jev | Fast scoring and judgment | The Lab |

- **ACT-006 — First adapter [MUST, Locked]:** Jeff is the first end-to-end adapter. He must establish identity, generate/supply his avatar, design his office, pass the command/acknowledgment/recovery loop, and only then onboard the remaining agents through the same scoped process.

---

## 3. Information architecture and navigation

- **NAV-001 — Default landing view [MUST]:** After owner authentication, open on the 3D city with the Morning Brief overlay.

- **NAV-002 — City drill-down [MUST]:** Selecting an agent building enters that agent’s office. Selecting a project building enters a project workspace. Selecting the avatar inside an office opens the agent dashboard and conversation view.

- **NAV-003 — HQ entry [MUST]:** The city must contain a BIS HQ building or equally prominent navigation target that opens the shared team control room.

- **NAV-004 — Return path [MUST]:** Every drill-down must have a clear one-action return path. Returning should preserve useful filters, selection, and camera position.

- **NAV-005 — Input methods [MUST]:** City and office navigation must support mouse, touch, keyboard-accessible alternatives, and mobile layouts.

- **NAV-006 — 2D parity [MUST]:** Building selection, mission access, agent status, approvals, pause controls, and “Needs Matt” must not depend on 3D hit testing or camera precision.

- **NAV-007 — Responsive use [MUST]:** The app must remain useful on desktop and phone. Mobile may reduce visual quality but not operational capability.

- **NAV-008 — Movable overlays [SHOULD, Baseline]:** City summary panels may be movable, dockable, and collapsible, with state retained locally.

---

## 4. Morning Brief and dashboard

- **BRF-001 — Header [MUST, Baseline]:** Show “Morning Brief,” the local date, active-agent count, number waiting on Matt, and count of today’s agenda items.

- **BRF-002 — BIS goal hero [MUST, Baseline]:** Show progress toward the current BIS monthly goal, initially the additional `$2,000/month` target, with current amount, target, and accessible progress semantics.

- **BRF-003 — While You Slept [MUST, Baseline]:** Display reverse-chronological activity with agent, time, summary, and optional detail.

- **BRF-004 — Waiting On You [MUST, Baseline]:** Put unresolved approvals and questions ahead of ambient activity. Support `MERGE`, `DECISION`, `ANSWER`, and `WATCH` types, context, effect, and a durable resolution note.

- **BRF-005 — Queued for Today [MUST, Baseline]:** Combine agenda, recurring work, and manual queue items. Show time labels and details when available.

- **BRF-006 — Crew roster [MUST, Baseline]:** Show each agent’s role, current task, status tone, connection state, and last-seen time. “Never connected” must be explicit.

- **BRF-007 — Goals strip [MUST, Baseline]:** Support multiple named goals with status text and optional current/target progress.

- **BRF-008 — Manual queue [MUST, Baseline]:** Owner can add and remove manual queue items.

- **BRF-009 — Manual sync [MUST, Baseline]:** Owner can run the same refresh used by the schedule and receive started, completed, or failed status without false success.

- **BRF-010 — Time semantics [MUST]:** Present operational dates and times in `America/Denver`. Store instants as UTC timestamps. Preserve intended local wall-clock labels for recurring schedules.

## 5. Morning synchronization

- **SYN-001 — Schedule [MUST, Baseline]:** Run a silent refresh daily at 5:55 AM `America/Denver`, before the 6:46 AM briefing.

- **SYN-002 — Server-to-server execution [MUST]:** Scheduled refresh must work without an interactive owner browser session. Manual refresh still requires owner authentication.

- **SYN-003 — Read-only sources [MUST]:** Gather today’s visible Google Calendar events, relevant non-system schedules and run status, BIS-Vault open pull requests and recent `main` commits, and valid Crew OS heartbeat files.

- **SYN-004 — Calendar grouping [MUST]:** Separate Personal and BIS events when source metadata permits and expose schedule conflicts or tight transitions.

- **SYN-005 — External side-effect boundary [MUST]:** Morning sync may read connected sources and update Crew OS only. It may not send messages, edit calendars, change schedules, or modify GitHub.

- **SYN-006 — Dedupe [MUST]:** Imported activities, approvals, and queue rows use durable source keys. Retries must not create duplicates.

- **SYN-007 — Approval reconciliation [MUST]:** If an external approval source is resolved, mark the matching Crew OS item resolved rather than leaving stale work.

- **SYN-008 — Truthfulness [MUST]:** Include only verified source values. Omit uncertain data rather than infer status.

- **SYN-009 — History policy [MUST]:** Replace the day’s agenda on refresh, retain activity history, and preserve approval resolutions.

---

## 6. 3D city and visual system

- **CTY-001 — BIS visual language [MUST]:** Use bright white architectural slabs, structural gray, navy/near-black, and royal-blue glowing channels. Reference colors are blue `#2768df`, near-black `#020617`, white `#f8fafc`, and gray `#e3e7ed`.

- **CTY-002 — Day and dusk [MUST, Baseline]:** Day is the bright default. Provide a Dusk toggle with a navy sky and controlled emissive lighting.

- **CTY-003 — Rotatable world [MUST, Baseline]:** The city supports orbit/rotate, zoom, pan where appropriate, and touch interaction with bounded camera controls.

- **CTY-004 — Data-driven registry [MUST, Baseline]:** Buildings come from durable data rather than a hardcoded four-agent union. Each building has name, optional agent, kind, style, position, accent, and optional project status/goal.

- **CTY-005 — Building kinds [MUST]:** Support `agent_hq` and `project_site`. New registered buildings must appear with functioning detail views.

- **CTY-006 — Initial architecture styles [MUST, Baseline]:** Support command, exchange, tower, lab, studio, and workshop presets.

- **CTY-007 — State beacons [MUST]:** Buildings visually distinguish active, waiting, blocked, failed, disconnected, and idle states. Every state also needs a text label and timestamp.

- **CTY-008 — Notification bubbles [MUST, Baseline]:** Agent buildings/offices show real current-task or approval notifications without inventing work.

- **CTY-009 — Project progression [SHOULD, Target]:** Project buildings gain visible construction stages only when named, verified milestones close.

- **CTY-010 — Ambient traffic [MAY, Deferred]:** Add flying-vehicle loops from the staged spaceship pack after office and HQ control flows are stable. Traffic is decorative, collision-free, and disabled for reduced motion.

- **CTY-011 — Progressive loading [MUST]:** Render status and navigation before high-detail models. Decorative content must never delay operational readiness.

- **CTY-012 — WebGL fallback [MUST, Baseline]:** If graphics initialization, context recovery, a shader, or a model fails, show a readable 2D operations summary—not a blank scene.

## 7. Agent offices and dashboards

- **OFF-001 — Focused workspace [MUST]:** Each agent office is a one-agent control room using the same work records as HQ, not a separate queue.

- **OFF-002 — Office operational surfaces [MUST]:** Show presence/runtime, current task and run, conversation, inbox, “Needs Matt,” outputs/evidence, schedule/routines, capabilities/boundaries, and avatar/office design.

- **OFF-003 — Live room surfaces [MUST, Baseline]:** The 3D office includes readable current-task, queue, approval, notification, and activity screens.

- **OFF-004 — Private messaging [MUST, Target]:** An office message is one-to-one by default. It becomes a team thread or handoff only by an explicit owner action.

- **OFF-005 — Delivery truth [MUST]:** Saving a note is not the same as delivering it. The UI must distinguish recorded, queued, delivered, acknowledged, failed, and replied.

- **OFF-006 — Context continuity [MUST]:** Opening an office from a mission carries the selected work item and thread into view.

- **OFF-007 — Activity animation [MUST, Baseline]:** Support typing, presenting, walking, reading, on-call, celebrating, and idle behaviors, driven by current activity or real run events.

- **OFF-008 — Shared desk seating [MUST, Baseline]:** Agents have a reliable sit-at-desk pose and station. Furniture, avatar, and desk accessories must not float or intersect.

- **OFF-009 — Camera-safe interior [MUST]:** Use dollhouse wall fading/culling or equivalent constraints so rotating the camera does not reveal blank wall backs. Preserve avatar and screen visibility.

- **OFF-010 — Visual life [SHOULD]:** Offices may use pulsing blue channels, animated screens/particles, subtle light behavior, and rotating props such as a satellite dish when supported by real room state.

- **OFF-011 — Project workspace [MUST]:** A project building exposes project goal/status, linked tasks, activity, approvals, and evidence even when no agent is assigned.

---

## 8. Avatar and office customization

### 8.1 Avatar identity

- **AVA-001 — Input paths [MUST, Baseline]:** Accept agent-supplied PNG/JPEG portraits through Drive or HTTPS heartbeat and owner-uploaded portraits through the authenticated UI.

- **AVA-002 — Display [MUST]:** Use the latest accepted portrait in 2D dashboard and office surfaces with meaningful alternative text.

- **AVA-003 — 3D characters [MUST]:** Known agents may resolve to reviewed full-body GLB characters. Unknown agents use a neutral articulated figure.

- **AVA-004 — No inference [MUST]:** Do not synthesize a 3D identity from a portrait or infer identity traits. New character models enter through reviewed application assets.

- **AVA-005 — Initial identities [MUST]:** Relay uses her established tech-forward look. Jeff uses his agent-supplied otter identity. Jefferson and Jev retain their supplied/curated identities or a neutral fallback.

### 8.2 Office design contract

- **DSN-001 — Themes [MUST, Baseline]:** Support Neutral Studio, Command Center, Trading Floor, Comms Loft, Research Lab, and Cozy Den.

- **DSN-002 — Palettes [MUST, Baseline]:** Support BIS Blue, Graphite, Signal Green, and Warm palettes with contrast-safe text and controls.

- **DSN-003 — Stable IDs [MUST]:** Agents select stable catalog asset IDs and named slots, never file paths, arbitrary URLs, scripts, shaders, or unbounded transforms.

- **DSN-004 — Current slots [MUST, Baseline]:** Support `primary_desk`, `task_chair`, `desk_screen`, `desk_accessory`, `plant_corner`, `library`, `lounge_seating`, `coffee_table`, `floor_rug`, `floor_lamp`, `feature_prop`, and `wall_display`.

- **DSN-005 — Deterministic placement [MUST]:** A slot has a fixed safe anchor and only accepts compatible asset categories. One asset occupies a slot unless a future version explicitly defines a collection slot.

- **DSN-006 — Versioned manifest [MUST]:** The design object contains `version`, `theme`, `palette`, and placements of `slot`, `asset_id`, and optional bounded rotation.

- **DSN-007 — Compatibility [MUST]:** Continue accepting legacy `office_theme` and `decor_items`, mapping them server-side to a valid structured design.

- **DSN-008 — Placement limit [MUST]:** Preserve the current contract limit of 12 placements for compatibility. An implementation may expand toward the earlier 24-object proposal only if protocol versioning and performance budgets remain intact.

- **DSN-009 — Validation [MUST]:** Reject unknown assets, incompatible slots, duplicate occupied slots, unsupported versions, oversized manifests, unknown properties, and invalid transforms. A partially invalid design must not erase the previous valid room.

- **DSN-010 — Precedence [MUST, Baseline]:** Owner override > latest valid agent design > theme default > Neutral Studio fallback. An agent heartbeat cannot clear or modify an owner override.

- **DSN-011 — Revision safety [MUST]:** Office edits use optimistic concurrency. Stale revisions fail with the current state instead of overwriting newer changes.

- **DSN-012 — Owner workflow [MUST]:** Owner can preview without saving, save an override, reset to agent design, and reset to theme defaults. Show effective source, revision, update time, and warnings.

- **DSN-013 — Agent workflow [MUST]:** Agent reads the published catalog, submits a design through its normal heartbeat, receives validation results, and sees the accepted design on the next office load or live refresh.

- **DSN-014 — Presets [SHOULD, Target]:** Allow saved design presets and one-click duplication between offices.

### 8.3 Asset catalog and licensing

- **AST-001 — Curated registry [MUST]:** Expose only reviewed assets with stable ID, label, category, allowed slots, dimensions, default transform, license, attribution, and mobile tier.

- **AST-002 — Initial catalog [MUST, Baseline]:** At minimum include desks, corner desk, chair, monitor, keyboard, laptop, plants, bookcase, books, floor lamps, rug, radio, speaker, television, coffee table, sofa, and satellite dish.

- **AST-003 — Imported packs [SHOULD, Target]:** Curate from the staged Kenney Furniture, KayKit Furniture Bits, Poly Pizza Office, Quaternius Cyberpunk, Sci-Fi Essentials, Modular Sci-Fi MegaKit, Kenney Space, and Quaternius Spaceships packs.

- **AST-004 — License gate [MUST]:** Unknown-license assets are unavailable. Visible CC-BY assets require resolvable author/source metadata and a persistent Credits surface. CC0 acknowledgment is optional.

- **AST-005 — Lazy load [MUST]:** Load only the active room’s selected assets, cache source models, clone for scene use, and dispose clones without leaking GPU memory.

- **AST-006 — Procedural fallback [MUST]:** Swap a procedural placeholder only after the imported model is ready. A failed model leaves a usable placeholder.

---

## 9. BIS HQ team control room

- **HQ-001 — First-screen order [MUST]:** Show items waiting on Matt first, unhealthy/disconnected agents second, active missions and blockers third, and historical activity last.

- **HQ-002 — Six zones [MUST, Target]:** Provide a Mission Table, Dispatch Board, Live Ops Wall, Handoff Bay, Collaboration Floor, and Review Room.

| Zone | Primary data | Core action |
| --- | --- | --- |
| Mission Table | Goals and projects | Set priority |
| Dispatch Board | Ready work and capacity | Assign / reorder |
| Live Ops Wall | Agents and runs | Inspect / pause |
| Handoff Bay | Dependencies | Accept / reroute |
| Collaboration Floor | Shared missions | Open team thread |
| Review Room | Approvals and artifacts | Approve / revise |

- **HQ-003 — 2D first [MUST]:** Implement useful 2D HQ panels before depending on the 3D floor. The 3D zones visualize the same records and actions.

- **HQ-004 — Mission creation [MUST, Baseline]:** Owner creates a work item with title, smallest sufficient brief, priority, optional goal/project reference, and optional parent.

- **HQ-005 — Dispatch board [MUST, Baseline]:** List work items with priority, lifecycle status, RACI assignments, revision, and owner controls.

- **HQ-006 — Owner controls [MUST]:** Support assign, reorder, dispatch, pause, resume, redirect, cancel, retry, approve, reject, inspect, and message where policy allows.

- **HQ-007 — Delivery truth [MUST, Baseline]:** Show commands, handoffs, artifacts, and state transitions separately. “Queued,” “accepted,” “running,” “completed,” “failed,” “expired,” and “canceled” are distinct.

- **HQ-008 — Review room [MUST]:** Display pending approvals and delivered artifacts together with context, proposed effect, evidence links, and durable owner resolution.

- **HQ-009 — Live operations [MUST, Baseline]:** Provide searchable operational history with timestamps, actors, entities, event types, and filters for commands, handoffs, and artifacts. Keyboard shortcut `/` should focus search.

- **HQ-010 — Agent health [MUST]:** Show runtime, transport, last heartbeat, sequence/lag, current run, capability summary, and terminal failure reason without exposing secrets.

- **HQ-011 — Team threads [MUST, Target]:** Shared mission conversations are durable, scoped to work, and distinguish participants. Office-private threads require explicit promotion.

- **HQ-012 — Global control [MUST, Target]:** Owner can pause an agent, mission, routine, dispatch queue, or all new dispatch. Show acknowledgment per runtime; never imply a stop succeeded merely because it was requested.

- **HQ-013 — Evidence inspection [MUST]:** Delivered artifacts remain linked to work item, run, agent, revision, approval, and audit events.

- **HQ-014 — Saved views [SHOULD]:** Support saved filters for needs-owner, failed, blocked, disconnected, stale, and active work.

## 10. Work, responsibility, and lifecycle

- **WRK-001 — Durable intent [MUST]:** A work item is durable intent; a run is one execution attempt. Do not collapse them into one record.

- **WRK-002 — Lifecycle [MUST]:** Support `INBOX → PLANNED → READY → CLAIMED → IN_PROGRESS`, branches to `BLOCKED` and `WAITING_APPROVAL`, and terminal `DONE` or `CANCELED`.

- **WRK-003 — RACI [MUST, Locked]:** Each work item may have one or more Responsible agents, exactly one Accountable actor before entering Ready, zero or more Consulted agents, and zero or more Informed agents.

- **WRK-004 — Handoff ownership [MUST]:** A handoff may change Responsible assignments. Accountable changes only through an explicit audited reassignment.

- **WRK-005 — Run lease [MUST, Target]:** Only one active run lease owns a work item at a time. Lease expiry returns work to recovery or Ready without duplicate execution.

- **WRK-006 — Minimal context [MUST]:** Every task links to a goal/project and carries the smallest context packet needed to act, plus references to authoritative external records.

- **WRK-007 — Optimistic concurrency [MUST, Baseline]:** State-changing owner edits carry an expected revision. Stale writes fail and request refresh.

- **WRK-008 — Idempotency [MUST, Baseline]:** Every externally retried mutation or dispatch accepts a durable idempotency key and returns the prior logical result on replay.

- **WRK-009 — Parent/child work [SHOULD, Target]:** Support nested work items while keeping lifecycle and responsibility visible at each level.

- **WRK-010 — Capacity [SHOULD, Target]:** Dispatch views should consider agent capability, health, policy, and current workload before assignment.

- **WRK-011 — Goal hierarchy [SHOULD, Target]:** Goals may contain subgoals/projects and work items. Dispatch surfaces should show why the work exists, not only what to execute.

- **WRK-012 — Routines [MUST, Target]:** Scheduled recurring work is durable and inspectable, with owner, cadence/timezone, next run, last result, enabled state, policy, and linked goal.

- **WRK-013 — Budget envelopes [SHOULD, Target]:** Organizations, agents, missions, and routines may have bounded resource budgets such as money, compute, model tokens, API calls, or elapsed runtime. Currency and unit are explicit.

- **WRK-014 — Budget enforcement [MUST when enabled]:** Show allocated, used, remaining, and period. Warn before a soft limit; require policy/owner approval or block before a hard limit. Never infer cost from activity alone.

- **WRK-015 — Autonomy policy [MUST, Target]:** Policy evaluates actor, capability, data scope, action, destination, budget, and approval tier before dispatch. Denials and exceptions are readable and audited.

---

## 11. Agent adapters and connection paths

### 11.1 Adapter responsibilities

- **ADP-001 — Identity [MUST]:** Bind one runtime to one agent and organization scope.
- **ADP-002 — Presence [MUST]:** Send ordered heartbeat state with last observed time.
- **ADP-003 — Commands [MUST]:** Poll or receive queued commands without exposing credentials to the UI.
- **ADP-004 — Execution [MUST]:** Start, pause, cancel, and resume where the runtime supports it.
- **ADP-005 — Evidence [MUST]:** Return typed events, results, and artifact references.
- **ADP-006 — Recovery [MUST]:** Resume safely after disconnect, sequence gaps, retries, or lease expiry.
- **ADP-007 — Security [MUST]:** Bind credentials to one agent and narrow capabilities; never expose long-lived secrets.
- **ADP-008 — Adapter SDK [SHOULD, Target]:** Publish a small transport-neutral library or reference package for envelopes, validation, idempotency, sequence tracking, lease/ack behavior, and typed errors.
- **ADP-009 — Conformance suite [MUST, Target]:** A new adapter passes repeatable identity, heartbeat, capability, command, duplicate, expiry, disconnect/reconnect, artifact, handoff, revocation, and redaction tests before activation.

### 11.2 Google Drive path

- **DRV-001 — Primary low-friction path [MUST, Locked]:** Google Drive JSON is the default token-free connection path. No reusable token is stored in the heartbeat file.

- **DRV-002 — Authentication boundary [MUST]:** Write access to the private shared folder is the transport’s authentication boundary.

- **DRV-003 — Isolation target [MUST, Locked]:** Use a separate folder/mailbox per agent so one agent cannot impersonate another. During migration, the existing `Shared Cognition / Crew OS Agent Status` folder with one `<agent_id>.json` file per agent may remain readable, but the target is per-agent isolation.

- **DRV-004 — Mailbox layout [MUST, Target]:** Each agent folder supports status/heartbeat, command inbox, event/artifact outbox, and acknowledgment files with atomic naming and dedupe rules.

- **DRV-005 — Cadence [SHOULD]:** While active, heartbeat approximately every five minutes and immediately on status, task, avatar, office design, command acknowledgment, or material output change.

- **DRV-006 — Folder scope [MUST]:** Read only the designated BIS Shared Cognition path. Do not fall back to a same-named root folder.

### 11.3 HTTPS path

- **HTTPS-001 — Advanced transport [MUST, Baseline]:** Direct HTTPS is an advanced option for agents that cannot use Drive.

- **HTTPS-002 — Pairing [MUST, Baseline]:** Owner creates a one-time pairing code that expires after 10 minutes. Redemption occurs server-side and returns the long-lived credential only to the agent.

- **HTTPS-003 — Credential storage [MUST]:** Store only a cryptographic hash and a safe hint. Re-pairing revokes the previous credential immediately.

- **HTTPS-004 — Endpoint guidance [MUST]:** The UI identifies the app-relative actions endpoint and tells the owner to use the shared artifact URL, never an internal iframe URL.

- **HTTPS-005 — Polling [MUST, Baseline]:** An authenticated agent can poll up to a bounded number of active commands ordered oldest first.

### 11.4 Protocol v2

- **PRO-001 — Versioned envelope [MUST]:** Protocol is versioned, transport-neutral, idempotent, and reconnect-safe.

- **PRO-002 — Heartbeat fields [MUST]:** Include protocol version, agent ID, display name, runtime ID, monotonic sequence, observed/last-seen time, status, current task/run, capabilities, activity mode, events, command acknowledgments, queue additions, optional avatar image, and optional office design.

- **PRO-003 — Status enum [MUST, Baseline]:** Agent presence supports `active`, `idle`, and `waiting_on_matt`.

- **PRO-004 — Command fields [MUST]:** Include command ID, target agent, verb, optional work item, issued time, expiry, idempotency key, approval requirement, and payload/reference.

- **PRO-005 — Delivery guarantees [MUST]:** Delivery may be at least once, but logical effects are exactly once per idempotency key. Sequence gaps are visible. Offline commands retain a TTL. Errors distinguish retryable from terminal.

- **PRO-006 — Acknowledgments [MUST]:** Track accepted, running, completed, and failed separately; record result/evidence and update the linked work item.

- **PRO-007 — Compatibility [MUST]:** Existing v1 heartbeat fields remain accepted while v2 capabilities, ordered events, and acknowledgments are adopted.

- **PRO-008 — Registration-before-connection [MUST, Baseline]:** Registered agent buildings appear in the plug-in panel even before a connection row exists and show “Never connected.”

- **PRO-009 — No direct agent command [MUST, Locked]:** Agents request subtasks or handoffs through Crew OS. Policy is evaluated once, a durable command is issued to the destination, and the chain remains auditable.

---

## 12. Data model

The complete target model includes the current schema plus proposed control-plane entities.

| Entity | Purpose | Status |
| --- | --- | --- |
| Organization | BIS boundary and config | Baseline |
| Agent | Role and identity | Baseline |
| Runtime | Execution location | Target |
| Capability | Allowed work/tools | Target |
| Policy | Dispatch/approval rules | Target |
| Goal / project | Why work exists | Baseline |
| Work item | Durable unit of intent | Baseline |
| RACI assignment | Ownership map | Baseline |
| Run | One execution attempt | Target |
| Command | Delivery envelope | Baseline |
| Handoff | Context transfer | Baseline |
| Thread / message | Conversation | Partial |
| Artifact | Delivered evidence | Baseline |
| Cognition reference | External canonical pointer | Target |
| Approval | Human decision gate | Baseline |
| Event | Immutable history | Baseline |
| Agent connection | Transport and presence | Baseline |
| Office manifest | Agent/owner design | Baseline |
| Building | City registry entry | Baseline |
| Activity / queue | Briefing compatibility | Baseline |

- **DAT-001 — Referential links [MUST]:** Work, commands, runs, handoffs, messages, artifacts, approvals, and events must link through stable IDs.

- **DAT-002 — Cognition references [MUST, Target]:** External records store canonical URI/reference, record type, revision, authority, and last-resolved time. They do not copy sensitive or fast-changing source content unnecessarily.

- **DAT-003 — Immutable audit [MUST]:** State changes append actor, time, reason, entity, prior/current state or result. Security events are immutable.

- **DAT-004 — Outbox transaction [MUST]:** A command and its queued event are committed atomically; adapters only see committed commands.

- **DAT-005 — Read model [SHOULD]:** Optimize HQ snapshots separately from append-heavy operational events.

- **DAT-006 — Retention [SHOULD, Target]:** Operational history retention is configurable. Security and approval history cannot be silently deleted.

- **DAT-007 — Migration compatibility [MUST]:** Preserve current activity, approval, queue, crew, goal, connection, building, message, and office data while introducing target entities.

## 13. Owner access, policy, and security

- **SEC-001 — First-run setup [MUST, Baseline]:** If no owner access exists, show a one-time choose-and-confirm passphrase flow with a minimum of 16 characters.

- **SEC-002 — No reset by design [MUST, Locked]:** The first-run passphrase flow has no ordinary reset path. Any recovery design requires a separate explicit security decision.

- **SEC-003 — Session [MUST, Baseline]:** Successful setup or login creates a server-signed 12-hour owner session held in browser memory and bound to the owner context.

- **SEC-004 — Protected data [MUST]:** Dashboard reads and owner mutations require the active owner session. Public bootstrap reveals only whether setup exists.

- **SEC-005 — Secret handling [MUST]:** Never log or render passphrases, owner tokens, pairing codes after their brief use, long-lived agent credentials, portrait bytes, or external secrets.

- **SEC-006 — Least privilege [MUST]:** Credentials bind one organization, one agent, one transport, and an explicit capability set.

- **SEC-007 — Input boundaries [MUST]:** Bound string lengths, image size/MIME, placement counts, transforms, URLs/references, event batches, and queue/activity batches before persistence.

- **SEC-008 — Approval tiers [MUST, Target]:** Routine reads/tests may be policy-allowed; drafts/PR proposals notify or wait for review; sends/publishes/merges/spend require owner approval; cross-boundary secrets are never dispatched.

- **SEC-009 — Boundary integrity [MUST]:** BIS and personal cognition remain separate scopes. A BIS task cannot read or write personal scope unless Matt explicitly changes policy for that action.

- **SEC-010 — Revocation [MUST]:** Re-pairing or disconnect revokes the affected credential without deleting agent identity, office, or history.

- **SEC-011 — Emergency stop [MUST, Target]:** One visible control halts new dispatch and reports each runtime’s acknowledgment. Stop requests never masquerade as completed stops.

- **SEC-012 — URL safety [MUST]:** Do not put credentials or protected identifiers in URLs. Evidence links must be valid references and subject to owner visibility.

---

## 14. Required action surface

The names below preserve the current callable contract where it exists. A different implementation may expose equivalent endpoints, but comparison should verify the same behavior and authorization.

### 14.1 Owner access and reads

- **`owner_access_status` [Baseline]:** Return only whether owner setup exists.
- **`owner_setup` [Baseline]:** One-time passphrase setup and initial session issuance.
- **`owner_login` [Baseline]:** Verify passphrase and issue a 12-hour session.
- **`get_dashboard` [Baseline]:** Return brief activity, waiting approvals, queue, crew, goals, connections, buildings, office designs, and messages.
- **`get_hq_snapshot` [Baseline]:** Return work items/RACI, commands, handoffs, artifacts, and operational events.

### 14.2 City, office, and identity

- **`register_building` [Baseline]:** Create a unique agent HQ or project site and initialize an agent slot when assigned.
- **`set_agent_avatar` [Baseline]:** Owner uploads a bounded PNG/JPEG for an agent.
- **`get_office_catalog` [Baseline]:** Publish approved assets, slots, themes, dimensions, tiers, and attribution.
- **`set_office_decor` [Baseline compatibility]:** Save legacy theme/decor choices as an owner design.
- **`preview_office_design` [Target]:** Validate and render owner changes without persistence.
- **`save_office_design` [Baseline]:** Save an owner override with expected revision.
- **`clear_office_override` [Baseline]:** Return effective control to the agent design or theme default.
- **`reset_office_default` [Target]:** Explicitly discard owner and agent design only with confirmed owner intent, then use theme default.

### 14.3 Collaboration and delivery

- **`create_work_item` [Baseline]:** Create durable intent with title, brief, priority, goal, and optional parent.
- **`set_work_raci` [Target]:** Replace or amend the complete Responsible/Accountable/Consulted/Informed map atomically.
- **`assign_work_item` [Baseline]:** Add one RACI assignment with optimistic revision check.
- **`link_cognition_record` [Target]:** Attach an authoritative shared-cognition reference.
- **`dispatch_work_item` [Baseline]:** Queue an idempotent `work.start` command for a Responsible agent.
- **`claim_command` [Target]:** Lease a command/run to one runtime.
- **`poll_commands` [Baseline]:** Return active unexpired commands for the authenticated agent.
- **`ack_command` [Baseline]:** Record accepted/running/completed/failed and update linked work.
- **`append_agent_events` [Target]:** Append an ordered, deduplicated event batch with sequence checks.
- **`submit_artifact` [Baseline]:** Record evidence and move work to Waiting Approval.
- **`request_handoff` [Baseline]:** Propose a context-bearing transfer from one agent to another.
- **`accept_handoff` [Baseline]:** Owner accepts or rejects a proposed handoff.
- **`complete_handoff` [Target]:** Record destination acknowledgment and ownership transition completion.
- **`update_work_item_status` [Baseline]:** Owner changes lifecycle state with revision check.
- **`pause_agent` [Target]:** Stop new assignments and apply the configured current-run policy.
- **`pause_mission` [Target]:** Freeze unstarted mission work while preserving context and evidence.
- **`global_stop` [Target]:** Halt dispatch and request lease revocation across adapters.

### 14.4 Agent onboarding and status

- **`create_pairing_code` [Baseline]:** Owner creates a 10-minute, single-use code and revokes the prior HTTPS credential.
- **`redeem_pairing_code` [Baseline]:** Agent exchanges the code for a credential returned only to that agent.
- **`report_heartbeat` [Baseline]:** Authenticated HTTPS agent submits presence, work state, events, queue, avatar, office design, and command acknowledgments.
- **`ingest_drive_heartbeats` [Baseline]:** Accept a bounded set of validated token-free Drive heartbeats.
- **`disconnect_agent` [Target]:** Revoke transport credentials while retaining profile, office, and history.

### 14.5 Briefing and compatibility actions

- **`send_agent_message` [Partial]:** Current behavior records an inbox note and activity. Target behavior must add durable delivery and acknowledgment.
- **`add_activity` [Baseline]:** Add a deduplicated timeline event.
- **`add_approval` [Baseline]:** Add a deduplicated waiting item.
- **`request_approval` [Target]:** Create a work/run-scoped approval with exact proposed action and policy tier.
- **`resolve_approval` [Baseline]:** Owner records a durable resolution.
- **`update_goal_progress` [Baseline]:** Update progress for an existing goal.
- **`update_crew_status` [Baseline]:** Update compatibility roster status.
- **`set_today_agenda` [Baseline]:** Atomically replace the day’s agenda.
- **`add_queue_item` / `remove_queue_item` [Baseline]:** Manage owner manual queue rows.
- **`apply_morning_sync` [Baseline]:** Apply a validated, deduplicated refresh payload.
- **`refresh_morning_brief` [Baseline]:** Start scheduled or owner-triggered refresh with reason-aware authorization.

---

## 15. Reference contracts

### 15.1 Heartbeat v2

```json
{
  "protocol_version": 2,
  "agent_id": "jeff",
  "display_name": "Jeff",
  "runtime_id": "office-pc",
  "sequence": 1842,
  "status": "active",
  "current_task": "Run the assigned work item",
  "current_run_id": "run_example",
  "last_seen": "2026-09-25T14:00:00Z",
  "current_activity": "typing",
  "capabilities": ["repo.read", "repo.patch", "tests.run"],
  "activity": [],
  "queue": [],
  "events": [
    {
      "id": "evt_example",
      "type": "run.progress",
      "summary": "Tests passing"
    }
  ],
  "command_acks": [
    {
      "command_id": "cmd_example",
      "status": "accepted"
    }
  ],
  "office_design": {
    "version": 1,
    "theme": "command_center",
    "palette": "graphite",
    "placements": [
      {
        "slot": "primary_desk",
        "asset_id": "kenney.corner_desk"
      }
    ]
  }
}
```

**Contract notes:** `avatar_image` may contain a bounded base64 PNG/JPEG object when the transport can safely carry it. Drive files contain no credential. HTTPS requests add the agent credential outside the reusable heartbeat body. Unknown optional extensions are rejected or version-gated rather than silently persisted.

### 15.2 HQ command

```json
{
  "command_id": "cmd_example",
  "target_agent_id": "jeff",
  "verb": "work.start",
  "work_item_id": "work_example",
  "issued_at": "2026-09-25T14:01:00Z",
  "expires_at": "2026-09-25T15:01:00Z",
  "idempotency_key": "work_example:rev_3",
  "requires_approval": false,
  "payload": {
    "brief_ref": "ctx_example",
    "priority": "high"
  }
}
```

### 15.3 Office design

```json
{
  "version": 1,
  "theme": "comms_loft",
  "palette": "bis_blue",
  "placements": [
    {
      "slot": "primary_desk",
      "asset_id": "kenney.corner_desk",
      "rotation": 0
    },
    {
      "slot": "task_chair",
      "asset_id": "kenney.desk_chair"
    },
    {
      "slot": "feature_prop",
      "asset_id": "kenney.satellite_dish"
    }
  ]
}
```

---

## 16. Performance, resilience, accessibility, and observability

### 16.1 Rendering budgets

| Budget | Desktop | Mobile |
| --- | ---: | ---: |
| Visible decor | 24 max | 16 max |
| Initial room payload | 8 MB | 4 MB |
| Unique materials | 28 | 18 |
| Dynamic lights | 4 | 2 |
| Shadow casters | 12 | 6 |
| Interactive-ready goal | 2.5 s | 3.5 s |

**Interpretation:** The current manifest limit remains 12 placements. The larger visible-decor budget allows built-in room shell and operational surfaces. Readiness goals apply to warm app load, typical broadband, and supported hardware; measure rather than assume.

- **NFR-001 — Quality tiers [MUST]:** Core includes room shell, live task screen, avatar, desk, chair, and one light. Standard adds theme furniture/decor and restrained animation. Enhanced adds secondary props and richer lighting on capable devices.

- **NFR-002 — Reduced motion [MUST]:** Respect system preference and an in-app option. Disable travel, pulsing, ticker movement, and vehicle loops while preserving status changes.

- **NFR-003 — Cross-browser [MUST]:** Smoke test desktop Chrome, Firefox, and Edge plus mobile Safari and Chrome. No supported browser may show an empty scene without fallback.

- **NFR-004 — Context recovery [MUST]:** Handle WebGL context loss/restoration, zero-sized containers, resize, visibility changes, rapid navigation, and asset-load errors.

- **NFR-005 — Accessibility [MUST]:** Keyboard-operable forms and navigation, associated labels, focus visibility, semantic progress/status, meaningful image alternative text, readable contrast in day/dusk, and non-3D access to every action.

- **NFR-006 — Loading states [MUST]:** Show preparing, ready, empty, failure, and stale/disconnected states explicitly.

- **NFR-007 — Diagnostics [MUST]:** Record model-load failures by asset ID; effective design source/revision; quality tier; asset count; triangles when available; load duration; adapter lag; sequence gaps; lease age; and terminal error reason.

- **NFR-008 — Privacy in logs [MUST]:** Diagnostics exclude portrait bytes, passphrases, session tokens, pairing codes, agent credentials, and unrelated source content.

- **NFR-009 — Bounded reads [MUST]:** Snapshots and feeds use practical limits, pagination/search, and deterministic ordering.

- **NFR-010 — No false completion [MUST]:** A queued task, spawned refresh, or requested stop is not “done” until its result or acknowledgment confirms completion.

---

## 17. Truthful gamification

- **GAM-001 — Agent active:** Occupied, lit station plus an Active badge.
- **GAM-002 — New assignment:** Agent moves to the relevant zone plus a queue row.
- **GAM-003 — Handoff:** A packet/courier moves only after destination acknowledgment; the 2D view shows the handoff card and state.
- **GAM-004 — Approval:** Review Room beacon plus a Needs Matt item.
- **GAM-005 — Failure:** Warning pulse plus readable error, retryability, and next action.
- **GAM-006 — Artifact:** An object arrives on the mission/review table plus an evidence link.
- **GAM-007 — Milestone:** Project site advances one named stage plus progress history.
- **GAM-008 — Offline:** Office dims gently plus a Disconnected label and last-seen time.
- **GAM-009 — Shared mission:** Assigned agents may gather around the mission table.
- **GAM-010 — Trophies:** Represent named, inspectable outcomes; never abstract points.
- **GAM-011 — No streak pressure [MUST]:** Do not create anxiety-driving streaks or cosmetic progress unrelated to verified outcomes.
- **GAM-012 — Inspectable effects [MUST]:** Every visual effect maps to a labeled, timestamped record and a 2D equivalent.

---

## 18. End-to-end acceptance criteria

### 18.1 Product and control

- **ACC-001:** Within 60 seconds, the owner can identify every active, waiting, blocked, failed, stale, and disconnected agent.
- **ACC-002:** Owner can create a mission, assign complete RACI, dispatch it, and observe queued, accepted, running, and completed as distinct states.
- **ACC-003:** One real mission involving two agents completes a handoff, one owner approval, and one delivered artifact without copying context between terminals.
- **ACC-004:** HQ and each office show the same work item, thread, run, responsibility, approvals, and evidence.
- **ACC-005:** A disconnected agent resumes queued work without duplicate logical execution.
- **ACC-006:** Pause, cancel, retry, approval, rejection, and credential revocation are enforced and audited.
- **ACC-007:** A recorded note that has not reached an agent is visibly not delivered.
- **ACC-008:** The owner can complete the critical loop on mobile without 3D precision.

### 18.2 City and office

- **ACC-009:** City supports agent and project buildings, all initial HQ mappings, day/dusk, pointer/touch navigation, and 2D fallback.
- **ACC-010:** Each of six themes renders a distinct, complete office using at least five catalog-backed models or explicit safe fallbacks.
- **ACC-011:** Agent can change office design through Drive and HTTPS; owner can preview, override, clear, and identify the effective design source.
- **ACC-012:** Unknown IDs, incompatible slots, malformed files, and stale revisions cannot corrupt the last valid room.
- **ACC-013:** Avatar remains visible and does not intersect furniture at every activity station.
- **ACC-014:** Current task, notification, queue count, and approval count remain readable in day and dusk.
- **ACC-015:** No decor blocks the exit, camera target, avatar click target, live screen, or navigation.

### 18.3 Reliability and security

- **ACC-016:** A model 404, malformed glTF, missing texture, shader error, or WebGL failure leaves a useful 2D/procedural experience.
- **ACC-017:** Repeated office entry reuses cache and does not grow GPU memory without bound.
- **ACC-018:** Rapid switching among city, HQ, office, dashboard, day, and dusk produces no uncaught error.
- **ACC-019:** Scheduled 5:55 AM refresh runs without an owner session; manual refresh cannot bypass owner authentication.
- **ACC-020:** Drive heartbeat files contain no reusable credential; one agent cannot update another agent’s identity or mailbox.
- **ACC-021:** One-time HTTPS pairing code expires after 10 minutes, cannot be reused, and re-pairing invalidates the old credential.
- **ACC-022:** Logs and UI reveal no passphrase, owner token, long-lived agent credential, or raw portrait bytes.
- **ACC-023:** BIS work cannot cross into personal cognition without explicit owner policy.

### 18.4 Attribution and quality

- **ACC-024:** Every visible CC-BY model resolves to author/source and appears in Credits.
- **ACC-025:** Reduced motion removes nonessential movement without hiding state.
- **ACC-026:** Desktop and mobile meet the stated smoke-test and fallback requirements.
- **ACC-027:** The app never reports successful delivery, execution, stop, or deployment from request creation alone.

---

## 19. Recommended implementation sequence

### Phase 0 — Stabilize the baseline

1. Reproduce the current source at the recorded `main` snapshot.
2. Preserve owner access and existing data through migrations.
3. Stabilize city/office rendering and the complete 2D fallback.
4. Tag a working baseline before schema expansion.

### Phase 1 — Asset-backed offices

1. Build the typed asset registry, license validation, slot anchors, cache, and procedural fallback.
2. Complete Relay’s Comms Loft as the reference room.
3. Compose all six themes and verify avatar stations, day/dusk, mobile tiers, and reduced motion.
4. Complete agent proposals, owner preview/override/reset, revisions, warnings, and Credits.

### Phase 2 — Durable collaboration core

1. Add or finish organization, runtime, capability, policy, work item, full RACI, run, command, handoff, thread, artifact, cognition reference, approval, and typed event records.
2. Dual-write legacy activity/message mutations into typed events while preserving compatibility.
3. Add leases, idempotency, optimistic concurrency, and atomic command outbox behavior.
4. Finish owner pause/cancel/retry/revoke/global-stop controls without changing the 3D world.

### Phase 3 — Useful HQ in 2D

1. Build Mission, Dispatch, Live Ops, Handoff, Collaboration, and Review panels against real records.
2. Add Needs Matt, health, saved filters, search, keyboard navigation, and mobile controls.
3. Ensure the office and HQ share the same work/thread/read models.

### Phase 4 — Adapters and real delivery

1. Implement the HTTPS reference adapter and isolated Drive mailbox contract.
2. Connect Jeff first; verify identity, office proposal, command poll, ack, run, artifact, handoff, failure, and reconnect.
3. Publish a small adapter SDK, schema, conformance suite, and onboarding workflow.
4. Have Jeff onboard Relay, Jefferson, and Jev one at a time without receiving their credentials.

### Phase 5 — 3D HQ and game layer

1. Place the six operational zones in the BIS HQ building.
2. Bind real events to agent motion, handoff packets, beacons, artifacts, and project stages.
3. Preserve complete 2D, reduced-motion, and no-WebGL operation.
4. Add ambient flying vehicles only after operational reliability is proven.

---

## 20. Known baseline gaps to avoid carrying forward

- **GAP-001 — Notes are not commands:** The current `send_agent_message` records a note and activity but does not prove agent delivery or acknowledgment.
- **GAP-002 — Drive is mostly inbound:** Current Drive JSON handles heartbeat/status; the target needs an isolated bidirectional mailbox for commands and acknowledgments.
- **GAP-003 — Shared folder migration:** Current ingestion uses one shared status folder. The approved target is one isolated folder/mailbox per agent.
- **GAP-004 — Collaboration model is partial:** Work items, commands, handoffs, artifacts, and events exist, but runtimes, capabilities, policies, runs/leases, threads, and cognition references remain target work.
- **GAP-005 — RACI UI is partial:** Current UI exposes Responsible and Accountable. Complete Consulted/Informed management and exactly-one-Accountable enforcement are still required.
- **GAP-006 — Stop controls are partial:** Work-item pause/cancel exists; agent, mission, routine, queue, and global stop with runtime acknowledgment remain required.
- **GAP-007 — Office editor is partial:** Structured designs and owner override exist; live unsaved preview, explicit theme-default reset, preset duplication, full catalog credits, and broader pack curation remain to finish.
- **GAP-008 — Visual verification:** A successful build is not proof that an avatar, decor change, or 3D fix shipped. Validate the served bundle and inspect authenticated views on target browsers.
- **GAP-009 — Current project matching:** Some dashboard relationships are inferred from text. Replace this with stable IDs and explicit links.
- **GAP-010 — Run truth:** Current command acknowledgment updates work status directly. A complete implementation must model separate execution runs and leases.

---

## 21. Deferred or explicit non-goals

- **DEF-001:** Full multi-company administration or shared multi-tenancy.
- **DEF-002:** Marketplace plugins, autonomous hiring, or agent performance reviews.
- **DEF-003:** Direct credential sharing or unrestricted agent-to-agent command execution.
- **DEF-004:** Replacing each agent’s native runtime or terminal; Crew OS coordinates rather than homogenizes them.
- **DEF-005:** Arbitrary GLB/glTF uploads, arbitrary asset URLs, mesh editing, skeletal rigging, or animation authoring in the first complete release.
- **DEF-006:** Free-form room editing with arbitrary coordinates, scale, or scripts; use validated slots and bounded variants first.
- **DEF-007:** Physics-heavy multiplayer or collision simulation.
- **DEF-008:** A points economy, streaks, or cosmetic progression unrelated to verified work.
- **DEF-009:** Ambient spaceship traffic before core control, fallback, and reduced-motion behavior are stable.

---

## 22. Comparison rubric for the experiment

Use the same acceptance data and agent simulators for both implementations. Do not award credit for screens that are disconnected from durable behavior.

| Area | Weight |
| --- | ---: |
| Truthful work control | 25% |
| Adapter delivery/recovery | 20% |
| Security and boundaries | 15% |
| City/office experience | 15% |
| HQ usability | 10% |
| Data integrity/audit | 10% |
| Performance/accessibility | 5% |

### Hard gates

An implementation cannot be considered the better result if it:

- exposes a passphrase or reusable credential;
- claims queued work was received or completed without acknowledgment;
- loses existing data during migration;
- permits one agent to impersonate another;
- lets BIS work cross into personal cognition without explicit policy;
- becomes unusable when WebGL or one 3D asset fails; or
- fabricates activity to make the world look busy.

### Demonstration script

1. Complete first-run owner setup, sign out, and sign in again.
2. Connect Jeff through an isolated adapter and show last-seen/status.
3. Have Jeff submit an avatar and valid office design; reject an invalid design without losing the valid room.
4. Create one mission with Jeff Responsible and Matt Accountable; add another agent as Consulted.
5. Dispatch, acknowledge, start, and complete the work while showing each state distinctly.
6. Submit an artifact and require an owner review decision.
7. Request and accept a handoff to a second agent; prove context/evidence continuity.
8. Disconnect and reconnect the agent; prove no duplicate logical execution.
9. Trigger a model failure and a WebGL failure; complete the same control flow in 2D.
10. Run scheduled-style morning sync without owner UI state, then run manual sync with owner authentication.
11. Test phone layout, keyboard navigation, day/dusk, and reduced motion.
12. Inspect the audit log and verify no secrets or false completion claims.

---

## 23. Assumptions and reconciliation notes

- The implementation may use a different stack, but the current baseline is React + TypeScript, Three.js r186, server actions, Drizzle, and SQLite.
- The current source limits an office manifest to 12 placements; the earlier decor proposal mentioned 24 visible decor objects. This specification treats 12 as the compatibility contract and 24/16 as desktop/mobile scene budgets including built-in surfaces.
- The current Drive implementation uses a shared status folder with one file per agent. The approved architecture requires isolated per-agent folders/mailboxes; treat the shared folder as a migration input, not the final authorization model.
- The current collaboration core proves several entities and actions, but the end-to-end adapter command loop, run leases, full RACI, thread delivery, policy enforcement, and global controls still require implementation and real-runtime verification.
- Owner passphrase recovery is intentionally absent. Do not invent a reset flow for the experiment.
- The comparison should evaluate the served application, not merely source compilation or a successful deployment command.

---

## 24. Source basis

- Current private source: [Crew OS](https://github.com/matboy82/crew-os), `main` commit `abe9a68761bb2866575ea82ce17bf0b4a7517b30`
- Imported office/city assets proposal: [Crew OS pull request #1](https://github.com/matboy82/crew-os/pull/1)
- Secure owner/pairing work: Crew OS pull request #2
- Shared-cognition plug-in guide: [BIS-Vault pull request #44](https://github.com/matboy82/BIS-Vault/pull/44)
- Control-plane inspiration: [Paperclip](https://github.com/paperclipai/paperclip)
- Reviewed asset sources: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) and [Kenney Space Kit](https://kenney.nl/assets/space-kit)

The detailed requirements also incorporate the approved BIS HQ product/architecture sketch, the 3D office/decor specification, the current server action and schema surface, the daily 5:55 AM refresh definition, and Matt’s accepted design decisions through September 25, 2026.

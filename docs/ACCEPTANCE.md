# Acceptance status

This file distinguishes implemented behavior from live-service and visual acceptance. It is not a claim that every item in the supplied requirements has passed.

## Implemented

- Standalone local/server runtime; Node.js, SQLite WAL, container configuration, lazy-loaded Babylon.js, no hosted SDK.
- Owner setup/login/logout, 12-hour memory-only sessions, hashed agent credentials, expiring one-use pairing, revocation, protected reads, origin checks and bounded JSON.
- Durable work, complete RACI, revisions, command outbox, idempotency enforced by a database index, separate runs and leases, recovery, owner review, artifacts, references, private messages and explicit promotion, handoffs.
- Queue/agent/mission/routine pause controls with separate runtime acknowledgment.
- City, offices, six HQ views and corresponding 3D zones; phone controls, day/dusk, manual 2D mode, failed-WebGL fallback. The city now uses the available page width, each viewer expands to the viewport, and orbit/zoom/reset controls remain available. Real 3D building and avatar picking opens office and agent details; equivalent buttons provide keyboard access. The sidebar collapses and Morning Brief, agenda, approvals and goals have focused pages.
- Curated furniture, including five individually checked CC0 models from the original Poly Pizza pack, and supplied portraits; validated office previews/overrides/reset, revisions and credits.
- Server-side Denver schedule, read-only Calendar/GitHub providers, configured schedule snapshots and isolated local Drive mailbox bridge.
- Hermes CLI handler using the installed structured result protocol, stdin input, persistent execution ledger, concurrent control polling and preserved runtime approvals.
- Read-only legacy database import into a new destination, raw record archive, explicit disconnected/blocked migration state and preserved undelivered-note semantics.

## Verification record

On September 25, 2026, all 18 core, HTTP, migration, adapter and Hermes workspace-boundary tests passed. Production TypeScript compilation and bundling passed. Chromium, Firefox, WebKit and iPhone emulation passed owner flows, WebGL fallback and the expanded viewer with focus pages. A desktop test clicks actual 3D building and avatar meshes, and the four initial offices are checked for missing model assets. The viewer tests inspect screenshot pixels so a blank full-screen canvas fails even when WebGL says it is ready. A polling regression confirms the office canvas survives heartbeat and unrelated data updates. Desktop office/city and phone expanded-view screenshots were inspected. Generated screenshots and traces are in `test-results/` and are excluded from git. On the local installation, Jeff's one-use pairing was redeemed and repeated `hermes-jeff` heartbeats were recorded from a running adapter. A live short note reached Hermes but did not produce a result; after sustained execution it was stopped and marked failed. The adapter now applies a default run budget. No live Hermes mission or Muse connection has been successfully tested.

## External acceptance still required

- Run a real Jeff mission with owner review, then the two-agent mission/approval/handoff/evidence acceptance script. Jeff has been paired locally, but no real agent execution has been claimed from a CLI help check or heartbeat.
- Verify Jeff's allowed Hermes tools before a real mission. The local launcher now points at `Shared Cognition/BIS-Cognition`; the runtime's own tool policy and filesystem isolation remain necessary to enforce its access boundary.
- Supply Google/GitHub credentials and isolated Drive folders/mounts. The included Drive bridge uses mapped private folders; a managed cloud Drive API service and automatic Google token refresh are not bundled.
- Export the hosted baseline database/blobs if migration is needed. No live baseline database was found in the source repo. Existing hosted owner auth and blob storage must be migrated separately; the importer preserves record metadata and requires fresh standalone owner setup and agent pairing.
- Validate the container on the intended server, HTTPS reverse proxy, backup/restore, physical iOS/Android devices, and measured rendering budgets on target hardware.

## Remaining specification work

The imported character bodies remain the experiment's prototype GLBs. This rebuild has not commissioned production character models or animation clips. The renderer now includes seated limb articulation and activity-driven typing, presenting, walking, reading, on-call and celebration poses, gated by a connected runtime. Station clearance across every character/theme still needs a complete visual acceptance pass. Project construction stages now advance only from verified closed milestones. Animated acknowledged handoff couriers and artifact/table animations still need a dedicated art/animation pass. The interface and runtime state do not invent these effects.

Optional office preset duplication, saved operational filters, budget accounting, expanded pack curation, and movable overlays are not implemented. The app should not be represented as fully conforming to every MUST in the supplied document until the character/animation requirements and external acceptance above are closed.



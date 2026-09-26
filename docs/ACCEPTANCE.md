# Acceptance status

This file distinguishes implemented behavior from live-service and visual acceptance. It is not a claim that every item in the supplied requirements has passed.

## Implemented

- Standalone local/server runtime; Node.js, SQLite WAL, container configuration, lazy-loaded Babylon.js, no hosted SDK.
- Owner setup/login/logout, 12-hour memory-only sessions, hashed agent credentials, expiring one-use pairing, revocation, protected reads, origin checks and bounded JSON.
- Durable work, complete RACI, revisions, command outbox, idempotency enforced by a database index, separate runs and leases, recovery, owner review, artifacts, references, private messages and explicit promotion, handoffs.
- Queue/agent/mission/routine pause controls with separate runtime acknowledgment.
- City, offices, six HQ views and corresponding 3D zones; phone controls, day/dusk, manual 2D mode, failed-WebGL fallback. The city now uses the available page width, each viewer expands to the viewport, and orbit/zoom/reset controls remain available. Real 3D building and avatar picking opens office and agent details; equivalent buttons provide keyboard access. The sidebar collapses and Morning Brief, agenda, approvals and goals have focused pages.
- Curated furniture, including fourteen individually checked CC0 models from the original Poly Pizza pack, and supplied portraits; validated office previews/overrides/reset, revisions and credits. White slab-and-glass campus and room architecture follows the supplied reference. Relay has a new reference-based procedural GLB with articulated limbs. Desk, screen, chair and accessory anchors were corrected.
- Reusable owner office presets; named operational views; verified resource budgets with soft warnings and hard dispatch limits; movable, collapsible Morning Brief overlay on the city viewer.
- Owner position editors for office furniture and city items with six-axis movement, live preview, bounded persisted positions and revision checks. Campus buildings have editable work-type styles and five selectable building models; owners can place and edit catalog-backed campus assets. Bounded building moves preserve clear plots and the HQ plaza. Two decorative ship routes use models from the original experiment and stop for reduced motion. Owner-directed project states render prepared dirt plots, scaffolded construction, and finished buildings; retiring a project leaves a claimable plot and archived project history.
- Server-side Denver schedule, read-only Calendar/GitHub providers, configured schedule snapshots and isolated local Drive mailbox bridge.
- Hermes CLI handler using the installed structured result protocol, stdin input, persistent execution ledger, concurrent control polling and preserved runtime approvals.
- Read-only legacy database import into a new destination, raw record archive, explicit disconnected/blocked migration state and preserved undelivered-note semantics.

## Verification record

On September 25, 2026, all 23 core, HTTP, migration, adapter and Hermes workspace-boundary tests passed. Production TypeScript compilation and bundling passed. Chromium, Firefox, WebKit and iPhone emulation passed owner flows, WebGL fallback and the expanded viewer with focus pages. A desktop test clicks actual 3D building and avatar meshes, and the four initial offices are checked for missing model assets. The viewer tests inspect screenshot pixels so a blank full-screen canvas fails even when WebGL says it is ready. A polling regression confirms the office canvas survives heartbeat and unrelated data updates. Desktop office/city and phone expanded-view screenshots were inspected. Generated screenshots and traces are in `test-results/` and are excluded from git. On the local installation, Jeff's one-use pairing was redeemed and repeated `hermes-jeff` heartbeats were recorded from a running adapter. A live short note reached Hermes but did not produce a result; after sustained execution it was stopped and marked failed. The adapter now applies a default run budget. No live Hermes mission or Muse connection has been successfully tested.

The September 26 pass added a city model/asset browser workflow and a core test for revisioned city placement, building collision checks, and asset add/edit/remove. The core suite has 24 passing tests. All ten Chromium cases passed across the full pass and a focused rerun after updating a selector for the renamed architecture field. Four applicable mobile cases passed; six desktop-specific cases were skipped. The final bundle was rebuilt after the city preview-state fix.

The following HQ pass added a revisioned HQ building model/position and bounded room desk offsets. HQ 3D desks select a matching focused panel; the Live Ops event log scrolls inside its own region. Four more selectable procedural building variants cover skyscraper, office, big-box and warehouse forms. These are functional stylized geometry and need an art review before claiming game-quality models. The new HQ persistence test and focused Chromium editor flow pass.

## External acceptance still required

- Run a real Jeff mission with owner review, then the two-agent mission/approval/handoff/evidence acceptance script. Jeff has been paired locally, but no real agent execution has been claimed from a CLI help check or heartbeat.
- Verify Jeff's allowed Hermes tools before a real mission. The local launcher now points at `Shared Cognition/BIS-Cognition`; the runtime's own tool policy and filesystem isolation remain necessary to enforce its access boundary.
- Supply Google/GitHub credentials and isolated Drive folders/mounts. The included Drive bridge uses mapped private folders; a managed cloud Drive API service and automatic Google token refresh are not bundled.
- Export the hosted baseline database/blobs if migration is needed. No live baseline database was found in the source repo. Existing hosted owner auth and blob storage must be migrated separately; the importer preserves record metadata and requires fresh standalone owner setup and agent pairing.
- Validate the container on the intended server, HTTPS reverse proxy, backup/restore, physical iOS/Android devices, and measured rendering budgets on target hardware.

## Remaining specification work

Jeff, Jefferson, and Jev still use the experiment's prototype GLBs; Relay's new authored GLB is a procedural interpretation of her supplied portrait, not a commissioned character rig. The renderer now restores task-to-activity mapping from the original experiment when a connected agent is active or has a running record, while honoring explicit heartbeat activity. Idle, waiting and disconnected agents remain idle; celebration requires an explicit activity cue. Seated articulation and typing, presenting, walking, reading and on-call gestures have been improved. Station clearance across every character/theme still needs a complete visual acceptance pass. Project milestones retain their separate evidence trail; lifecycle transitions are explicit owner decisions with recorded notes. Animated acknowledged handoff couriers and artifact/table animations still need a dedicated art/animation pass. The interface and runtime state do not invent these effects.

The optional owner controls now include office presets, saved filters, verified budget accounting, expanded pack curation, and a movable brief panel. The app should not be represented as fully conforming to every MUST in the supplied document until the remaining character/animation requirements and external acceptance above are closed.



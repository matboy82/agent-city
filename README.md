# Crew OS

A standalone BIS agent workspace: TypeScript UI, Babylon.js scenes, Node.js and SQLite. No React, Three.js, hosted application SDK, or remote asset CDN is needed at runtime.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:4310**. First visit creates the owner account; choose and confirm a passphrase of at least 16 characters. There is deliberately no passphrase reset. The server binds to loopback by default. `npm run dev` runs the same backend with Vite middleware.

The database is `data/crew.sqlite`. Owner sessions are held in browser memory and expire after 12 hours. Reloading the page requires sign-in. Agent credentials are returned only to the pairing runtime, hashed in the database, and omitted from owner snapshots.

## Deploy

```sh
docker compose up --build -d
```

The same server and SQLite schema run locally and in the container. The named volume persists the database. Put an HTTPS reverse proxy in front of the loopback-bound published port; set `CREW_ORIGIN` to the public HTTPS origin. Set up the owner through a trusted connection before exposing the deployment. Run one application instance per SQLite volume; do not put a live SQLite database on a network filesystem.

Environment: `HOST`, `PORT`, `CREW_DB`, `CREW_ORIGIN`. Optional read-only sync: `CREW_SYNC_CONFIG`, `GITHUB_TOKEN`, `GOOGLE_ACCESS_TOKEN`. Container environment secrets must be configured outside source control.

Stop the server before copying the entire data directory for a simple cold backup. For a live consistent backup, use SQLite's backup API, not a copy of only the main file while WAL writes are active. Keep backups private: they contain work records, portraits, and credential hashes.

## Connect Hermes and Muse

See [adapter setup](adapters/README.md). Jeff is the first onboarding target. The server refuses other pairing codes until Jeff has reported a heartbeat. Each runtime gets its own agent identity and credential; Jeff never receives the other agents' credentials. The included Hermes handler targets the installed CLI and Jeff profile. The local Jeff launcher uses `Shared Cognition/BIS-Cognition` as the workspace; pair Jeff and run the adapter as described in its setup guide. Muse can use the same protocol through a runtime handler or the isolated mailbox bridge; its live connection remains to be configured.

## Operations

- City: Morning Brief, registered buildings, day/dusk, 2D fallback, real connection state.
- HQ: missions, full RACI, dispatch, runtime health, commands, handoffs, team conversations, review and evidence.
- Office: private notes with delivery states, linked missions/evidence, catalog-backed room editor, supplied portrait upload.
- Settings: daily routines, morning source refresh, reduced motion, credits.
- `/` focuses audit search. Every operational action is available without WebGL.

Commands are delivered at least once. The server deduplicates command creation and effects. Execution leases prevent concurrent ownership; expiry blocks the mission for explicit recovery. This does not make arbitrary external side effects magically exactly-once: runtime handlers must honor command IDs and reconcile uncertain outcomes. The reference adapter persists its execution ledger and refuses blind replay after a crash.

A runtime completion enters owner review. A task is marked done only after owner approval. Pause/stop requests are visible commands; they do not imply the runtime stopped before acknowledgment.

Daily refresh runs server-side at 05:55 America/Denver (or on the first tick after startup that day). Routines preserve Denver wall-clock time and create planned missions for owner dispatch. Provider errors and missing configuration are reported distinctly from successful refresh.

Example sync configuration:

```json
{"githubRepo":"matboy82/BIS-Vault","calendarIds":[{"id":"your-bis-calendar","group":"BIS"},{"id":"your-personal-calendar","group":"Personal"}]}
```

Calendar access must be explicitly scoped by the owner; configuring a Personal calendar is an explicit source selection, not permission for agent work to cross into personal cognition. Google access-token renewal belongs in the deployment's credential provider. No Google or GitHub mutation endpoint is called.

## Verify

```sh
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
```

The browser suite uses its own database at `data/browser-test.sqlite`; never point the production deployment at it. Test artifacts are under `test-results/`. Browser tests exercise actual served production files, including a forced WebGL failure. WebKit emulation is not a substitute for testing physical iPhones.

## Original experiment

The source repository at `../crew-os` is untouched. Its reviewed Kenney catalog and local supplied assets are reused. No live baseline database was present in that repository during inspection; no claim is made that hosted data has been migrated. See the requirement coverage notes for remaining external acceptance work.

See [asset provenance](docs/ASSETS.md), [protocol](docs/PROTOCOL.md), and [acceptance status](docs/ACCEPTANCE.md).

## Import the original database

The import utility opens the source database read-only and requires a new destination:

```sh
node scripts/import-legacy.mjs old.sqlite
node scripts/import-legacy.mjs old.sqlite data/imported.sqlite --apply
```

The first command reports counts only. After inspecting the new database, set `CREW_DB` to it. Imported incomplete work is blocked, dispatch is stopped, agents require pairing, and original undelivered notes remain recorded. Raw source records are archived without reusable transport credentials. The original file is never overwritten. Hosted owner access and portrait blobs need a separate export; they are not available in the local source repository.


## World navigation

The city is a focused world page. Morning Brief, Today's agenda, Waiting on you, and Goals have dedicated pages in the sidebar's Focus section. Collapse navigation from the top bar; the choice is saved on this browser. On phones, swipe the bottom navigation to reach the Focus pages.

City, office, and HQ viewers have Full screen, zoom, and reset controls. Full screen uses the browser API on desktop where available and fills the viewport on phones; Escape or Exit full screen returns to the page. Click a building to enter its office, then click its avatar to open the agent's details. Building buttons and the Agent details button provide keyboard alternatives. Drag to orbit, scroll or pinch to zoom, and use Reset view to recover your framing.

In an agent office, use **✎ Edit positions** below the agent name. Choose an item or click it in the 3D room, then move it left, right, up, down, front, or back in 5, 10, or 25 cm steps. Changes preview immediately; **Save positions** persists them. **Stop editing positions** discards unsaved moves. The offsets are separate from the room's furniture and theme selection.

Existing agent buildings have **Edit building** in their office. The six campus styles identify operations, markets, communications, analysis, design, and delivery work. New project sites start as dirt plots. Open the project page to move through **Planning → Building → Running → Complete** with an owner note at each step. Construction shows scaffolding; running and complete show the finished style. **Retire project** preserves its history and leaves a plot that can be claimed for another project. Project milestones remain a separate evidence trail and do not silently change the building state.


Use **Edit city** under the campus title to select a building or placed asset. Pick a building model, move it with the six direction controls, and save. Add planters, trees, dishes, rocks, or landing pads from the same editor. Each asset can be moved, changed, or removed. Building details controls the name, work type, and linked goal. Building moves are bounded and cannot overlap another plot or the HQ plaza. Decorative shuttles travel between buildings when motion is enabled. Office avatar gestures follow live reported activity or the task of an active agent or run; disconnected and waiting agents remain idle.

# Protocol v2

POST `/api/actions` with `{ "action": "...", "input": { ... } }`. JSON is required. Owner and agent tokens are supplied only in `Authorization: Bearer ...`; agents also set `X-Crew-Role: agent`. Pairing redemption is public but requires a single-use 10-minute code. No token belongs in a URL.

Public actions: `owner_access_status`, `owner_setup`, `owner_login`, `redeem_pairing_code`.
Owner actions and exact validation are in `server/core.mjs`; payload schemas are in `server/contracts.mjs`. Unsupported actions and properties in structured contracts fail validation.

Heartbeat example:

```json
{"protocol_version":2,"agent_id":"jeff","runtime_id":"hermes-jeff","sequence":1,"status":"idle","last_seen":"2026-09-25T14:00:00.000Z","capabilities":["work.execute"],"current_task":null,"current_run_id":null,"events":[],"command_acks":[]}
```

Send a fresh timestamp and monotonic sequence. Repeated sequences are ignored, gaps are audited. Observations more than ten minutes from server time are rejected. Active runs need renewal within two minutes: include their `current_run_id` in a heartbeat at least every 30 seconds. A lease that has already expired cannot be revived.

Agent actions: `get_office_catalog`, `poll_commands`, `claim_command`, `ack_command`, `report_heartbeat`, `submit_artifact`, `request_handoff`, `reply_message`, `request_jev_judgment`, `get_jev_judgment`.

Use `request_jev_judgment` for discretionary calls such as prioritization, draft soundness, or plan risk, not routine execution. Jev is advisory; use your judgment and escalate only decisions that need Matt. Poll `get_jev_judgment` every five seconds for up to 60 seconds, then proceed without Jev if it is still scoring or unscored. Never re-ask the same question for a better score. Include `agentConfidence` when known. A request needs `detail` (1–2000 characters) and an `idempotency_key` (at least 8 characters); optional presets are `priority`, `risk`, and `soundness`. Custom score criteria must have one label for every point in the scale stated in the question instructions. Rate-limit errors return HTTP 429 with `retry_after` seconds.

An acknowledgment is `{ "command_id": "...", "status": "accepted|running|completed|failed", "run_id": "...", "result": "..." }`. Accepted, running and completed are separate steps. A repeated state is idempotent; backward and skipped transitions fail. The accepted work command returns the run ID. Only the credential's bound runtime can own that run.

Artifacts require `run_id`, `idempotency_key`, `title`, `uri`, optional `revision`. References must use HTTP(S) and contain no URL userinfo. Handoff requests require `workId`, `to`, `context`, `idempotency_key`. Active runs must finish or stop before handoff; ownership changes only after the destination acknowledgment, and Accountable remains Matt.

Owner mutations carry the current revision where applicable. HTTP 409 means refresh/reconcile; HTTP 401 means reauthenticate/re-pair; 403 indicates a policy or scope denial; malformed or invalid inputs return 400. A 200 queued result does not indicate execution.

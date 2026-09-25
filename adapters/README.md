# Runtime adapters

Jeff and the other local agents run in Hermes. Muse is the cloud runtime. Both connect to the same HTTP protocol; no agent execution is simulated.

## HTTPS

1. In Jeff's office, open Connection and generate a pairing code.
2. On the trusted runtime machine, run:

```sh
npm run adapter -- pair http://localhost:4310 jeff ONE_TIME_CODE
```

Use an HTTPS public origin for remote hosts. `CREW_RUNTIME_ID` defaults to `hermes-jeff`. `CREW_ADAPTER_CONFIG` chooses the private credential file (default `data/adapter.json`). Use distinct files and operating-system access controls for each agent. On Windows, restrict the file's ACL to the runtime account; POSIX mode 0600 is applied where supported.

3. Set `CREW_HANDLER` to an absolute path to a module that exports:

```js
export async function handle(command, { runId, adapter, shouldStop }) {
  // Call the documented Hermes/Muse entry point here.
  // Use command.id as the runtime's idempotency key.
  // Do not return until actual execution or control acknowledgment completes.
  // Check shouldStop during long operations; stop/reconcile on lost leases.
  return {
    summary: 'Actual runtime result',
    artifact: { title: 'Evidence', uri: 'https://your-authoritative-record' }
  };
}
```

4. `npm run adapter -- run`

The adapter heartbeats, polls, persists an execution ledger, acknowledges accepted/running/completed separately, renews leases, and submits evidence. A crash after execution starts leaves an uncertain record. Reconcile the actual runtime before retrying; never erase the ledger to force replay. The handler must implement message delivery and pause/cancel semantics rather than return a cosmetic success. Control commands are polled concurrently with work. Runtime handlers must implement interruption and acknowledge only after their owned execution stops.

You can also import `Adapter` from `adapters/cli.mjs` into a runtime-specific service. Its `call`, `heartbeat`, and `ack` methods implement the transport while your service owns scheduling and cancellation.

## Token-free Drive mailbox

`adapters/drive-bridge.mjs` works with private per-agent folders synchronized/mounted from Google Drive on the server. It does not use the owner browser or place reusable credentials in Drive. Configure one folder per agent; give each agent access only to its own folder. Do not use the old shared-folder pattern.

Private bridge configuration, outside all shared folders:

```json
{"bindings":[{"agentId":"jeff","runtimeId":"hermes-jeff","path":"/private-drive/BIS/jeff"}]}
```

Set `CREW_MAILBOX_CONFIG` to this configuration file and `CREW_DB` to the server database. Run `node adapters/drive-bridge.mjs` on a scheduler. The bridge reads only explicitly mapped paths; it never searches by folder name or falls back to a root folder. Revoke the HTTPS connection before enabling Drive for that agent.

Mailbox contract:

- `heartbeat.json`: protocol-v2 heartbeat, no credential. Write a temporary file and atomically rename it.
- `inbox/<command-id>.json`: server-written commands, including TTL and idempotency key.
- `outbox/<unique-id>.json`: agent-written `{ "action": "ack_command", "input": { ... } }`. Allowed actions: acknowledgments, artifacts, handoff requests, replies.
- `receipts/<unique-id>.json`: bridge acknowledgment. Retries do not repeat logical mutations.

Folder ACLs are the authentication boundary. A local mount must preserve isolation; a shared mount writable by every agent is not conforming. Cloud-only servers can mount/sync the designated folders or supply an equivalent Google Drive API transport. That cloud credential/sync service is not bundled.

## Installed Hermes handler

This rebuild includes `adapters/hermes.mjs`, verified against the CLI installed at `C:\Users\Matt\AppData\Local\hermes\bin\hermes.exe`. Jeff's named profile exists. It invokes:

```text
hermes --profile jeff chat --query-file - --format stream-json --in <BIS workspace>
```

On Matt's local machine, the launcher defaults to `C:\Users\Matt\My Drive\Shared Cognition\BIS-Cognition`. The sibling `Personal-Cognition` folder is outside Jeff's workspace. From the repository root, generate a one-time code in Jeff's **Connection** page and run:

```powershell
.\adapters\jeff.ps1 -PairCode 'ONE_TIME_CODE'
```

That pairs Jeff, saves his credential privately under ignored `data/adapter-jeff.json`, and starts polling. On later starts, run `.\adapters\jeff.ps1`. For a server or another machine, pass `-Workspace <BIS-directory> -Server <HTTPS-origin>` when pairing; the saved credential retains the origin. The script and handler check that the selected workspace does not contain `Personal-Cognition`.

On Linux, or when running Hermes on a different host from the Crew OS server, use the same adapter and handler with an explicit private workspace and HTTPS origin:

```sh
export CREW_ADAPTER_CONFIG="$PWD/data/adapter-jeff.json"
export CREW_RUNTIME_ID=hermes-jeff
npm run adapter -- pair https://crew.example.com jeff ONE_TIME_CODE
export CREW_HANDLER="$PWD/adapters/hermes.mjs"
export CREW_HERMES_WORKSPACE=/absolute/path/to/BIS-Cognition
export CREW_HERMES_PROFILE=jeff
npm run adapter -- run
```

Run the adapter where the Hermes CLI and its Jeff profile are installed. The application server can remain containerized; only the adapter needs access to the BIS workspace and Hermes executable.

`CREW_HERMES_BIN` overrides the installed executable, including on a Linux server running Hermes. `CREW_HERMES_TOOLSETS` can narrow the profile's enabled toolsets. `CREW_HERMES_RUN_BUDGET` overrides the default 10-minute message or 30-minute mission limit (60–7200 seconds). A stopped or failed turn is reported as failed and retains an uncertain local ledger entry until its external effects are reconciled. Existing Hermes approvals are preserved; top-level `-z` and `--yolo` are never passed. Subprocesses use direct argument arrays, stdin for work text, and hidden windows on Windows. No shell interprets mission text. The handler parses only terminal result events; raw tool output is not forwarded into logs.

Stop commands are polled concurrently while work is running. The handler acknowledges after its owned Hermes process exits. It does not claim that independently detached tools or remote side effects have been rolled back. The adapter writes terminal results privately beside its execution ledger. A successful message turn is linked back as a private reply.

The local executable's help was verified without starting a paid/model-backed task. Owner setup, pairing, and the first real mission are intentional application actions; no production passphrase or agent credential has been pre-created.

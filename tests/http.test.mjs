import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.mjs";
test("HTTP boundary: bootstrap, auth, origin, content type, input limits, private read", async () => {
  const app = await createApp({ dbPath: ":memory:" });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (action, input = {}, headers = {}) =>
    fetch(base + "/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ action, input }),
    });
  try {
    assert.deepEqual(await (await post("owner_access_status")).json(), {
      configured: false,
    });
    assert.equal((await post("get_dashboard")).status, 401);
    assert.equal(
      (
        await post(
          "owner_access_status",
          {},
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await post("owner_access_status", {}, { "Content-Type": "text/plain" }))
        .status,
      415,
    );
    assert.equal(
      (await post("owner_setup", { passphrase: "short", confirm: "short" }))
        .status,
      400,
    );
    const owner = await (
      await post("owner_setup", {
        passphrase: "a secure test passphrase",
        confirm: "a secure test passphrase",
      })
    ).json();
    const r = await post(
      "get_dashboard",
      {},
      { Authorization: `Bearer ${owner.token}` },
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).agents.length, 4);
    assert.equal((await post("owner_access_status")).status, 200);
  } finally {
    await app.close();
  }
});

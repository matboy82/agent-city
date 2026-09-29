import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { Store, Fault, hash } from "./store.mjs";
import { Core } from "./core.mjs";
import { Scheduler } from "./sync.mjs";
const root = resolve(import.meta.dirname, "..");
export async function createApp({
  dbPath = process.env.CREW_DB || resolve(root, "data/crew.sqlite"),
  dev = false,
} = {}) {
  const store = new Store(dbPath),
    core = new Core(store),
    scheduler = new Scheduler(core);
  core.retireLegacyAgents();
  core.migrateDaveIdentity();
  const vite = dev
    ? await (
        await import("vite")
      ).createServer({ server: { middlewareMode: true }, appType: "spa" })
    : null;
  const attempts = new Map();
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'" +
        (dev ? " 'unsafe-inline'" : "") +
        "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    );
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    let requestedAction = "";
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/healthz") return json(200, { ok: true });
      if (url.pathname.startsWith("/api/portrait/")) {
        core.owner((req.headers.authorization || "").replace(/^Bearer /, ""));
        const p = store.get(
          "portrait",
          decodeURIComponent(url.pathname.split("/").pop()),
        );
        if (!p) throw new Fault("Portrait not found", 404);
        const [prefix, data] = p.image.split(",");
        res.writeHead(200, {
          "Content-Type": prefix.includes("png") ? "image/png" : "image/jpeg",
          "Cache-Control": "private, no-store",
        });
        return res.end(Buffer.from(data, "base64"));
      }
      if (url.pathname === "/api/actions") {
        if (req.method !== "POST") return json(405, { error: "Use POST" });
        if (req.headers.origin) {
          const origin = new URL(req.headers.origin);
          const expected =
            process.env.CREW_ORIGIN || `http://${req.headers.host}`;
          if (origin.host !== new URL(expected).host)
            return json(403, { error: "Origin denied" });
        }
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(415, { error: "JSON required" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 3000000)
            throw new Fault("Request too large", 413);
        }
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new Fault("Malformed JSON");
        }
        const { action, input = {} } = parsed;
        if (typeof action !== "string" || !/^[a-z_]{1,80}$/.test(action))
          throw new Fault("Invalid action");
        requestedAction = action;
        const token = (req.headers.authorization || "").replace(/^Bearer /, "");
        if (
          ["owner_login", "owner_setup", "redeem_pairing_code"].includes(action)
        ) {
          const key = req.socket.remoteAddress;
          const t = attempts.get(key) || { count: 0, start: Date.now() };
          if (Date.now() - t.start > 900000) {
            t.count = 0;
            t.start = Date.now();
          }
          if (++t.count > 30)
            return json(429, {
              error: "Too many attempts; try again in 15 minutes",
            });
          attempts.set(key, t);
        }
        let value;
        if (
          [
            "owner_access_status",
            "owner_setup",
            "owner_login",
            "redeem_pairing_code",
          ].includes(action)
        )
          value = core.public(action, input);
        else if (action === "refresh_morning_brief") {
          core.owner(token);
          value = await scheduler.refresh("manual");
        } else if (req.headers["x-crew-role"] === "agent")
          value = core.agentAction(action, input, token);
        else value = core.ownerAction(action, input, token);
        return json(200, value);
      }
      if (vite) return vite.middlewares(req, res);
      const publicRoot = resolve(root, "dist");
      let file = resolve(publicRoot, "." + decodeURIComponent(url.pathname));
      if (!file.startsWith(publicRoot + sep) && file !== publicRoot)
        throw new Fault("Invalid path", 403);
      try {
        if ((await stat(file)).isDirectory())
          file = resolve(file, "index.html");
      } catch {
        if (extname(file)) throw new Fault("Not found", 404);
        file = resolve(publicRoot, "index.html");
      }
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".glb": "model/gltf-binary",
        ".json": "application/json",
        ".svg": "image/svg+xml",
      };
      const original = file;
      let encoding;
      const accepted = req.headers["accept-encoding"] || "";
      for (const [enc, suffix] of [
        ["br", ".br"],
        ["gzip", ".gz"],
      ]) {
        if (!accepted.includes(enc)) continue;
        try {
          await stat(file + suffix);
          encoding = enc;
          file += suffix;
          break;
        } catch {}
      }
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(original)] || "application/octet-stream",
        "Cache-Control":
          extname(original) === ".html" ? "no-cache" : "public, max-age=86400",
        Vary: "Accept-Encoding",
        ...(encoding ? { "Content-Encoding": encoding } : {}),
      });
      res.end(bytes);
    } catch (e) {
      const status = e.status || (e.name === "ZodError" ? 400 : 500);
      if ([401, 403, 409].includes(status) && requestedAction)
        store.event("request", "request.denied", requestedAction, { status });
      json(status, {
        error:
          status === 500
            ? "Request failed; no successful result recorded"
            : e.name === "ZodError"
              ? "Invalid input: " +
                e.issues
                  .map((i) => i.path.join(".") + " " + i.message)
                  .slice(0, 3)
                  .join("; ")
              : e.message,
      });
    }
  });
  const timer = setInterval(() => {
    try {
      core.recover();
      void scheduler.tick().catch(() => {});
    } catch {}
  }, 15000);
  timer.unref();
  return {
    server,
    core,
    store,
    close: async () => {
      clearInterval(timer);
      await vite?.close();
      server.close();
      store.close();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const app = await createApp({ dev: process.argv.includes("--dev") });
  const port = Number(process.env.PORT || 4310);
  app.server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(
      `Crew OS available at http://${process.env.HOST || "127.0.0.1"}:${port}`,
    ),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
}

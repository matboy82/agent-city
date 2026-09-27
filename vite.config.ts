import { defineConfig } from "vite";
export default defineConfig({
  define: { __CHARACTER_ASSET_VERSION__: JSON.stringify(Date.now().toString(36)) },
  build: { target: "es2022", chunkSizeWarningLimit: 1800 },
  server: { host: "127.0.0.1" },
});

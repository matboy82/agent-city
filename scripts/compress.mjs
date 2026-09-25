import { readdir, readFile, writeFile } from "node:fs/promises";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";
import { join, extname } from "node:path";
async function compress(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await compress(path);
    else if ([".js", ".css", ".html", ".json"].includes(extname(path))) {
      const bytes = await readFile(path);
      await Promise.all([
        writeFile(
          path + ".br",
          brotliCompressSync(bytes, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
          }),
        ),
        writeFile(path + ".gz", gzipSync(bytes, { level: 6 })),
      ]);
    }
  }
}
await compress("dist");

import { readFile, writeFile, mkdir } from "node:fs/promises";

// The reviewed Quaternius sources are self-contained glTFs. Packing their
// embedded geometry and images as GLB keeps the runtime loader and CSP simple.
const source = new URL("../source-assets/cyberpunk/", import.meta.url);
const output = new URL("../public/assets/cyberpunk/", import.meta.url);
const names = ["Light_Street_1", "AC", "Computer_Large"];
const align = (bytes, fill = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, fill)]);

await mkdir(output, { recursive: true });
for (const name of names) {
  const gltf = JSON.parse(await readFile(new URL(`${name}.gltf`, source), "utf8"));
  if (gltf.buffers?.length !== 1 || !gltf.buffers[0].uri?.startsWith("data:"))
    throw new Error(`${name} is no longer a self-contained single-buffer glTF`);
  const geometry = Buffer.from(gltf.buffers[0].uri.slice(gltf.buffers[0].uri.indexOf(",") + 1), "base64");
  delete gltf.buffers[0].uri;
  const chunks = [align(geometry)];
  let offset = chunks[0].length;
  for (const image of gltf.images || []) {
    if (image.bufferView !== undefined) continue;
    if (!image.uri?.startsWith("data:")) throw new Error(`${name} contains an external image`);
    const mimeType = image.uri.slice(5, image.uri.indexOf(";"));
    const bytes = Buffer.from(image.uri.slice(image.uri.indexOf(",") + 1), "base64");
    image.bufferView = gltf.bufferViews.length;
    image.mimeType = mimeType;
    delete image.uri;
    gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    const padded = align(bytes);
    chunks.push(padded);
    offset += padded.length;
  }
  const binary = Buffer.concat(chunks);
  gltf.buffers[0].byteLength = binary.length;
  const json = align(Buffer.from(JSON.stringify(gltf), "utf8"), 0x20);
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.write("JSON", 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.write("BIN\0", 4);
  await writeFile(new URL(`${name}.glb`, output), Buffer.concat([header, jsonHeader, json, binHeader, binary]));
  console.log(`packed ${name}.glb`);
}

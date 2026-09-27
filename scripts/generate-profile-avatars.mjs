import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// The supplied Hermes icons are finished pixel-art character designs. Pack each
// into a self-contained, camera-facing glTF avatar so a server deployment needs
// no access to the local Hermes profile directory.
const source = process.env.CREW_HERMES_PROFILES || resolve(process.env.LOCALAPPDATA || "", "hermes", "profiles");
const destination = new URL("../public/assets/characters/", import.meta.url);
const names = ["angela", "arthur", "calvin", "chad", "irene", "jeff", "jefferson", "jonathan", "mark", "nerby", "opal", "proctor", "rachel", "sally", "steve", "ted", "triton", "video", "zack"];
const align = (n) => (n + 3) & ~3;
const json = (value) => Buffer.from(JSON.stringify(value), "utf8");
const chunk = (data, type) => {
  const out = Buffer.alloc(8 + align(data.length));
  out.writeUInt32LE(align(data.length), 0);
  out.writeUInt32LE(type, 4);
  data.copy(out, 8);
  if (type === 0x4e4f534a) out.fill(0x20, 8 + data.length);
  return out;
};
function avatarGlb(name, png) {
  const positions = Buffer.alloc(4 * 3 * 4);
  const vertices = [-0.9, 0, 0, 0.9, 0, 0, 0.9, 2.1, 0, -0.9, 2.1, 0];
  vertices.forEach((v, i) => positions.writeFloatLE(v, i * 4));
  const uv = Buffer.alloc(4 * 2 * 4);
  [0, 1, 1, 1, 1, 0, 0, 0].forEach((v, i) => uv.writeFloatLE(v, i * 4));
  const indices = Buffer.alloc(12);
  [0, 1, 2, 0, 2, 3].forEach((v, i) => indices.writeUInt16LE(v, i * 2));
  const imageOffset = align(positions.length + uv.length + indices.length);
  const binary = Buffer.alloc(align(imageOffset + png.length));
  positions.copy(binary, 0);
  uv.copy(binary, positions.length);
  indices.copy(binary, positions.length + uv.length);
  png.copy(binary, imageOffset);
  const document = {
    asset: { version: "2.0", generator: "Crew OS profile avatar packer" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name, mesh: 0 }],
    meshes: [{ name: `${name}-sprite`, primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: "VEC3", min: [-0.9, 0, 0], max: [0.9, 2.1, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: 2, componentType: 5123, count: 6, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length, target: 34962 },
      { buffer: 0, byteOffset: positions.length, byteLength: uv.length, target: 34962 },
      { buffer: 0, byteOffset: positions.length + uv.length, byteLength: indices.length, target: 34963 },
      { buffer: 0, byteOffset: imageOffset, byteLength: png.length },
    ],
    buffers: [{ byteLength: binary.length }],
    images: [{ bufferView: 3, mimeType: "image/png" }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    textures: [{ sampler: 0, source: 0 }],
    materials: [{ name: `${name}-pixel-art`, doubleSided: true, alphaMode: "BLEND", pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } }],
  };
  const header = Buffer.alloc(12);
  const chunks = [chunk(json(document), 0x4e4f534a), chunk(binary, 0x004e4942)];
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + chunks[0].length + chunks[1].length, 8);
  return Buffer.concat([header, ...chunks]);
}
await mkdir(destination, { recursive: true });
for (const name of names) {
  const png = await readFile(resolve(source, name, "assets", "avatar.png"));
  await writeFile(new URL(`profile-${name}.glb`, destination), avatarGlb(name, png));
  console.log(`packed ${name}`);
}

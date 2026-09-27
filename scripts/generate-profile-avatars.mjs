import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

// Articulated counterparts to the supplied Hermes icons. Pivot names match the
// Jeff/Relay rigs consumed by the office and HQ activity animators.
class NodeFileReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) { void blob.arrayBuffer().then((value) => { this.result = value; queueMicrotask(() => this.onloadend?.()); }); }
  readAsDataURL(blob) { void blob.arrayBuffer().then((value) => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`; queueMicrotask(() => this.onloadend?.()); }); }
}
globalThis.FileReader = NodeFileReader;
const output = new URL("../public/assets/characters/", import.meta.url);
const material = (color, metalness = 0, roughness = .64) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const luminous = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .4, metalness: .15, roughness: .24 });
function piece(parent, geometry, mat, pos, name, scale) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(...pos);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const sphere = (p, m, v, r, n, s) => piece(p, new THREE.SphereGeometry(r, 18, 12), m, v, n, s);
const cube = (p, m, v, dims, n) => piece(p, new THREE.BoxGeometry(...dims), m, v, n);
const path = (p, m, points, radius, n) => piece(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(...v))), 16, radius, 6), m, [0, 0, 0], n);
function pivot(parent, name, pos) { const node = new THREE.Group(); node.name = name; node.position.set(...pos); parent.add(node); return node; }
function rig(root, colors = {}) {
  const outfit = material(colors.outfit ?? 0x303b54), skin = material(colors.skin ?? 0xe8b995);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "left" : "right";
    const leg = pivot(root, `${side}-leg`, [sign * .20, 1.02, 0]);
    piece(leg, new THREE.CapsuleGeometry(.14, .65, 4, 10), outfit, [0, -.44, 0], `${side}-leg-mesh`);
    cube(leg, material(0x202530), [0, -.9, .12], [.31, .15, .45], `${side}-shoe`);
    const arm = pivot(root, `${side}-arm`, [sign * .53, 2.08, 0]);
    piece(arm, new THREE.CapsuleGeometry(.13, .58, 4, 10), outfit, [sign * .04, -.42, 0], `${side}-sleeve`);
    const hand = pivot(arm, `${side}-hand`, [sign * .04, -.82, .04]);
    sphere(hand, skin, [0, 0, 0], .12, `${side}-hand-mesh`, [1, 1.1, .9]);
  }
}
function eyes(head, color = 0x1a2130, z = .41, spacing = .16) {
  const eye = material(color, 0, .19), white = material(0xffffff);
  for (const sign of [-1, 1]) {
    sphere(head, eye, [sign * spacing, .04, z], .053, `${sign < 0 ? "left" : "right"}-eye`, [1, 1.12, .7]);
    sphere(head, white, [sign * spacing - .015, .06, z + .04], .015, "eye-glint");
  }
}
function human(s) {
  const root = new THREE.Group();
  const skin = material(s.skin), hair = material(s.hair), outfit = material(s.outfit), accent = material(s.accent), ink = material(0x20242b);
  rig(root, { outfit: s.outfit, skin: s.skin });
  sphere(root, outfit, [0, 1.71, 0], .48, "tailored-torso", [1, 1.2, .74]);
  cube(root, accent, [0, 1.72, .37], [.24, .61, .07], "shirt-panel");
  for (const sign of [-1, 1]) {
    cube(root, outfit, [sign * .28, 1.78, .40], [.24, .77, .09], "jacket-panel");
    piece(root, new THREE.ConeGeometry(.12, .38, 4), accent, [sign * .14, 2.03, .45], "lapel").rotation.z = sign * .22;
  }
  const head = pivot(root, "head", [0, 2.64, 0]);
  sphere(head, skin, [0, 0, 0], .43, "face", [1, 1.1, .92]);
  eyes(head);
  sphere(head, skin, [0, -.07, .40], .06, "nose");
  path(head, material(0x8a5148), [[-.1, -.20, .39], [0, -.23, .42], [.1, -.20, .39]], .012, "smile");
  if (s.hairStyle === "long" || s.hairStyle === "bob") {
    sphere(head, hair, [0, .11, -.12], .48, "hair-back", [1.12, s.hairStyle === "long" ? 1.2 : .89, .86]);
    for (const sign of [-1, 1]) sphere(head, hair, [sign * .38, -.14, -.02], .18, "hair-side", [.9, s.hairStyle === "long" ? 2 : 1.4, .91]);
  } else {
    sphere(head, hair, [0, .24, -.06], .43, "hair-crown", [1.02, .65, .95]);
    for (let i = 0; i < 5; i++) path(head, hair, [[-.36 + i * .17, .36, .15], [-.29 + i * .17, .29, .31], [-.20 + i * .17, .20, .39]], .028, `hair-strand-${i}`);
  }
  if (s.id === "angela") {
    cube(head, material(0xf4c738), [0, .47, 0], [.9, .18, .83], "yellow-cap");
    cube(head, material(0xf4c738), [0, .38, .43], [.55, .06, .34], "cap-brim");
    for (const sign of [-1, 1]) piece(head, new THREE.TorusGeometry(.18, .044, 8, 20), material(0xf1f0e7), [sign * .19, .03, .42], "white-goggles");
  }
  if (s.id === "ted") {
    path(head, ink, [[-.26, -.18, .38], [0, -.14, .44], [.26, -.18, .38]], .055, "mustache");
    piece(head, new THREE.TorusGeometry(.45, .037, 8, 22, Math.PI), ink, [0, .11, -.02], "headset-band").rotation.z = Math.PI;
    for (const sign of [-1, 1]) cube(head, ink, [sign * .43, -.01, 0], [.13, .3, .23], "headset-ear");
    path(head, ink, [[.45, -.08, .02], [.48, -.20, .18], [.30, -.27, .34]], .025, "headset-mic");
  }
  if (s.id === "chad") {
    piece(root, new THREE.ConeGeometry(.60, 1.1, 3), material(0xc73632), [0, 1.51, -.43], "red-cape").rotation.z = Math.PI;
    cube(root, material(0xe7b63d, .52), [0, 1.74, .49], [.42, .13, .05], "gold-insignia");
  }
  if (s.id === "rachel") for (const sign of [-1, 1]) cube(root, material(0xf6a126), [sign * .31, 1.83, .47], [.12, .71, .07], "orange-suspender");
  if (s.id === "sally") {
    piece(root, new THREE.CylinderGeometry(.35, .60, .86, 18), material(0xf3b4bb), [0, 1.11, 0], "pink-skirt");
    sphere(root, material(0xe698a7), [0, 1.83, .4], .16, "bow", [1.55, .6, .4]);
  }
  if (s.id === "mark") cube(root, material(0xd0bc9c), [.31, 1.75, .48], [.32, .43, .07], "research-notebook");
  if (s.id === "zack") {
    piece(root, new THREE.ConeGeometry(.10, .43, 4), material(0x70c7db), [0, 1.78, .53], "blue-tie").rotation.z = Math.PI;
    cube(root, material(0xf1f0eb), [.58, 1.34, .16], [.13, .27, .1], "coffee-cup");
  }
  return root;
}
function creature(s) {
  const root = new THREE.Group();
  const coat = material(s.coat), light = material(s.light), dark = material(0x24242b);
  rig(root, { outfit: s.coat, skin: s.coat });
  sphere(root, coat, [0, 1.52, 0], .61, "round-body", [1.13, 1.05, .85]);
  sphere(root, light, [0, 1.43, .46], .32, "belly", [1.1, 1.1, .4]);
  const head = pivot(root, "head", [0, 2.48, 0]);
  sphere(head, coat, [0, 0, 0], .51, "creature-head", [1.13, 1, .9]);
  eyes(head, s.eye ?? 0x25262b, .45, .21);
  if (s.kind === "cat") {
    for (const sign of [-1, 1]) {
      piece(head, new THREE.ConeGeometry(.22, .48, 4), coat, [sign * .37, .47, 0], "cat-ear").rotation.z = -sign * .16;
      piece(head, new THREE.ConeGeometry(.11, .25, 4), material(0xeab8b0), [sign * .37, .51, .15], "inner-ear").rotation.z = -sign * .16;
      path(head, dark, [[sign * .12, -.20, .43], [sign * .32, -.17, .46], [sign * .54, -.11, .39]], .009, "whisker");
    }
    sphere(head, material(0xd9939d), [0, -.17, .48], .07, "nose", [1, .7, .5]);
    if (s.id === "calvin") piece(root, new THREE.ConeGeometry(.13, .48, 4), material(0xb12730), [0, 1.78, .68], "red-tie").rotation.z = Math.PI;
    if (s.id === "opal") for (const sign of [-1, 1]) sphere(head, material(0xf4c43d), [sign * .38, .59, 0], .11, "gold-ear-tip");
  } else if (s.kind === "duck") {
    sphere(head, material(0xf3a32d), [0, -.09, .51], .28, "duck-bill", [1.35, .46, 1]);
    for (const sign of [-1, 1]) sphere(root, coat, [sign * .56, 1.72, .02], .26, "wing", [.58, 1.1, .9]);
    piece(head, new THREE.ConeGeometry(.09, .3, 8), material(0x6bac26), [-.14, .52, 0], "green-feather").rotation.z = -.25;
  } else {
    for (const sign of [-1, 1]) { sphere(head, light, [sign * .38, -.15, .2], .24, "cheek"); sphere(head, coat, [sign * .39, .4, -.04], .17, "round-ear"); }
    piece(head, new THREE.CylinderGeometry(.3, .3, .36, 18), dark, [0, .65, 0], "top-hat");
    piece(head, new THREE.CylinderGeometry(.44, .44, .055, 18), dark, [0, .47, 0], "hat-brim");
    cube(root, material(0xf4edd6), [.48, 1.54, .52], [.24, .36, .04], "playing-card");
  }
  return root;
}
function bull() {
  const root = new THREE.Group();
  const hide = material(0x8b4b2c), darkHide = material(0x61351f), muzzle = material(0xc88961);
  const vest = material(0x243e50), shirt = material(0xe9e2d5), horn = material(0xf2e5c8);
  const gold = material(0xd9af54, .4, .3), black = material(0x242b2e);
  rig(root, { outfit: 0x243e50, skin: 0x8b4b2c });
  sphere(root, hide, [0, 1.63, 0], .68, "bull-shoulders", [1.24, 1.12, .83]);
  sphere(root, vest, [0, 1.55, .28], .54, "tailored-vest", [1.07, 1.14, .67]);
  cube(root, shirt, [0, 1.78, .61], [.18, .49, .045], "shirt-placket");
  piece(root, new THREE.ConeGeometry(.11, .40, 4), gold, [0, 1.78, .66], "bull-market-tie").rotation.z = Math.PI;
  for (const sign of [-1, 1]) {
    cube(root, darkHide, [sign * .20, .38, -.04], [.31, .18, .42], "cloven-hoof");
    path(root, gold, [[sign * .28, 1.32, .63], [sign * .18, 1.53, .66], [sign * .07, 1.69, .67]], .019, "rising-market-stitch");
  }
  path(root, darkHide, [[0, 1.38, -.43], [.22, 1.09, -.76], [.35, .73, -.86]], .055, "bull-tail");
  sphere(root, darkHide, [.36, .68, -.86], .09, "tail-tuft", [.6, 1.5, .65]);
  const head = pivot(root, "head", [0, 2.55, 0]);
  sphere(head, hide, [0, 0, -.03], .52, "bull-head", [1.18, 1.03, .92]);
  sphere(head, darkHide, [0, .34, .16], .34, "forelock", [1.12, .45, .78]);
  for (const sign of [-1, 1]) {
    sphere(head, hide, [sign * .53, .13, -.02], .21, "bull-ear", [1.17, .52, .72]);
    sphere(head, muzzle, [sign * .60, .13, .08], .12, "inner-ear", [1.06, .39, .55]);
    path(head, horn, [[sign * .35, .34, -.03], [sign * .53, .52, -.03], [sign * .67, .70, .02], [sign * .71, .87, .04]], .105, "curved-ivory-horn");
    piece(head, new THREE.ConeGeometry(.08, .29, 12), horn, [sign * .71, .83, .04], "horn-tip").rotation.z = -sign * .2;
    sphere(head, shirt, [sign * .21, .03, .43], .108, "eye-white", [1.15, .86, .58]);
    sphere(head, black, [sign * .21, .02, .50], .055, "bull-eye", [1, 1.12, .62]);
    path(head, darkHide, [[sign * .12, .20, .43], [sign * .22, .23, .45], [sign * .32, .18, .39]], .025, "expressive-brow");
  }
  sphere(head, muzzle, [0, -.25, .40], .34, "broad-muzzle", [1.34, .69, .78]);
  for (const sign of [-1, 1]) sphere(head, darkHide, [sign * .18, -.27, .65], .046, "nostril", [1, .7, .35]);
  path(head, darkHide, [[-.15, -.42, .56], [0, -.46, .60], [.15, -.42, .56]], .018, "confident-smile");
  return root;
}
function machine(s) {
  const root = new THREE.Group();
  const shell = material(s.shell, .22, .45), trim = material(s.trim, .5, .35), lit = luminous(s.accent);
  rig(root, { outfit: s.shell, skin: s.trim });
  cube(root, shell, [0, 1.66, 0], [1.05, 1.15, .72], "robot-body");
  cube(root, trim, [0, 1.67, .39], [.92, .93, .06], "front-panel");
  const head = pivot(root, "head", [0, 2.57, 0]);
  cube(head, shell, [0, 0, 0], [1.02, .76, .72], "robot-head");
  cube(head, material(s.screen, .03, .16), [0, .02, .38], [.81, .54, .06], "display");
  for (const sign of [-1, 1]) cube(head, lit, [sign * .21, .03, .42], [.10, .15, .025], "pixel-eye");
  cube(head, lit, [0, -.15, .42], [.23, .035, .025], "pixel-smile");
  if (s.id === "nerby") {
    cube(head, material(0xf6a137), [.56, .13, .05], [.13, .14, .13], "orange-button");
    cube(head, lit, [.56, -.12, .05], [.13, .14, .13], "status-button");
    cube(root, shell, [0, .36, .13], [.7, .16, .46], "keyboard");
  } else {
    cube(head, trim, [.54, .26, 0], [.15, .14, .19], "page-tab");
    path(root, trim, [[-.46, 2.16, .24], [-.55, 2.55, .15], [-.48, 2.82, .02]], .032, "spine-binding");
  }
  return root;
}
function spirit(s) {
  const root = new THREE.Group();
  const cloak = material(s.cloak), edge = material(s.edge), face = material(0x111720);
  rig(root, { outfit: s.cloak, skin: s.cloak });
  piece(root, new THREE.ConeGeometry(.75, 2.15, 12), cloak, [0, 1.12, 0], "robe");
  for (const sign of [-1, 1]) path(root, edge, [[sign * .50, 2.07, .20], [sign * .72, 1.42, .18], [sign * .56, .53, .15]], .06, "robe-hem");
  const head = pivot(root, "head", [0, 2.46, 0]);
  sphere(head, cloak, [0, 0, -.10], .60, "hood", [1.05, 1.12, .9]);
  sphere(head, face, [0, -.04, .34], .40, "hood-recess", [1, 1.08, .35]);
  if (s.id === "triton") {
    sphere(head, material(0xf0eee9), [0, -.04, .46], .29, "white-mask", [.76, 1.23, .36]);
    for (const sign of [-1, 1]) sphere(head, face, [sign * .12, .03, .57], .07, "mask-eye", [.72, 1.5, .5]);
    sphere(head, face, [0, -.23, .57], .075, "mask-mouth", [.68, 1.6, .5]);
    for (const sign of [-1, 1]) piece(root, new THREE.ConeGeometry(.12, .42, 7), luminous(0x38c4c9), [sign * .62, 1.11, .08], "teal-claw").rotation.z = sign * .5;
  } else for (const sign of [-1, 1]) cube(head, luminous(0x45dbc4), [sign * .16, .04, .61], [.08, .15, .025], "cyan-eye");
  return root;
}
function blob(s) {
  const root = new THREE.Group();
  const body = material(s.body), shade = material(s.shade), white = material(0xf5efdf);
  rig(root, { outfit: s.body, skin: s.body });
  sphere(root, body, [0, 1.52, 0], .68, "soft-body", [1.07, 1.2, .82]);
  const head = pivot(root, "head", [0, 2.47, 0]);
  sphere(head, body, [0, 0, 0], .54, "soft-head", [1.1, 1.02, .83]);
  for (const sign of [-1, 1]) { sphere(head, white, [sign * .19, .02, .45], .09, "white-eye"); sphere(head, shade, [sign * .19, .02, .53], .027, "pupil"); }
  for (const sign of [-1, 1]) path(root, shade, [[sign * .45, .52, .2], [sign * .63, .78, .26], [sign * .72, 1.12, .1]], .027, "surface-detail");
  return root;
}
function octopus() {
  const root = new THREE.Group();
  const red = material(0xe64b33), dark = material(0x902821), gold = material(0xf6c634, .16);
  rig(root, { outfit: 0xd64330, skin: 0xe64b33 });
  sphere(root, red, [0, 1.53, 0], .46, "octopus-body", [1, 1.16, .74]);
  for (const sign of [-1, 1]) path(root, dark, [[sign * .28, 1.28, -.24], [sign * .55, .79, -.48], [sign * .69, .42, -.16]], .08, "rear-tentacle");
  const head = pivot(root, "head", [0, 2.47, 0]);
  sphere(head, red, [0, -.08, 0], .42, "octopus-head", [1, 1.12, .87]);
  eyes(head, 0xf6efdc, .37, .18);
  cube(head, gold, [0, .56, 0], [.82, .68, .7], "question-box");
  cube(head, material(0xffffff), [0, .59, .36], [.13, .24, .03], "question-stem");
  sphere(head, material(0xffffff), [.08, .72, .37], .11, "question-curve");
  sphere(head, material(0xffffff), [0, .41, .37], .045, "question-dot");
  return root;
}
const specs = [
  { id: "angela", type: "human", skin: 0xe9b495, hair: 0x28252b, outfit: 0x302d32, accent: 0xffffff, hairStyle: "bob" },
  { id: "arthur", type: "machine", shell: 0xbfc6ce, trim: 0x727d89, screen: 0xe1e5e9, accent: 0x273747 },
  { id: "calvin", type: "creature", kind: "cat", coat: 0xf6f4ee, light: 0xffffff },
  { id: "chad", type: "human", skin: 0xe7ad87, hair: 0xe2b944, outfit: 0x3159a3, accent: 0xcf332e },
  { id: "irene", type: "creature", kind: "duck", coat: 0xf8dd49, light: 0xffe96b },
  { id: "jefferson", type: "bull" },
  { id: "jonathan", type: "spirit", cloak: 0x2b2c32, edge: 0x464a54 },
  { id: "mark", type: "human", skin: 0xe4b08a, hair: 0xcac8bb, outfit: 0x3d332d, accent: 0xd2bb86 },
  { id: "nerby", type: "machine", shell: 0xe7e2d2, trim: 0x738081, screen: 0x293a3c, accent: 0xf49b3b },
  { id: "opal", type: "creature", kind: "cat", coat: 0xf7f6ee, light: 0xffffff, eye: 0xe6af30 },
  { id: "proctor", type: "octopus" },
  { id: "rachel", type: "human", skin: 0xf0b78c, hair: 0x472722, outfit: 0x8c3d27, accent: 0xf5a532, hairStyle: "bob" },
  { id: "sally", type: "human", skin: 0xf1b899, hair: 0x6a362d, outfit: 0xe9a2a8, accent: 0xf7d9ce, hairStyle: "long" },
  { id: "steve", type: "creature", kind: "hamster", coat: 0xb67330, light: 0xf7e7c4 },
  { id: "ted", type: "human", skin: 0xc89b78, hair: 0x282123, outfit: 0xc4c5c0, accent: 0x4b535e },
  { id: "triton", type: "spirit", cloak: 0x171a23, edge: 0x313746 },
  { id: "video", type: "blob", body: 0x494cdb, shade: 0x252c9a },
  { id: "zack", type: "human", skin: 0xd99f7c, hair: 0x312320, outfit: 0x243957, accent: 0xd4d5d2 },
];
await mkdir(output, { recursive: true });
const exporter = new GLTFExporter();
for (const spec of specs) {
  const root = spec.type === "human" ? human(spec) : spec.type === "creature" ? creature(spec) : spec.type === "bull" ? bull() : spec.type === "machine" ? machine(spec) : spec.type === "spirit" ? spirit(spec) : spec.type === "octopus" ? octopus() : blob(spec);
  root.name = spec.id;
  root.userData.characterId = spec.id;
  const glb = await exporter.parseAsync(root, { binary: true, onlyVisible: true });
  await writeFile(new URL(`profile-${spec.id}.glb`, output), Buffer.from(glb));
  console.log(`modeled ${spec.id}`);
}

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

const outputDir = new URL("../public/assets/characters/", import.meta.url);

class BunFileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((value) => {
      this.result = value;
      queueMicrotask(() => this.onloadend?.());
    });
  }

  readAsDataURL(blob) {
    void blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      queueMicrotask(() => this.onloadend?.());
    });
  }
}

globalThis.FileReader = BunFileReader;

const material = (color, options = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: options.roughness ?? 0.72,
  metalness: options.metalness ?? 0,
  emissive: options.emissive ?? 0x000000,
  emissiveIntensity: options.emissiveIntensity ?? 0,
});

const addMesh = (parent, geometry, source, position, name) => {
  const value = new THREE.Mesh(geometry, source);
  value.position.set(...position);
  value.name = name ?? "detail";
  value.castShadow = true;
  value.receiveShadow = true;
  parent.add(value);
  return value;
};

function limb(parent, name, x, y, source, length, radius, shoe = false) {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(x, y, 0);
  parent.add(pivot);
  addMesh(pivot, new THREE.CapsuleGeometry(radius, length - radius * 2, 3, 7), source, [0, -length / 2, 0], `${name}-mesh`);
  if (shoe) addMesh(pivot, new THREE.BoxGeometry(radius * 2.2, .14, .42), material(0x101827, { roughness: .5 }), [0, -length + .02, .1], `${name}-shoe`);
  return pivot;
}

function createOtterCharacter(spec) {
  const root = new THREE.Group();
  root.name = spec.id;
  root.userData.characterId = spec.id;
  const fur = material(spec.fur ?? 0x985b36, { roughness: .94 });
  const furDark = material(0x663b28, { roughness: .92 });
  const furLight = material(0xc17b4c, { roughness: .9 });
  const cream = material(0xf2dfc7, { roughness: .86 });
  const suit = material(spec.clothing ?? 0x173452, { roughness: .62 });
  const suitLight = material(0x28516f, { roughness: .58 });
  const teal = material(spec.accent ?? 0x39d0b1, { roughness: .3, metalness: .18, emissive: spec.accent ?? 0x39d0b1, emissiveIntensity: .12 });
  const brass = material(0xe0b45e, { roughness: .3, metalness: .68 });
  const ink = material(0x191b20, { roughness: .24 });
  const eyeGlint = material(0xffffff, { roughness: .14 });

  // A broad, low-set tail gives the silhouette its unmistakable otter read.
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.05, -.22),
    new THREE.Vector3(0, .7, -.48),
    new THREE.Vector3(.08, .31, -.78),
    new THREE.Vector3(.34, .2, -.98),
    new THREE.Vector3(.64, .34, -.94),
  ]);
  addMesh(root, new THREE.TubeGeometry(tailCurve, 28, .16, 10, false), furDark, [0, 0, 0], "tail");
  const tailTip = addMesh(root, new THREE.SphereGeometry(.17, 14, 10), furLight, [.64, .34, -.94], "tail-tip");
  tailTip.scale.set(1.3, .8, .78);

  limb(root, "left-leg", -.2, 1.03, suit, .86, .15, true);
  limb(root, "right-leg", .2, 1.03, suit, .86, .15, true);
  const body = addMesh(root, new THREE.CapsuleGeometry(.43, .62, 5, 12), fur, [0, 1.7, 0], "otter-body");
  body.scale.set(1.12, 1.06, .78);
  const belly = addMesh(root, new THREE.SphereGeometry(1, 20, 16), cream, [0, 1.52, .26], "belly");
  belly.scale.set(.34, .5, .17);

  // Open navy jacket, cream shirt and a teal tie keep the BIS chief-of-staff cue.
  const jacketLeft = addMesh(root, new THREE.BoxGeometry(.33, .9, .16), suit, [-.23, 1.76, .31], "jacket-left");
  jacketLeft.rotation.z = -.08;
  const jacketRight = addMesh(root, new THREE.BoxGeometry(.33, .9, .16), suit, [.23, 1.76, .31], "jacket-right");
  jacketRight.rotation.z = .08;
  addMesh(root, new THREE.BoxGeometry(.22, .78, .07), cream, [0, 1.78, .4], "shirt");
  const tie = addMesh(root, new THREE.BoxGeometry(.105, .5, .055), teal, [0, 1.76, .445], "teal-tie");
  tie.rotation.z = .02;
  const leftLapel = addMesh(root, new THREE.ConeGeometry(.11, .38, 3), suitLight, [-.16, 2.08, .4], "left-lapel");
  leftLapel.rotation.z = -.28;
  const rightLapel = addMesh(root, new THREE.ConeGeometry(.11, .38, 3), suitLight, [.16, 2.08, .4], "right-lapel");
  rightLapel.rotation.z = .28;
  addMesh(root, new THREE.CylinderGeometry(.06, .06, .045, 12), brass, [.28, 1.92, .4], "bis-lapel-pin").rotation.x = Math.PI / 2;

  limb(root, "left-arm", -.53, 2.12, suit, .84, .13);
  limb(root, "right-arm", .53, 2.12, suit, .84, .13);
  const leftPaw = addMesh(root, new THREE.SphereGeometry(.14, 12, 9), fur, [-.53, 1.28, .04], "left-hand");
  leftPaw.scale.set(1, .82, .9);
  const rightPaw = addMesh(root, new THREE.SphereGeometry(.14, 12, 9), fur, [.53, 1.28, .04], "right-hand");
  rightPaw.scale.set(1, .82, .9);

  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 2.66, 0);
  root.add(head);
  const skull = addMesh(head, new THREE.SphereGeometry(.49, 24, 18), fur, [0, 0, 0], "otter-head");
  skull.scale.set(.97, 1.02, .86);
  for (const side of [-1, 1]) {
    const ear = addMesh(head, new THREE.SphereGeometry(.145, 14, 10), furDark, [side * .36, .31, -.025], side < 0 ? "left-ear" : "right-ear");
    ear.scale.set(1, 1.05, .65);
    const innerEar = addMesh(head, new THREE.SphereGeometry(.075, 12, 8), furLight, [side * .36, .31, .055], side < 0 ? "left-inner-ear" : "right-inner-ear");
    innerEar.scale.set(.9, 1, .45);
    const eye = addMesh(head, new THREE.SphereGeometry(.052, 14, 10), ink, [side * .18, .055, .402], side < 0 ? "left-eye" : "right-eye");
    const glint = addMesh(head, new THREE.SphereGeometry(.016, 8, 6), eyeGlint, [side * .18 - .012, .074, .448], side < 0 ? "left-eye-glint" : "right-eye-glint");
    glint.userData.eyeGlint = true;
  }

  const muzzle = new THREE.Group();
  muzzle.name = "muzzle";
  muzzle.position.set(0, -.12, .34);
  head.add(muzzle);
  const muzzleLeft = addMesh(muzzle, new THREE.SphereGeometry(.2, 18, 13), cream, [-.13, -.015, .055], "muzzle-left");
  muzzleLeft.scale.set(1.05, .78, .72);
  const muzzleRight = addMesh(muzzle, new THREE.SphereGeometry(.2, 18, 13), cream, [.13, -.015, .055], "muzzle-right");
  muzzleRight.scale.set(1.05, .78, .72);
  addMesh(muzzle, new THREE.SphereGeometry(.082, 14, 10), ink, [0, .105, .17], "nose");
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.07, -.095, .158),
    new THREE.Vector3(0, -.14, .174),
    new THREE.Vector3(.07, -.095, .158),
  ]);
  addMesh(muzzle, new THREE.TubeGeometry(smileCurve, 12, .012, 6, false), furDark, [0, 0, 0], "smile");
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const dot = addMesh(muzzle, new THREE.SphereGeometry(.012, 8, 6), furDark, [side * (.18 + (index % 2) * .025), -.015 - index * .035, .13], `whisker-dot-${side}-${index}`);
      dot.scale.set(1.25, 1, .7);
    }
    const whiskers = new THREE.Group();
    whiskers.name = side < 0 ? "left-whiskers" : "right-whiskers";
    whiskers.position.set(side * .18, -.025, .12);
    muzzle.add(whiskers);
    for (let index = 0; index < 3; index += 1) {
      const line = addMesh(whiskers, new THREE.CylinderGeometry(.006, .009, .22, 5), cream, [side * .1, -.045 + index * .045, .01], `whisker-${index}`);
      line.rotation.z = side * (.45 - index * .16);
    }
  }
  // A small swept forelock and cheek fur add a hand-shaped silhouette without hiding the ears.
  const forelock = addMesh(head, new THREE.SphereGeometry(.22, 14, 10), furLight, [0, .37, .06], "forelock");
  forelock.scale.set(1.1, .45, .68);
  forelock.rotation.z = -.12;
  for (const side of [-1, 1]) {
    const cheek = addMesh(head, new THREE.SphereGeometry(.13, 12, 9), furLight, [side * .37, -.16, .18], side < 0 ? "left-cheek-fur" : "right-cheek-fur");
    cheek.scale.set(.72, .65, .55);
  }

  root.traverse((object) => { object.userData.avatar = true; });
  return root;
}

function createCharacter(spec) {
  if (spec.species === "otter") return createOtterCharacter(spec);
  if (spec.id === "relay") return createRelayCharacter();
  const root = new THREE.Group();
  root.name = spec.id;
  root.userData.characterId = spec.id;
  const skin = material(spec.skin, { roughness: .82 });
  const hair = material(spec.hair, { roughness: .9 });
  const clothing = material(spec.clothing, { roughness: .66 });
  const secondary = material(spec.secondary, { roughness: .6 });
  const dark = material(0x101827, { roughness: .54 });
  const metal = material(spec.metal ?? 0x9cabc0, { roughness: .26, metalness: .72 });
  const glow = material(spec.accent, { roughness: .22, metalness: .2, emissive: spec.accent, emissiveIntensity: .8 });

  limb(root, "left-leg", -.2, 1.05, spec.legMaterial === "dark" ? dark : clothing, .94, .14, true);
  limb(root, "right-leg", .2, 1.05, spec.legMaterial === "dark" ? dark : clothing, .94, .14, true);

  const hips = addMesh(root, new THREE.BoxGeometry(.72, .34, .48), secondary, [0, 1.17, 0], "hips");
  hips.geometry.rotateX(.04);
  const torso = addMesh(root, new THREE.CapsuleGeometry(.43, .55, 3, 8), clothing, [0, 1.82, 0], "torso");
  torso.scale.set(spec.build ?? 1, 1, .72);
  addMesh(root, new THREE.BoxGeometry(.72 * (spec.build ?? 1), .08, .08), glow, [0, 1.72, .36], "chest-accent");

  limb(root, "left-arm", -.54 * (spec.build ?? 1), 2.12, clothing, .82, .115);
  limb(root, "right-arm", .54 * (spec.build ?? 1), 2.12, clothing, .82, .115);
  addMesh(root, new THREE.IcosahedronGeometry(.14, 1), skin, [-.54 * (spec.build ?? 1), 1.28, 0], "left-hand");
  addMesh(root, new THREE.IcosahedronGeometry(.14, 1), skin, [.54 * (spec.build ?? 1), 1.28, 0], "right-hand");
  addMesh(root, new THREE.CylinderGeometry(.12, .14, .18, 8), skin, [0, 2.3, 0], "neck");

  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 2.66, 0);
  root.add(head);
  const face = addMesh(head, new THREE.IcosahedronGeometry(.4, 2), skin, [0, 0, 0], "face");
  face.scale.set(.91, 1.08, .9);
  const leftEye = addMesh(head, new THREE.SphereGeometry(.043, 8, 6), dark, [-.14, .04, .35], "left-eye");
  const rightEye = addMesh(head, new THREE.SphereGeometry(.043, 8, 6), dark, [.14, .04, .35], "right-eye");
  leftEye.scale.y = rightEye.scale.y = 1.2;
  addMesh(head, new THREE.BoxGeometry(.055, .1, .075), skin, [0, -.04, .38], "nose");

  if (spec.hairStyle === "crop") {
    const cap = addMesh(head, new THREE.SphereGeometry(.415, 10, 7, 0, Math.PI * 2, 0, Math.PI * .52), hair, [0, .13, -.025], "hair");
    cap.scale.set(1, .8, 1);
    addMesh(head, new THREE.BoxGeometry(.46, .12, .08), hair, [0, -.19, .34], "beard");
  } else if (spec.hairStyle === "bob") {
    const cap = addMesh(head, new THREE.SphereGeometry(.43, 12, 8, 0, Math.PI * 2, 0, Math.PI * .7), hair, [0, .12, -.03], "hair");
    cap.scale.set(1.04, 1.06, 1);
    const leftBob = addMesh(head, new THREE.IcosahedronGeometry(.18, 1), hair, [-.34, -.08, -.04], "hair-left");
    const rightBob = addMesh(head, new THREE.IcosahedronGeometry(.18, 1), hair, [.34, -.08, -.04], "hair-right");
    leftBob.scale.y = rightBob.scale.y = 1.7;
  } else {
    const sweep = addMesh(head, new THREE.ConeGeometry(.41, .5, 7), hair, [-.06, .28, -.04], "hair");
    sweep.rotation.z = -.22;
  }

  if (spec.accessory === "commander") {
    addMesh(root, new THREE.BoxGeometry(.2, .08, .05), metal, [-.22, 2.04, .39], "rank-one");
    addMesh(root, new THREE.BoxGeometry(.2, .08, .05), metal, [.22, 2.04, .39], "rank-two");
    addMesh(root, new THREE.CylinderGeometry(.07, .07, .06, 8), glow, [.34, 1.85, .4], "command-pin").rotation.x = Math.PI / 2;
  }
  if (spec.accessory === "trader") {
    addMesh(head, new THREE.TorusGeometry(.43, .035, 6, 16, Math.PI), metal, [0, .04, -.05], "headset-band").rotation.z = Math.PI;
    addMesh(head, new THREE.BoxGeometry(.1, .28, .14), dark, [.39, -.02, 0], "headset-ear");
    const mic = addMesh(head, new THREE.CylinderGeometry(.025, .025, .42, 6), metal, [.27, -.15, .26], "headset-mic");
    mic.rotation.z = -.7;
  }
  if (spec.accessory === "relay") {
    addMesh(head, new THREE.BoxGeometry(.78, .18, .055), material(0x89d8ff, { roughness: .12, metalness: .18, emissive: spec.accent, emissiveIntensity: .35 }), [0, .04, .37], "visor");
    addMesh(root, new THREE.TorusGeometry(.16, .045, 6, 14), glow, [-.54, 1.45, 0], "signal-cuff").rotation.x = Math.PI / 2;
    addMesh(root, new THREE.ConeGeometry(.13, .42, 5), metal, [-.24, 2.05, .39], "left-lapel").rotation.z = -.18;
    addMesh(root, new THREE.ConeGeometry(.13, .42, 5), metal, [.24, 2.05, .39], "right-lapel").rotation.z = .18;
  }
  if (spec.accessory === "researcher") {
    const coat = addMesh(root, new THREE.BoxGeometry(.92, 1.05, .08), material(0xe8eef6, { roughness: .8 }), [0, 1.72, .37], "lab-coat");
    coat.geometry.rotateX(-.04);
    addMesh(head, new THREE.TorusGeometry(.15, .022, 6, 12), metal, [-.16, .04, .37], "left-glasses");
    addMesh(head, new THREE.TorusGeometry(.15, .022, 6, 12), metal, [.16, .04, .37], "right-glasses");
    addMesh(head, new THREE.BoxGeometry(.12, .025, .025), metal, [0, .04, .39], "glasses-bridge");
    addMesh(root, new THREE.BoxGeometry(.26, .34, .06), glow, [.26, 1.76, .43], "data-tablet");
  }

  root.traverse((object) => { object.userData.avatar = true; });
  return root;
}

// Relay's authored model follows her supplied full-body portrait. The large
// silhouette, bob, translucent visor, tailored jacket, skirt and wrist console
// are built as separate named parts so the office can still animate her pose.
function createRelayCharacter() {
  const root = new THREE.Group();
  root.name = "relay";
  root.userData.characterId = "relay";
  const skin = material(0xe9ae8d, { roughness: .82 });
  const skinShade = material(0xd68c6d, { roughness: .82 });
  const hair = material(0x78351f, { roughness: .7 });
  const hairLight = material(0xa7522f, { roughness: .62 });
  const jacket = material(0x111a27, { roughness: .52, metalness: .08 });
  const seam = material(0x263b51, { roughness: .55, metalness: .18 });
  const skirt = material(0x141a25, { roughness: .68 });
  const blouse = material(0xf3f0e8, { roughness: .9 });
  const metal = material(0x9eacb9, { roughness: .27, metalness: .8 });
  const black = material(0x111820, { roughness: .3 });
  const blue = material(0x49bdfa, { roughness: .24, metalness: .2, emissive: 0x2179c0, emissiveIntensity: .55 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9ecbe0, metalness: .24, roughness: .09,
    transparent: true, opacity: .38, transmission: .16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const curve = (parent, points, radius, source, name) =>
    addMesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(12, points.length * 5), radius, 7, false), source, [0, 0, 0], name);
  const panel = (parent, name, points, source, z, depth = .045) => {
    const shape = new THREE.Shape();
    shape.moveTo(...points[0]);
    for (const p of points.slice(1)) shape.lineTo(...p);
    shape.closePath();
    return addMesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .01, bevelThickness: .008, bevelSegments: 1 }), source, [0, 0, z], name);
  };

  // A tailored pencil skirt and bare lower legs distinguish Relay from the
  // trouser-shaped prototype. The pivots remain stable for seated animation.
  addMesh(root, new THREE.CylinderGeometry(.34, .39, .82, 24), skirt, [0, 1.02, 0], "pencil-skirt");
  addMesh(root, new THREE.CylinderGeometry(.36, .37, .07, 24), seam, [0, 1.40, 0], "skirt-waistband");
  for (const side of [-1, 1]) {
    const name = side < 0 ? "left" : "right";
    const leg = new THREE.Group();
    leg.name = `${name}-leg`;
    leg.position.set(side * .19, .91, 0);
    root.add(leg);
    const calf = addMesh(leg, new THREE.CapsuleGeometry(.105, .49, 8, 12), skin, [0, -.36, 0], `${name}-leg-mesh`);
    calf.scale.set(1, 1, .88);
    addMesh(leg, new THREE.SphereGeometry(.115, 14, 9), skinShade, [0, -.71, .01], `${name}-ankle`);
    const shoe = addMesh(leg, new THREE.SphereGeometry(.18, 18, 10), black, [0, -.79, .13], `${name}-shoe`);
    shoe.scale.set(.9, .5, 1.5);
    addMesh(leg, new THREE.BoxGeometry(.1, .16, .1), black, [0, -.83, -.10], `${name}-heel`);
  }
  const torso = addMesh(root, new THREE.CylinderGeometry(.35, .38, .83, 24), blouse, [0, 1.79, 0], "torso-blouse");
  torso.scale.z = .72;
  addMesh(root, new THREE.CylinderGeometry(.26, .29, .18, 20), blouse, [0, 2.24, 0], "shirt-collar-base");
  panel(root, "left-jacket-panel", [[-.38, 1.42], [-.06, 1.42], [-.04, 2.13], [-.29, 2.23], [-.43, 2.05]], jacket, .26);
  panel(root, "right-jacket-panel", [[.07, 1.42], [.38, 1.42], [.43, 2.05], [.29, 2.23], [.04, 2.13]], jacket, .26);
  panel(root, "left-metal-lapel", [[-.29, 2.22], [-.02, 1.96], [-.13, 1.73], [-.41, 2.10]], metal, .322, .025);
  panel(root, "right-metal-lapel", [[.29, 2.22], [.02, 1.96], [.13, 1.73], [.41, 2.10]], metal, .322, .025);
  panel(root, "left-shirt-collar", [[-.21, 2.28], [0, 2.12], [-.08, 1.99]], blouse, .34, .022);
  panel(root, "right-shirt-collar", [[.21, 2.28], [0, 2.12], [.08, 1.99]], blouse, .34, .022);
  for (const side of [-1, 1]) {
    const name = side < 0 ? "left" : "right";
    const arm = new THREE.Group();
    arm.name = `${name}-arm`;
    arm.position.set(side * .48, 2.18, 0);
    root.add(arm);
    addMesh(arm, new THREE.CapsuleGeometry(.115, .62, 8, 14), jacket, [side * .03, -.39, 0], `${name}-sleeve`);
    addMesh(arm, new THREE.SphereGeometry(.18, 16, 10), metal, [0, -.04, 0], `${name}-shoulder-armor`).scale.set(1, .6, .8);
    addMesh(arm, new THREE.CylinderGeometry(.125, .13, .12, 14), seam, [side * .06, -.72, 0], `${name}-cuff`);
    const hand = addMesh(arm, new THREE.CapsuleGeometry(.088, .12, 6, 12), skin, [side * .06, -.85, .015], `${name}-hand`);
    hand.rotation.z = side * .07;
    curve(arm, [[side * .1, -.16, .105], [side * .08, -.32, .117], [side * .08, -.5, .12], [side * .06, -.63, .12]], .009, blue, `${name}-sleeve-circuit`);
    if (side > 0) {
      addMesh(arm, new THREE.CylinderGeometry(.155, .15, .23, 20), metal, [side * .06, -.67, 0], "relay-wrist-console");
      addMesh(arm, new THREE.BoxGeometry(.16, .14, .025), blue, [side * .06, -.66, .151], "relay-wrist-display");
    }
  }
  for (const side of [-1, 1]) {
    curve(root, [[side * .33, 2.05, .34], [side * .28, 1.87, .35], [side * .34, 1.68, .35], [side * .25, 1.56, .35]], .008, blue, `jacket-circuit-${side}`);
    curve(root, [[side * .18, 1.26, .35], [side * .23, 1.03, .35], [side * .20, .78, .34]], .006, seam, `skirt-circuit-${side}`);
  }
  addMesh(root, new THREE.CylinderGeometry(.105, .115, .22, 18), skin, [0, 2.30, 0], "neck");

  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 2.72, 0);
  root.add(head);
  const face = addMesh(head, new THREE.SphereGeometry(.43, 32, 24), skin, [0, 0, .025], "face");
  face.scale.set(.96, 1.1, .88);
  addMesh(head, new THREE.SphereGeometry(.30, 24, 14), skinShade, [0, -.27, -.045], "chin").scale.set(1, .42, .7);
  // Layered bob silhouette and individual swept strands give the hair a
  // directional shape from both the front and the rotating office camera.
  addMesh(head, new THREE.SphereGeometry(.49, 32, 20), hair, [0, .12, -.11], "hair-back").scale.set(1.06, 1.17, .85);
  addMesh(head, new THREE.SphereGeometry(.47, 32, 18, 0, Math.PI * 2, 0, Math.PI * .48), hairLight, [0, .24, -.02], "hair-crown");
  for (const side of [-1, 1]) {
    addMesh(head, new THREE.SphereGeometry(.22, 22, 16), hair, [side * .37, -.16, -.035], `${side < 0 ? "left" : "right"}-bob`).scale.set(.72, 1.35, .89);
    const eye = addMesh(head, new THREE.SphereGeometry(.058, 16, 12), black, [side * .16, .025, .389], `${side < 0 ? "left" : "right"}-eye`);
    eye.scale.z = .75;
    addMesh(head, new THREE.SphereGeometry(.014, 8, 6), material(0xffffff), [side * .16 - .018, .045, .438], "eye-glint");
    curve(head, [[side * .08, .17, .395], [side * .16, .19, .392], [side * .25, .165, .36]], .018, hair, `eyebrow-${side}`);
    addMesh(head, new THREE.SphereGeometry(.095, 12, 9), skinShade, [side * .43, -.045, .03], "ear").scale.set(.5, 1, .5);
  }
  addMesh(head, new THREE.SphereGeometry(.055, 16, 10), skinShade, [0, -.075, .426], "nose");
  curve(head, [[-.105, -.205, .389], [0, -.238, .414], [.105, -.205, .389]], .012, material(0x6f322b), "smile");
  for (let i = 0; i < 9; i++) {
    const x = -.37 + i * .095;
    curve(head, [[x, .44, .19], [x + .065, .35, .32], [x + .12, .20, .40]], .026, i % 3 ? hairLight : hair, `swept-strand-${i}`);
  }
  const shieldGeometry = new THREE.PlaneGeometry(.88, .235, 24, 6);
  const position = shieldGeometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    position.setZ(i, .41 + .055 * (1 - (x / .44) ** 2));
  }
  position.needsUpdate = true;
  addMesh(head, shieldGeometry, glass, [0, .035, 0], "transparent-smart-visor");
  curve(head, [[-.44, .155, .40], [-.24, .17, .463], [0, .17, .469], [.24, .17, .463], [.44, .155, .40]], .022, metal, "visor-top-frame");
  curve(head, [[-.44, -.085, .40], [-.20, -.095, .457], [0, -.10, .464], [.20, -.095, .457], [.44, -.085, .40]], .012, metal, "visor-bottom-frame");
  for (const side of [-1, 1]) {
    curve(head, [[side * .44, .15, .40], [side * .48, .06, .22], [side * .44, .02, -.10]], .018, metal, `visor-temple-${side}`);
    curve(head, [[side * .20, .10, .471], [side * .26, .055, .475], [side * .36, .055, .444]], .006, blue, `visor-interface-${side}`);
  }
  root.traverse((object) => { object.userData.avatar = true; });
  return root;
}

const characters = [{ id: "relay" }];

await mkdir(outputDir, { recursive: true });
const exporter = new GLTFExporter();
for (const spec of characters) {
  const character = spec.id === "relay" ? createRelayCharacter() : createCharacter(spec);
  const glb = await exporter.parseAsync(character, { binary: true, onlyVisible: true });
  await writeFile(new URL(`${spec.id}.glb`, outputDir), Buffer.from(glb));
  console.log(`wrote ${spec.id}.glb`);
}

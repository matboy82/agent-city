import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_unlit";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { resolveActivity } from "./activity";
type Row = Record<string, any>;
const files: Record<string, string> = {
  "kenney.desk": "desk",
  "kenney.corner_desk": "deskCorner",
  "kenney.desk_chair": "chairDesk",
  "kenney.monitor": "computerScreen",
  "kenney.keyboard": "computerKeyboard",
  "kenney.laptop": "laptop",
  "kenney.potted_plant": "pottedPlant",
  "kenney.small_plant": "plantSmall2",
  "kenney.bookcase": "bookcaseOpen",
  "kenney.books": "books",
  "kenney.round_lamp": "lampRoundFloor",
  "kenney.square_lamp": "lampSquareFloor",
  "kenney.rug": "rugRectangle",
  "kenney.radio": "radio",
  "kenney.speaker": "speaker",
  "kenney.television": "televisionModern",
  "kenney.coffee_table": "tableCoffee",
  "kenney.sofa": "loungeDesignSofa",
  "kenney.satellite_dish": "satelliteDish",
  "polypizza.desk": "desk_4",
  "polypizza.chair": "office_chair",
  "polypizza.plant": "houseplant",
  "polypizza.rug": "rug_round",
  "polypizza.sofa": "couch_small",
  "polypizza.printer": "printer",
  "polypizza.desk_lamp": "light_desk",
  "polypizza.phone": "phone_2",
  "polypizza.screen": "computer_screen",
  "polypizza.shelf": "shelf_small",
  "polypizza.cabinet": "cabinet",
  "polypizza.couch_medium": "couch_medium",
  "polypizza.plant_tall": "houseplant_2",
  "polypizza.floor_light": "light_floor",
};
const buffers = new Map<string, Promise<ArrayBuffer>>();
function modelBytes(path: string) {
  let p = buffers.get(path);
  if (!p) {
    p = fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error("Model unavailable");
        return r.arrayBuffer();
      })
      .catch((err) => {
        buffers.delete(path);
        throw err;
      });
    buffers.set(path, p);
  }
  return p;
}
let cityCamera: number[] | null = null;
let cityCameraExtent = 12;
export async function mountWorld(
  canvas: HTMLCanvasElement,
  opts: {
    data: Row;
    agent: Row | null;
    headquarters?: boolean;
    dusk: boolean;
    reduced: boolean;
    onSelect: (id: string) => void;
    onError: () => void;
    positionDraft?: Record<string, number[]>;
  },
) {
  const { data, agent, dusk, onSelect, onError } = opts;
  let disposed = false;
  const mobile = innerWidth < 700;
  let initialRadius = agent ? 17 : mobile && !opts.headquarters ? 42 : 35;
  let cityCenterZ = 0;
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: !mobile,
    powerPreference: mobile ? "low-power" : "high-performance",
  });
  engine.setHardwareScalingLevel(1);
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  scene.clearColor = Color4.FromHexString(
    dusk
      ? "#0d1b32ff"
      : !agent && !opts.headquarters
        ? "#13284dff"
        : "#edf3f9ff",
  );
  scene.ambientColor = new Color3(0.06, 0.07, 0.1);
  const camera = new ArcRotateCamera(
    "camera",
    agent ? Math.PI / 3 : -Math.PI / 3,
    Math.PI / 3.3,
    initialRadius,
    new Vector3(0, 0, 0),
    scene,
  );
  camera.lowerBetaLimit = 0.35;
  camera.upperBetaLimit = 1.3;
  camera.lowerRadiusLimit = agent ? 2 : 4;
  camera.upperRadiusLimit = agent ? 45 : 100;
  camera.wheelDeltaPercentage = 0.015;
  camera.pinchDeltaPercentage = 0.01;
  camera.panningSensibility = 60;
  camera.attachControl(canvas, true);
  camera.minZ = 0.1;
  if (!agent && !opts.headquarters && cityCamera) {
    [camera.alpha, camera.beta, camera.radius] = cityCamera;
  }
  const hemi = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  hemi.intensity = dusk ? 0.5 : 0.65;
  hemi.groundColor = Color3.FromHexString(dusk ? "#293451" : "#c5d2e1");
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.6), scene);
  sun.position = new Vector3(15, 28, -18);
  sun.intensity = dusk ? 0.4 : 0.8;
  sun.diffuse = Color3.FromHexString(dusk ? "#9eb8ff" : "#fff5e5");
  const shadows = new ShadowGenerator(mobile ? 512 : 1024, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 16;
  shadows.darkness = 0.22;
  const material = (name: string, color: string, emissive = false) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    if (emissive) m.emissiveColor = m.diffuseColor.scale(dusk ? 0.8 : 0.25);
    return m;
  };
  const palette = agent?.effectiveDesign?.palette;
  const accent =
    (
      {
        bis_blue: "#2768df",
        graphite: "#748aaf",
        signal_green: "#2b9b80",
        warm: "#c58b4f",
      } as Record<string, string>
    )[palette] || "#2768df";
  const white = material("porcelain", dusk ? "#b7c9e3" : "#f8fafc"),
    navy = material("navy", "#213a59"),
    blue = material("BIS blue", accent, true),
    stone = material("slate", "#d8e2ed"),
    grass = material("landscape", dusk ? "#385e68" : "#abc6bc"),
    pathMat = material("paths", dusk ? "#30435b" : "#dde6ef"),
    water = material("water", "#64acc8", true),
    gold = material("brass", "#c5a773");
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: StandardMaterial,
  ) => {
    const m = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    m.position.set(x, y, z);
    m.material = mat;
    m.receiveShadows = true;
    return m;
  };
  let shadowCount = 0;
  const failures: string[] = [];
  const containers = new Map<string, Promise<AssetContainer>>();
  async function model(
    path: string,
    pos: number[],
    size: number,
    axis: "height" | "max" = "max",
    rotation = 0,
    selectId?: string,
  ) {
    try {
      let cached = containers.get(path);
      if (!cached) {
        cached = modelBytes(path).then((buffer) => {
          if (disposed) throw new Error("disposed");
          return LoadAssetContainerAsync(new Uint8Array(buffer), scene, {
            pluginExtension: ".glb",
          });
        });
        containers.set(path, cached);
      }
      const container = await cached;
      if (disposed) return null;
      for (const material of container.materials) {
        const m = material as any;
        if (typeof m.metallic === "number")
          m.metallic = Math.min(m.metallic, 0.12);
        if (
          path.includes("/space/hangar") ||
          path.includes("/space/structure")
        ) {
          const colors: Record<string, string> = {
            metal: "#f2f5fa",
            metalDark: "#b9c7d8",
            metalRed: "#2768df",
            dark: "#243a57",
          };
          if (colors[m.name] && m.albedoColor)
            m.albedoColor = Color3.FromHexString(colors[m.name]);
          m.unlit = false;
          m.roughness = 0.72;
        }
      }
      const instance = container.instantiateModelsToScene(
        (n) => `${n}-${scene.meshes.length}`,
        false,
        { doNotInstantiate: true },
      );
      const root = new TransformNode("asset", scene);
      for (const n of instance.rootNodes) n.parent = root;
      const bounds = root.getHierarchyBoundingVectors();
      const span = bounds.max.subtract(bounds.min);
      const factor =
        size / (axis === "height" ? span.y : Math.max(span.x, span.y, span.z));
      root.scaling.setAll(factor);
      root.position.set(
        -((bounds.min.x + bounds.max.x) / 2) * factor,
        -bounds.min.y * factor,
        -((bounds.min.z + bounds.max.z) / 2) * factor,
      );
      const anchor = new TransformNode("anchor", scene);
      root.parent = anchor;
      anchor.position.set(pos[0], pos[1], pos[2]);
      anchor.rotation.y = rotation;
      for (const m of root.getChildMeshes()) {
        m.receiveShadows = true;
        if (shadowCount < (mobile ? 6 : 12)) {
          shadows.addShadowCaster(m);
          shadowCount++;
        }
        if (selectId) {
          m.metadata = { selectId };
          m.isPickable = true;
        }
      }
      return anchor;
    } catch {
      if (!disposed) {
        failures.push(path.split("/").pop() || "model");
        console.warn("Asset load failed:", path.split("/").pop());
      }
      return null;
    }
  }
  function plaque(
    title: string,
    subtitle: string,
    x: number,
    y: number,
    z: number,
    width = 3.3,
  ) {
    const plane = MeshBuilder.CreatePlane(
      "label",
      { width, height: width * 0.29 },
      scene,
    );
    plane.position.set(x, y, z);
    plane.billboardMode = 7;
    const texture = new DynamicTexture(
      "label",
      { width: 512, height: 148 },
      scene,
      false,
    );
    const ctx = texture.getContext();
    ctx.fillStyle = dusk ? "#132238ee" : "#fffffff2";
    ctx.fillRect(0, 0, 512, 148);
    ctx.fillStyle = dusk ? "#eef5ff" : "#253d5d";
    let fontSize = 60;
    ctx.font = "600 " + fontSize + "px Segoe UI";
    while (ctx.measureText(title).width > 462 && fontSize > 28) {
      fontSize -= 2;
      ctx.font = "600 " + fontSize + "px Segoe UI";
    }
    ctx.fillText(title, 25, 62);
    ctx.font = "34px Segoe UI";
    ctx.fillStyle = "#8294ad";
    ctx.fillText(subtitle, 25, 108);
    texture.update();
    const mat = new StandardMaterial("label-material", scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    plane.material = mat;
    plane.isPickable = false;
    return plane;
  }
  const facadeGlass = material("blue architectural glass", "#1761af", true);
  facadeGlass.alpha = 0.68;
  facadeGlass.backFaceCulling = false;
  const reveal = material("deep window reveals", "#17345a");
  function architecture(
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    selectId: string,
    stage = 3,
    style = "studio",
  ) {
    const pick = (
      part: string,
      px: number,
      py: number,
      pz: number,
      w: number,
      h: number,
      d: number,
      mat: StandardMaterial,
    ) => {
      const mesh = box(name + " " + part, px, py, pz, w, h, d, mat);
      mesh.metadata = { selectId };
      return mesh;
    };
    const front = z + depth / 2;
    const rear = z - depth / 2;
    pick("raised plinth", x, 0.36, z, width + 0.32, 0.26, depth + 0.26, white);
    pick("shadow base", x, 0.15, z, width + 0.4, 0.16, depth + 0.35, navy);
    pick("ground glass", x, 1.18, z, width - 0.28, 1.58, depth - 0.28, reveal);
    if (stage >= 1) {
      pick(
        "front glazing",
        x,
        1.42,
        front - 0.055,
        width - 0.42,
        1.94,
        0.08,
        facadeGlass,
      );
      pick(
        "side glazing",
        x + width / 2 - 0.055,
        1.42,
        z,
        0.08,
        1.94,
        depth - 0.3,
        facadeGlass,
      );
    }
    for (const side of [-1, 1]) {
      for (const edge of [front, rear])
        pick(
          "structural pier",
          x + side * (width / 2 - 0.12),
          height / 2 + 0.4,
          edge,
          0.25,
          height,
          0.28,
          white,
        );
      pick(
        "front mullion",
        x + (side * width) / 5,
        1.42,
        front + 0.025,
        0.1,
        1.94,
        0.13,
        white,
      );
    }
    pick("floor slab", x, 2.43, z, width + 0.18, 0.24, depth + 0.16, white);
    pick(
      "blue slab reveal",
      x,
      2.28,
      front + 0.02,
      width + 0.08,
      0.055,
      0.08,
      blue,
    );
    if (stage >= 2) {
      pick(
        "upper volume",
        x + 0.3,
        (height + 2.5) / 2,
        z - 0.22,
        width - 0.7,
        height - 2.35,
        depth - 0.65,
        reveal,
      );
      pick(
        "upper glazing",
        x + 0.3,
        (height + 2.5) / 2,
        front - 0.3,
        width - 1.0,
        height - 2.54,
        0.08,
        facadeGlass,
      );
      for (const side of [-1, 1])
        pick(
          "upper pier",
          x + 0.3 + (side * (width - 0.7)) / 2,
          (height + 2.5) / 2,
          front - 0.3,
          0.17,
          height - 2.3,
          0.2,
          white,
        );
      pick(
        "upper transom",
        x + 0.3,
        (height + 2.45) / 2,
        front - 0.23,
        width - 0.75,
        0.12,
        0.18,
        white,
      );
    }
    if (stage >= 3) {
      pick(
        "cantilever roof",
        x + 0.38,
        height + 0.33,
        z - 0.15,
        width + 0.55,
        0.28,
        depth + 0.65,
        white,
      );
      pick(
        "roof blue channel",
        x + 0.38,
        height + 0.16,
        front + 0.17,
        width + 0.42,
        0.035,
        0.09,
        blue,
      );
      pick(
        "white portal",
        x - width * 0.28,
        1.4,
        front + 0.12,
        0.18,
        1.95,
        0.34,
        white,
      );
      pick(
        "portal lintel",
        x - width * 0.28,
        2.4,
        front + 0.12,
        width * 0.32,
        0.18,
        0.34,
        white,
      );
    }
    pick(
      "entry dark",
      x + width * 0.18,
      0.98,
      front + 0.03,
      0.96,
      1.25,
      0.08,
      navy,
    );
    for (let step = 0; step < 3; step++)
      pick(
        "entry stair",
        x + width * 0.18,
        0.25 - step * 0.07,
        front + 0.38 + step * 0.27,
        1.55 + step * 0.24,
        0.16,
        0.4,
        white,
      );
    if (style === "tower") {
      pick(
        "glass crown",
        x + 0.3,
        height + 0.8,
        z - 0.25,
        width * 0.45,
        1.1,
        depth * 0.5,
        facadeGlass,
      );
      pick(
        "crown cap",
        x + 0.3,
        height + 1.4,
        z - 0.25,
        width * 0.52,
        0.18,
        depth * 0.57,
        white,
      );
      pick("antenna", x + 0.3, height + 2.1, z - 0.25, 0.08, 1.3, 0.08, blue);
    } else if (style === "exchange") {
      for (const level of [1.25, 2.95, height - 0.25])
        pick(
          "exchange ribbon",
          x,
          level,
          front + 0.16,
          width + 0.4,
          0.09,
          0.15,
          blue,
        );
      pick(
        "market portal",
        x - width * 0.2,
        1.35,
        front + 0.5,
        width * 0.7,
        0.16,
        0.8,
        white,
      );
    } else if (style === "lab") {
      for (let i = -2; i <= 2; i++)
        pick(
          "lab glass fin",
          x + i * width * 0.16,
          height * 0.66,
          front + 0.19,
          0.1,
          height * 0.6,
          0.45,
          white,
        );
      pick(
        "research skylight",
        x + 0.2,
        height + 0.55,
        z - 0.5,
        width * 0.58,
        0.56,
        depth * 0.42,
        facadeGlass,
      );
    } else if (style === "command") {
      for (const side of [-1, 1]) {
        pick(
          "command wing",
          x + side * width * 0.54,
          1.15,
          z - 0.35,
          width * 0.28,
          1.5,
          depth * 0.65,
          white,
        );
        pick(
          "wing glass",
          x + side * width * 0.54,
          1.35,
          front - 0.6,
          width * 0.21,
          0.75,
          0.08,
          facadeGlass,
        );
      }
      pick("command signal", x, height + 0.57, z, 0.2, 0.65, 0.2, blue);
    } else if (style === "workshop") {
      const roofA = pick(
        "workshop roof A",
        x - width * 0.2,
        height + 0.5,
        z,
        width * 0.54,
        0.15,
        depth + 0.2,
        white,
      );
      const roofB = pick(
        "workshop roof B",
        x + width * 0.2,
        height + 0.5,
        z,
        width * 0.54,
        0.15,
        depth + 0.2,
        white,
      );
      roofA.rotation.z = 0.17;
      roofB.rotation.z = -0.17;
      pick(
        "service canopy",
        x + width * 0.29,
        1.94,
        front + 0.7,
        width * 0.37,
        0.13,
        1.5,
        white,
      );
    } else {
      pick(
        "studio skylight",
        x - width * 0.18,
        height + 0.5,
        z - 0.3,
        width * 0.56,
        0.45,
        depth * 0.55,
        facadeGlass,
      );
      pick(
        "studio floating beam",
        x + width * 0.31,
        height * 0.68,
        front + 0.45,
        width * 0.48,
        0.16,
        0.9,
        white,
      );
    }
    return height;
  }
  function buildingVariant(name: string, x: number, z: number, kind: string, selectId: string, lift = 0) {
    const part = (title: string, dx: number, y: number, dz: number, w: number, h: number, d: number, mat: StandardMaterial) => {
      const mesh = box(`${name} ${title}`, x + dx, y + lift, z + dz, w, h, d, mat);
      mesh.metadata = { selectId };
      return mesh;
    };
    const glass = facadeGlass, dark = reveal;
    if (kind === "skyscraper" || kind === "office_building") {
      const floors = kind === "skyscraper" ? 9 : 4;
      const width = kind === "skyscraper" ? 3.6 : 5.5;
      const depth = kind === "skyscraper" ? 3.1 : 4.4;
      part("lobby", 0, 1.0, 0, width, 1.8, depth, dark);
      part("lobby glass", 0, 1, depth / 2 + 0.04, width - 0.35, 1.45, 0.08, glass);
      for (let floor = 1; floor <= floors; floor++) {
        const y = 1.25 + floor * 0.68;
        part(`floor ${floor} blue glass`, 0, y, 0, width - 0.22, 0.59, depth - 0.22, glass);
        part(`floor ${floor} white slab`, 0, y + 0.32, 0, width + 0.16, 0.11, depth + 0.16, white);
        for (const dx of [-width / 3, 0, width / 3])
          part(`floor ${floor} mullion`, dx, y, depth / 2 + 0.02, 0.07, 0.6, 0.12, white);
      }
      for (const dx of [-width / 2, width / 2]) {
        part("vertical tower pier", dx, 2.1 + floors * 0.34, depth / 2, 0.14, 1.4 + floors * 0.68, 0.18, white);
        part("side fin", dx, 2.1 + floors * 0.34, 0, 0.16, 1.4 + floors * 0.68, depth + 0.2, white);
      }
      part("roof crown", 0, 1.65 + floors * 0.68, 0, width + 0.35, 0.23, depth + 0.35, white);
      if (kind === "skyscraper") {
        part("lit mast", 0, 2.55 + floors * 0.68, 0, 0.11, 1.7, 0.11, blue);
        part("tower entrance canopy", 0, 1.85, depth / 2 + 0.6, 2.1, 0.15, 1.25, white);
      } else {
        part("office entrance canopy", 0, 1.9, depth / 2 + 0.6, 3.2, 0.18, 1.4, white);
        part("roof equipment", -1.5, 4.65, -0.8, 1.2, 0.5, 1.1, dark);
      }
      return;
    }
    const warehouse = kind === "warehouse";
    const width = 6.4, depth = warehouse ? 5.0 : 4.6;
    part("main shell", 0, 1.85, 0, width, 3.05, depth, white);
    part("deep blue fascia", 0, 3.15, depth / 2 + 0.04, width + 0.16, 0.52, 0.15, blue);
    part("roof cap", 0, 3.49, 0, width + 0.45, 0.16, depth + 0.45, white);
    for (const dx of [-2.1, 0, 2.1]) {
      part(warehouse ? "loading dock recess" : "storefront glass", dx, 1.42, depth / 2 + 0.05, 1.65, 1.65, 0.1, warehouse ? dark : glass);
      part(warehouse ? "loading dock door" : "storefront reveal", dx, 1.34, depth / 2 + 0.12, 1.47, 1.48, 0.06, warehouse ? facadeGlass : dark);
      part("facade pier", dx + 0.98, 1.5, depth / 2 + 0.08, 0.13, 2.85, 0.2, white);
      if (warehouse) part("dock bumper", dx, 0.5, depth / 2 + 0.26, 1.7, 0.16, 0.16, navy);
    }
    if (!warehouse) {
      part("entrance canopy", 0, 2.5, depth / 2 + 0.65, 3.1, 0.14, 1.35, white);
      for (const dx of [-2.4, 2.4]) part("blue canopy support", dx, 1.45, depth / 2 + 1.15, 0.11, 2.2, 0.11, blue);
    } else {
      for (const dx of [-2, 2]) part("roof skylight", dx, 3.62, -0.5, 1.3, 0.08, 2.1, glass);
      part("dock ramp", 0, 0.3, depth / 2 + 0.75, 5.6, 0.2, 1.3, stone);
    }
  }
  const tasks: Promise<unknown>[] = [];
  const officeItems = new Map<string, TransformNode>();
  const officeAnchors = new Map<string, number[]>();
  const cityItems = new Map<
    string,
    { root: TransformNode; origin: number[] }
  >();
  let officeAvatar: TransformNode | null = null;
  let featurePedestal: ReturnType<typeof box> | null = null;
  let seatedPose = false;
  if (opts.headquarters) {
    camera.radius = 23;
    camera.target = new Vector3(0, 0, 0);
    box("HQ floor", 0, -0.2, 0, 17, 0.4, 12, white);
    box("HQ foundation", 0, -0.48, 0, 17.3, 0.2, 12.3, navy);
    const zones = [
      ["missions", "MISSION TABLE", -5, -3],
      ["dispatch", "DISPATCH", 0, -3],
      ["ops", "LIVE OPS", 5, -3],
      ["handoffs", "HANDOFF BAY", -5, 3],
      ["team", "COLLABORATION", 0, 3],
      ["review", "REVIEW ROOM", 5, 3],
    ] as const;
    for (const [zone, title, baseX, baseZ] of zones) {
      const offset = data.hq?.zones?.[zone] || [0, 0, 0];
      const x = baseX + offset[0], z = baseZ + offset[2], y = offset[1];
      box("zone channel", x, 0.02, z, 4, 0.025, 3.8, stone);
      box("zone accent", x, 0.04, z + 1.8, 4, 0.03, 0.07, blue);
      const table = box("zone table", x, 0.8 + y, z, 2.7, 0.18, 1.6, navy);
      table.metadata = { selectId: "zone:" + zone };
      const base = box("table base", x, 0.4 + y, z, 1, 0.7, 0.7, white);
      base.metadata = { selectId: "zone:" + zone };
      tasks.push(
        model(
          "/assets/furniture/chairDesk.glb",
          [x - 1.2, y, z + 1.2],
          1,
          "height",
          Math.PI,
          "zone:" + zone,
        ),
      );
      tasks.push(
        model(
          "/assets/furniture/computerScreen.glb",
          [x, 0.91 + y, z],
          0.55,
          "height",
          0,
          "zone:" + zone,
        ),
      );
      const count =
        zone === "review"
          ? data.approvals.filter((a: Row) => a.status === "waiting").length
          : zone === "handoffs"
            ? data.handoffs.filter((h: Row) => h.status !== "completed").length
            : zone === "ops"
              ? data.runs.filter((r: Row) => r.status === "running").length
              : zone === "team"
                ? data.messages.filter((m: Row) => m.scope === "team").length
                : zone === "dispatch"
                  ? data.commands.filter((c: Row) => c.status === "queued")
                      .length
                  : data.work.length;
      plaque(
        title,
        count + " " + (zone === "review" ? "waiting on Matt" : "records"),
        x,
        2.5,
        z,
        4,
      );
    }
    for (const x of [-7.5, 7.5])
      for (const z of [-5, 5])
        tasks.push(
          model("/assets/furniture/pottedPlant.glb", [x, 0, z], 1.4, "height"),
        );
  } else if (!agent) {
    const northEdge = Math.min(
      -12,
      ...data.buildings.map((b: Row) => b.z - 6),
      ...(data.cityAssets || []).map((a: Row) => a.position[2] - 3),
    );
    const southEdge = Math.max(
      12,
      ...data.buildings.map((b: Row) => b.z + 6),
      ...(data.cityAssets || []).map((a: Row) => a.position[2] + 3),
    );
    const halfWidth = Math.max(
      13.5,
      ...data.buildings.map((b: Row) => Math.abs(b.x) + 3.5),
      ...(data.cityAssets || []).map((a: Row) => Math.abs(a.position[0]) + 2),
    );
    const campusWidth = halfWidth * 2;
    const campusDepth = southEdge - northEdge;
    const campusCenter = (southEdge + northEdge) / 2;
    cityCenterZ = campusCenter;
    const extent = Math.max(southEdge - 12, -12 - northEdge);
    initialRadius = Math.max(initialRadius, 35 + extent * 1.5);
    camera.target = new Vector3(0, 0, campusCenter);
    if (!cityCamera || extent > cityCameraExtent) camera.radius = initialRadius;
    cityCameraExtent = Math.max(cityCameraExtent, extent);
    box(
      "campus plinth",
      0,
      -0.65,
      campusCenter,
      campusWidth,
      1,
      campusDepth,
      white,
    );
    box(
      "campus trim",
      0,
      -0.12,
      campusCenter,
      campusWidth + 0.15,
      0.12,
      campusDepth + 0.15,
      stone,
    );
    box(
      "landscape",
      0,
      -0.03,
      campusCenter,
      campusWidth - 0.5,
      0.08,
      campusDepth - 0.5,
      grass,
    );
    box(
      "central boulevard",
      0,
      0.025,
      campusCenter,
      4.3,
      0.1,
      campusDepth - 0.5,
      pathMat,
    );
    box("cross boulevard", 0, 0.027, 0, 26.5, 0.1, 3.2, pathMat);
    for (const x of [-2.3, 2.3])
      box(
        "blue channel",
        x,
        0.09,
        campusCenter,
        0.05,
        0.02,
        campusDepth - 1,
        blue,
      );
    for (const z of [-1.8, 1.8])
      box("blue channel", 0, 0.09, z, 26, 0.02, 0.05, blue);
    for (let z = northEdge + 2; z <= southEdge - 2; z += 2)
      box("boulevard seam", 0, 0.09, z, 3.8, 0.02, 0.035, white);
    const ring = MeshBuilder.CreateTorus(
      "arrival plaza",
      { diameter: 4.1, thickness: 0.13, tessellation: 64 },
      scene,
    );
    ring.position.y = 0.15;
    ring.material = blue;
    const hq = data.hq || { position: [0, 0, 0], model: "campus" };
    const [hx, hy, hz] = hq.position;
    box("HQ podium", hx, 0.22 + hy, hz, 3.2, 0.3, 2.8, white);
    if (hq.model === "campus") {
      const begin = scene.meshes.length;
      architecture("BIS HQ", hx, hz, 3.1, 2.6, 3.4, "hq");
      for (const mesh of scene.meshes.slice(begin)) mesh.position.y += hy;
    }
    else buildingVariant("BIS HQ", hx, hz, hq.model, "hq", hy);
    plaque("BIS HQ", "TEAM CONTROL", hx, (hq.model === "skyscraper" ? 9.4 : hq.model === "office_building" ? 5.5 : 4.3) + hy, hz, 3.0);
    for (const b of data.buildings) {
      const a = data.agents.find((a: Row) => a.id === b.agentId);
      const x = b.x,
        z = b.z;
      const projectState =
        b.kind === "reserved_plot"
          ? "ready"
          : b.kind === "project_site"
            ? b.lifecycle || "planning"
            : "running";
      const selectId = b.agentId || "project:" + b.id;
      if (b.kind !== "agent_hq") {
        box(
          "project walkway",
          x / 2,
          0.035,
          z,
          Math.abs(x) + 3,
          0.09,
          1.25,
          pathMat,
        );
      }
      const begin = scene.meshes.length;
      const buildingRoot = new TransformNode(`building:${b.id}`, scene);
      const collect = () => {
        for (const mesh of scene.meshes.slice(begin)) {
          if (!mesh.parent) mesh.parent = buildingRoot;
          if (mesh.isPickable && !mesh.metadata?.selectId)
            mesh.metadata = { selectId };
        }
        buildingRoot.position.y = b.y || 0;
        cityItems.set(`building:${b.id}`, {
          root: buildingRoot,
          origin: [x, 0, z],
        });
      };
      if (projectState === "planning" || projectState === "ready") {
        const soil = material("prepared earth", "#8d806e");
        const plot = box(
          "reserved construction plot",
          x,
          0.19,
          z,
          5.6,
          0.22,
          4.3,
          soil,
        );
        plot.metadata = { selectId };
        for (const side of [-1, 1]) {
          box(
            "plot retaining edge",
            x + side * 2.88,
            0.31,
            z,
            0.18,
            0.36,
            4.5,
            white,
          );
          box(
            "survey channel",
            x + side * 2.55,
            0.31,
            z,
            0.045,
            0.02,
            4.0,
            blue,
          );
        }
        box("plot front edge", x, 0.31, z + 2.23, 5.8, 0.36, 0.18, white);
        plaque(
          projectState === "ready" ? "READY FOR NEXT PROJECT" : b.name,
          projectState === "ready" ? "RESERVED CAMPUS PLOT" : "PLANNING",
          x,
          1.5,
          z,
          5.5,
        );
        collect();
        continue;
      }
      if (projectState === "building") {
        const concrete = material("construction deck", "#b5bec9");
        const safety = material("safety orange", "#e5a94d", true);
        const deck = box(
          "construction footprint",
          x,
          0.36,
          z,
          5.8,
          0.35,
          4.6,
          concrete,
        );
        deck.metadata = { selectId };
        for (const side of [-1, 1])
          for (const edge of [-1, 1]) {
            const px = x + side * 2.45,
              pz = z + edge * 1.85;
            const pole = box(
              "scaffold upright",
              px,
              1.9,
              pz,
              0.1,
              3.1,
              0.1,
              navy,
            );
            pole.metadata = { selectId };
            box("safety marker", px, 0.65, pz, 0.18, 0.28, 0.18, safety);
          }
        for (const level of [1.1, 2.4, 3.45]) {
          box(
            "scaffold front rail",
            x,
            level,
            z + 1.85,
            5.1,
            0.08,
            0.08,
            white,
          );
          box("scaffold rear rail", x, level, z - 1.85, 5.1, 0.08, 0.08, white);
        }
        box("partial core", x - 0.8, 1.3, z - 0.3, 2.2, 1.8, 2.2, white);
        box(
          "partial glazing",
          x - 0.8,
          1.5,
          z + 0.85,
          1.8,
          1.25,
          0.05,
          facadeGlass,
        );
        const crane = box(
          "crane mast",
          x + 2,
          3.5,
          z - 1.3,
          0.14,
          6,
          0.14,
          safety,
        );
        crane.metadata = { selectId };
        box("crane jib", x + 1.1, 6.45, z - 1.3, 3.5, 0.14, 0.14, safety);
        box("crane cable", x - 0.45, 5.75, z - 1.3, 0.035, 1.35, 0.035, navy);
        plaque(b.name, "BUILDING OUT", x, 7.1, z, 5.3);
        collect();
        continue;
      }
      box("foundation", x, 0.2, z, 6, 0.35, 5, white);
      box("step", x, 0.1, z + 2.9, 4, 0.15, 1, pathMat);
      box("front channel", x, 0.39, z + 2.4, 5.5, 0.06, 0.07, blue);
      const height =
        b.style === "tower" ? 4.5 : b.style === "command" ? 4.05 : 3.6;
      const buildingModels: Record<string, string> = {
        hangar_a: "hangar_largeA",
        hangar_b: "hangar_largeB",
        glass_atrium: "hangar_roundGlass",
        detailed_hub: "structure_detailed",
      };
      if (["skyscraper", "office_building", "big_box", "warehouse"].includes(b.model)) {
        buildingVariant(b.name, x, z, b.model, selectId, b.y || 0);
      } else if (buildingModels[b.model]) {
        tasks.push(
          model(
            `/assets/space/${buildingModels[b.model]}.glb`,
            [x, 0.39, z],
            5.3,
            "max",
            0,
            selectId,
          ).then((item) => {
            if (item) item.parent = buildingRoot;
          }),
        );
      } else
        architecture(b.name, x, z, 5.25, 3.9, height, selectId, 3, b.style);
      const state =
        a?.connection === "Connected"
          ? a.operationalState
          : a?.connection ||
            (projectState === "complete" ? "COMPLETE" : "RUNNING");
      plaque(b.name, state, x, ["skyscraper", "office_building"].includes(b.model) ? (b.model === "skyscraper" ? 9.4 : 5.5) : height + 1.05, z, 5.3);
      const beacon = MeshBuilder.CreateCylinder(
        "beacon",
        { diameter: 0.15, height: 0.65, tessellation: 12 },
        scene,
      );
      beacon.position.set(x + 2.5, 0.7, z + 2);
      beacon.material =
        a?.connection === "Connected"
          ? a.operationalState === "waiting"
            ? gold
            : a.operationalState === "blocked"
              ? material("blocked beacon", "#c56151", true)
              : blue
          : stone;
      for (const dx of [-2.3, 2.3])
        tasks.push(
          model(
            "/assets/furniture/pottedPlant.glb",
            [x + dx, 0.4, z - 2],
            0.85,
            "height",
          ),
        );
      collect();
    }
    const cityAssetFiles: Record<string, [string, number]> = {
      planter: ["/assets/furniture/pottedPlant.glb", 1.5],
      small_tree: ["/assets/furniture/plantSmall2.glb", 2.3],
      satellite_dish: ["/assets/space/satelliteDish.glb", 2.2],
      rock_cluster: ["/assets/space/rocks_smallA.glb", 1.7],
      landing_pad: ["/assets/space/platform_large.glb", 3.5],
    };
    for (const item of data.cityAssets || []) {
      const spec = cityAssetFiles[item.asset];
      if (!spec) continue;
      tasks.push(
        model(
          spec[0],
          item.position,
          spec[1],
          "max",
          0,
          `cityasset:${item.id}`,
        ).then((root) => {
          if (root)
            cityItems.set(`asset:${item.id}`, { root, origin: item.position });
        }),
      );
    }
    if (!opts.reduced && data.buildings.length > 1) {
      const destinations = data.buildings.filter(
        (b: Row) => b.kind !== "reserved_plot",
      );
      for (
        let i = 0;
        i < Math.min(2, Math.floor(destinations.length / 2));
        i++
      ) {
        const from = destinations[i],
          to = destinations[destinations.length - 1 - i];
        void model(
          `/assets/vehicles/${i ? "courier" : "shuttle"}.glb`,
          [from.x, 0.8, from.z],
          1.25,
          "max",
        ).then((vehicle) => {
          if (!vehicle || disposed) return;
          const start = performance.now() + i * 3500;
          const duration = i ? 18000 : 23000;
          scene.onBeforeRenderObservable.add(() => {
            const t =
              ((performance.now() - start + duration) % duration) / duration;
            const leg = t < 0.5 ? t * 2 : (1 - t) * 2;
            const smooth = leg * leg * (3 - 2 * leg);
            vehicle.position.x = from.x + (to.x - from.x) * smooth;
            vehicle.position.z = from.z + (to.z - from.z) * smooth;
            vehicle.position.y =
              0.8 + Math.sin(Math.PI * leg) * (i ? 5.2 : 6.2);
            vehicle.rotation.y =
              Math.atan2(to.x - from.x, to.z - from.z) +
              (t < 0.5 ? 0 : Math.PI);
            vehicle.rotation.z = Math.sin(Math.PI * leg) * 0.06;
          });
        });
      }
    }
    for (const x of [-12, 12])
      for (const z of [-9, -3, 3, 9])
        tasks.push(
          model(
            "/assets/furniture/pottedPlant.glb",
            [x, 0.1, z],
            1.6,
            "height",
          ),
        );
    box("reflection pool", -7, 0.13, 10, 6, 0.1, 1.5, white);
    box("water", -7, 0.2, 10, 5.6, 0.05, 1.1, water);
    for (const x of [-10, 10]) {
      box("bench", x, 0.5, 0, 1.7, 0.16, 0.7, white);
      box("bench support", x, 0.28, 0, 0.7, 0.4, 0.45, navy);
    }
    for (let i = 0; i < 5; i++)
      tasks.push(
        model(
          "/assets/space/rocks_smallA.glb",
          [10 + i * 0.3, 0.06, 10 + (i % 2) * 0.4],
          0.7,
        ),
      );
  } else {
    const design = agent.effectiveDesign;
    const theme = design.theme;
    const warm = theme === "cozy_den";
    const floor = material("floor", warm ? "#bba38b" : "#edf2f8");
    const wall = material(
      "wall",
      warm ? "#ddd0bd" : dusk ? "#a9bad3" : "#f8fafc",
    );
    box("room floor", 0, -0.17, 0, 11, 0.3, 9, floor);
    box("foundation", 0, -0.45, 0, 11.3, 0.25, 9.3, navy);
    const back = box("back wall", 0, 1.7, -4.4, 11, 3.5, 0.15, wall),
      side = box("side wall", -5.4, 1.7, 0, 0.15, 3.5, 9, wall);
    box("back skirting", 0, 0.12, -4.28, 10.9, 0.2, 0.08, white);
    box("floor channel", 0, 0.015, -4.05, 10.4, 0.02, 0.07, blue);
    box("side channel", -5.15, 0.015, 0, 0.07, 0.02, 8.4, blue);
    const glass = material("window", "#2173c7", true);
    glass.alpha = 0.72;
    box("architectural sill", -3, 1.12, -4.13, 3.75, 0.13, 0.19, white);
    box("window", -3, 2.13, -4.16, 3.55, 1.86, 0.045, glass);
    box("architectural lintel", -3, 3.14, -4.13, 3.8, 0.16, 0.22, white);
    for (const x of [-4.78, -3.58, -2.38, -1.2])
      box("mullion", x, 2.13, -4.08, 0.12, 2.05, 0.17, white);
    box("window transom", -3, 2.13, -4.06, 3.6, 0.095, 0.14, white);
    box("room canopy", 0, 3.51, -4.03, 10.9, 0.17, 0.78, white);
    box("room canopy blue reveal", 0, 3.37, -3.63, 10.7, 0.035, 0.075, blue);
    for (const x of [-5.22, 5.22])
      box("room structural pier", x, 1.78, -4.05, 0.28, 3.55, 0.32, white);
    box("display backing", 1.9, 2.2, -4.2, 4.6, 1.65, 0.12, navy);
    const screen = MeshBuilder.CreatePlane(
      "live screen",
      { width: 4.3, height: 1.35 },
      scene,
    );
    screen.position.set(1.9, 2.2, -4.11);
    screen.rotation.y = Math.PI;
    const tex = new DynamicTexture(
      "task-screen",
      { width: 1024, height: 320 },
      scene,
      false,
    );
    const ctx = tex.getContext();
    ctx.fillStyle = "#10243c";
    ctx.fillRect(0, 0, 1024, 320);
    ctx.fillStyle = "#6a9bf1";
    ctx.font = "22px Segoe UI";
    ctx.fillText("BIS / " + agent.name.toUpperCase() + " / LIVE WORK", 38, 51);
    ctx.fillStyle = "#f4f8ff";
    ctx.font = "36px Segoe UI";
    ctx.fillText(
      (agent.currentTask || "Awaiting your next mission").slice(0, 44),
      38,
      125,
    );
    ctx.font = "24px Segoe UI";
    ctx.fillStyle = "#9fb4d2";
    ctx.fillText(
      agent.connection +
        "  /  " +
        data.work.filter((w: Row) => w.raci.responsible.includes(agent.id))
          .length +
        " assigned  /  " +
        data.approvals.filter((a: Row) => a.status === "waiting").length +
        " reviews",
      38,
      202,
    );
    ctx.font = "20px Segoe UI";
    ctx.fillText(
      agent.lastSeen
        ? "Last seen " +
            new Date(agent.lastSeen).toLocaleString("en-US", {
              timeZone: "America/Denver",
            })
        : "Never connected — no presence inferred",
      38,
      265,
    );
    tex.update();
    const sm = material("screen", "#ffffff", true);
    sm.diffuseTexture = tex;
    sm.emissiveColor = Color3.White();
    sm.disableLighting = true;
    sm.backFaceCulling = false;
    screen.material = sm;
    const anchors: Record<string, number[]> = {
      primary_desk: [1.3, 0, -1.6],
      task_chair: [1.3, 0, 0.18],
      desk_screen: [1.3, 0.7, -1.88],
      desk_accessory: [1.65, 0.7, -1.26],
      plant_corner: [4.4, 0, -3.3],
      library: [-4.2, 0, -3.5],
      lounge_seating: [-3.6, 0, 1.4],
      coffee_table: [-2, 0, 1.4],
      floor_rug: [0.8, 0.01, 1.6],
      floor_lamp: [4.2, 0, 0.5],
      feature_prop: [-3.5, 0.8, -1.4],
      wall_display: [4, 1.4, -3.95],
    };
    const sizes: Record<string, number> = {
      primary_desk: 0.84,
      task_chair: 1.1,
      desk_screen: 0.65,
      desk_accessory: 0.16,
      plant_corner: 1.6,
      library: 2.4,
      lounge_seating: 1,
      coffee_table: 0.55,
      floor_rug: 3.1,
      floor_lamp: 2,
      feature_prop: 0.9,
      wall_display: 0.85,
    };
    const fallback = data.themes[theme].placements;
    const placements = [
      ...fallback.filter(
        (p: Row) => !design.placements.some((q: Row) => q.slot === p.slot),
      ),
      ...design.placements,
    ];
    for (const p of placements) {
      if (!files[p.asset_id]) continue;
      const collection = p.asset_id.startsWith("polypizza.")
        ? "polypizza"
        : p.asset_id === "kenney.satellite_dish"
          ? "space"
          : "furniture";
      const path = `/assets/${collection}/${files[p.asset_id]}.glb`;
      const base = anchors[p.slot];
      const offset = opts.positionDraft?.[p.slot] ||
        agent.officePositions?.[p.slot] || [0, 0, 0];
      if (p.slot === "feature_prop")
        featurePedestal = box(
          "feature pedestal",
          -3.5 + offset[0],
          0.4 + offset[1],
          -1.4 + offset[2],
          1.3,
          0.8,
          1.2,
          white,
        );
      officeAnchors.set(p.slot, base);
      tasks.push(
        model(
          path,
          base.map(
            (coordinate: number, axis: number) => coordinate + offset[axis],
          ),
          sizes[p.slot],
          p.slot === "floor_rug" ? "max" : "height",
          ((p.rotation || 0) * Math.PI) / 180 +
            (p.slot === "task_chair"
              ? 0
              : p.slot === "lounge_seating"
                ? Math.PI / 2
                : Math.PI),
          `furniture:${p.slot}`,
        ).then((item) => {
          if (item) officeItems.set(p.slot, item);
        }),
      );
    }
    // Supplied prototype bodies retain their existing identity; no portrait-to-body inference.
    const live = agent.connection === "Connected";
    const mode = resolveActivity(agent, data.runs);
    const seated = ["typing", "reading", "on_call"].includes(mode);
    seatedPose = seated;
    const chairOffset = opts.positionDraft?.task_chair ||
      agent.officePositions?.task_chair || [0, 0, 0];
    const station = seated
      ? [1.3 + chairOffset[0], chairOffset[1], 0.18 + chairOffset[2]]
      : mode === "presenting"
        ? [3.2, 0, -2.7]
        : [1.3, 0, 1.3];
    tasks.push(
      model(
        `/assets/characters/${["jeff", "relay", "jefferson", "jev"].includes(agent.id) ? agent.id : "neutral"}.glb`,
        station,
        1.75,
        "height",
        0,
        "agent:" + agent.id,
      ).then((avatar) => {
        if (!avatar) return;
        officeAvatar = avatar;
        const nodes = avatar.getDescendants(false);
        const node = (name: string) =>
          nodes.find(
            (n) =>
              n.name.startsWith(name + "-") &&
              !n.name.includes("mesh") &&
              !n.name.includes("shoe"),
          ) as TransformNode | undefined;
        const left = node("left-arm"),
          right = node("right-arm"),
          head = node("head");
        for (const side of ["left", "right"]) {
          const leg = node(side + "-leg");
          if (!leg) continue;
          leg.rotationQuaternion = null;
          if (seated) {
            const mesh = leg
              .getChildMeshes(true)
              .find((m) => m.name.includes("-leg-mesh"));
            if (mesh) {
              const length = Math.abs(mesh.position.y) * 2;
              const knee = new TransformNode(side + "-knee", scene);
              knee.parent = leg;
              knee.position.y = -length / 2;
              const lower = mesh.clone(side + "-shin", knee);
              mesh.scaling.y *= 0.5;
              mesh.position.y = -length / 4;
              if (lower) {
                lower.position.y = -length / 2;
              }
              const shoe = leg
                .getChildMeshes(true)
                .find((m) => m.name.includes("shoe"));
              if (shoe) {
                shoe.parent = knee;
                shoe.position.y = -length + 0.02;
              }
              leg.rotation.x = -1.35;
              knee.rotation.x = 1.35;
            }
          }
        }
        for (const side of ["left", "right"]) {
          const hand = nodes.find((n) => n.name.startsWith(side + "-hand-")) as
            TransformNode | undefined;
          const arm = side === "left" ? left : right;
          if (hand && arm) hand.setParent(arm);
        }
        if (left) {
          left.rotationQuaternion = null;
          left.rotation.x = seated ? -1 : 0;
        }
        if (right) {
          right.rotationQuaternion = null;
          right.rotation.x =
            mode === "on_call"
              ? -2.1
              : mode === "presenting"
                ? -1.1
                : seated
                  ? -1
                  : 0;
          right.rotation.z = mode === "presenting" ? -0.65 : 0;
        }
        if (head) {
          head.rotationQuaternion = null;
          head.rotation.x = mode === "reading" ? 0.18 : 0;
        }
        if (!opts.reduced && live && mode !== "idle")
          scene.onBeforeRenderObservable.add(() => {
            const t = performance.now() / 1000;
            if (mode === "typing") {
              if (left) left.rotation.x = -1 + Math.sin(t * 8) * 0.12;
              if (right) right.rotation.x = -1 + Math.sin(t * 8 + 1) * 0.12;
            }
            if (mode === "presenting" && right) {
              right.rotation.x = -1.1 + Math.sin(t * 1.25) * 0.13;
              right.rotation.z = -0.65 + Math.sin(t * 1.8) * 0.08;
            }
            if (mode === "reading" && head)
              head.rotation.x = 0.18 + Math.sin(t * 0.7) * 0.025;
            if (mode === "on_call" && head)
              head.rotation.y = Math.sin(t * 0.42) * 0.08;
            if (mode === "walking") {
              avatar.position.x = 1.3 + Math.sin(t * 0.58) * 1.3;
              avatar.position.z = 1.3 + Math.sin(t * 1.16) * 0.25;
              const l = node("left-leg"),
                r = node("right-leg");
              const stride = Math.sin(t * 5.2) * 0.35;
              if (l) l.rotation.x = stride;
              if (r) r.rotation.x = -stride;
              if (left) left.rotation.x = -stride * 0.7;
              if (right) right.rotation.x = stride * 0.7;
              avatar.rotation.y =
                Math.cos(t * 0.58) > 0 ? Math.PI / 2 : -Math.PI / 2;
            }
            if (mode === "celebrating") {
              if (left) {
                left.rotation.x = -2.5;
                left.rotation.z = 0.3;
              }
              if (right) {
                right.rotation.x = -2.5;
                right.rotation.z = -0.3;
              }
              avatar.position.y = Math.abs(Math.sin(t * 2)) * 0.07;
            }
          });
      }),
    );
    const backFixtures = scene.meshes.filter((mesh) =>
      [
        "architectural sill",
        "window",
        "mullion",
        "architectural lintel",
        "window transom",
        "room canopy",
        "room canopy blue reveal",
        "room structural pier",
        "display backing",
        "live screen",
      ].includes(mesh.name),
    );
    scene.onBeforeRenderObservable.add(() => {
      const pos = camera.position;
      back.visibility = pos.z < -2 ? 0.06 : 1;
      for (const fixture of backFixtures) fixture.visibility = back.visibility;
      side.visibility = pos.x < -2 ? 0.06 : 1;
    });
    camera.target = new Vector3(0, 0.6, 0);
  }
  let last = 0;
  engine.runRenderLoop(() => {
    if (disposed || document.hidden || !canvas.isConnected) return;
    const t = performance.now();
    if (t - last < (mobile ? 33 : 16)) return;
    last = t;
    try {
      scene.render();
    } catch (error) {
      console.error("World render failed", error);
      onError();
      engine.stopRenderLoop();
    }
  });
  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERTAP) {
      const picked = scene.pick(
        scene.pointerX,
        scene.pointerY,
        (mesh) =>
          Boolean(mesh.metadata?.selectId) &&
          mesh.isEnabled() &&
          mesh.isVisible,
      )?.pickedMesh;
      const id = picked?.metadata?.selectId;
      if (id) onSelect(id);
    }
  });
  const resize = new ResizeObserver(() => {
    if (canvas.clientWidth && canvas.clientHeight) engine.resize();
  });
  resize.observe(canvas);
  const lost = (ev: Event) => {
    ev.preventDefault();
    onError();
  };
  canvas.addEventListener("webglcontextlost", lost);
  const started = performance.now();
  void Promise.allSettled(tasks).then(async () => {
    if (disposed) return;
    await Promise.race([
      scene.whenReadyAsync(),
      new Promise<void>((resolve) => setTimeout(resolve, 10000)),
    ]);
    if (disposed) return;
    if (!scene.isReady()) {
      console.error("World scene did not become ready", {
        failures,
        pending: scene.getWaitingItemsCount(),
      });
      onError();
      return;
    }
    scene.render();
    const loading = canvas.parentElement?.querySelector("#world-loading");
    loading?.classList.add("ready");
    canvas.dataset.ready = "true";
    canvas.dataset.diagnostics = JSON.stringify({
      loadMs: Math.round(performance.now() - started),
      meshes: scene.meshes.length,
      materials: scene.materials.length,
      triangles: scene.getActiveIndices() / 3,
      failures,
      quality: mobile ? "core" : "standard",
      source: agent?.designSource,
      revision: agent?.revision,
    });
    if (failures.length) {
      const note = document.createElement("span");
      note.className = "model-warning";
      note.textContent = `${failures.length} assets unavailable · controls remain ready`;
      canvas.parentElement?.append(note);
    }
  });
  return {
    moveItem(slot: string, offset: number[]) {
      const item = officeItems.get(slot),
        base = officeAnchors.get(slot);
      if (!item || !base) return;
      item.position.set(
        base[0] + offset[0],
        base[1] + offset[1],
        base[2] + offset[2],
      );
      if (slot === "feature_prop" && featurePedestal)
        featurePedestal.position.set(
          -3.5 + offset[0],
          0.4 + offset[1],
          -1.4 + offset[2],
        );
      if (slot === "task_chair" && seatedPose && officeAvatar)
        officeAvatar.position.set(1.3 + offset[0], offset[1], 0.18 + offset[2]);
    },
    moveCityItem(key: string, position: number[]) {
      const item = cityItems.get(key);
      if (!item) return;
      if (key.startsWith("building:"))
        item.root.position.set(
          position[0] - item.origin[0],
          position[1],
          position[2] - item.origin[2],
        );
      else item.root.position.set(position[0], position[1], position[2]);
    },
    zoom(direction: number) {
      camera.radius = Math.min(
        camera.upperRadiusLimit!,
        Math.max(
          camera.lowerRadiusLimit!,
          camera.radius * (direction < 0 ? 0.8 : 1.25),
        ),
      );
    },
    reset() {
      camera.alpha = agent ? Math.PI / 3 : -Math.PI / 3;
      camera.beta = Math.PI / 3.3;
      camera.radius = initialRadius;
      camera.target = new Vector3(
        0,
        agent ? 0.6 : 0,
        agent || opts.headquarters ? 0 : cityCenterZ,
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!agent && !opts.headquarters)
        cityCamera = [camera.alpha, camera.beta, camera.radius];
      resize.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}

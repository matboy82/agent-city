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
  },
) {
  const { data, agent, dusk, onSelect, onError } = opts;
  let disposed = false;
  const mobile = innerWidth < 700;
  const initialRadius = agent ? 17 : mobile && !opts.headquarters ? 42 : 35;
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: !mobile,
    powerPreference: "low-power",
  });
  engine.setHardwareScalingLevel(1);
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  scene.clearColor = Color4.FromHexString(dusk ? "#0d1b32ff" : "#edf3f9ff");
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
        if (path.includes("/space/hangar")) {
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
    name: string, x: number, z: number, width: number, depth: number,
    height: number, selectId: string, stage = 3,
  ) {
    const pick = (part: string, px: number, py: number, pz: number, w: number, h: number, d: number, mat: StandardMaterial) => {
      const mesh = box(name + " " + part, px, py, pz, w, h, d, mat);
      mesh.metadata = { selectId };
      return mesh;
    };
    const front = z + depth / 2;
    const rear = z - depth / 2;
    pick("raised plinth", x, .36, z, width + .32, .26, depth + .26, white);
    pick("shadow base", x, .15, z, width + .4, .16, depth + .35, navy);
    pick("ground glass", x, 1.18, z, width - .28, 1.58, depth - .28, reveal);
    if (stage >= 1) {
      pick("front glazing", x, 1.42, front - .055, width - .42, 1.94, .08, facadeGlass);
      pick("side glazing", x + width / 2 - .055, 1.42, z, .08, 1.94, depth - .3, facadeGlass);
    }
    for (const side of [-1, 1]) {
      for (const edge of [front, rear])
        pick("structural pier", x + side * (width / 2 - .12), height / 2 + .4, edge, .25, height, .28, white);
      pick("front mullion", x + side * width / 5, 1.42, front + .025, .10, 1.94, .13, white);
    }
    pick("floor slab", x, 2.43, z, width + .18, .24, depth + .16, white);
    pick("blue slab reveal", x, 2.28, front + .02, width + .08, .055, .08, blue);
    if (stage >= 2) {
      pick("upper volume", x + .3, (height + 2.5) / 2, z - .22, width - .7, height - 2.35, depth - .65, reveal);
      pick("upper glazing", x + .3, (height + 2.5) / 2, front - .3, width - 1.0, height - 2.54, .08, facadeGlass);
      for (const side of [-1, 1])
        pick("upper pier", x + .3 + side * (width - .7) / 2, (height + 2.5) / 2, front - .3, .17, height - 2.3, .20, white);
      pick("upper transom", x + .3, (height + 2.45) / 2, front - .23, width - .75, .12, .18, white);
    }
    if (stage >= 3) {
      pick("cantilever roof", x + .38, height + .33, z - .15, width + .55, .28, depth + .65, white);
      pick("roof blue channel", x + .38, height + .16, front + .17, width + .42, .035, .09, blue);
      pick("white portal", x - width * .28, 1.4, front + .12, .18, 1.95, .34, white);
      pick("portal lintel", x - width * .28, 2.4, front + .12, width * .32, .18, .34, white);
    }
    pick("entry dark", x + width * .18, .98, front + .03, .96, 1.25, .08, navy);
    for (let step = 0; step < 3; step++)
      pick("entry stair", x + width * .18, .25 - step * .07, front + .38 + step * .27, 1.55 + step * .24, .16, .4, white);
    return height;
  }
  const tasks: Promise<unknown>[] = [];
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
    for (const [zone, title, x, z] of zones) {
      box("zone channel", x, 0.02, z, 4, 0.025, 3.8, stone);
      box("zone accent", x, 0.04, z + 1.8, 4, 0.03, 0.07, blue);
      const table = box("zone table", x, 0.8, z, 2.7, 0.18, 1.6, navy);
      table.metadata = { selectId: "zone:" + zone };
      box("table base", x, 0.4, z, 1, 0.7, 0.7, white);
      tasks.push(
        model(
          "/assets/furniture/chairDesk.glb",
          [x - 1.2, 0, z + 1.2],
          1,
          "height",
          Math.PI,
          "zone:" + zone,
        ),
      );
      tasks.push(
        model(
          "/assets/furniture/computerScreen.glb",
          [x, 0.91, z],
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
    box("campus plinth", 0, -0.65, 0, 27, 1, 24, white);
    box("campus trim", 0, -0.12, 0, 27.15, 0.12, 24.15, stone);
    box("landscape", 0, -0.03, 0, 26.5, 0.08, 23.5, grass);
    box("central boulevard", 0, 0.025, 0, 4.3, 0.1, 23.5, pathMat);
    box("cross boulevard", 0, 0.027, 0, 26.5, 0.1, 3.2, pathMat);
    for (const x of [-2.3, 2.3])
      box("blue channel", x, 0.09, 0, 0.05, 0.02, 23, blue);
    for (const z of [-1.8, 1.8])
      box("blue channel", 0, 0.09, z, 26, 0.02, 0.05, blue);
    for (let z = -10; z <= 10; z += 2)
      box("boulevard seam", 0, 0.09, z, 3.8, 0.02, 0.035, white);
    const ring = MeshBuilder.CreateTorus(
      "arrival plaza",
      { diameter: 4.1, thickness: 0.13, tessellation: 64 },
      scene,
    );
    ring.position.y = 0.15;
    ring.material = blue;
    box("HQ podium", 0, 0.22, 0, 3.2, 0.3, 2.8, white);
    architecture("BIS HQ", 0, 0, 3.1, 2.6, 3.4, "hq");
    plaque("BIS HQ", "TEAM CONTROL", 0, 4.3, 0, 3.0);
    for (const b of data.buildings) {
      const a = data.agents.find((a: Row) => a.id === b.agentId);
      const x = b.x,
        z = b.z;
      box("foundation", x, 0.2, z, 6, 0.35, 5, white);
      box("step", x, 0.1, z + 2.9, 4, 0.15, 1, pathMat);
      box("front channel", x, 0.39, z + 2.4, 5.5, 0.06, 0.07, blue);
      const stage = (b.milestones || []).filter(
        (m: Row) => m.status === "closed",
      ).length;
      const height = b.style === "tower" ? 4.5 : b.style === "command" ? 4.05 : 3.6;
      architecture(
        b.name, x, z, 5.25, 3.9, height,
        b.agentId || "project:" + b.id,
        b.kind === "project_site" ? stage : 3,
      );
      const state =
        a?.connection === "Connected"
          ? a.operationalState
          : a?.connection || "Project site";
      plaque(b.name, state, x, height + 1.05, z, 5.3);
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
    glass.alpha = .72;
    box("architectural sill", -3, 1.12, -4.13, 3.75, .13, .19, white);
    box("window", -3, 2.13, -4.16, 3.55, 1.86, .045, glass);
    box("architectural lintel", -3, 3.14, -4.13, 3.8, .16, .22, white);
    for (const x of [-4.78, -3.58, -2.38, -1.2])
      box("mullion", x, 2.13, -4.08, .12, 2.05, .17, white);
    box("window transom", -3, 2.13, -4.06, 3.6, .095, .14, white);
    box("room canopy", 0, 3.51, -4.03, 10.9, .17, .78, white);
    box("room canopy blue reveal", 0, 3.37, -3.63, 10.7, .035, .075, blue);
    for (const x of [-5.22, 5.22])
      box("room structural pier", x, 1.78, -4.05, .28, 3.55, .32, white);
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
      desk_screen: [1.3, 0.70, -1.88],
      desk_accessory: [1.65, 0.70, -1.26],
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
      if (p.slot === "feature_prop")
        box("feature pedestal", -3.5, 0.4, -1.4, 1.3, 0.8, 1.2, white);
      tasks.push(
        model(
          path,
          anchors[p.slot],
          sizes[p.slot],
          p.slot === "floor_rug" ? "max" : "height",
          ((p.rotation || 0) * Math.PI) / 180 +
            (p.slot === "task_chair" ? 0 : p.slot === "lounge_seating" ? Math.PI / 2 : Math.PI),
        ),
      );
    }
    // Supplied prototype bodies retain their existing identity; no portrait-to-body inference.
    const live = agent.connection === "Connected";
    const mode = live ? agent.activity : "idle";
    const seated = ["typing", "reading", "on_call"].includes(mode);
    const station = seated
      ? [1.3, 0, 0.18]
      : mode === "presenting"
        ? [3.2, 0, -2.7]
        : [1.3, 0, 1.3];
    tasks.push(
      model(
        `/assets/characters/${["jeff", "relay", "jefferson", "jev"].includes(agent.id) ? agent.id : "neutral"}.glb`,
        station,
        1.75,
        "height",
        Math.PI,
        "agent:" + agent.id,
      ).then((avatar) => {
        if (!avatar) return;
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
              if (left) left.rotation.x = -1 + Math.sin(t * 8) * 0.035;
              if (right) right.rotation.x = -1 + Math.sin(t * 8 + 1) * 0.035;
            }
            if (mode === "walking") {
              avatar.position.x = 1.3 + Math.sin(t * 0.3) * 1.3;
              avatar.position.z = 2.2;
              const l = node("left-leg"),
                r = node("right-leg");
              if (l) l.rotation.x = Math.sin(t * 3) * 0.28;
              if (r) r.rotation.x = -Math.sin(t * 3) * 0.28;
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
    plaque(agent.name, agent.connection, station[0], 2.4, station[2], 2.4);
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
    } catch {
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
      camera.target = new Vector3(0, agent ? 0.6 : 0, 0);
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

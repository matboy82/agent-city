export const OFFICE_THEMES = [
  "neutral",
  "command_center",
  "trading_floor",
  "comms_loft",
  "research_lab",
  "cozy_den",
] as const;
export const OFFICE_PALETTES = [
  "bis_blue",
  "graphite",
  "signal_green",
  "warm",
] as const;
export const OFFICE_SLOTS = [
  "primary_desk",
  "task_chair",
  "desk_screen",
  "desk_accessory",
  "plant_corner",
  "library",
  "lounge_seating",
  "coffee_table",
  "floor_rug",
  "floor_lamp",
  "feature_prop",
  "wall_display",
] as const;

export type OfficeThemeId = (typeof OFFICE_THEMES)[number];
export type OfficePaletteId = (typeof OFFICE_PALETTES)[number];
export type OfficeSlotId = (typeof OFFICE_SLOTS)[number];

export type OfficePlacement = {
  slot: OfficeSlotId;
  asset_id: OfficeAssetId;
  rotation?: -15 | 0 | 15;
};

export type OfficeDesign = {
  version: 1;
  theme: OfficeThemeId;
  palette: OfficePaletteId;
  placements: OfficePlacement[];
};

export type OfficeAsset = {
  id: string;
  label: string;
  category:
    | "desk"
    | "chair"
    | "screen"
    | "accessory"
    | "plant"
    | "storage"
    | "lighting"
    | "rug"
    | "lounge"
    | "feature";
  allowed_slots: readonly OfficeSlotId[];
  bounds_m: readonly [number, number, number];
  license: "CC0-1.0";
  author: "Kenney" | "Quaternius" | "CreativeTrio";
  source: string;
  mobile_tier: "core" | "standard";
};

const KENNEY_FURNITURE = "https://kenney.nl/assets/furniture-kit";
const KENNEY_SPACE = "https://kenney.nl/assets/space-kit";
const POLY_PIZZA_OFFICE = "https://poly.pizza/bundle/Office-Pack-UGIy7YcQP9";

export const OFFICE_ASSETS = {
  "kenney.desk": {
    id: "kenney.desk",
    label: "Studio desk",
    category: "desk",
    allowed_slots: ["primary_desk"],
    bounds_m: [2.2, 1, 0.9],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "core",
  },
  "kenney.corner_desk": {
    id: "kenney.corner_desk",
    label: "Corner command desk",
    category: "desk",
    allowed_slots: ["primary_desk"],
    bounds_m: [2.6, 1, 1.5],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "core",
  },
  "kenney.desk_chair": {
    id: "kenney.desk_chair",
    label: "Task chair",
    category: "chair",
    allowed_slots: ["task_chair"],
    bounds_m: [0.9, 1.2, 0.9],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "core",
  },
  "kenney.monitor": {
    id: "kenney.monitor",
    label: "Desktop monitor",
    category: "screen",
    allowed_slots: ["desk_screen", "wall_display"],
    bounds_m: [0.9, 0.7, 0.25],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "core",
  },
  "kenney.keyboard": {
    id: "kenney.keyboard",
    label: "Keyboard",
    category: "accessory",
    allowed_slots: ["desk_accessory"],
    bounds_m: [0.7, 0.08, 0.25],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.laptop": {
    id: "kenney.laptop",
    label: "Laptop",
    category: "screen",
    allowed_slots: ["desk_screen", "desk_accessory"],
    bounds_m: [0.7, 0.5, 0.45],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "core",
  },
  "kenney.potted_plant": {
    id: "kenney.potted_plant",
    label: "Potted plant",
    category: "plant",
    allowed_slots: ["plant_corner"],
    bounds_m: [0.8, 1.4, 0.8],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.small_plant": {
    id: "kenney.small_plant",
    label: "Small plant",
    category: "plant",
    allowed_slots: ["plant_corner", "desk_accessory"],
    bounds_m: [0.55, 0.7, 0.55],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.bookcase": {
    id: "kenney.bookcase",
    label: "Open bookcase",
    category: "storage",
    allowed_slots: ["library"],
    bounds_m: [1.4, 2.5, 0.5],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.books": {
    id: "kenney.books",
    label: "Books",
    category: "accessory",
    allowed_slots: ["library", "desk_accessory"],
    bounds_m: [0.7, 0.45, 0.3],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.round_lamp": {
    id: "kenney.round_lamp",
    label: "Round floor lamp",
    category: "lighting",
    allowed_slots: ["floor_lamp"],
    bounds_m: [0.7, 2.1, 0.7],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "core",
  },
  "kenney.square_lamp": {
    id: "kenney.square_lamp",
    label: "Square floor lamp",
    category: "lighting",
    allowed_slots: ["floor_lamp"],
    bounds_m: [0.7, 2.1, 0.7],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "core",
  },
  "kenney.rug": {
    id: "kenney.rug",
    label: "Area rug",
    category: "rug",
    allowed_slots: ["floor_rug"],
    bounds_m: [3.4, 0.08, 2.4],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.radio": {
    id: "kenney.radio",
    label: "Desk radio",
    category: "feature",
    allowed_slots: ["feature_prop", "desk_accessory"],
    bounds_m: [0.8, 0.55, 0.35],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.speaker": {
    id: "kenney.speaker",
    label: "Studio speaker",
    category: "feature",
    allowed_slots: ["feature_prop", "wall_display"],
    bounds_m: [0.65, 1.15, 0.55],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.television": {
    id: "kenney.television",
    label: "Wall display",
    category: "screen",
    allowed_slots: ["wall_display"],
    bounds_m: [1.6, 1, 0.2],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.coffee_table": {
    id: "kenney.coffee_table",
    label: "Coffee table",
    category: "lounge",
    allowed_slots: ["coffee_table"],
    bounds_m: [1.5, 0.55, 0.9],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.sofa": {
    id: "kenney.sofa",
    label: "Design sofa",
    category: "lounge",
    allowed_slots: ["lounge_seating"],
    bounds_m: [2.4, 1.05, 1],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_FURNITURE,
    mobile_tier: "standard",
  },
  "kenney.satellite_dish": {
    id: "kenney.satellite_dish",
    label: "Satellite dish",
    category: "feature",
    allowed_slots: ["feature_prop"],
    bounds_m: [1.3, 1.8, 1.3],
    license: "CC0-1.0",
    author: "Kenney",
    source: KENNEY_SPACE,
    mobile_tier: "standard",
  },
  "polypizza.desk": {
    id: "polypizza.desk",
    label: "Studio work desk",
    category: "desk",
    allowed_slots: ["primary_desk"],
    bounds_m: [2.2, 1, 1],
    license: "CC0-1.0",
    author: "Quaternius",
    source: POLY_PIZZA_OFFICE,
    mobile_tier: "core",
  },
  "polypizza.chair": {
    id: "polypizza.chair",
    label: "Office chair",
    category: "chair",
    allowed_slots: ["task_chair"],
    bounds_m: [0.9, 1.2, 0.9],
    license: "CC0-1.0",
    author: "Quaternius",
    source: POLY_PIZZA_OFFICE,
    mobile_tier: "core",
  },
  "polypizza.plant": {
    id: "polypizza.plant",
    label: "Houseplant",
    category: "plant",
    allowed_slots: ["plant_corner"],
    bounds_m: [1, 1.4, 1],
    license: "CC0-1.0",
    author: "Quaternius",
    source: POLY_PIZZA_OFFICE,
    mobile_tier: "standard",
  },
  "polypizza.rug": {
    id: "polypizza.rug",
    label: "Round rug",
    category: "rug",
    allowed_slots: ["floor_rug"],
    bounds_m: [2.5, 0.05, 2.5],
    license: "CC0-1.0",
    author: "Kenney",
    source: POLY_PIZZA_OFFICE,
    mobile_tier: "standard",
  },
  "polypizza.sofa": {
    id: "polypizza.sofa",
    label: "Small sofa",
    category: "lounge",
    allowed_slots: ["lounge_seating"],
    bounds_m: [2, 1, 1],
    license: "CC0-1.0",
    author: "Quaternius",
    source: POLY_PIZZA_OFFICE,
    mobile_tier: "standard",
  },
  "polypizza.printer": {
    id: "polypizza.printer", label: "Office printer", category: "accessory",
    allowed_slots: ["desk_accessory", "feature_prop"], bounds_m: [0.6, 0.45, 0.5],
    license: "CC0-1.0", author: "CreativeTrio", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
  "polypizza.desk_lamp": {
    id: "polypizza.desk_lamp", label: "Desk lamp", category: "accessory",
    allowed_slots: ["desk_accessory"], bounds_m: [0.35, 0.5, 0.35],
    license: "CC0-1.0", author: "Quaternius", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
  "polypizza.phone": {
    id: "polypizza.phone", label: "Desk phone", category: "accessory",
    allowed_slots: ["desk_accessory"], bounds_m: [0.3, 0.2, 0.25],
    license: "CC0-1.0", author: "Quaternius", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
  "polypizza.screen": {
    id: "polypizza.screen", label: "Studio computer screen", category: "screen",
    allowed_slots: ["desk_screen"], bounds_m: [0.9, 0.7, 0.25],
    license: "CC0-1.0", author: "Kenney", source: POLY_PIZZA_OFFICE, mobile_tier: "core",
  },
  "polypizza.shelf": {
    id: "polypizza.shelf", label: "Compact open shelf", category: "storage",
    allowed_slots: ["library"], bounds_m: [1.1, 1.5, 0.5],
    license: "CC0-1.0", author: "Quaternius", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
  "polypizza.cabinet": {
    id: "polypizza.cabinet", label: "Studio cabinet", category: "storage",
    allowed_slots: ["library"], bounds_m: [1.2, 1.7, 0.6],
    license: "CC0-1.0", author: "CreativeTrio", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
  "polypizza.couch_medium": {
    id: "polypizza.couch_medium", label: "Medium lounge couch", category: "lounge",
    allowed_slots: ["lounge_seating"], bounds_m: [2.4, 1.1, 1.0],
    license: "CC0-1.0", author: "Quaternius", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
  "polypizza.plant_tall": {
    id: "polypizza.plant_tall", label: "Tall houseplant", category: "plant",
    allowed_slots: ["plant_corner"], bounds_m: [1.0, 1.7, 1.0],
    license: "CC0-1.0", author: "Quaternius", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
  "polypizza.floor_light": {
    id: "polypizza.floor_light", label: "Sculptural floor light", category: "lighting",
    allowed_slots: ["floor_lamp"], bounds_m: [0.6, 1.8, 0.6],
    license: "CC0-1.0", author: "Quaternius", source: POLY_PIZZA_OFFICE, mobile_tier: "standard",
  },
} as const satisfies Record<string, OfficeAsset>;

export type OfficeAssetId = keyof typeof OFFICE_ASSETS;

const p = (slot: OfficeSlotId, asset_id: OfficeAssetId): OfficePlacement => ({
  slot,
  asset_id,
});

export const OFFICE_THEME_DESIGNS: Record<OfficeThemeId, OfficeDesign> = {
  neutral: {
    version: 1,
    theme: "neutral",
    palette: "bis_blue",
    placements: [
      p("primary_desk", "kenney.desk"),
      p("task_chair", "kenney.desk_chair"),
      p("desk_screen", "kenney.laptop"),
      p("plant_corner", "kenney.potted_plant"),
      p("floor_lamp", "kenney.round_lamp"),
      p("floor_rug", "kenney.rug"),
    ],
  },
  command_center: {
    version: 1,
    theme: "command_center",
    palette: "graphite",
    placements: [
      p("primary_desk", "kenney.corner_desk"),
      p("task_chair", "kenney.desk_chair"),
      p("desk_screen", "kenney.monitor"),
      p("desk_accessory", "kenney.keyboard"),
      p("wall_display", "kenney.television"),
      p("feature_prop", "kenney.speaker"),
      p("floor_lamp", "kenney.square_lamp"),
      p("plant_corner", "polypizza.plant"),
      p("lounge_seating", "polypizza.sofa"),
    ],
  },
  trading_floor: {
    version: 1,
    theme: "trading_floor",
    palette: "signal_green",
    placements: [
      p("primary_desk", "kenney.corner_desk"),
      p("task_chair", "kenney.desk_chair"),
      p("desk_screen", "kenney.monitor"),
      p("desk_accessory", "kenney.laptop"),
      p("wall_display", "kenney.television"),
      p("feature_prop", "kenney.radio"),
      p("plant_corner", "polypizza.plant"),
    ],
  },
  comms_loft: {
    version: 1,
    theme: "comms_loft",
    palette: "bis_blue",
    placements: [
      p("primary_desk", "kenney.desk"),
      p("task_chair", "kenney.desk_chair"),
      p("desk_screen", "kenney.monitor"),
      p("feature_prop", "kenney.satellite_dish"),
      p("wall_display", "kenney.speaker"),
      p("floor_lamp", "kenney.round_lamp"),
      p("lounge_seating", "polypizza.sofa"),
      p("plant_corner", "polypizza.plant"),
    ],
  },
  research_lab: {
    version: 1,
    theme: "research_lab",
    palette: "graphite",
    placements: [
      p("primary_desk", "kenney.corner_desk"),
      p("task_chair", "kenney.desk_chair"),
      p("desk_screen", "kenney.laptop"),
      p("library", "kenney.bookcase"),
      p("desk_accessory", "kenney.books"),
      p("plant_corner", "polypizza.plant"),
      p("wall_display", "kenney.television"),
    ],
  },
  cozy_den: {
    version: 1,
    theme: "cozy_den",
    palette: "warm",
    placements: [
      p("primary_desk", "kenney.desk"),
      p("task_chair", "kenney.desk_chair"),
      p("desk_screen", "kenney.laptop"),
      p("library", "kenney.bookcase"),
      p("lounge_seating", "kenney.sofa"),
      p("coffee_table", "kenney.coffee_table"),
      p("floor_rug", "kenney.rug"),
      p("floor_lamp", "kenney.round_lamp"),
    ],
  },
};

export const LEGACY_DECOR_PLACEMENTS: Record<string, OfficePlacement> = {
  poster: p("wall_display", "kenney.television"),
  trophy_shelf: p("library", "kenney.bookcase"),
  extra_monitors: p("desk_screen", "kenney.monitor"),
  plants: p("plant_corner", "kenney.potted_plant"),
  neon_sign: p("wall_display", "kenney.television"),
  blue_rug: p("floor_rug", "kenney.rug"),
  warm_rug: p("floor_rug", "kenney.rug"),
  mug_collection: p("desk_accessory", "kenney.radio"),
  satellite_dish: p("feature_prop", "kenney.satellite_dish"),
  signal_art: p("wall_display", "kenney.speaker"),
  activity_wall: p("wall_display", "kenney.television"),
  blue_accent_lights: p("floor_lamp", "kenney.square_lamp"),
  books: p("library", "kenney.bookcase"),
  market_ticker: p("wall_display", "kenney.television"),
  whiteboard: p("wall_display", "kenney.television"),
};

export function officeDesignFromLegacy(
  theme: OfficeThemeId,
  decorItems: string[] = [],
) {
  const design = structuredClone(OFFICE_THEME_DESIGNS[theme]);
  for (const item of decorItems) {
    const placement = LEGACY_DECOR_PLACEMENTS[item];
    if (!placement) continue;
    design.placements = design.placements.filter(
      (current) => current.slot !== placement.slot,
    );
    design.placements.push({ ...placement });
  }
  return design;
}

export function validateOfficeDesign(design: OfficeDesign) {
  const warnings: string[] = [];
  if (design.placements.length > 12)
    return {
      ok: false as const,
      error: "Office designs may contain at most 12 placements.",
    };
  const slots = new Set<OfficeSlotId>();
  for (const placement of design.placements) {
    const asset = OFFICE_ASSETS[placement.asset_id];
    if (!asset)
      return {
        ok: false as const,
        error: `Unknown office asset: ${placement.asset_id}`,
      };
    if (
      !(asset.allowed_slots as readonly OfficeSlotId[]).includes(placement.slot)
    )
      return {
        ok: false as const,
        error: `${asset.label} cannot be placed in ${placement.slot}.`,
      };
    if (slots.has(placement.slot))
      return {
        ok: false as const,
        error: `Only one asset may occupy ${placement.slot}.`,
      };
    slots.add(placement.slot);
  }
  for (const required of [
    "primary_desk",
    "task_chair",
    "desk_screen",
    "floor_lamp",
  ] as OfficeSlotId[])
    if (!slots.has(required))
      warnings.push(`Theme fallback supplies missing ${required}.`);
  return { ok: true as const, warnings };
}

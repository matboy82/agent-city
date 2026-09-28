import { Fault } from "./store.mjs";
import { z } from "zod";
import {
  OFFICE_THEMES,
  OFFICE_PALETTES,
  OFFICE_SLOTS,
  OFFICE_ASSETS,
  OFFICE_THEME_DESIGNS,
  validateOfficeDesign,
  officeDesignFromLegacy,
} from "../src/catalog.ts";
export { OFFICE_ASSETS, OFFICE_THEME_DESIGNS, officeDesignFromLegacy };
export const text = z.string().trim().min(1).max(2000),
  key = z.string().min(1).max(100),
  revision = z.number().int().nonnegative();
export const designSchema = z
  .object({
    version: z.literal(1),
    theme: z.enum(OFFICE_THEMES),
    palette: z.enum(OFFICE_PALETTES),
    placements: z
      .array(
        z
          .object({
            slot: z.enum(OFFICE_SLOTS),
            asset_id: z.enum(Object.keys(OFFICE_ASSETS)),
            rotation: z
              .union([z.literal(-15), z.literal(0), z.literal(15)])
              .optional(),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
export function design(input) {
  const d = designSchema.parse(input);
  const r = validateOfficeDesign(d);
  if (!r.ok) throw new Fault(r.error);
  return d;
}
export const safeUrl = z
  .string()
  .max(2000)
  .url()
  .refine(
    (v) =>
      /^https?:\/\//.test(v) && !new URL(v).username && !new URL(v).password,
    "Use an HTTP(S) reference without credentials",
  );
export const raci = z
  .object({
    responsible: z.array(key).min(1).max(16),
    accountable: z.literal("matt"),
    consulted: z.array(key).max(16),
    informed: z.array(key).max(16),
  })
  .strict();
export const workSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    brief: text,
    priority: z.enum(["low", "normal", "high", "urgent"]),
    goalId: key,
    parentId: key.nullable().optional(),
    raci,
    capability: z.string().max(100).default("work.execute"),
    scope: z.literal("bis").default("bis"),
    action: z
      .enum(["read", "test", "draft", "send", "publish", "merge", "spend"])
      .default("read"),
  })
  .strict();
export const heartbeatSchema = z
  .object({
    protocol_version: z.union([z.literal(1), z.literal(2)]).default(1),
    agent_id: key,
    runtime_id: key.optional(),
    instruction_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    sequence: revision.optional(),
    status: z.enum(["active", "idle", "waiting_on_matt"]),
    last_seen: z.string().datetime(),
    current_task: z.string().max(240).nullable().optional(),
    current_run_id: key.nullable().optional(),
    display_name: z.string().max(80).optional(),
    current_activity: z
      .enum([
        "typing",
        "presenting",
        "walking",
        "reading",
        "on_call",
        "celebrating",
        "idle",
      ])
      .default("idle"),
    capabilities: z.array(key).max(40).default([]),
    avatar_image: z
      .object({
        mime_type: z.enum(["image/png", "image/jpeg"]),
        data_base64: z.string().min(16).max(2800000),
      })
      .strict()
      .optional(),
    activity: z
      .array(
        z
          .object({
            time: z.string().datetime().optional(),
            summary: z.string().min(1).max(240),
            detail: z.string().max(800).optional(),
            source_key: z.string().max(180).optional(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    queue: z
      .array(
        z
          .object({
            text: z.string().min(1).max(240),
            detail: z.string().max(500).optional(),
            time: z.string().max(80).optional(),
            source_key: z.string().max(180).optional(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    office_design: designSchema.optional(),
    office_theme: z.enum(OFFICE_THEMES).optional(),
    decor_items: z.array(z.string().max(80)).max(20).optional(),
    events: z
      .array(
        z.object({ id: key, type: key, summary: z.string().max(500) }).strict(),
      )
      .max(20)
      .default([]),
    command_acks: z
      .array(
        z
          .object({
            command_id: key,
            status: z.enum(["accepted", "running", "completed", "failed"]),
            result: z.string().max(2000).optional(),
            run_id: key.optional(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
  })
  .strict();

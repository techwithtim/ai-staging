import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Kept to types that map one to one onto Postgres (text ids, ISO timestamps),
// so the move to a hosted database later is a driver change, not a rewrite.

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const houses = sqliteTable(
  "houses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    address: text("address").notNull(),
    city: text("city"),
    price: integer("price"),
    beds: real("beds"),
    baths: real("baths"),
    sqft: integer("sqft"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("houses_user_idx").on(t.userId)],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => houses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // Cloudinary
    publicId: text("public_id").notNull().unique(),
    assetId: text("asset_id").notNull(),
    version: integer("version").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    format: text("format").notNull(),
    originalFilename: text("original_filename"),
    // Sorting: null kind means the agent hasn't decided yet
    kind: text("kind", { enum: ["interior", "exterior"] }),
    kindSource: text("kind_source", { enum: ["manual", "auto"] }),
    room: text("room"),
    // The version the gallery shows (and staging will use). Null means the original.
    activeEditId: text("active_edit_id"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("photos_house_idx").on(t.houseId)],
);

/** One AI edit of a photo, saved as its own Cloudinary asset. The original is never changed. */
export const photoEdits = sqliteTable(
  "photo_edits",
  {
    id: text("id").primaryKey(),
    photoId: text("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type", { enum: ["cleanup", "stage", "dusk"] }).notNull(),
    // The version this edit was made from: null is the original photo.
    sourceEditId: text("source_edit_id"),
    params: text("params", { mode: "json" }).$type<EditParams>().notNull(),
    transformation: text("transformation").notNull(),
    status: text("status", { enum: ["running", "done", "failed"] }).notNull(),
    error: text("error"),
    // Filled in when done
    publicId: text("public_id"),
    assetId: text("asset_id"),
    version: integer("version"),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    format: text("format"),
    // Cost tracking. Cleanup: Cloudinary counts each generative remove as 50 transformations.
    costTransformations: integer("cost_transformations").notNull().default(0),
    // Staging: the model that ran and Image Generation credits (about 1 US cent each).
    model: text("model"),
    creditsUsed: integer("credits_used"),
    creditsRemaining: integer("credits_remaining"),
    creditsLimit: integer("credits_limit"),
    latencyMs: integer("latency_ms"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("photo_edits_photo_idx").on(t.photoId)],
);

/** items: what the agent typed. prompts: what was sent to Cloudinary. attempt: retries of the same request. */
/** A vertical listing video made from a house's photos, stored as a Cloudinary video asset. */
export const listingVideos = sqliteTable(
  "listing_videos",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => houses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    settings: text("settings", { mode: "json" }).$type<VideoSettings>().notNull(),
    transformation: text("transformation").notNull(),
    status: text("status", { enum: ["running", "done", "failed"] }).notNull(),
    error: text("error"),
    publicId: text("public_id"),
    assetId: text("asset_id"),
    version: integer("version"),
    seconds: real("seconds"),
    bytes: integer("bytes"),
    latencyMs: integer("latency_ms"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("listing_videos_house_idx").on(t.houseId)],
);

export type VideoSettings = {
  photoIds: string[]; // in play order
  framing: "fill" | "whole";
  secondsPerShot: number;
  showTitle: boolean;
  showCaptions: boolean;
  closing: string;
};
export type ListingVideo = typeof listingVideos.$inferSelect;

export type CleanupParams ={ items: string[]; prompts?: string[]; removeShadow: boolean; attempt?: number };

export type StageQuality = "draft" | "final";
/** room and style are slugs from lib/staging.ts; prompt is exactly what was sent. */
export type StageParams = {
  room: string;
  style: string;
  notes: string;
  quality: StageQuality;
  prompt: string;
  seed?: number;
};
/** mood is a slug from lib/dusk.ts: how far from day toward night. */
export type DuskParams = {
  mood: string;
  windowsLit: boolean;
  outdoorLights: boolean;
  quality: StageQuality;
  prompt: string;
  seed?: number;
};
export type EditParams = CleanupParams | StageParams | DuskParams;

export type House = typeof houses.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type PhotoEdit = typeof photoEdits.$inferSelect;
export type PhotoKind = NonNullable<Photo["kind"]>;

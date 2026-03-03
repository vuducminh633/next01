import { timestamp,pgTable, serial, jsonb,text,boolean, doublePrecision,integer, geometry } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(), 
  password: text("password").notNull(),    
  createdAt: timestamp("created_at").defaultNow(),
});

export const maps = pgTable("maps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const vias = pgTable("vias", {
  id: serial("id").primaryKey(),
  mapId: integer("map_id").references(() => maps.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),         // e.g., "Vỉa 8"
  rockType: text("rock_type"),          
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blocks = pgTable("blocks", {
  id: serial("id").primaryKey(),
  viaId: integer("via_id").references(() => vias.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),         // e.g., "Khối 1"
  createdAt: timestamp("created_at").defaultNow(),
});

export const cadLines = pgTable("cad_lines", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").references(() => blocks.id, { onDelete: "cascade" }).notNull(),
  
  handle: text("handle").notNull().unique(), 
  partType: text("part_type"),               // "Vách" (Roof) or "Trụ" (Floor)
  layer: text("layer"),                      // "F.C"
  properties: jsonb("properties"),           
  
  // UI State
  isNew: boolean("is_new").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blockMeshes = pgTable("block_meshes", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").references(() => blocks.id, { onDelete: "cascade" }).notNull().unique(),
  
  vertices: jsonb("vertices").notNull(), 
  indices: jsonb("indices").notNull(),   
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const drillHoles = pgTable("drill_holes", {
  id: serial("id").primaryKey(),
  mapId: integer("map_id").references(() => maps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),             // e.g., "B2031"
  coordinates: jsonb("coordinates"),        
  createdAt: timestamp("created_at").defaultNow(),
});


export const drillSamples = pgTable("drill_samples", {
  id: serial("id").primaryKey(),
  holeId: integer("hole_id").references(() => drillHoles.id, { onDelete: "cascade" }).notNull(),
  viaId: integer("via_id").references(() => vias.id, { onDelete: "set null" }), 
  
  sampleCode: text("sample_code"),      // "STT" (e.g., V9)
  depthFrom: doublePrecision("depth_from"), // "Từ (m)"
  depthTo: doublePrecision("depth_to"),     // "Đến (m)"
  rockType: text("rock_type"),          // "Tên nham thạch"
  
  // Mechanical Properties
  compressiveStrength: doublePrecision("compressive_strength"), 
  tensileStrength: doublePrecision("tensile_strength"),         
  frictionAngleDeg: integer("friction_angle_deg"), 
  frictionAngleMin: integer("friction_angle_min"), 
  cohesion: doublePrecision("cohesion"),   
  
  // Physical Properties
  density: doublePrecision("density"),           
  specificGravity: doublePrecision("specific_gravity"), 
  coefficient: doublePrecision("coefficient"), 
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const mapsRelations = relations(maps, ({ many }) => ({
  vias: many(vias),
  drillHoles: many(drillHoles),
}));

export const viasRelations = relations(vias, ({ one, many }) => ({
  map: one(maps, { fields: [vias.mapId], references: [maps.id] }),
  blocks: many(blocks),
  drillSamples: many(drillSamples),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  via: one(vias, { fields: [blocks.viaId], references: [vias.id] }),
  lines: many(cadLines),
  mesh: one(blockMeshes), // 1-to-1 relationship defined here
}));

export const cadLinesRelations = relations(cadLines, ({ one }) => ({
  block: one(blocks, { fields: [cadLines.blockId], references: [blocks.id] }),
}));

export const blockMeshesRelations = relations(blockMeshes, ({ one }) => ({
  block: one(blocks, { fields: [blockMeshes.blockId], references: [blocks.id] }),
}));

export const drillHolesRelations = relations(drillHoles, ({ one, many }) => ({
  map: one(maps, { fields: [drillHoles.mapId], references: [maps.id] }),
  samples: many(drillSamples),
}));

export const drillSamplesRelations = relations(drillSamples, ({ one }) => ({
  hole: one(drillHoles, { fields: [drillSamples.holeId], references: [drillHoles.id] }),
  via: one(vias, { fields: [drillSamples.viaId], references: [vias.id] }),
}));
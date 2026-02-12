import { timestamp,pgTable, serial, jsonb,text,boolean, doublePrecision,integer, geometry } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("user", {
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
  name: text("name").notNull().unique(), // e.g., "Vỉa_Map"
  createdAt: timestamp("created_at").defaultNow(),
});

export const cadObjects = pgTable("cad_objects", {
  id: serial("id").primaryKey(),
  mapId: integer("map_id").references(() => maps.id).notNull(),
  // Unique Identifier from AutoCAD
  handle: text("handle").notNull(),
  // hierarchical grouping
  viaName: text("via_name"),       //  "Vỉa 8 (Sample)"
  blockName: text("block_name"),   // "Khối 1"
  partType: text("part_type"),     // "Vách" (Roof) or "Trụ" (Floor)
  
  // Standard CAD Data
  layer: text("layer"),            // "F.C"
  objectType: text("object_type"), //  "Polyline"
  properties: jsonb("properties"), 
  
  // UI State
  isNew: boolean("is_new").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const drillCoreData = pgTable("drill_core_data", {
  id: serial("id").primaryKey(),
  
  // Columns matched to your Excel image
  sampleCode: text("sample_code"),      // "STT" (e.g., V9)
  holeId: text("hole_id"),              // "Tên lỗ khoan" (e.g., B2031)
  
  depthFrom: doublePrecision("depth_from"), // "Từ (m)"
  depthTo: doublePrecision("depth_to"),     // "Đến (m)"
  
  rockType: text("rock_type"),          // "Tên nham thạch"
  
  // Mechanical Properties
  compressiveStrength: doublePrecision("compressive_strength"), // "Cường độ kháng nén"
  tensileStrength: doublePrecision("tensile_strength"),         // "Cường độ kháng kéo"
  
  // Shear Strength split into Degrees and Minutes
  frictionAngleDeg: integer("friction_angle_deg"), // "Độ"
  frictionAngleMin: integer("friction_angle_min"), // "Phút"
  
  cohesion: doublePrecision("cohesion"),   // "Lực dính kết"
  
  // Physical Properties
  density: doublePrecision("density"),           // "Dung trọng"
  specificGravity: doublePrecision("specific_gravity"), // "Tỷ trọng"
  
  coefficient: doublePrecision("coefficient"), // "Hệ số..."
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const mapsRelations = relations(maps, ({ many }) => ({
  objects: many(cadObjects),
}));

export const cadObjectsRelations = relations(cadObjects, ({ one }) => ({
  map: one(maps, {
    fields: [cadObjects.mapId],
    references: [maps.id],
  }),
}));
import { timestamp,pgTable, serial, jsonb,text,boolean, primaryKey,integer, geometry } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(), 
  password: text("password").notNull(),    
  createdAt: timestamp("created_at").defaultNow(),
});

export const vietnamData = pgTable("gis_osm_roads_free_1", {
  gid: serial("gid").primaryKey(),
  osm_id: text("osm_id"),
  code: integer("code"),
  fclass: text("fclass"),
  name: text("name"),
  ref: text("ref"),
  oneway: text("oneway"),
  maxspeed: integer("maxspeed"),
  layer: integer("layer"),
  bridge: text("bridge"),
  tunnel: text("tunnel"),
  // Using generic geometry to handle Points, Lines, or Polygons
  geom: geometry("geom", { srid: 4326 }), 
});

export const cadObjects = pgTable("cad_objects", {
  id: serial("id").primaryKey(),
  groupName: text("group_name"),     
  handle: text("handle").notNull(), 
  objectType: text("object_type"),  
  layer: text("layer"),
  
  properties: jsonb("properties"), 
  
  isNew: boolean("is_new").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
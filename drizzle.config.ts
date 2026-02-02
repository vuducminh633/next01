import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  tablesFilter: ["user", "account", "gis_osm_roads_free_1"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
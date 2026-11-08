import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/schema-interview.ts"],
  dbCredentials: { url: process.env.DATABASE_URL! },
  extensionsFilters: ["postgis"],
});

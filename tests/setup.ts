import { config } from "dotenv";
config({ path: ".env" });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.AI_PROVIDER = "mock";
process.env.WHATSAPP_DRY_RUN = "true";

import { config } from "dotenv";
config({ path: ".env" });
if (!process.env.TEST_DATABASE_URL?.includes("_test")) {
  throw new Error("TEST_DATABASE_URL precisa apontar para um banco *_test (os testes apagam dados).");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AI_PROVIDER = "mock";
process.env.WHATSAPP_DRY_RUN = "true";

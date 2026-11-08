import { config } from "dotenv";
config({ path: ".env" });
if (!process.env.TEST_DATABASE_URL?.includes("_test")) {
  throw new Error("TEST_DATABASE_URL precisa apontar para um banco *_test (os testes apagam dados).");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AI_PROVIDER = "mock";
// Testes nunca gastam crédito: sem chaves pagas de IA e de voz, mesmo que estejam no .env.
for (const k of Object.keys(process.env)) {
  if (/^(FEATHERLESS_API_KEY|ELEVENLABS_API_KEY|AI_GATEWAY_API_KEY)/.test(k)) delete process.env[k];
}
process.env.WHATSAPP_DRY_RUN = "true";

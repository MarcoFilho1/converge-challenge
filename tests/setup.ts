import { afterEach } from "vitest";
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
// Entrada aberta só nos testes que ligam de propósito.
delete process.env.OPEN_ENTRY;
delete process.env.AI_EMBEDDINGS;
delete process.env.INTERVIEW_INVITE_ALL;
delete process.env.DEMO_NOTIFY_PARTICIPANT;
delete process.env.AUTO_DISPATCH;
delete process.env.DOCTOR_WHATSAPP;

// Indícios e resumo rodam em segundo plano: cada teste espera terminar antes do próximo limpar o banco.
afterEach(async () => {
  // Alguns testes trocam o motor por um falso, sem settleBackground: nesse caso não há nada a esperar.
  try {
    await (await import("@/lib/engine/engine")).settleBackground();
  } catch {
    /* motor falso */
  }
});

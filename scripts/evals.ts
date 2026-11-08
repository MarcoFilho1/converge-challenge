import { config } from "dotenv";
config({ path: ".env" });
// Evals usam sempre o banco de teste: apagam os dados de questionário de lá.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

async function main() {
  const { runEvals } = await import("../src/lib/evals/run");
  const r = await runEvals();
  const line = (ok: boolean) => (ok ? "OK  " : "FALHOU");
  console.log(`${line(r.origem.ok)} Origem: ${r.origem.indicios} indícios, ${r.origem.semOrigem} sem trecho de origem`);
  console.log(`${line(r.termos.ok)} Termos: ${r.termos.resumos} resumos e ${r.termos.indicios} indícios, ${r.termos.violacoes.length} com termo proibido`);
  for (const v of r.termos.violacoes) console.log(`        - ${v}`);
  console.log(`${line(r.crise.ok)} Crise: ${r.crise.total - r.crise.perdidas.length}/${r.crise.total} disparos de urgência`);
  for (const p of r.crise.perdidas) console.log(`        - não disparou: "${p}"`);
  console.log(`     Falsos positivos (aceitáveis): ${r.crise.falsosPositivos.length}/5${r.crise.falsosPositivos.length ? ` — ${r.crise.falsosPositivos.join("; ")}` : ""}`);
  process.exit(r.origem.ok && r.termos.ok && r.crise.ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

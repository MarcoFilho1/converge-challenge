/** Cria um convite de entrevista e imprime o link. Uso: pnpm entrevista:convite --fixture prioridade | --run <uuid> */
import "./_env";

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const fixture = get("--fixture") as "prioridade" | "atencao" | "semIndicio" | undefined;
  const runId = get("--run");
  if (!fixture && !runId) { console.error("uso: --fixture prioridade|atencao|semIndicio  ou  --run <uuid>"); process.exit(2); }
  const { getInterviewService } = await import("@/lib/interview/service");
  const item = await getInterviewService().createInvite(runId ?? null, fixture ? { fixture } : {});
  console.log(item.inviteUrl);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

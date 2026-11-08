/**
 * Roda uma vez quando o servidor sobe. A cada minuto, encerra as entrevistas paradas
 * (página fechada, conexão perdida): o resumo sai e o médico é avisado sem ninguém abrir o Caso.
 * A cada hora, roda o disparo automático do questionário (só manda algo se a médica ligou nas Configurações).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.INTERVIEW_IDLE_SWEEP === "false") return;
  const g = globalThis as typeof globalThis & { __interviewSweep?: ReturnType<typeof setInterval> };
  if (g.__interviewSweep) return;
  let busy = false;
  g.__interviewSweep = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const { getInterviewService } = await import("@/lib/interview/service");
      const closed = await getInterviewService().closeIdle();
      if (closed > 0) console.info(`[entrevista] ${closed} entrevista(s) parada(s) encerrada(s) com resumo`);
    } catch (err) {
      console.warn("[entrevista] varredura de entrevistas paradas falhou", err instanceof Error ? err.message : err);
    } finally {
      busy = false;
    }
  }, 60_000);
  g.__interviewSweep.unref?.();
  startAutoDispatch();
}

function startAutoDispatch() {
  const g = globalThis as typeof globalThis & { __autoDispatch?: ReturnType<typeof setInterval> };
  if (g.__autoDispatch) return;
  let busy = false;
  g.__autoDispatch = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const { runAutoDispatch } = await import("@/lib/dispatch/auto");
      const sent = await runAutoDispatch();
      if (sent > 0) console.info(`[disparo] questionário enviado a ${sent} colaborador(es)`);
    } catch (err) {
      console.warn("[disparo] disparo automático falhou", err instanceof Error ? err.message : err);
    } finally {
      busy = false;
    }
  }, 60 * 60_000);
  g.__autoDispatch.unref?.();
}

/**
 * Roda uma vez quando o servidor sobe.
 * - A cada minuto, encerra as entrevistas paradas (página fechada, conexão perdida): o resumo sai e o
 *   médico é avisado sem ninguém abrir o Caso.
 * - Com TELEGRAM_BOT_TOKEN, liga o leitor do Telegram (a reserva do WhatsApp).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_POLLING !== "false") {
    const { startTelegramPoller } = await import("@/lib/telegram/poller");
    startTelegramPoller();
  }
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
}

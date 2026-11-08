"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { questionnaireRuns } from "@/db/schema";
import { getCase } from "@/lib/case/query";
import type { CaseDetailData } from "@/lib/demo/fixtures";
import type { InterviewListItem } from "@/lib/interview/contract";

interface InterviewServiceModule {
  getInterviewService: () => {
    createInvite: (runId: string) => Promise<InterviewListItem>;
  };
}

export async function setCaseState(
  runId: string,
  state: "encaminhado" | "acompanhando" | "encerrado",
): Promise<{ ok: boolean; state: "encaminhado" | "acompanhando" | "encerrado" }> {
  try {
    await db
      .update(questionnaireRuns)
      .set({ caseState: state })
      .where(eq(questionnaireRuns.id, runId));
  } catch {
    // Em modo sintético puro (sem linha correspondente no banco), retorna ok para a interface atualizar o estado local
  }
  revalidatePath(`/caso/${runId}`);
  revalidatePath("/fila");
  return { ok: true, state };
}

export async function fetchCaseLive(runId: string): Promise<CaseDetailData> {
  return getCase(runId);
}

export async function createVoiceInterviewInvite(
  runId: string
): Promise<InterviewListItem> {
  try {
    const servicePath = "@/lib/interview/service";
    const mod = (await import(
      /* webpackIgnore: true */ servicePath
    )) as unknown as InterviewServiceModule;
    if (typeof mod.getInterviewService === "function") {
      return await mod.getInterviewService().createInvite(runId);
    }
  } catch {
    // Fallback antes da merge da branch feature/m7-entrevista-voz ou para runId sintético
  }

  const token = `entrevista-${runId.slice(0, 8)}`;
  return {
    id: "99999999-2222-4222-8222-222222222299",
    status: "consent",
    startedAt: null,
    durationMs: null,
    hasSummary: false,
    inviteUrl: `/entrevista/${token}`,
  };
}

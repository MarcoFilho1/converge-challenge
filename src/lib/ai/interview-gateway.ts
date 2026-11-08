import { generateText, Output } from "ai";
import { z } from "zod";
import { InterviewSummary } from "@/lib/interview/contract";
import { cleanGenerated } from "@/lib/interview/filters";
import { FindingDraftSchema, type InterviewAi } from "./interview";
import { createInterviewMock } from "./interview-mock";
import { ACK_SYSTEM, EXTRACT_SYSTEM, INTERVIEW_SUMMARY_SYSTEM } from "./interview-prompts";
import { chatCallOptions, hasChatKey, withChat } from "./llm";

async function withFallback<T>(label: string, real: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!hasChatKey()) {
    console.warn(`[entrevista] gateway sem chave em ${label}, usando mock`);
    return fallback();
  }
  try {
    return await real();
  } catch (err) {
    console.warn(`[entrevista] gateway falhou em ${label}, usando mock`, err instanceof Error ? err.message : err);
    return fallback();
  }
}

export function createInterviewGateway(): InterviewAi {
  const mock = createInterviewMock();
  return {
    extractFindings(input) {
      return withFallback("extractFindings", async () => {
        const { output } = await withChat((model) => generateText({
          model, ...chatCallOptions(), system: EXTRACT_SYSTEM, temperature: 0,
          output: Output.object({ schema: z.object({ achados: z.array(FindingDraftSchema) }) }),
          prompt: JSON.stringify({ bloco: input.blockId, pergunta: input.probeText, fala: input.text }),
        }));
        return output.achados;
      }, () => mock.extractFindings(input));
    },

    phraseAck(input) {
      return withFallback("phraseAck", async () => {
        const { output } = await withChat((model) => generateText({
          model, ...chatCallOptions(), system: ACK_SYSTEM, temperature: 0,
          output: Output.object({ schema: z.object({ ack: z.string().max(140) }) }),
          prompt: JSON.stringify({ fala: input.lastText, achados: input.findings, proximaPergunta: input.probeText }),
        }));
        return cleanGenerated(output.ack);
      }, () => mock.phraseAck(input));
    },

    summarize(input) {
      return withFallback("summarize", async () => {
        const { output } = await withChat((model) => generateText({
          model, ...chatCallOptions(), system: INTERVIEW_SUMMARY_SYSTEM, temperature: 0,
          output: Output.object({ schema: InterviewSummary }),
          prompt: JSON.stringify({ turnos: input.turns, achados: input.findings, naoRespondido: input.skipped }),
        }));
        return output;
      }, () => mock.summarize(input));
    },
  };
}

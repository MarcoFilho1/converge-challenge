/**
 * Contexto do rastro: a qual caso, entrevista ou resposta pertence o que o agente está fazendo agora.
 * Passa sozinho por todas as chamadas assíncronas dentro de withObsContext.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type ObsContext = { runId?: string | null; interviewId?: string | null; answerId?: string | null; waMessageId?: string | null };

const storage = new AsyncLocalStorage<ObsContext>();

export function withObsContext<T>(ctx: ObsContext, fn: () => Promise<T>): Promise<T> {
  return storage.run({ ...storage.getStore(), ...ctx }, fn);
}

export function obsContext(): ObsContext {
  return storage.getStore() ?? {};
}

import { beforeEach, describe, expect, it } from "vitest";
import { chatCallOptions, chatTargets, costTotals, isCreditError, resetCostTotals, resetExhaustedKeys, withChat, type ChatTarget } from "@/lib/ai/llm";

const target = (key: string, model: string): ChatTarget => ({ label: `${model}@${key}`, key, model: `${model}@${key}` });
const creditError = () => Object.assign(new Error("Insufficient credits"), { statusCode: 402 });

beforeEach(() => {
  resetExhaustedKeys();
  resetCostTotals();
});

describe("troca de chave e de modelo da IA", () => {
  it("quando a primeira chave fica sem crédito, usa a segunda e não volta mais na primeira", async () => {
    const seen: string[] = [];
    const run = async (model: unknown) => {
      seen.push(String(model));
      if (String(model).endsWith("@k1")) throw creditError();
      return "ok";
    };
    const targets = [target("k1", "m1"), target("k2", "m1")];
    expect(await withChat(run, targets)).toBe("ok");
    expect(seen).toEqual(["m1@k1", "m1@k2"]);

    seen.length = 0;
    expect(await withChat(run, targets)).toBe("ok");
    expect(seen).toEqual(["m1@k2"]);
  });

  it("erro que não é de crédito tenta o próximo alvo, mas a chave continua valendo", async () => {
    const seen: string[] = [];
    let fail = true;
    const run = async (model: unknown) => {
      seen.push(String(model));
      if (fail && String(model) === "m1@k1") throw Object.assign(new Error("upstream"), { statusCode: 503 });
      return "ok";
    };
    const targets = [target("k1", "m1"), target("k1", "m2")];
    expect(await withChat(run, targets)).toBe("ok");
    expect(seen).toEqual(["m1@k1", "m2@k1"]);

    fail = false;
    seen.length = 0;
    await withChat(run, targets);
    expect(seen).toEqual(["m1@k1"]);
  });

  it("se todos os alvos falharem, lança o último erro", async () => {
    const run = async (model: unknown) => {
      throw new Error(`falhou ${String(model)}`);
    };
    await expect(withChat(run, [target("k1", "m1"), target("k2", "m1")])).rejects.toThrow("falhou m1@k2");
  });

  it("reconhece falta de crédito pelo status 402 ou pela mensagem", () => {
    expect(isCreditError(Object.assign(new Error("x"), { statusCode: 402 }))).toBe(true);
    expect(isCreditError(Object.assign(new Error("Insufficient balance on this key"), { statusCode: 403 }))).toBe(true);
    expect(isCreditError(Object.assign(new Error("Invalid API key"), { statusCode: 401 }))).toBe(true);
    expect(isCreditError(Object.assign(new Error("Bad gateway"), { statusCode: 502 }))).toBe(false);
    expect(isCreditError(new Error("timeout"))).toBe(false);
  });

  it("monta os alvos da Featherless: cada modelo com cada chave, na ordem", () => {
    const t = chatTargets({
      FEATHERLESS_API_KEY_1: "k1",
      FEATHERLESS_API_KEY_2: "k2",
      AI_CHAT_MODEL: "moonshotai/Kimi-K2-Instruct-0905",
      AI_CHAT_MODEL_FALLBACK: "deepseek-ai/DeepSeek-V3.2",
    });
    expect(t.map((x) => x.label)).toEqual([
      "featherless:moonshotai/Kimi-K2-Instruct-0905#1",
      "featherless:moonshotai/Kimi-K2-Instruct-0905#2",
      "featherless:deepseek-ai/DeepSeek-V3.2#1",
      "featherless:deepseek-ai/DeepSeek-V3.2#2",
    ]);
  });

  it("sem chave da Featherless, cai no AI Gateway com o modelo configurado", () => {
    const t = chatTargets({ AI_CHAT_MODEL: "anthropic/claude-sonnet-5-5" });
    expect(t).toEqual([{ label: "gateway:anthropic/claude-sonnet-5-5", key: "gateway", model: "anthropic/claude-sonnet-5-5" }]);
  });
});

describe("modo da IA", () => {
  it("AI_PROVIDER=featherless e gateway usam o provedor real; qualquer outro valor, o simulado", async () => {
    const { aiMode } = await import("@/lib/ai");
    expect(aiMode({ AI_PROVIDER: "featherless" })).toBe("real");
    expect(aiMode({ AI_PROVIDER: "gateway" })).toBe("real");
    expect(aiMode({ AI_PROVIDER: "mock" })).toBe("mock");
    expect(aiMode({})).toBe("mock");
  });
});

describe("tarefas rápidas e longas", () => {
  it("tarefa rápida usa o modelo rápido primeiro, depois o principal", () => {
    const t = chatTargets({ FEATHERLESS_API_KEY_1: "k1", AI_CHAT_MODEL: "moonshotai/Kimi-K2-Instruct-0905", AI_FAST_MODEL: "deepseek-ai/DeepSeek-V3-0324" }, "fast");
    expect(t.map((x) => x.label)).toEqual(["featherless:deepseek-ai/DeepSeek-V3-0324#1", "featherless:moonshotai/Kimi-K2-Instruct-0905#1"]);
  });

  it("tarefa rápida tem modelo reserva próprio antes do principal", () => {
    const t = chatTargets({ FEATHERLESS_API_KEY_1: "k1", AI_CHAT_MODEL: "moonshotai/Kimi-K2-Instruct-0905", AI_FAST_MODEL: "moonshotai/Kimi-K2-Instruct-0905", AI_FAST_MODEL_FALLBACK: "Qwen/Qwen3-30B-A3B-Instruct-2507" }, "fast");
    expect(t.map((x) => x.label)).toEqual(["featherless:moonshotai/Kimi-K2-Instruct-0905#1", "featherless:Qwen/Qwen3-30B-A3B-Instruct-2507#1"]);
  });

  it("limite de tempo: 7 s para tarefa rápida e 45 s para resumo, configuráveis", () => {
    const fast = chatCallOptions("fast", {});
    const long = chatCallOptions("long", {});
    expect(fast.timeoutMs).toBe(7000);
    expect(long.timeoutMs).toBe(45000);
    expect(chatCallOptions("fast", { AI_FAST_TIMEOUT_MS: "5000" }).timeoutMs).toBe(5000);
    expect(fast.abortSignal).toBeInstanceOf(AbortSignal);
  });
});

describe("medidor de custo", () => {
  it("soma o custo que a Featherless devolve em cada chamada, por etapa", async () => {
    const run = async () => ({ usage: { raw: { cost: 0.0012 } } });
    await withChat(run, [target("k1", "m1")], "classificar");
    await withChat(run, [target("k1", "m1")], "classificar");
    await withChat(async () => ({ usage: { raw: { cost: 0.0005 } } }), [target("k1", "m1")], "resumo");
    const t = costTotals();
    expect(t.classificar).toEqual({ calls: 2, usd: 0.0024 });
    expect(t.resumo).toEqual({ calls: 1, usd: 0.0005 });
  });
});

describe("teto de tempo das tarefas rápidas", () => {
  it("para de tentar quando a próxima tentativa estouraria o teto total", async () => {
    let now = 0;
    const seen: string[] = [];
    const slow = async (model: unknown) => {
      seen.push(String(model));
      now += 7000;
      throw new Error("timeout");
    };
    const targets = [target("k1", "m1"), target("k2", "m1"), target("k1", "m2")];
    await expect(withChat(slow, targets, "x", { attemptMs: 7000, budgetMs: 14000, clock: () => now })).rejects.toThrow();
    expect(seen).toEqual(["m1@k1", "m1@k2"]);
  });
});

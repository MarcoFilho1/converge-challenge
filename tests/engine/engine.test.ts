import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

const PHONE = "5581999990001";
let n = 0;
const msgId = () => `wa-${Date.now()}-${n++}`;

async function setup() {
  const { db } = await import("@/db/client");
  const { contacts } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Ana Teste", phoneE164: PHONE, sector: "Atendimento" }).returning();
  return c;
}

async function say(text: string, id = msgId()) {
  const { handleIncoming } = await import("@/lib/engine/engine");
  return handleIncoming({ phone: PHONE, text, waMessageId: id });
}

async function getRun(runId: string) {
  const { db } = await import("@/db/client");
  const { questionnaireRuns } = await import("@/db/schema");
  const [r] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, runId));
  return r;
}

async function answersOf(runId: string) {
  const { db } = await import("@/db/client");
  const { answers } = await import("@/db/schema");
  return db.select().from(answers).where(eq(answers.runId, runId)).orderBy(asc(answers.createdAt));
}

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("motor do questionário", () => {
  it("demo: consentimento + 8 respostas do personagem termina em prioridade", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const start = await startRun(contact.id, { demoShort: true });
    expect(start.outbound[0]).toMatch(/Vamos começar/i);

    const consent = await say("sim");
    expect(consent.event).toBe("consent_ok");
    expect(consent.outbound.join("\n")).toContain("NOS ÚLTIMOS 30 DIAS");

    let last;
    for (const text of ["sim", "6", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "nunca", "sempre", "metas dobraram e não tenho apoio"]) last = await say(text);
    expect(last!.event).toBe("finished");
    expect(last!.outbound.join("\n")).toContain("188");

    const run = await getRun(start.runId);
    expect(run.status).toBe("done");
    expect(run.severity).toBe("priority");
    expect(await answersOf(start.runId)).toHaveLength(8);
  });

  it("recusa no consentimento encerra sem perguntas", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    const r = await say("não quero");
    expect(r.event).toBe("declined");
    expect((await getRun(runId)).status).toBe("stopped");
  });

  it("resposta fora da escala repete uma vez e na segunda grava vazio e segue", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    await say("sim");
    const first = await say("11");
    expect(first.event).toBe("repeat");
    const second = await say("talvez");
    expect(second.event).toBe("answer");
    const rows = await answersOf(runId);
    expect(rows.find((a) => a.itemCode === "WPAI_Q5")?.valueNumeric).toBeNull();
  });

  it("frase de risco interrompe, manda 188 e CONTINUAR retoma no mesmo ponto", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    await say("sim");
    await say("6");
    const crisis = await say("às vezes quero sumir");
    expect(crisis.event).toBe("crisis");
    expect(crisis.outbound.join("\n")).toContain("188");
    const crisisRun = await getRun(runId);
    expect(crisisRun).toMatchObject({ status: "crisis", severity: "urgency" });

    const resumed = await say("CONTINUAR");
    expect(resumed.event).toBe("resumed");
    expect(resumed.outbound.join("\n")).toContain("mentalmente exausto");
    const newRun = await getRun(resumed.runId!);
    expect(newRun.resumedFromRunId).toBe(runId);
    expect(newRun.status).toBe("in_progress");
    expect(await answersOf(newRun.id)).toHaveLength(2);
  });

  it("item 9 maior que zero vira crise com urgência", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    for (const t of ["sim", "não", "1", "nunca", "nenhuma vez", "nenhuma vez"]) await say(t);
    const r = await say("vários dias");
    expect(r.event).toBe("crisis");
    expect(await getRun(runId)).toMatchObject({ status: "crisis", severity: "urgency" });
  });

  it("PARAR encerra com escores parciais", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    for (const t of ["sim", "sim", "6"]) await say(t);
    const r = await say("parar");
    expect(r.event).toBe("stopped");
    expect(await getRun(runId)).toMatchObject({ status: "stopped", partial: true });
  });

  it("mesmo id de mensagem duas vezes não avança", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    const before = (await getRun(runId)).currentItem;
    await say("sim", "dup-1");
    const dup = await say("sim", "dup-1");
    expect(dup.event).toBe("duplicate");
    expect(dup.outbound).toEqual([]);
    expect((await getRun(runId)).currentItem).toBe(before + 1);
  });

  it("CONTINUAR no meio do questionário só repete a pergunta atual", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    await say("sim");
    const r = await say("continuar");
    expect(r.event).toBe("already_running");
    expect(r.outbound.join("\n")).toContain("Durante os últimos sete dias");
    expect((await getRun(runId)).retryCount).toBe(0);
  });

  it("número desconhecido recebe um aviso e não cria questionário", async () => {
    const { handleIncoming } = await import("@/lib/engine/engine");
    const r = await handleIncoming({ phone: "5581000000000", text: "oi", waMessageId: msgId() });
    expect(r.event).toBe("ignored_unknown");
    expect(r.outbound).toHaveLength(1);
    expect(r.runId).toBeNull();
  });

  it("frase de risco sem questionário ativo cria caso de urgência", async () => {
    await setup();
    const r = await say("penso em me matar");
    expect(r.event).toBe("crisis");
    expect(await getRun(r.runId!)).toMatchObject({ status: "crisis", severity: "urgency" });
  });

  it("roteiro completo pula a WPAI quando o tronco é não", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    await startRun(contact.id, { demoShort: false });
    await say("sim");
    const r = await say("não");
    expect(r.outbound.join("\n")).toContain("Pouco interesse ou pouco prazer");
  });
});

describe("convite automático para a entrevista", () => {
  async function runDemo(answers: string[]) {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const start = await startRun(contact.id, { demoShort: true });
    await say("sim");
    let last;
    for (const text of answers) last = await say(text);
    return { runId: start.runId, last: last! };
  }

  async function interviewsOf(runId: string) {
    const { db } = await import("@/db/client");
    const { interviews } = await import("@/db/schema-interview");
    return db.select().from(interviews).where(eq(interviews.runId, runId));
  }

  it("índice abaixo do limite: o agente manda o link da Helena junto com o encerramento", async () => {
    const { runId, last } = await runDemo(["sim", "7", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "nunca", "sempre", "as metas dobraram"]);
    expect(last.event).toBe("finished");
    expect(last.outbound).toHaveLength(2);
    expect(last.outbound[1]).toMatch(/Helena/);
    const rows = await interviewsOf(runId);
    expect(rows).toHaveLength(1);
    expect(last.outbound[1]).toContain(`/entrevista/${rows[0].token}`);
  });

  it("sem indício e índice alto: só o encerramento, sem convite", async () => {
    const { runId, last } = await runDemo(["não", "0", "nunca", "nenhuma vez", "nenhuma vez", "nunca", "raramente", "tudo tranquilo"]);
    expect(last.outbound).toHaveLength(1);
    expect(await interviewsOf(runId)).toHaveLength(0);
  });

  it("crise pelo item 9: nada de convite, só a mensagem de segurança", async () => {
    const { runId, last } = await runDemo(["sim", "4", "algumas vezes", "vários dias", "vários dias", "vários dias"]);
    expect(last.event).toBe("crisis");
    expect(await interviewsOf(runId)).toHaveLength(0);
  });

  it("INTERVIEW_AUTO_INVITE=false desliga o convite", async () => {
    process.env.INTERVIEW_AUTO_INVITE = "false";
    try {
      const { runId, last } = await runDemo(["sim", "7", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "nunca", "sempre", "as metas dobraram"]);
      expect(last.outbound).toHaveLength(1);
      expect(await interviewsOf(runId)).toHaveLength(0);
    } finally {
      delete process.env.INTERVIEW_AUTO_INVITE;
    }
  });
});

describe("indícios e resumo em segundo plano", () => {
  it("a próxima pergunta não espera a busca de indícios; o resumo só sai depois dos indícios", async () => {
    const { registerEngineHooks, settleBackground } = await import("@/lib/engine/engine");
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    registerEngineHooks({
      onAnswer: async () => {
        await gate;
        order.push("indício");
      },
      onRunFinished: async () => {
        order.push("resumo");
      },
    });
    try {
      const contact = await setup();
      const { startRun } = await import("@/lib/engine/engine");
      await startRun(contact.id, { demoShort: true });
      await say("sim");
      const first = await say("não");
      expect(first.event).toBe("answer");
      expect(order).toEqual([]);
      let last;
      for (const t of ["7", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "nunca", "sempre", "metas"]) last = await say(t);
      expect(last!.event).toBe("finished");
      expect(order).toEqual([]);
      release();
      await settleBackground();
      expect(order.at(-1)).toBe("resumo");
      expect(order.filter((x) => x === "indício")).toHaveLength(8);
    } finally {
      const { restoreDefaultEngineHooks } = await import("@/lib/engine/engine");
      restoreDefaultEngineHooks();
    }
  });
});

describe("frase de risco com negação", () => {
  async function startDemo() {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    return runId;
  }

  it("sem IA real (ambíguo): pergunta para confirmar; um 'não' claro segue com a pergunta atual", async () => {
    const runId = await startDemo();
    const ask = await say("não, nunca pensei em me machucar");
    expect(ask.event).toBe("crisis_confirm");
    expect(ask.outbound.join(" ")).toMatch(/SIM ou NÃO/);
    expect((await getRun(runId)).status).toBe("in_progress");

    const ok = await say("não");
    expect(ok.event).toBe("crisis_denied");
    expect(ok.outbound.join("\n")).toContain("NOS ÚLTIMOS 30 DIAS");
    expect((await getRun(runId)).status).toBe("in_progress");
  });

  it("na confirmação, qualquer coisa que não seja um 'não' claro vira crise", async () => {
    const runId = await startDemo();
    await say("não, nunca pensei em me machucar");
    const r = await say("às vezes sim");
    expect(r.event).toBe("crisis");
    const run = await getRun(runId);
    expect(run.status).toBe("crisis");
    expect(run.severity).toBe("urgency");
  });

  it("IA diz que negou: o questionário segue e a resposta ao item 9 vale 0", async () => {
    const { setRiskJudge, resetRiskJudge } = await import("@/lib/crisis/judge");
    setRiskJudge(async () => "negado");
    try {
      const runId = await startDemo();
      let last;
      for (const t of ["sim", "7", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "não, nunca pensei em me ferir"]) last = await say(t);
      expect(last!.event).toBe("answer");
      const a = (await answersOf(runId)).find((x) => x.itemCode === "PHQ9_9");
      expect(a?.valueNumeric).toBe(0);
      expect((await getRun(runId)).status).toBe("in_progress");
    } finally {
      resetRiskJudge();
    }
  });

  it("frase de risco sem negação continua cortando na hora", async () => {
    await startDemo();
    const r = await say("eu penso em me matar");
    expect(r.event).toBe("crisis");
  });
});

describe("áudio e mídia no WhatsApp", () => {
  it("figurinha no meio do questionário: resposta padrão e a pergunta atual de novo", async () => {
    const contact = await setup();
    const { startRun, handleMedia } = await import("@/lib/engine/engine");
    await startRun(contact.id, { demoShort: true });
    await say("sim");
    const r = await handleMedia({ phone: PHONE, waMessageId: msgId(), media: "figurinha" });
    expect(r.event).toBe("media");
    expect(r.outbound[0]).toMatch(/texto e ouço áudios/);
    expect(r.outbound.join("\n")).toContain("NOS ÚLTIMOS 30 DIAS");
  });

  it("mídia de número desconhecido não recebe resposta", async () => {
    const { handleMedia } = await import("@/lib/engine/engine");
    const r = await handleMedia({ phone: "5581900001234", waMessageId: msgId(), media: "foto" });
    expect(r.outbound).toEqual([]);
  });

  it("áudio transcrito entra como resposta, sem eco para a pessoa, e fica marcado como áudio", async () => {
    const contact = await setup();
    const { startRun, handleIncoming } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    const r = await handleIncoming({ phone: PHONE, text: "sim", waMessageId: msgId(), viaAudio: true });
    expect(r.event).toBe("answer");
    expect(r.outbound.join("\n")).not.toMatch(/Ouvi seu áudio/);
    expect(r.outbound).toHaveLength(1);
    expect(r.outboundIds).toHaveLength(r.outbound.length);
    expect((await answersOf(runId))[0].valueNumeric).toBe(2);
    const { db } = await import("@/db/client");
    const { messages } = await import("@/db/schema");
    const inbound = await db.select().from(messages).where(eq(messages.direction, "in"));
    expect(inbound.find((m) => m.text === "sim" && m.viaAudio)).toBeTruthy();
  });

  it("áudio que não deu para ouvir: pede para escrever", async () => {
    const contact = await setup();
    const { startRun, handleMedia } = await import("@/lib/engine/engine");
    await startRun(contact.id, { demoShort: true });
    await say("sim");
    const r = await handleMedia({ phone: PHONE, waMessageId: msgId(), media: "áudio sem transcrição" });
    expect(r.outbound[0]).toMatch(/Não consegui ouvir/);
  });
});

describe("entrada aberta (OPEN_ENTRY=true)", () => {
  it("número desconhecido vira colaborador com o nome do perfil e recebe o consentimento", async () => {
    process.env.OPEN_ENTRY = "true";
    try {
      const { handleIncoming } = await import("@/lib/engine/engine");
      const r = await handleIncoming({ phone: "5581977770001", text: "oi", waMessageId: msgId(), name: "Marina Souza" });
      expect(r.event).toBe("joined");
      expect(r.outbound[0]).toMatch(/Vamos começar/i);
      expect(r.outbound[0]).toContain("Marina");
      const { db } = await import("@/db/client");
      const { contacts } = await import("@/db/schema");
      const rows = await db.select().from(contacts).where(eq(contacts.phoneE164, "5581977770001"));
      expect(rows[0].name).toBe("Marina Souza");
      expect((await getRun(r.runId!)).status).toBe("consent");

      const next = await handleIncoming({ phone: "5581977770001", text: "sim", waMessageId: msgId() });
      expect(next.event).toBe("consent_ok");
    } finally {
      delete process.env.OPEN_ENTRY;
    }
  });

  it("sem nome no perfil, usa 'Colaborador' e os 4 últimos dígitos", async () => {
    process.env.OPEN_ENTRY = "true";
    try {
      const { handleIncoming } = await import("@/lib/engine/engine");
      await handleIncoming({ phone: "5581977774321", text: "oi", waMessageId: msgId() });
      const { db } = await import("@/db/client");
      const { contacts } = await import("@/db/schema");
      const rows = await db.select().from(contacts).where(eq(contacts.phoneE164, "5581977774321"));
      expect(rows[0].name).toBe("Colaborador 4321");
    } finally {
      delete process.env.OPEN_ENTRY;
    }
  });

  it("frase de risco na primeira mensagem de um número novo ainda corta em crise", async () => {
    process.env.OPEN_ENTRY = "true";
    try {
      const { handleIncoming } = await import("@/lib/engine/engine");
      const r = await handleIncoming({ phone: "5581977770002", text: "penso em me matar", waMessageId: msgId() });
      expect(r.event).toBe("crisis");
    } finally {
      delete process.env.OPEN_ENTRY;
    }
  });
});

describe("demonstração: entrevista para todos (INTERVIEW_INVITE_ALL=true)", () => {
  async function runDemo(answers: string[]) {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const start = await startRun(contact.id, { demoShort: true });
    await say("sim");
    let last;
    for (const text of answers) last = await say(text);
    return { runId: start.runId, last: last! };
  }

  it("sem indício também recebe o convite, com a nota de que em uso real só abaixo do limite", async () => {
    process.env.INTERVIEW_INVITE_ALL = "true";
    try {
      const { runId, last } = await runDemo(["não", "0", "nunca", "nenhuma vez", "nenhuma vez", "nunca", "raramente", "tudo tranquilo"]);
      expect(last.outbound).toHaveLength(2);
      expect(last.outbound[1]).toMatch(/Helena/);
      expect(last.outbound[1]).toMatch(/demonstração/i);
      expect(last.outbound[1]).toMatch(/70/);
      const { db } = await import("@/db/client");
      const { interviews } = await import("@/db/schema-interview");
      expect(await db.select().from(interviews).where(eq(interviews.runId, runId))).toHaveLength(1);
    } finally {
      delete process.env.INTERVIEW_INVITE_ALL;
    }
  });

  it("quem precisa da entrevista recebe o convite normal, sem a nota", async () => {
    process.env.INTERVIEW_INVITE_ALL = "true";
    try {
      const { last } = await runDemo(["sim", "7", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "nunca", "sempre", "as metas dobraram"]);
      expect(last.outbound[1]).toMatch(/Helena/);
      expect(last.outbound[1]).not.toMatch(/demonstração/i);
    } finally {
      delete process.env.INTERVIEW_INVITE_ALL;
    }
  });

  it("urgência continua sem convite, mesmo na demonstração", async () => {
    process.env.INTERVIEW_INVITE_ALL = "true";
    try {
      const { last } = await runDemo(["sim", "4", "algumas vezes", "vários dias", "vários dias", "vários dias"]);
      expect(last.event).toBe("crisis");
      expect(last.outbound.join(" ")).not.toMatch(/Helena/);
    } finally {
      delete process.env.INTERVIEW_INVITE_ALL;
    }
  });
});

describe("linguagem natural (IA sugere, código decide)", () => {
  async function demoAt(answers: string[] = []) {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    for (const t of answers) await say(t);
    return runId;
  }
  const answer = async (runId: string, code: string) => (await answersOf(runId)).find((a) => a.itemCode === code);

  it("consentimento: número não aceita; frase livre aceita; dúvida recebe explicação", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    await startRun(contact.id, { demoShort: true });
    expect((await say("1")).event).toBe("consent_repeat");
    const doubt = await say("isso é sigiloso mesmo?");
    expect(doubt.event).toBe("consent_repeat");
    expect(doubt.outbound[0]).toMatch(/sigilo/i);
    expect((await say("bora, pode mandar")).event).toBe("consent_ok");
  });

  it("número sozinho não responde item com rótulos: repete com as opções por extenso", async () => {
    const runId = await demoAt(["sim", "6"]);
    const r = await say("4");
    expect(r.event).toBe("repeat");
    expect(r.outbound.join("\n")).toContain("nunca · raramente · algumas vezes · com frequência · sempre");
    expect(await answer(runId, "BAT_1")).toBeUndefined();
  });

  it("número no meio da frase não vira valor", async () => {
    const runId = await demoAt(["sim", "6", "com frequência"]);
    const r = await say("faz 3 meses que eu ando assim");
    expect(r.event).toBe("repeat");
    expect(await answer(runId, "PHQ9_1")).toBeUndefined();
  });

  it("resposta em palavras grava valor, trecho, origem e a mensagem de onde veio", async () => {
    const runId = await demoAt(["sim", "6"]);
    const r = await say("Acho que com frequência, ainda mais no fechamento");
    expect(r.event).toBe("answer");
    const a = await answer(runId, "BAT_1");
    expect(a).toMatchObject({ valueNumeric: 4, source: "regra", quote: "com frequencia" });
    expect(a?.messageId).toBeTruthy();
  });

  it("0 a 10 sem número: confirma; 'sim' grava como confirmado", async () => {
    const { getAi } = await import("@/lib/ai");
    const runId = await demoAt(["sim"]);
    const spy = vi.spyOn(getAi(), "readReply").mockResolvedValueOnce({ intent: "answer", value: 7, quote: "atrapalhou bastante", confidence: "alta", mentions: [], source: "ia" });
    const ask = await say("atrapalhou bastante");
    expect(ask.event).toBe("confirm");
    expect(ask.outbound[0]).toMatch(/7 de 10/);
    expect((await getRun(runId)).pendingValue).toBe(7);
    spy.mockRestore();
    const ok = await say("sim");
    expect(ok.event).toBe("answer");
    expect(await answer(runId, "WPAI_Q5")).toMatchObject({ valueNumeric: 7, source: "ia_confirmada", rawText: "atrapalhou bastante" });
    expect((await getRun(runId)).pendingValue).toBeNull();
  });

  it("confirmação negada: pergunta de novo com as opções e não grava", async () => {
    const { getAi } = await import("@/lib/ai");
    const runId = await demoAt(["sim"]);
    const spy = vi.spyOn(getAi(), "readReply").mockResolvedValueOnce({ intent: "answer", value: 7, quote: "bastante", confidence: "alta", mentions: [], source: "ia" });
    await say("bastante");
    spy.mockRestore();
    const r = await say("não");
    expect(r.event).toBe("repeat");
    expect((await answer(runId, "WPAI_Q5"))?.valueNumeric).toBeNull();
  });

  it("item 9: 'acho que não' pede confirmação; 'sim' grava 0 e segue", async () => {
    const runId = await demoAt(["sim", "6", "com frequência", "mais da metade dos dias", "mais da metade dos dias"]);
    const { getAi } = await import("@/lib/ai");
    const spy = vi.spyOn(getAi(), "readReply").mockResolvedValueOnce({ intent: "answer", value: 0, quote: "acho que", confidence: "baixa", mentions: [], source: "ia" });
    const ask = await say("acho que não");
    expect(ask.event).toBe("confirm");
    expect(ask.outbound[0]).toMatch(/nenhuma vez/);
    spy.mockRestore();
    const ok = await say("sim");
    expect(ok.event).toBe("answer");
    expect((await answer(runId, "PHQ9_9"))?.valueNumeric).toBe(0);
  });

  it("item 9 em palavras acima de zero vira crise", async () => {
    const runId = await demoAt(["sim", "6", "com frequência", "mais da metade dos dias", "mais da metade dos dias"]);
    const r = await say("vários dias");
    expect(r.event).toBe("crisis");
    expect((await getRun(runId)).severity).toBe("urgency");
  });

  it("correção muda a resposta anterior e repete a pergunta atual", async () => {
    const runId = await demoAt(["sim", "6", "com frequência"]);
    const r = await say("não, quis dizer raramente");
    expect(r.event).toBe("corrected");
    expect(r.outbound[0]).toBe("Certo, corrigi.");
    expect((await answer(runId, "BAT_1"))?.valueNumeric).toBe(2);
    expect((await getRun(runId)).currentItem).toBe(3);
  });

  it("dúvida sobre a pergunta: explicação fixa e a pergunta de novo, sem contar tentativa", async () => {
    const runId = await demoAt(["sim"]);
    const r = await say("o que é produtividade?");
    expect(r.event).toBe("doubt");
    expect(r.outbound[0]).toMatch(/0 a 10/);
    expect((await getRun(runId)).retryCount).toBe(0);
  });

  it("fala que já toca no próximo item: frase de ligação antes do texto validado, sem preencher", async () => {
    const { getAi } = await import("@/lib/ai");
    const runId = await demoAt(["sim", "6", "com frequência"]);
    const spy = vi.spyOn(getAi(), "readReply").mockResolvedValueOnce({ intent: "answer", value: 2, quote: "mais da metade dos dias", confidence: "alta", mentions: ["PHQ9_2"], source: "ia" });
    const r = await say("mais da metade dos dias, e ando pra baixo também");
    spy.mockRestore();
    expect(r.event).toBe("answer");
    expect(r.outbound[0]).toMatch(/^Você já comentou um pouco sobre isso/);
    expect(r.outbound[0]).toContain('Se sentir "para baixo"');
    expect(await answer(runId, "PHQ9_2")).toBeUndefined();
  });

  it("'prefiro não responder' grava vazio e segue", async () => {
    const runId = await demoAt(["sim", "6"]);
    const r = await say("prefiro não responder essa");
    expect(r.event).toBe("answer");
    expect((await answer(runId, "BAT_1"))?.valueNumeric).toBeNull();
  });
});

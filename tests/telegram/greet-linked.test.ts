import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

const PHONE = "5581999990001";
let n = 0;
const id = () => `wa-${Date.now()}-${n++}`;

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});
afterEach(() => {
  delete process.env.OPEN_ENTRY;
});

async function contact() {
  const { db } = await import("@/db/client");
  const { contacts } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Paula Lima", phoneE164: PHONE, sector: "Atendimento" }).returning();
  return c;
}

describe("pessoa que liga o Telegram no meio do questionário", () => {
  it("continua da pergunta atual, sem inventar mensagem dela na conversa", async () => {
    const c = await contact();
    const { startRun, handleIncoming, greetLinked } = await import("@/lib/engine/engine");
    await startRun(c.id, { demoShort: true });
    // "sim" aceita no motor atual e no de linguagem natural.
    const consent = await handleIncoming({ phone: PHONE, text: "sim", waMessageId: id() });
    const currentQuestion = consent.outbound[consent.outbound.length - 1];

    const greet = await greetLinked({ phone: PHONE });
    expect(greet.event).toBe("resumed");
    expect(greet.outbound[0]).toMatch(/continuar de onde você parou/);
    expect(greet.outbound[1]).toBe(currentQuestion);

    const { db } = await import("@/db/client");
    const { messages } = await import("@/db/schema");
    const rows = await db.select().from(messages);
    expect(rows.filter((m) => m.direction === "in")).toHaveLength(1);

    // A resposta pelo Telegram segue o mesmo caso.
    const next = await handleIncoming({ phone: PHONE, text: "1", waMessageId: "tg:555:1" });
    expect(next.runId).toBe(consent.runId);
  });

  it("ainda no consentimento: repete o pedido de aceite", async () => {
    const c = await contact();
    const { startRun, greetLinked } = await import("@/lib/engine/engine");
    const { copy } = await import("@/lib/engine/copy");
    await startRun(c.id, { demoShort: true });
    const greet = await greetLinked({ phone: PHONE });
    expect(greet.event).toBe("consent_repeat");
    expect(greet.outbound[1]).toBe(copy.consentRepeat);
  });

  it("sem cadastro e com entrada aberta: vira colaborador e recebe o consentimento", async () => {
    process.env.OPEN_ENTRY = "true";
    const { greetLinked } = await import("@/lib/engine/engine");
    const greet = await greetLinked({ phone: "tg:555", name: "Paula" });
    expect(greet.event).toBe("joined");
    expect(greet.outbound[0]).toMatch(/Olá, Paula/);
  });

  it("sem cadastro e sem entrada aberta: mensagem de número desconhecido", async () => {
    const { greetLinked } = await import("@/lib/engine/engine");
    const greet = await greetLinked({ phone: "tg:555" });
    expect(greet.event).toBe("ignored_unknown");
  });

  it("ligação do Telegram: a conversa mais recente da pessoa é a usada no envio", async () => {
    const { linkChat, chatForPerson, personForChat } = await import("@/lib/telegram/links");
    await linkChat("111", PHONE);
    await new Promise((r) => setTimeout(r, 5));
    await linkChat("222", PHONE);
    expect(await chatForPerson(PHONE)).toBe("222");
    expect(await personForChat("111")).toBe(PHONE);
    expect(await chatForPerson("tg:999")).toBe("999");
  });
});

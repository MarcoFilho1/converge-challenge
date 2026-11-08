"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { contacts, questionnaireRuns } from "@/db/schema";
import { parseContactsCsv } from "@/lib/contacts/csv";
import { seedDemoDatabaseIfEmpty } from "@/lib/contacts/query";
import { startRun } from "@/lib/engine/engine";
import { EvolutionError } from "@/lib/whatsapp/evolution";
import { sendToPerson } from "@/lib/channels/send";
import { toE164 } from "@/lib/whatsapp/phone";

export interface ContactActionResult {
  ok: boolean;
  message: string;
  errors?: { line: number; reason: string }[];
  failed?: { id: string; message: string }[];
}

export async function addContact(formData: FormData): Promise<ContactActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim() || "Geral";
  const role = String(formData.get("role") ?? "").trim() || "Colaborador";

  if (!name) {
    return { ok: false, message: "Informe o nome completo do colaborador." };
  }

  const phoneE164 = toE164(rawPhone);
  if (!phoneE164) {
    return { ok: false, message: `Telefone inválido ("${rawPhone}"). Use DDD + número (ex.: 81 99999-0000).` };
  }

  try {
    await db
      .insert(contacts)
      .values({ name, phoneE164, sector, role })
      .onConflictDoUpdate({
        target: contacts.phoneE164,
        set: { name, sector, role },
      });

    revalidatePath("/contatos");
    revalidatePath("/fila");
    return { ok: true, message: `Colaborador ${name} cadastrado com sucesso.` };
  } catch {
    return { ok: false, message: "Não foi possível gravar no banco de dados." };
  }
}

export async function importCsv(formData: FormData): Promise<ContactActionResult> {
  let rawText = String(formData.get("csvText") ?? "").trim();
  const file = formData.get("csvFile");
  if (!rawText && file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) {
      return { ok: false, message: "Arquivo CSV excede o limite de 2 MB." };
    }
    rawText = (await file.text()).trim();
  }

  if (!rawText) {
    return { ok: false, message: "Cole o conteúdo CSV ou selecione um arquivo .csv." };
  }

  const parsed = parseContactsCsv(rawText);
  if (parsed.ok.length === 0) {
    return {
      ok: false,
      message: "Nenhuma linha válida encontrada no CSV.",
      errors: parsed.errors,
    };
  }

  try {
    for (const row of parsed.ok) {
      await db
        .insert(contacts)
        .values({
          name: row.name,
          phoneE164: row.phone,
          sector: row.sector,
          role: row.role,
        })
        .onConflictDoUpdate({
          target: contacts.phoneE164,
          set: { name: row.name, sector: row.sector, role: row.role },
        });
    }

    revalidatePath("/contatos");
    revalidatePath("/fila");
    return {
      ok: true,
      message: `${parsed.ok.length} colaborador(es) importado(s)${
        parsed.errors.length > 0 ? ` (${parsed.errors.length} linha(s) ignorada(s) por erro)` : ""
      }.`,
      errors: parsed.errors,
    };
  } catch {
    return { ok: false, message: "Erro ao gravar os contatos importados no banco." };
  }
}

export async function sendQuestionnaire(contactIds: string[]): Promise<ContactActionResult> {
  if (!contactIds.length) {
    return { ok: false, message: "Selecione ao menos um colaborador na tabela." };
  }

  const failed: { id: string; message: string }[] = [];
  let sentCount = 0;

  for (const id of contactIds) {
    try {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
      if (!contact) {
        failed.push({ id, message: "Contato ainda está apenas na prévia sintética (clique em Gravar base sintética no banco primeiro)." });
        continue;
      }

      const { runId, outbound } = await startRun(contact.id);
      try {
        // WhatsApp primeiro; quem tem o Telegram ligado recebe pela reserva se o WhatsApp estiver fora.
        for (const msg of outbound) {
          await sendToPerson(contact.phoneE164, msg, { prefer: "last", runId });
        }
        sentCount++;
      } catch (err) {
        // Review Focus 5: Evolution fora do ar -> run volta para pending, erro legível
        await db
          .update(questionnaireRuns)
          .set({ status: "pending" })
          .where(eq(questionnaireRuns.id, runId));

        const errMsg =
          err instanceof EvolutionError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Falha ao enviar mensagem pelo WhatsApp.";
        failed.push({ id: contact.name, message: errMsg });
      }
    } catch (err) {
      failed.push({
        id,
        message: err instanceof Error ? err.message : "Erro ao iniciar questionário.",
      });
    }
  }

  revalidatePath("/contatos");
  revalidatePath("/fila");

  if (failed.length > 0 && sentCount === 0) {
    return {
      ok: false,
      message: `Não foi possível enviar via WhatsApp: ${failed[0]?.message}`,
      failed,
    };
  }

  return {
    ok: true,
    message: `Questionário disparado para ${sentCount} colaborador(es)${
      failed.length > 0 ? ` (${failed.length} falha(s) de envio)` : ""
    }.`,
    failed,
  };
}

export async function sendReminder(contactIds: string[]): Promise<ContactActionResult> {
  if (!contactIds.length) {
    return { ok: false, message: "Selecione ao menos um colaborador." };
  }

  const failed: { id: string; message: string }[] = [];
  let sentCount = 0;

  for (const id of contactIds) {
    try {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
      if (!contact) continue;

      const doctorName = process.env.DOCTOR_NAME || "Dra. Ana Lima";
      const reminderText = `Olá, ${contact.name.split(" ")[0]}. Lembrete do Consultório NR-7 (${doctorName}): quando puder, responda à última pergunta para concluir seu acompanhamento periódico. Você pode digitar PARAR a qualquer momento.`;
      await sendToPerson(contact.phoneE164, reminderText, { prefer: "last" });
      sentCount++;
    } catch (err) {
      failed.push({
        id,
        message: err instanceof Error ? err.message : "Falha ao enviar lembrete.",
      });
    }
  }

  revalidatePath("/contatos");
  if (failed.length > 0 && sentCount === 0) {
    return {
      ok: false,
      message: `Lembrete não enviado: ${failed[0]?.message}`,
      failed,
    };
  }

  return {
    ok: true,
    message: `Lembrete enviado para ${sentCount} colaborador(es).`,
    failed,
  };
}

export async function seedSyntheticContactsAction(): Promise<ContactActionResult> {
  try {
    const { seeded } = await seedDemoDatabaseIfEmpty();
    revalidatePath("/contatos");
    revalidatePath("/fila");
    return {
      ok: true,
      message:
        seeded > 0
          ? `${seeded} casos sintéticos gravados no banco Postgres para demonstração.`
          : "A base sintética já está gravada no banco de dados.",
    };
  } catch {
    return {
      ok: false,
      message: "Não foi possível gravar a base sintética no banco Postgres.",
    };
  }
}

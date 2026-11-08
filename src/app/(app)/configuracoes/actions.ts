"use server";

import { revalidatePath } from "next/cache";
import { settleEvents } from "@/lib/obs/events";
import { resetSettings, saveSettings, type Settings } from "@/lib/settings";

export type SaveState = { ok: boolean; message: string } | null;

const BOOLEANS = ["autoInvite", "inviteAll", "openEntry", "notifyParticipant", "autoDispatch"] as const;

/** Lê o formulário inteiro: caixa desmarcada não vem no FormData, então ausente = desligado. */
function fromForm(form: FormData): Partial<Settings> {
  const num = (k: string) => {
    const raw = String(form.get(k) ?? "").trim().replace(",", ".");
    return raw === "" ? Number.NaN : Number(raw);
  };
  const out: Partial<Settings> = {
    inviteThreshold: num("inviteThreshold"),
    idleMinutes: num("idleMinutes"),
    autoDispatchDays: num("autoDispatchDays"),
    doctorWhatsapp: String(form.get("doctorWhatsapp") ?? ""),
  };
  for (const k of BOOLEANS) out[k] = form.get(k) === "on";
  return out;
}

export async function saveConfig(_prev: SaveState, form: FormData): Promise<SaveState> {
  try {
    await saveSettings(fromForm(form));
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Não deu para salvar. Tente de novo." };
  }
  await settleEvents(); // a mudança aparece em "Últimas mudanças" já na volta
  revalidatePath("/", "layout");
  return { ok: true, message: "Salvo. Já vale para o próximo questionário e a próxima entrevista." };
}

export async function resetConfig(): Promise<SaveState> {
  await resetSettings();
  await settleEvents();
  revalidatePath("/", "layout");
  return { ok: true, message: "Tudo voltou ao padrão." };
}

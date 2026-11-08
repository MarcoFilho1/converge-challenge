/**
 * Configurações da médica: o que ela salva no painel vale mais que o .env, e vale na hora.
 * Sem nada salvo, cada opção cai no .env e, sem ele, no padrão do código.
 */
import { z } from "zod";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";
import { recordEvent } from "@/lib/obs/events";
import { toE164 } from "@/lib/whatsapp/phone";

export type Settings = {
  /** Limite do índice de bem-estar (0 a 100): abaixo dele, o colaborador é convidado para a entrevista. */
  inviteThreshold: number;
  /** Convite automático para a entrevista no fim do questionário. */
  autoInvite: boolean;
  /** Demonstração: oferece a entrevista a todos (menos urgência). */
  inviteAll: boolean;
  /** Quem mandar mensagem para o bot vira colaborador na hora. */
  openEntry: boolean;
  /** WhatsApp da médica para o aviso de fim de entrevista (vazio = só no painel). */
  doctorWhatsapp: string;
  /** Demonstração: quem fez a entrevista recebe no WhatsApp o aviso que iria para a médica. */
  notifyParticipant: boolean;
  /** Minutos sem fala até a entrevista parada ser encerrada com resumo. */
  idleMinutes: number;
  /** Disparo automático do questionário para os colaboradores cadastrados. */
  autoDispatch: boolean;
  /** De quantos em quantos dias o questionário é reenviado. */
  autoDispatchDays: number;
};

const bool = (v: string | undefined, fallback: boolean) => (v === undefined || v === "" ? fallback : v === "true");
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : fallback;
};

/** Padrões vindos do .env (ou do código). Lidos a cada chamada: mudar o .env em teste reflete na hora. */
export function envDefaults(env: Record<string, string | undefined> = process.env): Settings {
  return {
    inviteThreshold: num(env.INTERVIEW_INVITE_THRESHOLD, 70),
    autoInvite: env.INTERVIEW_AUTO_INVITE !== "false",
    inviteAll: bool(env.INTERVIEW_INVITE_ALL, false),
    openEntry: bool(env.OPEN_ENTRY, false),
    doctorWhatsapp: env.DOCTOR_WHATSAPP ?? "",
    notifyParticipant: bool(env.DEMO_NOTIFY_PARTICIPANT, false),
    idleMinutes: Math.max(1, num(env.INTERVIEW_IDLE_MIN, 10)),
    autoDispatch: bool(env.AUTO_DISPATCH, false),
    autoDispatchDays: num(env.AUTO_DISPATCH_DAYS, 30),
  };
}

const SettingsPatch = z
  .object({
    inviteThreshold: z.number({ message: "O limite precisa ser um número de 0 a 100." }).finite("O limite precisa ser um número de 0 a 100.").min(0, "O limite precisa ser um número de 0 a 100.").max(100, "O limite precisa ser um número de 0 a 100."),
    autoInvite: z.boolean(),
    inviteAll: z.boolean(),
    openEntry: z.boolean(),
    doctorWhatsapp: z.string().refine((v) => v.trim() === "" || toE164(v) !== null, "Telefone da médica inválido: use DDD e número, por exemplo (81) 99999-0001."),
    notifyParticipant: z.boolean(),
    idleMinutes: z.number().int("Os minutos precisam ser um número inteiro de 1 a 120.").min(1, "Os minutos precisam ser de 1 a 120.").max(120, "Os minutos precisam ser de 1 a 120."),
    autoDispatch: z.boolean(),
    autoDispatchDays: z.number().int("Os dias precisam ser um número inteiro de 1 a 365.").min(1, "Os dias precisam ser de 1 a 365.").max(365, "Os dias precisam ser de 1 a 365."),
  })
  .partial();

export type SettingsPatch = z.infer<typeof SettingsPatch>;

const LABELS: Record<keyof Settings, string> = {
  inviteThreshold: "limite do índice",
  autoInvite: "convite automático",
  inviteAll: "entrevista para todos (demo)",
  openEntry: "entrada aberta",
  doctorWhatsapp: "WhatsApp da médica",
  notifyParticipant: "aviso também ao participante (demo)",
  idleMinutes: "minutos até encerrar entrevista parada",
  autoDispatch: "disparo automático",
  autoDispatchDays: "dias entre disparos",
};
const show = (v: unknown) => (typeof v === "boolean" ? (v ? "ligado" : "desligado") : v === "" ? "vazio" : String(v));

let cache: { at: number; saved: Partial<Settings> } | null = null;
const CACHE_MS = 10_000;

/** Só para testes e depois de salvar. */
export function resetSettingsCache() {
  cache = null;
}

async function savedSettings(): Promise<Partial<Settings>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.saved;
  let saved: Partial<Settings> = {};
  try {
    const rows = await db.select().from(appSettings);
    saved = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
  } catch {
    saved = {}; // banco sem a tabela ainda: vale o .env
  }
  cache = { at: Date.now(), saved };
  return saved;
}

export async function getSettings(): Promise<Settings> {
  return { ...envDefaults(), ...(await savedSettings()) };
}

/** Valida, grava e registra no rastro o que mudou (antigo → novo). Lança com mensagem legível se inválido. */
export async function saveSettings(patch: SettingsPatch): Promise<Settings> {
  const parsed = SettingsPatch.safeParse(patch);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
  const data = { ...parsed.data };
  if (data.doctorWhatsapp !== undefined) data.doctorWhatsapp = data.doctorWhatsapp.trim() === "" ? "" : toE164(data.doctorWhatsapp)!;
  const before = await getSettings();
  const changes: string[] = [];
  for (const [key, value] of Object.entries(data) as [keyof Settings, Settings[keyof Settings]][]) {
    if (before[key] === value) continue;
    changes.push(`${LABELS[key]}: ${show(before[key])} → ${show(value)}`);
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  }
  resetSettingsCache();
  if (changes.length) recordEvent({ kind: "configuração", outcome: "ok", model: "médica no painel", detail: changes.join("; ") });
  return getSettings();
}

/** Volta tudo ao padrão (.env ou código). */
export async function resetSettings(): Promise<void> {
  await db.delete(appSettings);
  resetSettingsCache();
  recordEvent({ kind: "configuração", outcome: "ok", model: "médica no painel", detail: "voltou tudo ao padrão" });
}

/**
 * CONTRATO da entrevista por voz (MVP2). Consumido pelas telas
 * /entrevista/[token] (colaborador) e /caso/[runId] aba "Entrevista" (médico).
 * Dono: motor/voz (feature/m7-entrevista-voz). Mudou → contract_publish no hackhub.
 * Versão 4 · 2026-11-08 01h (v3 + InterviewSummary.avisos; segurança ambígua pergunta de novo em vez de virar crise).
 */
import { z } from "zod";

// ---------- vocabulário ----------
export const InterviewStatus = z.enum(["consent", "running", "crisis", "done", "stopped"]);
export type InterviewStatus = z.infer<typeof InterviewStatus>;

export const BlockId = z.enum(["abertura", "saude", "trabalho", "barreiras", "seguranca", "fechamento"]);
export type BlockId = z.infer<typeof BlockId>;

/** Rótulo que a tela mostra para cada bloco. */
export const BLOCK_LABELS: Record<BlockId, string> = {
  abertura: "Começando",
  saude: "Sobre o que você sente",
  trabalho: "Sobre o trabalho",
  barreiras: "Sobre buscar ajuda",
  seguranca: "Uma pergunta importante",
  fechamento: "Encerrando",
};

export const BlockInfo = z.object({
  id: BlockId,
  label: z.string(),
  /** posição 1-based na pauta desta pessoa e total de blocos */
  index: z.number().int(),
  total: z.number().int(),
});
export type BlockInfo = z.infer<typeof BlockInfo>;

/** De onde saiu o áudio da fala: cache em disco, TTS ao vivo, ou nenhum (tela usa speechSynthesis). */
export const VoiceSource = z.enum(["cache", "live", "browser"]);

// ---------- colaborador: GET /api/entrevista/[token] ----------
export const InterviewView = z.object({
  id: z.string().uuid(),
  status: InterviewStatus,
  interviewer: z.object({ name: z.string(), avatarUrl: z.string() }), // ex.: "Helena", "/entrevistadora.png"
  doctorName: z.string(), // ex.: "Dra. Ana Lima"
  estimatedMinutes: z.number().int(), // 10
  block: BlockInfo.nullable(), // null em consent
  /** Última fala da IA (para recarregar a página sem perder o fio). null em consent. */
  currentUtterance: z
    .object({ text: z.string(), audioUrl: z.string().nullable(), voice: VoiceSource })
    .nullable(),
  turnsCount: z.number().int(),
  elapsedMs: z.number().int(),
});
export type InterviewView = z.infer<typeof InterviewView>;

// ---------- colaborador: resposta de start / turno / skip / stop ----------
export const TurnResponse = z.object({
  status: InterviewStatus,
  /** o que a IA entendeu da fala da pessoa (transcrição). null em start/skip/stop. */
  heard: z.string().nullable(),
  /** o que a IA diz agora (legenda). Sempre presente. */
  say: z.string(),
  /** áudio da fala. null → tela fala `say` com speechSynthesis (pt-BR). */
  audioUrl: z.string().nullable(),
  voice: VoiceSource,
  block: BlockInfo,
  /** índice do turno da IA que acabou de ser gerado (0 = abertura) */
  turnIndex: z.number().int(),
  elapsedMs: z.number().int(),
  /** true quando não há mais o que ouvir: tela mostra estado final e NÃO abre o microfone. */
  final: z.boolean(),
  /** só quando status = crisis: a tela mostra o cartão de ajuda com estes contatos. */
  crisis: z.object({ cvv: z.literal("188"), samu: z.literal("192"), doctorNotified: z.boolean() }).optional(),
});
export type TurnResponse = z.infer<typeof TurnResponse>;

/**
 * Endpoints do colaborador (sem login; o token é a credencial):
 *  GET  /api/entrevista/[token]                 → InterviewView            (404 {error:"token_invalido"})
 *  POST /api/entrevista/[token]/start  {consent:boolean}
 *        consent=true  → TurnResponse (abertura, status running)
 *        consent=false → TurnResponse (status stopped, final true)
 *  POST /api/entrevista/[token]/turno  multipart/form-data
 *        campo `audio` (webm/opus, mp4/aac ou wav; ≤ 60 s) OU campo `text` (modo texto, para teste)
 *        campo opcional `clientMs` (duração da gravação)
 *        → TurnResponse                                                   (409 {error:"estado_invalido"} fora de running)
 *  POST /api/entrevista/[token]/skip             → TurnResponse (pula a pergunta atual)
 *  POST /api/entrevista/[token]/stop             → TurnResponse (fechamento; status stopped; final true)
 *  GET  /api/entrevista/[token]/fala/[turnIdx]   → audio/wav da fala da IA (é o `audioUrl` do TurnResponse)      (404 {error:"sem_audio"})
 *  Erros: 404 token_invalido · 409 estado_invalido · 400 audio_invalido · 413 audio_grande (> 5 MB)
 *         503 stt_indisponivel: a transcrição falhou; NENHUM turno foi gravado. A tela mostra "não consegui ouvir" e oferece
 *         o modo texto (mesma rota, campo `text`). Não reenviar o áudio em loop.
 * Regras para a tela: microfone fechado enquanto o áudio toca; abre quando o áudio termina;
 * fecha o turno após 900 ms de silêncio depois de ter detectado voz, ou no botão "pronto"; máximo 60 s.
 * Durante o fetch do turno a tela mostra "pensando". Alvo de resposta: ≤ 4 s; timeout sugerido 25 s.
 */

// ---------- médico ----------
export const Origin = z.object({
  /** índice do turno da PESSOA em `turns` (clicável: rola até ele) */
  turnIdx: z.number().int(),
  /** rótulo pronto, ex.: "turno 3 · 01:12" */
  label: z.string(),
});
const Cited = z.object({ texto: z.string(), origem: z.array(Origin).min(1) });

export const InterviewSummary = z.object({
  dificuldades_relatadas: z.array(Cited.extend({ duracao: z.string().nullable() })),
  impacto_no_trabalho: z.array(Cited),
  fatores_do_trabalho: z.array(Cited),
  barreiras_atendimento: z.array(Cited),
  sinais_de_alerta: z.object({ risco: z.boolean(), origem: z.array(Origin) }),
  pontos_para_avaliacao: z.array(Cited),
  nao_respondido: z.array(z.string()), // ex.: ["tratamento atual", "bloco barreiras (pulado)"]
  /**
   * Avisos para o médico, montados em código (nunca pelo LLM): pergunta que a pessoa não quis responder
   * depois de ouvi-la de dois jeitos, pulou, ou ficou em silêncio; e pergunta de segurança sem resposta clara.
   * A tela mostra em destaque (acima do resumo). origem pode ser vazia (pulo ou silêncio).
   */
  avisos: z.array(z.object({ texto: z.string(), origem: z.array(Origin) })).default([]),
  duracao_min: z.number(),
  turnos: z.number().int(),
});
export type InterviewSummary = z.infer<typeof InterviewSummary>;

export const InterviewTurn = z.object({
  idx: z.number().int(),
  speaker: z.enum(["ai", "person"]),
  text: z.string(),
  blockId: BlockId,
  startedMs: z.number().int(), // desde o início da entrevista
  durationMs: z.number().int().nullable(),
  /** só para speaker=person e só com cookie do médico: /api/medico/entrevista/[id]/audio/[idx] */
  audioUrl: z.string().nullable(),
});
export type InterviewTurn = z.infer<typeof InterviewTurn>;

export const InterviewDetail = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid().nullable(),
  contact: z.object({ name: z.string(), sector: z.string().nullable() }).nullable(),
  /** gravidade do questionário ligado (none|attention|priority|urgency) */
  severity: z.enum(["none", "attention", "priority", "urgency"]).nullable(),
  status: InterviewStatus,
  mode: z.enum(["live", "cache_only"]),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nullable(),
  blocks: z.array(z.object({ id: BlockId, label: z.string(), required: z.boolean() })),
  turns: z.array(InterviewTurn),
  summary: InterviewSummary.nullable(), // null enquanto running
});
export type InterviewDetail = z.infer<typeof InterviewDetail>;

export const InterviewListItem = z.object({
  id: z.string().uuid(),
  status: InterviewStatus,
  startedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nullable(),
  hasSummary: z.boolean(),
  inviteUrl: z.string(), // link para o colaborador (mostrar/copiar/QR)
});
export type InterviewListItem = z.infer<typeof InterviewListItem>;

/**
 * Endpoints do médico (cookie `session=ok`, o mesmo da T11):
 *  GET  /api/medico/caso/[runId]/entrevistas       → InterviewListItem[]   (aba "Entrevista" do Caso)
 *  POST /api/medico/entrevista  {runId}             → InterviewListItem     (botão "Convidar para entrevista")
 *  GET  /api/medico/entrevista/[id]                 → InterviewDetail
 *  GET  /api/medico/entrevista/[id]/audio/[idx]     → audio/wav
 * Páginas: a aba vive em /caso/[runId] (tela do Antigravity #2). Eu não crio página do médico.
 */

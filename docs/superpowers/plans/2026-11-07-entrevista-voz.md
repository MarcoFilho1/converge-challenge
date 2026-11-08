# Entrevista por voz (MVP2) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motor de entrevista em código (pauta, sondas, crise, resumo com origem), voz local pelo Voicebox e as rotas de API do contrato, para a tela de chamada e a aba do médico que o Antigravity #2 constrói.

**Architecture:** `src/lib/interview` é puro (sem I/O): `buildAgenda` monta a pauta a partir dos escores; `step` recebe um evento (start, fala, pular, parar) e devolve o novo estado e a fala da IA; a IA entra por `getInterviewAi()` (mock ou gateway) só para extrair achados, redigir 1 frase de acolhimento e montar o resumo. `src/lib/interview/service.ts` liga motor, banco e voz (`src/lib/voice`) e é chamado pelas rotas `/api/entrevista/*` e `/api/medico/*`. Cada turno é uma requisição HTTP.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), TypeScript, Drizzle + postgres-js, Vercel AI SDK (`ai` v7, `generateText` + `Output.object`), zod v4, Vitest, Voicebox REST (`/generate`, `/transcribe`), `ffmpeg` por `child_process`.

**Spec:** `docs/superpowers/specs/2026-11-07-entrevista-voz-design.md` (contrato em `src/lib/interview/contract.ts`).

## Global Constraints

- Branch `feature/m7-entrevista-voz`, worktree `~/Desktop/things/consultorio-nr7-entrevista`. Commits pequenos, sem linha de atribuição de IA. PR para `develop` no fim.
- Não editar: `src/lib/ai/{types,mock,gateway,index,prompts}.ts`, `src/lib/engine/*`, `src/db/schema.ts`, telas em `src/app/**/page.tsx`, `src/middleware.ts`. Exceções de uma linha: `drizzle.config.ts` (lista de schemas) e `tests/helpers/db.ts` (TRUNCATE).
- Crise em código (`detectCrisis` de `src/lib/crisis/detect.ts`) roda **antes** de qualquer chamada de IA em toda fala recebida.
- O texto de uma sonda nunca é alterado pelo LLM. Toda fala gerada passa por `assertNoForbidden` + `hasAdvice`; se bater, a parte gerada é descartada.
- Resumo: entrada sem `origem` ou com `turnIdx` inexistente é descartada em código.
- Termos proibidos (lista existente): "você tem", "você está com", "diagnóstico", "burnout", "depressão", "transtorno", "doença mental".
- Padrões de conselho (novos, `src/lib/interview/filters.ts`): `você deveria`, `você devia`, `procure`, `tente`, `é importante que você`, `recomendo`, `sugiro`, `o ideal é`, `faça`.
- `severity === 'urgency'` no questionário → não entrevista: `start` devolve `status:'crisis'`, `final:true`.
- Teto: 12 turnos da pessoa ou 15 min → só fechamento. Silêncio/VAD são da tela; o servidor aceita áudio de até 60 s.
- Dados sintéticos apenas. Áudio da pessoa em `data/entrevistas/<id>/<idx>.wav`, nunca em `public/`.
- Variáveis novas (`.env.example`): `VOICEBOX_URL=http://127.0.0.1:17493`, `VOICEBOX_PROFILE_ID=`, `VOICEBOX_LANGUAGE=pt`, `VOICE_PROVIDER=voicebox|none`, `INTERVIEW_MODE=live|cache_only`, `INTERVIEWER_NAME=Helena`, `INTERVIEW_PUBLIC_URL=http://localhost:3100`.

## Review Focus

1. Pessoa fala algo vazio ou só ruído (transcrição `""` ou < 2 caracteres) → a IA repete a mesma sonda uma vez ("Não consegui ouvir bem. {sonda}"); na segunda vez segue adiante registrando `nao_respondido`. Teste em Task 4.
2. "Sim" curto depois da pergunta de segurança → crise, mesmo sem padrão de risco no texto. Teste em Task 4.
3. Áudio em mp4/aac (Safari iOS) e webm/opus (Chrome) → ambos convertidos para wav 16 kHz mono antes do STT; ffmpeg ausente ou falha → 503 `{error:"audio_invalido"}` sem gravar turno. Teste em Task 8.
4. Voicebox fora do ar no meio da entrevista → turno continua com `audioUrl:null, voice:"browser"`; nada quebra. Teste em Task 9.
5. Duas requisições de turno simultâneas para o mesmo token → a segunda recebe 409 `estado_invalido` (lock otimista por `turnsCount`). Teste em Task 10.

---

### Task 1: Protocolo v0 e tipos do motor

**Files:**
- Create: `src/lib/interview/types.ts`, `src/lib/interview/protocol.ts`, `src/lib/interview/filters.ts`, `src/lib/interview/origin.ts`
- Test: `tests/interview/protocol.test.ts`, `tests/interview/filters.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type ProbeCondition = 'semDuracao' | 'semFrequencia' | 'naoProcurou' | 'mencionouTrabalho' | 'mencionouChefia' | 'sempre'`
  - `type Probe = { id: string; text: string; when: ProbeCondition; covers: FindingTheme }`
  - `type FindingTheme = 'sintoma' | 'duracao' | 'frequencia' | 'gatilho' | 'alivio' | 'procurou' | 'tratamento' | 'carga' | 'chefia' | 'pausa' | 'mudanca' | 'necessidade' | 'barreira' | 'seguranca' | 'outro'`
  - `type Block = { id: BlockId; label: string; base: string; probes: Probe[]; maxTurns: number; required: boolean }` (`BlockId` e `BLOCK_LABELS` vêm de `contract.ts`)
  - `type Finding = { tema: FindingTheme; texto: string; duracao: string | null; intensidade: 'leve'|'moderada'|'forte'|null; mencionaTrabalho: boolean; pediuParar: boolean; turnIdx: number; blockId: BlockId }`
  - `type Turn = { idx: number; speaker: 'ai'|'person'; text: string; blockId: BlockId; probeId: string | null; startedMs: number; durationMs: number | null }`
  - `type InterviewInput = { runId: string|null; severity: 'none'|'attention'|'priority'|'urgency'; flags: { trabalhouDoente: boolean; prejuizoTrabalho: number|null; exaustao: boolean; humor: boolean; ansiedade: boolean; assedio: boolean; ritmoAlto: boolean }; abertas: { OPEN_1?: string; OPEN_2?: string }; doctorName: string }`
- Produces (`protocol.ts`): `PROTOCOL_VERSION = 'v0-nao-assinado'`, `BLOCKS: Record<BlockId, Block>` com os textos exatos da spec §5.7 (abertura e fechamento com `{medico}` e `{prazo}`), `renderText(text, vars: {medico: string; prazo: string}): string`, `CRISIS_SPEECH(medico): string` (versão falada do roteiro: CVV 188, SAMU 192, "vou avisar {medico} agora"), `REPEAT_PREFIX = 'Não consegui ouvir bem. '`, `DEFAULT_PRAZO = 'uma semana'`.
- Produces (`origin.ts`): `formatOrigin(turn: Turn): string` → `turno ${idx} · mm:ss` a partir de `startedMs` (ex.: `{idx:3, startedMs:72000}` → `'turno 3 · 01:12'`).
- Produces (`filters.ts`): `ADVICE_PATTERNS: RegExp[]`, `hasAdvice(text): boolean`, `cleanGenerated(text): string` (devolve `''` se `assertNoForbidden(text).length > 0 || hasAdvice(text)`, senão o texto aparado).

- [ ] **Step 1: Testes** — `protocol.test.ts`: (a) os 6 blocos existem e `seguranca.probes` é vazio; (b) `saude.probes` tem ids `desdeQuando, frequencia, piora, alivia, procurou, tratamento`; `trabalho` tem `quandoMudou, carga, pausa, chefia, oQueFaltaria`; `barreiras` tem `horarioGarantido, pertoOuOnline, medoEmpresa`; (c) nenhum texto de bloco/sonda/crise contém termo proibido nem conselho; (d) `renderText(BLOCKS.abertura.base, {medico:'Dra. Ana', prazo:'uma semana'})` contém "Dra. Ana" e não contém "{". `filters.test.ts`: `hasAdvice('Você deveria descansar')` true; `hasAdvice('Procure um médico')` true; `hasAdvice('Entendi, você falou do fechamento do mês.')` false; `cleanGenerated('Você tem sinais de burnout')` === `''`; `formatOrigin({idx:3, startedMs:72000, ...})` === `'turno 3 · 01:12'`.
- [ ] **Step 2: Rodar** `pnpm vitest run tests/interview` → FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** os três arquivos conforme Interfaces. `maxTurns`: abertura 1, saude 4, trabalho 4, barreiras 3, seguranca 1, fechamento 1.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(entrevista): protocolo v0, tipos e filtros de linguagem`.

### Task 2: Pauta a partir do questionário

**Files:**
- Create: `src/lib/interview/agenda.ts`, `src/lib/interview/adapters/questionnaire.ts`, `src/lib/interview/fixtures.ts`
- Test: `tests/interview/agenda.test.ts`

**Interfaces:**
- Consumes: `Score`, `Answers` de `@/lib/instruments/types`; `BLOCKS` da Task 1.
- Produces:
  - `type Agenda = { blocks: { id: BlockId; required: boolean; maxProbes: number }[]; skipInterview: boolean }`
  - `buildAgenda(input: InterviewInput): Agenda` — regras da spec §5.2: ordem fixa `abertura → [obrigatórios na ordem saude, trabalho, barreiras] → [confirmações] → seguranca → fechamento`; obrigatório: `maxProbes 3`; confirmação: `maxProbes 1`; `skipInterview = severity === 'urgency'`.
  - `flagsFromRun(answers: Answers, scores: Score[]): InterviewInput['flags']` — `trabalhouDoente = answers.TRUNK === TRUNK_YES`; `prejuizoTrabalho = answers.WPAI_Q5 ?? null`; `exaustao = flagged('BAT12','total') || flagged('BAT','item1')`; `humor = flagged('PHQ9','total') || flagged('PHQ2','total')`; `ansiedade = flagged('GAD7','total') || flagged('GAD2','total')`; `assedio = flagged('COPSOQ','assedio')`; `ritmoAlto = flagged('COPSOQ','ritmo')`.
  - `fromQuestionnaireRun(run: QuestionnaireRun, answers: Answers, scores: Score[], doctorName: string): InterviewInput` (lê `OPEN_1/OPEN_2` de `getAnswerRows` já feito pelo chamador: assinatura recebe `openTexts: {OPEN_1?: string; OPEN_2?: string}` como 4º parâmetro).
  - `FIXTURES: Record<'semIndicio'|'atencao'|'prioridade', InterviewInput>` (`prioridade`: trabalhouDoente, prejuizo 7, exaustao, humor, ritmoAlto; `atencao`: trabalhouDoente, prejuizo 4; `semIndicio`: tudo falso).
- [ ] **Step 1: Testes** — `prioridade` → blocos `[abertura, saude, trabalho, barreiras, seguranca, fechamento]`, saude/trabalho/barreiras `required:true`; `atencao` → trabalho obrigatório (prejuizo ≥ 3), saude obrigatório (trabalhouDoente), barreiras obrigatório; `semIndicio` → saude/trabalho/barreiras `required:false, maxProbes:1`; `severity:'urgency'` → `skipInterview:true`; `flagsFromRun` com `scores=[{instrument:'COPSOQ',dimension:'ritmo',flagged:true,...}]` → `ritmoAlto:true`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(entrevista): pauta a partir dos escores do questionário`.

### Task 3: IA da entrevista (interfaces, mock, filtros)

**Files:**
- Create: `src/lib/ai/interview.ts`, `src/lib/ai/interview-mock.ts`
- Test: `tests/ai/interview-mock.test.ts`

**Interfaces:**
- Produces (`src/lib/ai/interview.ts`):
  - `FindingDraftSchema = z.object({ tema: z.enum([...FindingTheme]), texto: z.string(), duracao: z.string().nullable(), intensidade: z.enum(['leve','moderada','forte']).nullable(), mencionaTrabalho: z.boolean(), pediuParar: z.boolean() })`; `type FindingDraft`.
  - `interface InterviewAi { extractFindings(input: { blockId: BlockId; probeText: string; text: string }): Promise<FindingDraft[]>; phraseAck(input: { lastText: string; findings: FindingDraft[]; probeText: string }): Promise<string>; summarize(input: { turns: Turn[]; findings: Finding[]; agenda: Agenda; skipped: BlockId[] }): Promise<InterviewSummary> }`
  - `getInterviewAi(): InterviewAi` — `AI_PROVIDER === 'gateway'` → `createInterviewGateway()` (Task 6; até lá importa o mock), senão `createInterviewMock()`.
- Produces (`interview-mock.ts`): `createInterviewMock(): InterviewAi` — `extractFindings`: regex de duração (`há \d+ (dias|semanas|meses|anos)`, `desde \w+`, `faz \d+`), palavras-chave por tema (ex.: `chefe|gerente|supervisor` → chefia; `hora extra|até tarde|meta|prazo|fechamento` → carga; `parar|encerrar|chega|não quero mais falar` → `pediuParar`), tema padrão `sintoma` em saude, `carga` em trabalho, `barreira` em barreiras, `outro` fora; texto = fala aparada em 160 caracteres. `phraseAck`: `'Entendi.'` quando há achado, `'Certo.'` quando não; `summarize`: monta o `InterviewSummary` direto dos `findings` (sintoma/duracao → `dificuldades_relatadas`; carga/pausa/chefia/mudanca/necessidade → `fatores_do_trabalho`; barreira → `barreiras_atendimento`; `mencionaTrabalho` em saude → `impacto_no_trabalho`), `origem = [{turnIdx, label: formatOrigin(turn)}]` usando `formatOrigin` da Task 5, `nao_respondido` = rótulos dos blocos em `skipped`.
- [ ] **Step 1: Testes** — `extractFindings({blockId:'saude', probeText, text:'Cansaço todo dia, há uns três meses'})` → 1 achado `tema:'sintoma', duracao:'há uns três meses'`; `'meu chefe cobra meta até tarde'` em trabalho → tema `chefia`, `mencionaTrabalho:true`; `'quero parar'` → `pediuParar:true`; `phraseAck` devolve string sem termo proibido e `hasAdvice` false; `summarize` com 2 findings → cada entrada com `origem.length >= 1`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(entrevista): camada de IA da entrevista em modo mock`.

### Task 4: Motor de turnos

**Files:**
- Create: `src/lib/interview/engine.ts`, `src/lib/interview/select.ts`
- Test: `tests/interview/engine.test.ts`

**Interfaces:**
- Consumes: `detectCrisis` (`@/lib/crisis/detect`), `BLOCKS`, `renderText`, `CRISIS_SPEECH`, `REPEAT_PREFIX`, `cleanGenerated`, `buildAgenda`, `InterviewAi`.
- Produces:
  - `type InterviewState = { agenda: Agenda; blockIndex: number; probesAsked: string[]; turns: Turn[]; findings: Finding[]; status: InterviewStatus; startedMs: number; endedMs: number | null; mode: 'live'|'cache_only'; repeatCount: number; skipped: BlockId[]; vars: { medico: string; prazo: string } }`
  - `type InterviewEvent = { kind:'start'; consent: boolean } | { kind:'speech'; text: string; durationMs: number|null } | { kind:'skip' } | { kind:'stop' }`
  - `type Utterance = { text: string; probeId: string | null; blockId: BlockId; cacheKey: string | null; final: boolean; crisis: boolean }`
  - `createState(input: InterviewInput, opts: { mode: 'live'|'cache_only'; nowMs: number }): InterviewState`
  - `step(state, event, ai: InterviewAi, nowMs: number): Promise<{ state: InterviewState; say: Utterance }>` — ordem fixa: (1) `stop`/consent false → fechamento, `stopped`; (2) `speech`: `detectCrisis` → `crisis`; se bloco atual é `seguranca` e texto normalizado bate `/^(sim|tive|ja tive|as vezes|um pouco)\b/` → `crisis`; (3) texto vazio/curto → `REPEAT_PREFIX + sonda atual` uma vez (`repeatCount`), depois segue com `skipped` do tema; (4) `ai.extractFindings` → findings com `turnIdx`; (5) `selectNext(state)` (`select.ts`): `pediuParar` → fechamento; dentro do bloco: primeira sonda não feita cuja `when` está ativa (`semDuracao` = nenhum achado do bloco com `duracao`; `naoProcurou` = nenhum achado `procurou`; `mencionouTrabalho`/`mencionouChefia` = há achado com a flag/tema; `sempre`), respeitando `maxProbes` do bloco na pauta e `maxTurns`; senão próximo bloco (sua `base`); (6) teto: ≥ 12 turnos da pessoa ou `nowMs - startedMs ≥ 15 min` → fechamento; (7) `ack = mode === 'live' ? cleanGenerated(await ai.phraseAck(...)) : ''`; `text = [ack, probeText].filter(Boolean).join(' ')`; `cacheKey = ack ? null : \`${blockId}:${probeId ?? 'base'}\``. `skip` → marca a sonda atual como feita e segue como em (5) sem extração.
  - `isFinal(status)`: `crisis|done|stopped`.
- [ ] **Step 1: Testes** (todos com `createInterviewMock()`): (a) `start consent:true` com `FIXTURES.prioridade` → fala da abertura contém "Helena"? Não: a abertura é um texto fixo com `{medico}`; verificar que contém `vars.medico` e `status:'running'`; (b) `start` com `severity:'urgency'` → `status:'crisis'`, `final:true`; (c) `speech 'quero me matar'` → `status:'crisis'`, texto contém "188"; (d) no bloco seguranca, `speech 'sim'` → crisis; (e) `speech ''` → texto começa com `REPEAT_PREFIX`, segunda vez segue; (f) entrevista inteira por texto com `prioridade` (respostas fixas por bloco) termina em `done` com ≤ 12 turnos da pessoa e ≥ 3 findings; (g) `speech 'quero parar'` → fechamento, `stopped`; (h) `mode:'cache_only'` → toda `say.cacheKey !== null`; (i) 13 falas seguidas → fechamento antes da 13ª.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(entrevista): motor de turnos com pauta, sondas, crise e teto`.

### Task 5: Resumo com origem

**Files:**
- Create: `src/lib/interview/summary.ts`
- Test: `tests/interview/summary.test.ts`

**Interfaces:**
- Consumes: `formatOrigin` (Task 1).
- Produces: `validateSummary(raw: unknown, turns: Turn[]): InterviewSummary` — `InterviewSummary.parse`, descarta entradas com `origem` vazia ou `turnIdx` que não é turno de `person`, aplica `assertNoForbidden` (descarta a entrada) e recalcula `duracao_min`/`turnos`; `buildSummary(state: InterviewState, ai: InterviewAi): Promise<InterviewSummary>` = `validateSummary(await ai.summarize(...), state.turns)`.
- [ ] **Step 1: Testes** — entrada com `origem: []` é removida; `turnIdx: 99` é removida; texto com "burnout" é removido; `buildSummary` sobre o estado final do teste (f) da Task 4 produz ≥ 3 entradas, todas com origem válida.
- [ ] **Step 2–4; Step 5: Commit** — `feat(entrevista): resumo com origem validada em código`.

### Task 6: Provedor gateway da entrevista

**Files:**
- Create: `src/lib/ai/interview-gateway.ts`, `src/lib/ai/interview-prompts.ts`
- Modify: `src/lib/ai/interview.ts` (trocar import do mock pelo gateway em `getInterviewAi`)
- Test: `tests/ai/interview-gateway.test.ts`

**Interfaces:**
- Produces: `createInterviewGateway(): InterviewAi` com `generateText` + `Output.object` (mesmo padrão de `src/lib/ai/gateway.ts`, modelo `process.env.AI_CHAT_MODEL`, `temperature: 0`): `extractFindings` → `z.array(FindingDraftSchema)`; `phraseAck` → `z.object({ ack: z.string().max(140) })` e passa por `cleanGenerated`; `summarize` → `InterviewSummary` (validação fica no `buildSummary`). Em qualquer erro de rede/modelo, cai no mock para aquela chamada (log `console.warn('[entrevista] gateway falhou, usando mock')`).
- Prompts (`interview-prompts.ts`): `EXTRACT_SYSTEM` (extrair só o que foi dito; `LANGUAGE_RULES` de `src/lib/ai/prompts.ts`), `ACK_SYSTEM` ("uma frase, no máximo 15 palavras, refletindo o que a pessoa disse, sem avaliar, sem aconselhar, sem perguntar; não repita a pergunta"), `INTERVIEW_SUMMARY_SYSTEM` (esquema, origem obrigatória com `turnIdx` dos turnos da pessoa).
- [ ] **Step 1: Teste** — sem chave (`AI_GATEWAY_API_KEY` vazio), `createInterviewGateway().phraseAck(...)` resolve com string (fallback mock) e não lança; `getInterviewAi()` devolve o mock quando `AI_PROVIDER=mock`.
- [ ] **Step 2–4; Step 5: Commit** — `feat(entrevista): provedor gateway com fallback para mock`.

### Task 7: Tabelas e repositório

**Files:**
- Create: `src/db/schema-interview.ts`, `src/lib/interview/repo.ts`
- Modify: `drizzle.config.ts` (`schema: ["./src/db/schema.ts", "./src/db/schema-interview.ts"]`), `tests/helpers/db.ts` (acrescentar `interview_summaries, interview_turns, interviews` ao TRUNCATE), `.env.example` (variáveis novas)
- Test: `tests/interview/repo.test.ts`

**Interfaces:**
- Produces (`schema-interview.ts`): `interviewStatus = pgEnum('interview_status', ['consent','running','crisis','done','stopped'])`; `interviews` (id uuid pk, runId uuid nullable → `questionnaireRuns.id` on delete set null, token text unique, status, mode text, agenda jsonb, state jsonb, interviewerProfile text, startedAt, endedAt, createdAt); `interviewTurns` (id, interviewId fk cascade, idx int, speaker text, text, blockId text, probeId text nullable, audioPath text nullable, startedMs int, durationMs int nullable, createdAt; unique (interviewId, idx)); `interviewSummaries` (interviewId pk fk, json jsonb, createdAt).
- Produces (`repo.ts`): `createInterview(v: { runId: string|null; token: string; state: InterviewState; profile: string|null })`, `getInterviewByToken(token)`, `getInterview(id)`, `saveState(id, state, expectedTurns: number): Promise<boolean>` (UPDATE ... WHERE jsonb_array_length(state->'turns') = expectedTurns; false = conflito), `insertTurn(interviewId, turn: Turn & { audioPath?: string|null })`, `listTurns(interviewId)`, `saveSummary(interviewId, summary)`, `getSummary(interviewId)`, `listByRun(runId)`, `markRunUrgency(runId)` (UPDATE `questionnaire_runs` SET severity='urgency').
- [ ] **Step 1: Testes** — cria entrevista com token, lê por token, `saveState` com `expectedTurns` errado devolve false, `insertTurn` duplicado (mesmo idx) lança, `markRunUrgency` muda a gravidade de um run criado no teste.
- [ ] **Step 2–4** (`pnpm db:push` no banco de teste via `pushSchemaToTestDb`). **Step 5: Commit** — `feat(entrevista): tabelas e repositório da entrevista`.

### Task 8: Voz — cliente Voicebox, conversão e cache

**Files:**
- Create: `src/lib/voice/types.ts`, `src/lib/voice/voicebox.ts`, `src/lib/voice/none.ts`, `src/lib/voice/convert.ts`, `src/lib/voice/cache.ts`, `src/lib/voice/index.ts`
- Test: `tests/voice/voicebox.test.ts`, `tests/voice/convert.test.ts`, `tests/voice/cache.test.ts`

**Interfaces:**
- Produces (`types.ts`): `interface VoiceProvider { tts(text: string): Promise<{ audio: Buffer; mime: 'audio/wav' } | null>; stt(audio: Buffer, mime: string): Promise<{ text: string; ms: number }>; health(): Promise<boolean> }`; `class VoiceUnavailable extends Error`.
- `voicebox.ts`: `createVoicebox(opts: { url: string; profileId: string; language: string; fetchImpl?: typeof fetch }): VoiceProvider` — `tts` → `POST {url}/generate` `{text, profile_id, language}`, timeout 20 s, devolve wav; `stt` → `POST {url}/transcribe` multipart `audio` (wav) + `model=whisper-turbo`, timeout 15 s, devolve `{text}`; erros → `VoiceUnavailable`. **Antes de codar, conferir o formato real das respostas em `http://127.0.0.1:17493/docs` (Task 13 instala o Voicebox); se diferir, ajustar aqui e anotar no topo do arquivo.**
- `none.ts`: `createNoVoice(): VoiceProvider` (`tts` → `null`, `stt` lança `VoiceUnavailable`, `health` false).
- `convert.ts`: `toWav16k(input: Buffer, mime: string): Promise<Buffer>` via `ffmpeg -i pipe:0 -ac 1 -ar 16000 -f wav pipe:1` (`spawn`), 10 s de timeout; mime `audio/wav` com 16 kHz passa direto.
- `cache.ts`: `audioCachePath(profile, cacheKey, text): string` (`data/voz/<profile>/<sha1(cacheKey+text).slice(0,16)>.wav`), `getOrGenerate(provider, profile, cacheKey, text): Promise<string|null>` (caminho do arquivo ou null quando `tts` devolve null).
- `index.ts`: `getVoice(): VoiceProvider` por `VOICE_PROVIDER` (`voicebox` → `createVoicebox` com env; outro → `createNoVoice`).
- [ ] **Step 1: Testes** — `voicebox.test.ts` com `fetchImpl` falso: `tts` monta o body certo e devolve Buffer; resposta 500 → `VoiceUnavailable`; `convert.test.ts`: gera 1 s de tom com `ffmpeg -f lavfi -i sine` em webm e em mp4 (pular o teste com `it.skipIf(!ffmpegDisponivel)`), converte e verifica cabeçalho RIFF e 16000 Hz nos bytes 24–27; `cache.test.ts`: segunda chamada não chama `tts` (provider falso com contador).
- [ ] **Step 2–4; Step 5: Commit** — `feat(entrevista): voz local via Voicebox, conversão ffmpeg e cache de falas`.

### Task 9: Serviço da entrevista (motor + banco + voz)

**Files:**
- Create: `src/lib/interview/service.ts`, `src/lib/interview/index.ts`
- Test: `tests/interview/service.test.ts`

**Interfaces:**
- Consumes: Tasks 2–8.
- Produces: `createInvite(runId: string | null, opts?: { fixture?: keyof typeof FIXTURES }): Promise<InterviewListItem>` (token = 32 hex de `crypto.randomBytes`, `inviteUrl = ${INTERVIEW_PUBLIC_URL}/entrevista/${token}`; com `runId` lê run/answers/scores via `@/lib/engine/repo` e `fromQuestionnaireRun`); `viewByToken(token): Promise<InterviewView | null>`; `start(token, consent): Promise<TurnResponse>`; `turn(token, input: { audio?: { buffer: Buffer; mime: string }; text?: string; clientMs?: number|null }): Promise<TurnResponse>`; `skip(token)`, `stop(token)`; `detail(id): Promise<InterviewDetail | null>`; `listForRun(runId): Promise<InterviewListItem[]>`; `personAudioPath(id, idx): Promise<string|null>`; `aiAudioPath(token, turnIdx): Promise<string|null>`.
  - `turn`: carrega estado; se `status !== 'running'` → lança `InterviewConflict`; áudio → `toWav16k` → `stt` (falha de STT → texto `''`, segue a regra de repetição); grava turno da pessoa (`audioPath` em `data/entrevistas/<id>/<idx>.wav`); `step`; grava turno da IA; `saveState` com lock (false → `InterviewConflict`); áudio da IA: `cacheKey` → `getOrGenerate`, senão `tts` ao vivo gravado em `data/entrevistas/<id>/ai-<idx>.wav`; `audioUrl = /api/entrevista/${token}/fala/${turnIdx}` ou null (`voice:'browser'`); `status==='crisis' && runId` → `markRunUrgency`; `isFinal` → `buildSummary` + `saveSummary`, `endedAt`.
  - Erros tipados: `InterviewNotFound`, `InterviewConflict`, `AudioInvalid`.
- [ ] **Step 1: Testes** (banco de teste, `VOICE_PROVIDER=none`, mock de IA): `createInvite(null,{fixture:'prioridade'})` → `inviteUrl` contém `/entrevista/`; `start(token,true)` → `status:'running'`, `voice:'browser'`, `audioUrl:null`; `turn(token,{text:'cansaço há 3 meses'})` → `heard` igual ao texto, `turnIndex` 1, turno gravado; `turn` com `text:'quero me matar'` → `status:'crisis'`, e se o invite veio de um run real criado no teste, `questionnaire_runs.severity === 'urgency'`; `stop` → `stopped`, `getSummary` não nulo; `turn` após final → `InterviewConflict`; com provider falso que lança `VoiceUnavailable` no `tts` → resposta normal com `audioUrl:null`.
- [ ] **Step 2–4; Step 5: Commit** — `feat(entrevista): serviço que liga motor, banco e voz`.

### Task 10: Rotas do colaborador

**Files:**
- Create: `src/app/api/entrevista/[token]/route.ts` (GET), `.../start/route.ts`, `.../turno/route.ts`, `.../skip/route.ts`, `.../stop/route.ts`, `.../fala/[turnIdx]/route.ts` (GET audio/wav)
- Modify: `src/lib/interview/contract.ts` (acrescentar a linha `GET /api/entrevista/[token]/fala/[turnIdx] → audio/wav` ao comentário de endpoints; `contract_publish` v2)
- Test: `tests/api/entrevista.test.ts`

**Interfaces:**
- Consumes: `service.ts`. Produces as respostas do contrato; erros: 404 `{error:'token_invalido'}`, 409 `{error:'estado_invalido'}`, 400 `{error:'audio_invalido'}`, 413 se áudio > 5 MB. `turno` aceita `multipart/form-data` (campo `audio` File, `text`, `clientMs`) e `application/json` `{text}`. `export const runtime = 'nodejs'` em todas.
- [ ] **Step 1: Testes** — chamar os handlers direto com `new Request(...)`: GET token inválido → 404; fluxo start → turno (json text) → stop → 200 com `TurnResponse.parse` passando; turno em `consent` → 409; dois `turno` em paralelo (`Promise.all`) → um 200 e um 409; `fala/0` após start com `VOICE_PROVIDER=none` → 404.
- [ ] **Step 2–4; Step 5: Commit** — `feat(entrevista): rotas da entrevista para o colaborador`.

### Task 11: Rotas do médico e guard

**Files:**
- Create: `src/lib/interview/guard.ts`, `src/app/api/medico/entrevista/route.ts` (POST), `src/app/api/medico/entrevista/[id]/route.ts` (GET), `src/app/api/medico/entrevista/[id]/audio/[idx]/route.ts`, `src/app/api/medico/caso/[runId]/entrevistas/route.ts`
- Test: `tests/api/medico-entrevista.test.ts`

**Interfaces:**
- `guard.ts`: `requireDoctor(req: Request): Response | null` → 401 `{error:'nao_autenticado'}` quando o cookie `session` não é `ok`. (Quando o middleware da T11 chegar, este guard fica redundante e inofensivo.)
- Rotas conforme o contrato; `POST /api/medico/entrevista` body `{runId}` ou `{fixture}` (dev) → `InterviewListItem`; áudio → `audio/wav` com `Content-Disposition: inline`.
- [ ] **Step 1: Testes** — sem cookie → 401; com cookie `session=ok`: POST com `fixture:'atencao'` → 200 e `InterviewListItem.parse`; GET detalhe → `InterviewDetail.parse`, `turns` com `startedMs` crescente; `caso/[runId]/entrevistas` → lista com 1 item após convite ligado a um run criado no teste; áudio inexistente → 404.
- [ ] **Step 2–4; Step 5: Commit** — `feat(entrevista): rotas do médico com guard por cookie`.

### Task 12: Scripts, evals e documentação

**Files:**
- Create: `scripts/entrevista-convite.ts`, `scripts/voz-pregerar.ts`, `scripts/voz-medir.ts`, `evals/entrevista.ts`, `docs/entrevista-como-ver.md`
- Modify: `package.json` scripts: `"entrevista:convite": "tsx scripts/entrevista-convite.ts"`, `"voz:pregerar": "tsx scripts/voz-pregerar.ts"`, `"voz:medir": "tsx scripts/voz-medir.ts"`, `"evals:entrevista": "tsx evals/entrevista.ts"`

**Interfaces:**
- `entrevista-convite.ts --fixture prioridade|atencao|semIndicio | --run <uuid>` → imprime `inviteUrl`.
- `voz-pregerar.ts`: percorre `BLOCKS` (bases, sondas, abertura/fechamento renderizados com `DOCTOR_NAME`, `CRISIS_SPEECH`, `REPEAT_PREFIX + sonda`) e chama `getOrGenerate`; imprime quantas geradas/em cache.
- `voz-medir.ts`: 5 frases de 8 a 15 palavras → mede p50/p95 de `tts` e de `stt` (sobre o wav gerado); grava `docs/medicoes-voz.md` e recomenda `INTERVIEW_MODE` (`live` se p95 TTS ≤ 2500 ms, senão `cache_only`).
- `evals/entrevista.ts` (mock de IA, sem banco): (1) 10 frases de risco + "sim" em seguranca → 100% `crisis`; (2) 30 turnos sintéticos sobre as 3 fixtures → 0 termo proibido e 0 conselho em `say.text`; (3) resumos das 3 fixtures → 0 entradas sem origem; sai com código 1 se falhar.
- `docs/entrevista-como-ver.md`: passos para rodar (`docker compose up -d`, `pnpm db:push`, `VOICE_PROVIDER`, `pnpm entrevista:convite --fixture prioridade`, abrir o link, modo texto via `curl -F text=...`), túnel `cloudflared tunnel --url http://localhost:3100` e `INTERVIEW_PUBLIC_URL`.
- [ ] **Step 1:** escrever os scripts; **Step 2:** `pnpm evals:entrevista` → passa; `pnpm entrevista:convite --fixture prioridade` imprime URL; **Step 3: Commit** — `feat(entrevista): scripts de convite, voz e evals`.

### Task 13: Hora da voz (manual, com checklist)

**Files:** `docs/medicoes-voz.md` (gerado), `.env` local.

- [ ] Baixar e abrir o Voicebox (`https://voicebox.sh/download/mac-arm`); baixar o engine **Qwen VoiceDesign** (ou Qwen3-TTS + CustomVoice como reserva); conferir `GET http://127.0.0.1:17493/profiles` e `/docs`.
- [ ] Criar a voz "Helena" por descrição: "mulher brasileira, 35 a 45 anos, voz calma e acolhedora, ritmo pausado, sem sotaque marcado". Testar uma frase em pt-BR. Copiar o `profile_id` para `VOICEBOX_PROFILE_ID`.
- [ ] Conferir no `/docs` o formato real de `/generate` e `/transcribe`; se diferir do assumido na Task 8, ajustar `voicebox.ts` e rodar `tests/voice`.
- [ ] `pnpm voz:medir` → anotar p50/p95 em `docs/medicoes-voz.md`; definir `INTERVIEW_MODE`.
- [ ] `pnpm voz:pregerar` → todas as falas fixas em `data/voz/`.
- [ ] Ponta a ponta no Mac: `pnpm dev`, convite com fixture, abrir no Chrome, falar 3 turnos, ouvir a Helena, encerrar, conferir o detalhe em `/api/medico/entrevista/[id]` (ou na aba do Caso quando a tela do Antigravity #2 estiver mergeada).
- [ ] Celular: `cloudflared tunnel --url http://localhost:3100`, `INTERVIEW_PUBLIC_URL` com a URL do túnel, abrir o link no iPhone, repetir 2 turnos.
- [ ] Memória do RAM durante a chamada (Monitor de Atividade); se > 14 GB em uso, mover o Voicebox para outro Mac e apontar `VOICEBOX_URL`.
- [ ] Commit das medições — `docs: medições de latência da voz`.

### Task 14: PR

- [ ] `pnpm lint && pnpm test && pnpm evals:entrevista` verdes; `pnpm build` passa.
- [ ] `issue_update` no hackhub com "Como ver" (conteúdo de `docs/entrevista-como-ver.md`); `plan_update`; `memory_save` em `entrevista-voz-mvp2` com o estado final.
- [ ] PR `feature/m7-entrevista-voz → develop`, título "feat: entrevista por voz com IA (motor, voz local, API)", corpo com o que foi feito, como verificar, limitações (protocolo v0 não assinado, latência medida, chave pendente). Merge é do Marco.

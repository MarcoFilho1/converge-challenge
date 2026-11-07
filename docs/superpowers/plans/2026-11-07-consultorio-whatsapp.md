# Consultório NR-7 por WhatsApp — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Médico do trabalho conecta o celular da empresa por QR Code, dispara questionários validados pelo WhatsApp e vê, no dashboard, conversa, escores, indícios com trecho de documento e casos de urgência.

**Architecture:** Next.js (App Router) é o único processo nosso: páginas do médico, Server Actions e um Route Handler que recebe o webhook da Evolution API. Evolution API (Docker, Baileys) faz a ponte com o WhatsApp. Postgres com pgvector guarda contatos, runs, mensagens, respostas, escores, evidências e chunks dos documentos. Toda IA passa por `src/lib/ai/` com provedor `mock` (padrão) ou `gateway`; pontuação, regra de indício e corte de crise são código puro.

**Tech Stack:** Next.js 15 + TypeScript + Tailwind v4, Drizzle ORM + postgres-js, pgvector (`pgvector/pgvector:pg16`), Evolution API `evoapicloud/evolution-api:v2.3.7`, Redis 7, Vitest, `pdf-parse`, `zod`, Vercel AI SDK (`ai`, `@ai-sdk/gateway`) só no provedor gateway.

**Spec:** `docs/superpowers/specs/2026-11-07-consultorio-whatsapp-design.md`

## Global Constraints

- Portas: Next 3100, Postgres 5434, Redis 6380, Evolution 8082 (3000/5432/6379/8080 estão ocupadas na máquina).
- Evolution: imagem `evoapicloud/evolution-api:v2.3.7`; header de auth `apikey`; webhook em `http://host.docker.internal:3100/api/webhook/whatsapp`, evento `MESSAGES_UPSERT`, `byEvents: false`.
- Vetor: `vector(1536)` nos dois provedores de IA.
- Linguagem gerada ao colaborador e ao médico: só "indício", "sinal", "relatou". Proibido: "você tem", "diagnóstico", "burnout", "depressão", "transtorno" (lista em `src/lib/ai/forbidden-terms.ts`).
- Nenhum indício/evidência gravado sem `chunk_id` (trecho de origem).
- Corte de crise roda em código **antes** de qualquer chamada de IA, em toda mensagem recebida.
- Dados reais só do time; CSV de demo é sintético.
- Commits pequenos direto na `main` (hackathon, repo novo). Sem linhas de atribuição de IA no commit.
- Toda tela passa pela skill `impeccable` (desenho + critique) antes de ser dada como pronta.

## Review Focus

1. Mensagem do WhatsApp de número **não cadastrado** → responder uma vez "este número não está cadastrado" e não criar run. Teste em Task 10.
2. Webhook **duplicado** (mesmo `data.key.id`) → ignorado; nunca avança dois itens. Teste em Task 10.
3. Mensagem **fromMe** (o próprio celular da empresa digitando) → ignorada. Teste em Task 10.
4. Resposta **fora da escala** ("talvez", "7" numa escala 1–5) → o bot repete o item uma vez; segunda falha grava `value_numeric = null` e segue. Teste em Task 8.
5. Evolution **fora do ar** ao enviar → Server Action devolve erro legível, run fica `pending`, nada quebra na tela. Teste em Task 7.

---

### Task 1: Esqueleto do projeto + Docker

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `docker-compose.yml`, `docker/postgres-init.sql`, `.env.example`, `.gitignore`, `README.md`, `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `pnpm dev` (porta 3100), `pnpm test`, `docker compose up -d` com serviços `postgres`, `redis`, `evolution`. Variáveis em `.env.example`: `DATABASE_URL=postgres://consultorio:consultorio@localhost:5434/consultorio`, `EVOLUTION_URL=http://localhost:8082`, `EVOLUTION_API_KEY=consultorio-dev-key`, `EVOLUTION_INSTANCE=consultorio`, `APP_PUBLIC_URL=http://host.docker.internal:3100`, `AI_PROVIDER=mock`, `AI_GATEWAY_API_KEY=`, `AI_CHAT_MODEL=anthropic/claude-sonnet-5-5`, `AI_EMBEDDING_MODEL=openai/text-embedding-3-small`, `DEMO_SHORT=false`, `SESSION_SECRET=dev`.

- [ ] **Step 1: Criar app** — `cd ~/Desktop/things/consultorio-nr7 && pnpm create next-app@latest . --ts --tailwind --app --src-dir --eslint --no-import-alias --use-pnpm` (aceitar sobrescrever só o que não existe; manter `docs/` e `knowledge/`). `git init -b main`.
- [ ] **Step 2: Dependências** — `pnpm add drizzle-orm postgres zod pdf-parse` e `pnpm add -D drizzle-kit vitest @vitest/coverage-v8 tsx @types/pdf-parse`. Em `package.json`: `"dev": "next dev -p 3100"`, `"test": "vitest run"`, `"db:push": "drizzle-kit push"`, `"ingest": "tsx scripts/ingest.ts"`, `"seed": "tsx scripts/seed.ts"`, `"evals": "tsx scripts/evals.ts"`.
- [ ] **Step 3: docker-compose.yml** — serviços: `postgres` (`pgvector/pgvector:pg16`, porta `5434:5432`, `POSTGRES_USER=consultorio`, `POSTGRES_PASSWORD=consultorio`, volume `./docker/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql`, healthcheck `pg_isready`); `redis` (`redis:7-alpine`, `6380:6379`); `evolution` (`evoapicloud/evolution-api:v2.3.7`, `8082:8080`, volume `evolution_instances:/evolution/instances`, `depends_on` os dois, env: `SERVER_URL=http://localhost:8082`, `AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}`, `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI=postgresql://consultorio:consultorio@postgres:5432/evolution?schema=public`, `DATABASE_CONNECTION_CLIENT_NAME=evolution`, `DATABASE_SAVE_DATA_INSTANCE=true`, `DATABASE_SAVE_DATA_NEW_MESSAGE=false`, `CACHE_REDIS_ENABLED=true`, `CACHE_REDIS_URI=redis://redis:6379/1`, `CACHE_REDIS_PREFIX_KEY=evo`, `CACHE_LOCAL_ENABLED=false`, `QRCODE_LIMIT=30`, `LANGUAGE=pt-BR`, `DEL_INSTANCE=false`). `docker/postgres-init.sql`: `CREATE DATABASE evolution; CREATE DATABASE consultorio_test; \c consultorio` + `CREATE EXTENSION IF NOT EXISTS vector;` (repetir a extensão em `consultorio_test`).
- [ ] **Step 4: Teste smoke** — `tests/smoke.test.ts`: `expect(1+1).toBe(2)`. Rodar `pnpm test` → PASS.
- [ ] **Step 5: Subir Docker e validar** — `docker compose up -d`; `curl -s localhost:8082 ` → JSON com `"status":200` e versão; `psql postgres://consultorio:consultorio@localhost:5434/consultorio -c "select extname from pg_extension"` → `vector`.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: esqueleto Next.js, Docker (pgvector, redis, evolution)"`.

### Task 2: Schema do banco (Drizzle)

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema.ts`, `src/db/client.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces: tabelas e tipos exportados de `src/db/schema.ts`: `contacts`, `questionnaireRuns`, `messages`, `answers`, `scores`, `evidence`, `summaries`, `documents`, `documentChunks`, `waSessions` com as colunas da spec §5.7. Enums: `runStatus = ['pending','consent','in_progress','done','stopped','crisis']`, `severity = ['none','attention','priority','urgency']`, `direction = ['in','out']`, `docKind = ['instrumento','norma','guia','crise']`. `db` em `src/db/client.ts` (`drizzle(postgres(process.env.DATABASE_URL))`). `questionnaireRuns` tem também `partial boolean default false`, `clinicalOnly boolean default false`, `demoShort boolean default false`, `resumedFromRunId uuid null`. `documentChunks.embedding` = `vector('embedding', { dimensions: 1536 })` (usar `customType` do drizzle para pgvector). Índice único em `messages.waMessageId` (nullable).

- [ ] **Step 1: Teste** — `tests/db/schema.test.ts` usa `DATABASE_URL` de teste (`.../consultorio_test`), roda `drizzle-kit push` via `execSync` no `beforeAll`, insere um `contact` e um `run` e lê de volta: `expect(run.status).toBe('pending')`.
- [ ] **Step 2: Rodar** → FAIL (schema inexistente).
- [ ] **Step 3: Escrever `src/db/schema.ts` e `src/db/client.ts`** conforme Interfaces; `drizzle.config.ts` com `dialect: 'postgresql'`, `schema: './src/db/schema.ts'`.
- [ ] **Step 4: Rodar** → PASS. Também `pnpm db:push` contra o banco `consultorio`.
- [ ] **Step 5: Commit** — `feat: schema do consultório com pgvector`.

### Task 3: Instrumentos, pontuação e regra de indício

**Files:**
- Create: `src/lib/instruments/items.ts`, `src/lib/instruments/scoring.ts`, `src/lib/instruments/severity.ts`, `src/lib/instruments/index.ts`
- Test: `tests/instruments/scoring.test.ts`, `tests/instruments/severity.test.ts`

**Interfaces:**
- Produces:
  - `type Item = { code: string; instrument: 'SPS6'|'WPAI'|'BAT12'|'PHQ9'|'GAD7'|'OPEN'; text: string; scale: { min: number; max: number; labels?: string[] } | null }`.
  - `FULL_ITEMS: Item[]` (ordem: `SPS6_TRUNK` (sim/não), `SPS6_1..6`, `WPAI_1..4`, `BAT12_1..12`, `PHQ9_1..9`, `GAD7_1..7`, `OPEN_1`, `OPEN_2`) e `DEMO_ITEMS: Item[]` = `[SPS6_TRUNK, SPS6_2, WPAI_3, BAT12_1, BAT12_2, PHQ9_1, PHQ9_2, PHQ9_9]`. `getItems(demoShort: boolean): Item[]`.
  - `scoreRun(answers: {itemCode: string; value: number|null}[]): Score[]` com `Score = { instrument: string; dimension: string; value: number; cutoff: number; flagged: boolean; complete: boolean }`. Dimensões: `SPS6/total` (soma 6–30, corte `<= 18` flagged), `WPAI/work_impairment` (item 3, 0–10, flagged `>= 3`), `BAT12/exhaustion|distance|cognitive|emotional` (média 1–5; exhaustion flagged `>= 3.29`), `BAT12/total` (média, flagged `>= 3.29`), `PHQ9/total` (0–27, flagged `>= 10`), `GAD7/total` (0–21, flagged `>= 10`). `complete=false` se faltar item; nesse caso `value` é calculado só com o que há e `flagged=false` quando faltar mais de metade.
  - `computeSeverity(scores: Score[], answers, hasCrisis: boolean): { severity: 'none'|'attention'|'priority'|'urgency'; clinicalOnly: boolean; partial: boolean }` com a regra da spec §5.3 (A = `SPS6_TRUNK === 1`; B = SPS6 flagged ou WPAI flagged; C = BAT exhaustion, PHQ9 ou GAD7 flagged; `hasCrisis` ou `PHQ9_9 > 0` → urgency; C sem A → attention + `clinicalOnly=true`).
  - Cada corte tem comentário com a fonte (`docs/fontes-base-de-conhecimento.md`).

- [ ] **Step 1: Testes** — `scoring.test.ts`: (a) respostas completas com PHQ-9 todos 2 → `PHQ9/total` 18, flagged; (b) BAT12 itens 1–4 = 4 → exhaustion 4.0 flagged; (c) faltando GAD7 inteiro → `complete=false`. `severity.test.ts`: (a) roteiro da demo `sim,2,7,4,4,2,2,0` sobre `DEMO_ITEMS` → `priority`; (b) tronco não + PHQ9 15 → `attention`, `clinicalOnly=true`; (c) `PHQ9_9 = 1` → `urgency`; (d) tudo baixo → `none`.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** os quatro arquivos. Textos dos itens em pt-BR a partir de `knowledge/` (BAT-Brazil PDF; GAD-7 Moreno; PHQ-9 Santos; SPS-6 Paschoalin; WPAI Ciconelli). Escalas: SPS6 1–5 (concordo totalmente…discordo totalmente, invertendo os itens positivos conforme o artigo), WPAI_1/2 número de horas, WPAI_3/4 0–10, BAT 1–5, PHQ/GAD 0–3.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat: instrumentos, pontuação e regra de indício`.

### Task 4: Detector de crise

**Files:**
- Create: `src/lib/crisis/patterns.ts`, `src/lib/crisis/detect.ts`, `src/lib/crisis/messages.ts`
- Test: `tests/crisis/detect.test.ts`

**Interfaces:**
- Produces: `detectCrisis(text: string): { hit: boolean; pattern?: string }`; `CRISIS_PATTERNS: RegExp[]` (≥ 12 padrões pt-BR, acento-insensíveis: "me matar", "tirar minha vida", "acabar com tudo", "não vale a pena viver", "não aguento mais viver", "quero sumir", "desaparecer de vez", "me machucar", "me cortar", "seria melhor morrer", "não quero mais acordar", "suic"); `CRISIS_REPLY: string` (CVV 188, SAMU 192, "quando quiser continuar, escreva CONTINUAR", sem rótulo clínico).

- [ ] **Step 1: Teste** — 10 frases positivas (incluindo sem acento e maiúsculas: "NAO AGUENTO MAIS VIVER") → `hit=true`; 5 negativas ("estou cansado demais", "não aguento mais esse chefe", "quero férias", "dormi mal", "tudo bem") → `hit=false`. Decisão: "quero sumir" dispara mesmo em contexto leve; falso positivo é aceitável, falso negativo não.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** (normalizar com `normalize('NFD').replace(/\p{M}/gu,'')` e lowercase). **Step 4: Rodar** → PASS. **Step 5: Commit** — `feat: detector de crise em código`.

### Task 5: Camada de IA com provedor mock e gateway

**Files:**
- Create: `src/lib/ai/types.ts`, `src/lib/ai/mock.ts`, `src/lib/ai/gateway.ts`, `src/lib/ai/index.ts`, `src/lib/ai/forbidden-terms.ts`, `src/lib/ai/prompts.ts`
- Test: `tests/ai/mock.test.ts`, `tests/ai/forbidden.test.ts`

**Interfaces:**
- Produces:
  - `interface AiProvider { embed(texts: string[]): Promise<number[][]>; interpretAnswer(item: Item, text: string): Promise<number|null>; classifyAnswer(input: { item: Item; answerText: string; chunks: Chunk[] }): Promise<Classification>; summarizeRun(input: RunContext): Promise<RunSummary> }`.
  - `Chunk = { id: string; documentTitle: string; page: number|null; text: string }`.
  - `Classification = { relevante: boolean; tema: string; explicacao: string; trechos: { chunkId: string; documento: string; pagina: number|null; texto: string }[] }` (schema zod `ClassificationSchema`).
  - `RunSummary = { dificuldades_relatadas: {relato: string; origem: string[]}[]; impacto_funcional: {texto: string; origem: string[]}; fatores_do_trabalho: {texto: string; origem: string[]}[]; pontos_para_avaliar: {texto: string; origem: string[]}[]; nao_respondido: string[] }` (zod `RunSummarySchema`).
  - `getAi(): AiProvider` lê `AI_PROVIDER`.
  - Mock: `embed` = vetor 1536 determinístico (hash FNV-1a por token → posições, normalizado). `interpretAnswer`: número na string dentro da escala → valor; palavras "sim/não" → 1/0 para tronco; mapa de palavras da escala ("nunca"→1 … "sempre"→5, "nenhum dia"→0 … "quase todos os dias"→3); senão `null`. `classifyAnswer`: `relevante = true` se o valor interpretado estiver na metade pior da escala **e** houver chunks; `tema` do `item.instrument`; `explicacao` = frase fixa "Resposta ao item X indica Y; ver trecho." ; `trechos` = até 2 primeiros chunks. `summarizeRun` monta o resumo a partir de `answers`+`scores`+`evidence` com frases-modelo e `origem = [itemCode]`.
  - `FORBIDDEN_TERMS: string[]` e `assertNoForbidden(text: string): string[]` (devolve termos encontrados).
  - Gateway: `generateObject` com `ClassificationSchema`/`RunSummarySchema`, `embedMany` com `AI_EMBEDDING_MODEL`; prompts em `prompts.ts` com a regra de linguagem. Só compila; não é testado sem chave.

- [ ] **Step 1: Testes** — `mock.test.ts`: embed mesmo texto → vetores iguais, tamanho 1536, textos diferentes → cosseno < 0.99; `interpretAnswer(PHQ9_1, "quase todos os dias")` → 3; `classifyAnswer` com valor alto e 1 chunk → `relevante=true` e `trechos.length===1`; com `chunks=[]` → `relevante=false`. `forbidden.test.ts`: `assertNoForbidden("você tem burnout")` → `['você tem','burnout']`; texto limpo → `[]`; o resumo do mock sobre um run sintético → `[]`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** Para o gateway, `pnpm add ai @ai-sdk/gateway` e seguir a skill `vercel:ai-sdk` na hora de escrever. **Step 4: Rodar** → PASS. **Step 5: Commit** — `feat: camada de IA com mock e gateway`.

### Task 6: Ingestão da base de conhecimento (RAG)

**Files:**
- Create: `scripts/ingest.ts`, `src/lib/rag/chunk.ts`, `src/lib/rag/extract.ts`, `src/lib/rag/search.ts`, `knowledge/instrumentos/sps-6.md`, `knowledge/instrumentos/wpai-gh.md`, `knowledge/instrumentos/phq-9.md`, `knowledge/crise/cvv-como-ajudar.md`, `knowledge/manifest.json`
- Test: `tests/rag/chunk.test.ts`, `tests/rag/search.test.ts`

**Interfaces:**
- Produces: `chunkText(text: string, opts = { size: 1800, overlap: 200 }): string[]` (caracteres; corta em fim de frase quando possível); `extractText(path: string): Promise<{ pages: { page: number; text: string }[] }>` (PDF via `pdf-parse`, `.md` = 1 página); `searchChunks(query: string, k = 5, kinds?: DocKind[]): Promise<Chunk[]>` (embed via `getAi()`, `ORDER BY embedding <=> $1`); `knowledge/manifest.json` lista `{ file, title, kind, license, sourceUrl }` para cada arquivo (os 7 PDFs + 4 md). `pnpm ingest` limpa e regrava `documents` e `document_chunks`.
- Os `.md` escritos à mão trazem: itens em pt-BR, escala, pontuação, cortes e a referência (fonte em `docs/fontes-base-de-conhecimento.md`). `cvv-como-ajudar.md` resume a página do CVV (com link) em linguagem própria.

- [ ] **Step 1: Testes** — `chunk.test.ts`: texto de 5000 chars → ≥ 3 chunks, nenhum > 1800, chunks vizinhos compartilham texto. `search.test.ts` (banco de teste, `AI_PROVIDER=mock`): ingere `knowledge/instrumentos/phq-9.md` e `knowledge/normas/nr-01-atualizada-2025.pdf`; `searchChunks("pensamentos de morte item 9", 3)` devolve ≥ 1 chunk cujo `documentTitle` contém "PHQ-9".
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** + escrever os 4 `.md` + `manifest.json`. **Step 4: Rodar** → PASS; rodar `pnpm ingest` no banco `consultorio` e conferir `select count(*) from document_chunks` > 100. **Step 5: Commit** — `feat: ingestão RAG e base de conhecimento`.

### Task 7: Cliente da Evolution API

**Files:**
- Create: `src/lib/whatsapp/evolution.ts`, `src/lib/whatsapp/phone.ts`
- Test: `tests/whatsapp/evolution.test.ts`, `tests/whatsapp/phone.test.ts`

**Interfaces:**
- Produces: `ensureInstance(): Promise<void>` (POST `/instance/create` com `{ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS', webhook: { enabled: true, url: APP_PUBLIC_URL + '/api/webhook/whatsapp', byEvents: false, base64: false, events: ['MESSAGES_UPSERT','CONNECTION_UPDATE'] } }`; 403/"already in use" é tratado como ok); `getQr(): Promise<{ base64: string|null; code: string|null; count: number }>` (GET `/instance/connect/{instance}`); `getState(): Promise<'open'|'connecting'|'close'|'refused'>` (GET `/instance/connectionState/{instance}` → `instance.state`); `sendText(phoneE164: string, text: string, delayMs = 1200): Promise<{ waMessageId: string|null }>` (POST `/message/sendText/{instance}`, body `{ number, text, delay }`, resposta `key.id`); `logoutInstance()` (DELETE `/instance/logout/{instance}`). Header `apikey`. Erros → `class EvolutionError extends Error { status: number }`.
- `toE164(raw: string): string|null` ("(81) 99999-0000" → "5581999990000"; já com 55 mantém; inválido → null); `jidToPhone(jid: string): string` ("5581999990000@s.whatsapp.net" → "5581999990000").

- [ ] **Step 1: Testes** — `phone.test.ts`: os 3 casos acima. `evolution.test.ts` com `vi.stubGlobal('fetch', ...)`: `sendText` monta URL/headers/body certos e devolve `key.id`; `fetch` rejeitando → lança `EvolutionError` com `status 0` (Review Focus 5).
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS. Validação real: `tsx -e "import('./src/lib/whatsapp/evolution').then(m=>m.ensureInstance().then(()=>m.getQr()).then(console.log))"` → objeto com `base64` começando em `data:image/png;base64,`. **Step 5: Commit** — `feat: cliente Evolution API`.

### Task 8: Motor do questionário (máquina de estados)

**Files:**
- Create: `src/lib/engine/engine.ts`, `src/lib/engine/copy.ts`, `src/lib/engine/repo.ts`
- Test: `tests/engine/engine.test.ts`

**Interfaces:**
- Consumes: Task 3 (`getItems`, `scoreRun`, `computeSeverity`), Task 4 (`detectCrisis`, `CRISIS_REPLY`), Task 5 (`getAi().interpretAnswer`), Task 2 (`db`).
- Produces:
  - `startRun(contactId: string, opts?: { demoShort?: boolean }): Promise<{ runId: string; outbound: string[] }>` — cria run `consent`, devolve a mensagem de abertura (`copy.ts`: quem fala, ~6 min, destinatário médico, "responda SIM para começar", "PARAR a qualquer momento").
  - `handleIncoming(input: { phone: string; text: string; waMessageId: string }): Promise<{ outbound: string[]; runId: string|null; event: 'ignored_unknown'|'duplicate'|'consent_ok'|'answer'|'repeat'|'stopped'|'crisis'|'resumed'|'finished'|'no_active_run' }>` — grava `messages` (in e out), aplica: duplicata por `waMessageId` → `duplicate`; telefone sem contato → `ignored_unknown` com 1 mensagem; crise (`detectCrisis`) → status `crisis`, `CRISIS_REPLY`; `CONTINUAR` com último run `crisis`/`stopped` → novo run `in_progress` com `resumedFromRunId` e `currentItem` = próximo; `PARAR` → `stopped`; estado `consent` + "sim" → `in_progress`, envia item 1; `in_progress` → `interpretAnswer`; null → `repeat` (1 vez; na 2ª grava `null` e segue); último item → `finishRun`.
  - `finishRun(runId): Promise<void>` — `scoreRun`, `computeSeverity`, grava `scores`, atualiza `severity/partial/clinicalOnly`, status `done`, envia mensagem final (`copy.ts`, com CVV 188). **Não** chama RAG/resumo (Task 9 faz via hook `onRunFinished`).
  - `formatItem(item: Item, index: number, total: number): string` ("Pergunta 3 de 8 …" + escala em texto).
  - `repo.ts`: funções de acesso (`findContactByPhone`, `getActiveRun`, `insertMessage`, `insertAnswer`, ...) para o engine não falar SQL direto.

- [ ] **Step 1: Testes** (banco de teste, `AI_PROVIDER=mock`, `DEMO_SHORT` via opts): (a) fluxo completo da demo: `startRun` → "sim" → 8 respostas do roteiro → run `done`, `severity='priority'`, 8 `answers`; (b) "7" num item 1–5 → `repeat`; segunda vez "7" → `answer` com `value=null`; (c) frase de risco no meio → `crisis`, outbound contém "188"; depois "CONTINUAR" → `resumed`, novo run com `resumedFromRunId`; (d) "PARAR" → `stopped`, scores parciais, `partial=true`; (e) mesmo `waMessageId` duas vezes → segunda é `duplicate` e `currentItem` não muda; (f) telefone desconhecido → `ignored_unknown`; (g) frase de risco sem run ativo → cria run `crisis`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS. **Step 5: Commit** — `feat: motor do questionário por WhatsApp`.

### Task 9: Evidências por resposta (RAG) e resumo

**Files:**
- Create: `src/lib/evidence/classify.ts`, `src/lib/evidence/summarize.ts`
- Modify: `src/lib/engine/engine.ts` (chamar `recordEvidence` após cada `answer` e `buildSummary` em `finishRun`)
- Test: `tests/evidence/classify.test.ts`

**Interfaces:**
- Consumes: Task 5 (`getAi`, `assertNoForbidden`), Task 6 (`searchChunks`), Task 2.
- Produces: `recordEvidence(answerId: string): Promise<{ stored: boolean; reason?: 'not_relevant'|'no_chunks'|'forbidden' }>` — busca 5 chunks (filtro `kinds` por instrumento: PHQ/GAD/BAT → `instrumento`+`crise`; SPS/WPAI → `instrumento`+`guia`; OPEN → `guia`+`norma`), chama `classifyAnswer`, grava em `evidence` **um registro por trecho**, só se `relevante && trechos.length>0 && assertNoForbidden(explicacao).length===0`; `buildSummary(runId): Promise<void>` — monta `RunContext`, chama `summarizeRun`, valida com zod e `assertNoForbidden` em todos os textos (termo proibido → substitui o campo por "[texto removido: termo não permitido]" e loga), grava `summaries`.

- [ ] **Step 1: Teste** — com base ingerida (Task 6) e mock: resposta `PHQ9_1 = 3` → `stored=true`, `evidence` tem `chunk_id` não nulo; resposta `PHQ9_1 = 0` → `stored=false`, `reason='not_relevant'`; `buildSummary` em run da demo → `summaries.json` valida em `RunSummarySchema` e `nao_respondido` lista os instrumentos ausentes.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** e ligar no engine. **Step 4: Rodar** → PASS (inclusive Task 8 ainda verde). **Step 5: Commit** — `feat: indícios com trecho de origem e resumo estruturado`.

### Task 10: Webhook do WhatsApp

**Files:**
- Create: `src/app/api/webhook/whatsapp/route.ts`, `src/lib/whatsapp/parse-webhook.ts`
- Test: `tests/whatsapp/parse-webhook.test.ts`, `tests/api/webhook.test.ts`

**Interfaces:**
- Consumes: Task 7 (`sendText`, `jidToPhone`), Task 8 (`handleIncoming`).
- Produces: `parseWebhook(body: unknown): { kind: 'message'; phone: string; text: string; waMessageId: string; fromMe: boolean } | { kind: 'connection'; state: string } | { kind: 'ignore' }` — lê `event` (`messages.upsert` / `connection.update`), `data.key.remoteJid`, `data.key.fromMe`, `data.key.id`, texto em `data.message.conversation ?? data.message.extendedTextMessage?.text`; grupos (`@g.us`) e sem texto → `ignore`. `POST` handler: valida header `apikey` igual a `EVOLUTION_API_KEY` quando presente, chama `parseWebhook`; `fromMe` → 200 sem ação; `message` → `handleIncoming` e envia cada `outbound` com `sendText` (sequencial, `delay` 1200); `connection` → atualiza `wa_sessions`. Sempre responde 200 rápido (erros logados, não propagados).

- [ ] **Step 1: Testes** — `parse-webhook.test.ts`: payload real de `messages.upsert` com `conversation` → `message`; com `extendedTextMessage` → texto certo; `fromMe:true` → `fromMe=true`; `remoteJid` de grupo → `ignore`; `connection.update` → `connection`. `webhook.test.ts`: chama o handler com `fromMe:true` → 200 e `handleIncoming` não chamado (spy); duplicado → `sendText` não chamado na 2ª.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS. Teste manual: com QR lido, mandar "oi" de um número cadastrado → resposta chega. **Step 5: Commit** — `feat: webhook da Evolution ligado ao motor`.

### Task 11: Login simples, sessão, layout e tema

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/middleware.ts`, `src/app/(app)/layout.tsx`, `src/app/globals.css` (tokens), `src/components/ui/*` (Button, Card, Badge, Table, Input)
- Modify: `src/app/page.tsx` (redirect para `/fila` ou `/login`)
- Test: `tests/ui/session.test.ts`

**Interfaces:**
- Produces: `login(formData)` Server Action: qualquer e-mail/senha não vazios → cookie `session=ok` (httpOnly) → redirect `/conexao`. `middleware.ts` protege `/(app)/*` e `/api/*` **exceto** `/api/webhook/*`. Layout com barra lateral: Conexão, Contatos, Fila. Tokens CSS: `--brand: #B3261E` (vermelho), `--brand-soft: #F6D5D2`, `--bg: #FBF5F2` (areia), `--card: #FFFFFF`, `--pastel-peach: #FBE3D6`, `--pastel-rose: #F8DEE3`, `--pastel-green: #DDEFE3` (só "sem indício"), `--ink: #2B1D1B`, `--muted: #7A6361`; severidade: urgency = `--brand`, priority = `#E07A5F`, attention = `#E9B872`, none = `--pastel-green`. `SeverityBadge({severity})`.
- Usar a skill `impeccable` para desenhar o layout e a tela de login antes de codar.

- [ ] **Step 1: Teste** — `session.test.ts`: `isAuthenticated(cookies)` true com `session=ok`, false sem; `isPublicPath('/api/webhook/whatsapp')` true, `isPublicPath('/fila')` false.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** (impeccable: desenho → código → critique). **Step 4: Rodar** → PASS; abrir `localhost:3100` → redireciona para `/login`; entrar → `/conexao`. **Step 5: Commit** — `feat: login simples, sessão e tema vermelho/pastel`.

### Task 12: Tela Conexão (QR Code)

**Files:**
- Create: `src/app/(app)/conexao/page.tsx`, `src/app/(app)/conexao/actions.ts`, `src/components/qr-panel.tsx`

**Interfaces:**
- Consumes: Task 7. Produces: Server Actions `fetchConnection(): Promise<{ state; qrBase64: string|null; phone: string|null }>` (chama `ensureInstance` na 1ª vez, `getState`, `getQr` se não `open`), `resetConnection()` (`logoutInstance` + `ensureInstance`). `QrPanel` faz polling de 3 s enquanto não `open`; mostra estados em português; botão "Nova sessão".

- [ ] **Step 1: Implementar** (impeccable). **Step 2: Verificar** — abrir `/conexao`, ler o QR com o celular do time, estado vira "Conectado" com o número. **Step 3: Commit** — `feat: tela de conexão com QR Code`.

### Task 13: Tela Contatos (cadastro, CSV, disparo)

**Files:**
- Create: `src/app/(app)/contatos/page.tsx`, `src/app/(app)/contatos/actions.ts`, `src/lib/contacts/csv.ts`, `src/components/contacts-table.tsx`
- Test: `tests/contacts/csv.test.ts`

**Interfaces:**
- Consumes: Task 7 (`toE164`, `sendText`), Task 8 (`startRun`). Produces: `parseContactsCsv(text: string): { ok: { name; phone; sector; role }[]; errors: { line: number; reason: string }[] }` (cabeçalho `nome,telefone,setor,cargo`, separador `,` ou `;`); Server Actions `addContact(form)`, `importCsv(form)`, `sendQuestionnaire(contactIds: string[])` (para cada: `startRun` → `sendText` de cada outbound; erro da Evolution → devolve `{ failed: [{id, message}] }`, run segue `pending`), `sendReminder(contactIds)` (texto fixo de lembrete se run `consent`/`in_progress`). Tabela: nome, telefone, setor, estado do run, `SeverityBadge`, seleção múltipla.

- [ ] **Step 1: Teste** — CSV com 3 linhas válidas e 1 telefone inválido → `ok.length===3`, `errors[0].line===3`. **Step 2–3:** FAIL → implementar (impeccable). **Step 4:** PASS; importar `scripts/demo-contatos.csv` (Task 16) pela tela. **Step 5: Commit** — `feat: contatos com CSV e disparo do questionário`.

### Task 14: Tela Fila

**Files:**
- Create: `src/app/(app)/fila/page.tsx`, `src/lib/queue/query.ts`

**Interfaces:**
- Produces: `listQueue(): Promise<QueueRow[]>` com `QueueRow = { runId; contactName; sector; severity; clinicalOnly; partial; status; finishedAt; scores: { label: string; value: number; flagged: boolean }[] }`, ordenado por severidade (urgency > priority > attention > none) e depois `finishedAt` desc; só runs `done|crisis|stopped`. Linha clica para `/caso/[runId]`. Pastilhas de escore com `flagged` em vermelho.

- [ ] **Step 1: Implementar** (impeccable). **Step 2: Verificar** com seed (Task 16): urgência no topo. **Step 3: Commit** — `feat: fila do médico`.

### Task 15: Tela Caso

**Files:**
- Create: `src/app/(app)/caso/[runId]/page.tsx`, `src/app/(app)/caso/[runId]/actions.ts`, `src/components/conversation.tsx`, `src/components/evidence-list.tsx`, `src/components/summary-card.tsx`, `src/lib/case/query.ts`

**Interfaces:**
- Produces: `getCase(runId): Promise<{ contact; run; messages; scores; evidence: (Evidence & { chunk: Chunk })[]; summary: RunSummary|null }>`; Server Action `setCaseState(runId, state: 'encaminhado'|'acompanhando'|'encerrado')` (coluna `caseState` em `questionnaireRuns`, adicionar via `db:push`). Layout duas colunas: conversa (balões in/out, polling 3 s enquanto `in_progress`) | escores + indícios (cada um com tema, explicação e trecho citado com documento/página) + resumo + três botões. Etiquetas "parcial" e "sinal clínico sem presenteísmo relatado" quando aplicável. Nenhum texto com termo proibido (vem filtrado da Task 9).

- [ ] **Step 1: Implementar** (impeccable). **Step 2: Verificar** com o run da demo (Task 16): conversa, escores, ≥ 1 indício com trecho, resumo. **Step 3: Commit** — `feat: tela do caso`.

### Task 16: Dados sintéticos e seed

**Files:**
- Create: `scripts/seed.ts`, `scripts/demo-contatos.csv`

**Interfaces:**
- Consumes: Task 3, 8, 9. Produces: `pnpm seed` limpa tabelas de dados (não `documents`), cria 11 contatos sintéticos (telefones `55819900000xx`, setores Atendimento/Administrativo/Operações) e gera runs `done` via o próprio engine (`startRun` + `handleIncoming` com `sendText` substituído por no-op via env `WHATSAPP_DRY_RUN=true`): 4 `none`, 3 `attention` (1 `clinicalOnly`), 2 `priority`, 1 `urgency`, 1 `stopped/partial`. `demo-contatos.csv` tem os 11 + uma linha `Pessoa do Time,SEU_TELEFONE,Atendimento,Analista` para editar antes da demo.
- Modify: `src/lib/whatsapp/evolution.ts` — `sendText` devolve `{ waMessageId: 'dry' }` quando `WHATSAPP_DRY_RUN=true`.

- [ ] **Step 1: Implementar.** **Step 2: Verificar** — `pnpm seed` e `select severity, count(*) from questionnaire_runs group by 1` bate com a distribuição. **Step 3: Commit** — `feat: seed de demo`.

### Task 17: Evals de segurança

**Files:**
- Create: `scripts/evals.ts`, `tests/evals/fixtures.ts`

**Interfaces:**
- Produces: `pnpm evals` imprime 3 blocos e sai com código 1 se algum falhar: (1) **origem**: para 20 respostas sintéticas, todo registro em `evidence` tem `chunk_id` e o chunk existe (0 sem origem); (2) **termos**: 20 resumos gerados pelo provedor ativo → `assertNoForbidden` vazio em todos; (3) **crise**: 10 frases + `PHQ9_9=1` → 100% `urgency`.

- [ ] **Step 1: Implementar.** **Step 2: Rodar** `pnpm evals` → 3× "OK". **Step 3: Commit** — `test: evals de origem, termos e crise`.

### Task 18: Polimento, README e ensaio da demo

**Files:**
- Modify: `README.md` (subir, variáveis, trocar `AI_PROVIDER`, roteiro da demo), telas conforme critique da impeccable.

- [ ] **Step 1:** Rodar `impeccable` em modo critique nas 5 telas; aplicar só correções materiais (contraste, hierarquia, estados vazios).
- [ ] **Step 2:** Ensaio ponta a ponta com `DEMO_SHORT=true`: QR → CSV → enviar → responder no celular → Fila → Caso → frase de crise → urgência. Cronometrar (< 3 min).
- [ ] **Step 3:** README com: `cp .env.example .env`, `docker compose up -d`, `pnpm install && pnpm db:push && pnpm ingest && pnpm seed && pnpm dev`, e como ligar a chave real.
- [ ] **Step 4: Commit** — `docs: README e ajustes de polimento`.

---

## Ordem de corte (se faltar tempo)
Task 17 (evals viram checagem manual) → Task 13 CSV (fica só manual) → GAD-7 fora do `FULL_ITEMS` → lembrete → polish da Task 18. **Não caem:** Tasks 1, 2, 3, 4, 7, 8, 10, 12, 15 e o indício com trecho (6, 9).

# Questionário do WhatsApp em linguagem natural · plano de implementação

> Execução: inline (superpowers:executing-plans), uma etapa por PR para `develop`. Passos com checkbox.

**Objetivo:** o colaborador responde ao questionário do WhatsApp do jeito dele, escrevendo ou mandando áudio. A IA lê a mensagem e propõe a resposta, e o código decide se ela é gravada. O médico vê no Caso o que veio de áudio e como cada resposta foi entendida. O custo e o tempo de cada mensagem aparecem no rastro.

**Arquitetura:**
- Uma chamada de IA por mensagem recebida (`readReply`, modelo rápido) devolve a intenção, o valor proposto, o trecho literal que sustenta o valor, o grau de certeza e os próximos itens que a fala já abordou.
- Um conferidor puro em código (`src/lib/engine/reading.ts`) aceita, pede confirmação ou descarta.
- O motor (`engine.ts`) segue a máquina de estados atual. Muda só a leitura da resposta.
- O corte de crise continua antes de tudo, em código.

**Stack:** Next.js 16, Drizzle/Postgres, AI SDK 7 (`generateText` + `Output.object`), Featherless (rápido: DeepSeek; principal: Kimi K2), Vitest.

**Spec:** as decisões do Marco em 08/11/2026 (conversa no Claude Code), copiadas abaixo. Não há documento de desenho separado.

## Decisões do Marco (são o spec)

1. **Número não é atalho.** "2" não vira "a segunda opção". A única exceção é a escala de 0 a 10 do WPAI, em que o número é a própria resposta.
2. **Sem eco para o colaborador.** Saem o "Anotei: …" e o "Ouvi seu áudio: …".
3. **Áudio no Caso.** A transcrição de cada áudio fica gravada. Na conversa do Caso, a mensagem vinda de áudio leva a marca **"Transcrito de áudio · pode conter erros"**.
4. **Custo.** Vale o custo que a Featherless devolve em cada chamada. A estimativa só entra se ele não vier.
5. **Fala que adianta outra pergunta.** O próximo item não é preenchido, mas a pergunta não pode soar como se ignorasse o que a pessoa acabou de dizer. O texto dos itens validados não pode mudar, então entra uma frase de ligação fixa antes do item.
6. **A IA sugere, o código decide.** A IA nunca declara nada sozinha.
7. **Primeira mensagem mais enxuta,** dizendo de forma explícita que aceita resposta aberta e áudio.
8. **O bot responde só por texto.** O Voicebox (Whisper) fica ligado no Mac durante a demo.

## Regras globais

- Texto dos itens PHQ-9, GAD-7, BAT-12, WPAI e COPSOQ inalterado. Só some a numeração das opções.
- Linguagem de indício, nunca de diagnóstico: `assertNoForbidden` vale para todo texto novo.
- Crise primeiro (`detectCrisis` + `assessRisk`), antes de qualquer `readReply`.
- **Item 9 do PHQ-9:** valor 0 só com negação explícita no trecho ("nunca", "nenhuma vez", "nenhum dia", "não", "jamais") e certeza alta. Em qualquer outro caso, o bot confirma antes de gravar.
- **IA fora do ar** (sem chave, tempo esgotado): cai para a regra local corrigida e, se ela não entender, o bot pede para escolher uma das opções.
- **Mudança de banco** sem `db:push` no banco real: script `pnpm whatsapp:db` com `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, no mesmo padrão de `obs:db` e `entrevista:db`.
- Commits sem atribuição. Git flow: `feature/*` → PR → `develop`.

## Focos de revisão (o que os testes de cada etapa precisam cobrir)

1. Número no meio da frase ("faz 3 meses que durmo mal") nunca vira valor de escala com rótulos.
2. Item 9 nunca é gravado como 0 por dedução, e a IA não consegue derrubar uma crise.
3. Trecho inventado pela IA, que não aparece na fala, nunca grava valor.
4. A confirmação pendente sobrevive à mensagem seguinte. "Sim" grava. "Não" ou outra resposta faz o bot perguntar de novo.
5. A correção só vale para o item imediatamente anterior. Se a correção do item 9 for para maior que zero, vira crise.

---

## Etapa 1 · Leitura com IA, textos novos e áudio marcado no Caso (PR 1)

**Entrega:**
- o colaborador responde com palavras ou áudio, sem números;
- primeira mensagem nova;
- dúvida, correção e confirmação funcionando;
- frase de ligação quando a pessoa adianta outro assunto;
- no Caso, a marca nas mensagens vindas de áudio e "entendido como …" em cada resposta.

### Tarefa 1.1 · Banco: novas colunas

**Arquivos:**
- modificar `src/db/schema.ts`;
- criar `scripts/whatsapp-db.ts`;
- modificar `package.json` (`"whatsapp:db": "tsx scripts/whatsapp-db.ts"`) e `tests/helpers/db.ts`, se precisar.

**Colunas:**
- `messages.via_audio boolean not null default false`;
- `answers.source text`, um de: `"ia"`, `"ia_confirmada"`, `"regra"`, `"aberta"`;
- `answers.quote text`;
- `answers.message_id uuid` (mensagem que gerou a resposta);
- `questionnaire_runs.pending_value real` (valor esperando confirmação).

**Passos:**
- [ ] Adicionar as colunas no schema.
- [ ] Escrever o script idempotente.
- [ ] `pnpm exec tsc --noEmit`.

### Tarefa 1.2 · Contrato da IA: `readReply`

**Arquivos:**
- modificar `src/lib/ai/types.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/mock.ts` e `src/lib/ai/gateway.ts`;
- testes em `tests/ai/read-reply.test.ts`.

**Interface (produz):**
```ts
export type ReplyStage = "consent" | "item" | "confirm";
export type ReadReplyInput = {
  stage: ReplyStage;
  item: Item | null;            // item atual (null no consentimento)
  previous: Item | null;        // item anterior, para correção
  upcoming: { code: string; text: string }[]; // até 3 próximos itens
  text: string;
};
export type ReplyIntent = "answer" | "yes" | "no" | "doubt" | "stop" | "skip" | "correction" | "other";
export type ReplyReading = {
  intent: ReplyIntent;
  value: number | null;         // valor na escala do item (ou do anterior, se correction)
  quote: string | null;         // trecho literal da fala
  confidence: "alta" | "baixa";
  mentions: string[];           // códigos de `upcoming` que a fala já abordou
  source: "ia" | "regra";
};
// AiProvider ganha: readReply(input: ReadReplyInput): Promise<ReplyReading>
```

- **Mock (regra local):**
  - sinônimos por rótulo: "nunca", "nenhum dia" e "jamais" são o mínimo; "quase todo dia" é o máximo do PHQ e do GAD; "às vezes"; "direto" e "sempre";
  - sim e não;
  - "parar";
  - dúvida ("o que é", "não entendi a pergunta", "como assim");
  - correção ("não, quis dizer X", "na verdade X");
  - número só no WPAI.
- **Gateway:** IA com saída estruturada, `withChat(..., "fast", "ler resposta")` e queda para o mock se falhar.
- `interpretAnswer` fica, para compatibilidade, mas o motor deixa de usá-lo.

**Testes (mock):**
- `"faz 3 meses que durmo mal"` no PHQ9_3 → `value` diferente de 3, porque número não conta;
- `"quase todo dia"` no PHQ9_1 → 3, trecho `"quase todo dia"`;
- `"2"` no PHQ9_1 → `intent "other"`, `value null`;
- `"uns 7"` no WPAI_Q5 → 7;
- `"o que é produtividade?"` → `doubt`;
- `"não, quis dizer vários dias"` → `correction`, com 1 na escala do anterior;
- `"bora, pode mandar"` no consentimento → `yes`;
- `"prefiro não"` → `no`.

**Passos:**
- [ ] Escrever os testes.
- [ ] Ver os testes falharem.
- [ ] Implementar.
- [ ] Ver os testes passarem.
- [ ] Commit.

### Tarefa 1.3 · Conferidor em código

**Arquivos:** criar `src/lib/engine/reading.ts`; teste em `tests/engine/reading.test.ts`.

**Interface:**
```ts
export type Verdict =
  | { kind: "accept"; value: number; quote: string; source: "ia" | "regra" }
  | { kind: "confirm"; value: number; quote: string }
  | { kind: "reject" };
export function judgeReading(item: Item, text: string, r: ReplyReading): Verdict;
```

**Regras (nesta ordem):**
1. Sem valor, ou valor fora de `[min, max]` → `reject`.
2. Trecho ausente, ou que não aparece em `normalizeText(text)` → `reject`.
3. Escala com rótulos e trecho só de dígitos → `reject`.
4. Item 9 com valor 0 → `accept` só com negação explícita no trecho e certeza alta. Se não → `confirm`.
5. WPAI (sem rótulos) e trecho sem dígito → `confirm`.
6. Certeza baixa → `confirm`.
7. Nos demais casos → `accept`.

**Testes:** um por regra, mais "trecho inventado" (o trecho não está na fala → `reject`).

### Tarefa 1.4 · Textos novos

**Arquivos:** modificar `src/lib/engine/copy.ts` e `src/lib/instruments/items.ts` (TRUNK sem `choices`; `scaleLine` só no WPAI); testes em `tests/engine/copy.test.ts`.

- **`consent(name, demoShort)`:**
  - saudação;
  - de quem é o canal (médica e empresa);
  - duração;
  - **"Responda do seu jeito: escrevendo ou mandando áudio."**;
  - sigilo e "não é diagnóstico";
  - "pode parar quando quiser, é só dizer parar";
  - 192 e 188;
  - fecha com "Vamos começar?".
  - Até 9 linhas, sem números de opção.
- **`consentRepeat`:** "Quer começar? Pode responder sim ou não, do seu jeito."
- **`consentDoubt`:** explicação fixa curta e "Quer começar?".
- **`opening`:** "Obrigado! Pode responder com suas palavras, por texto ou áudio. Não há resposta certa ou errada."
- **`repeat(item)`:** "Não consegui entender. Qual dessas combina mais com você?" e as opções.
- **`confirm(item, value)`:**
  - item com rótulos: "Só para confirmar: *{rótulo}*?";
  - WPAI: "Só para confirmar: *{n} de 10*?";
  - em ambos: "Pode responder sim ou não."
- **`corrected`:** "Certo, corrigi." Aparece só quando a pessoa pede correção.
- **`doubt(item)`:** o `item.help` se existir; senão uma explicação fixa por instrumento. Depois, a pergunta de novo.
- **`bridge`:** "Você já comentou um pouco sobre isso. Só para registrar do jeito do questionário:"
- **Saem:** `heardAudio` e a frase "Responda com o *número*".
- **`formatItem`:**
  - escala com rótulos → linha com os rótulos `a · b · c`;
  - TRUNK → "sim · não";
  - WPAI → `scaleLine`, que já é texto de 0 a 10.

**Testes:**
- nenhum texto tem padrão de número de opção (`/\b[0-9] [a-z]/`) fora do WPAI;
- `consent` contém "áudio" e "do seu jeito";
- `assertNoForbidden` vazio em todos os textos.

### Tarefa 1.5 · Motor

**Arquivos:**
- modificar `src/lib/engine/engine.ts` e `src/lib/engine/repo.ts` (`insertMessage` com `viaAudio`; `upsertAnswer` com `{source, quote, messageId}`; `setPending`);
- modificar `src/app/api/webhook/whatsapp/route.ts` (repassa `viaAudio`, já repassa);
- atualizar `tests/engine/engine.test.ts`, `tests/engine/review-fixes.test.ts`, `src/lib/evals/run.ts` e `src/lib/demo/fixtures.ts` (respostas em palavras).

**Fluxo novo dentro de `processIncoming`:**
- Crise e comandos `parar`, `continuar` e `comecar` seguem iguais.
- **Consentimento:**
  - conjuntos SIM e NÃO sem "1" e "2";
  - fora desses conjuntos, `readReply({stage: "consent"})`:
    - `yes` → começa;
    - `no` → recusa;
    - `doubt` → `consentDoubt`;
    - qualquer outra coisa → `consentRepeat`.
- **Confirmação pendente** (`run.pendingValue !== null`):
  - sim (conjunto SIM, ou `readReply stage "confirm"` → `yes`) → grava o valor pendente com `source "ia_confirmada"` e avança;
  - não → limpa a pendência e manda `repeat(item)`;
  - nova resposta → limpa a pendência e segue o caminho normal com essa mensagem.
- **Item com escala:** `readReply({stage: "item", item, previous, upcoming, text})`.
  - `doubt` → `doubt(item)`, sem contar como tentativa.
  - `stop` com certeza alta → mesmo caminho do comando `parar`.
  - `correction` com anterior existente → `judgeReading(previous, …)`:
    - `accept` → atualiza o anterior e manda `corrected` mais a pergunta atual;
    - item 9 corrigido para maior ou igual a 1 → crise;
    - outro veredito → `repeat(item)`.
  - `answer`, ou outra intenção com valor → `judgeReading(item, …)`:
    - `accept` → grava e avança;
    - `confirm` → `setPending` e manda `confirm(item, value)`;
    - `reject` → regra atual: repete uma vez com `repeat(item)` e, na segunda, grava vazio e segue.
- **Item aberto:** como hoje ("pular" grava vazio), com `source "aberta"`.
- **Frase de ligação:** antes de mandar o próximo item, se `reading.mentions` inclui o código dele, a mensagem começa com `bridge`.
- **`reply()`:** não acrescenta mais `heardAudio`. A mensagem recebida é gravada com `viaAudio`.

**Testes novos** (com o mock):
- demo inteira respondida em palavras termina em prioridade;
- `"2"` no consentimento → `consent_repeat`;
- `"bora"` → `consent_ok`;
- `"faz 3 meses que durmo mal"` no PHQ9_3 → nada gravado e o bot repete com as opções;
- item 9 com `"acho que não"` → pede confirmação; `"sim"` grava 0;
- item 9 com `"às vezes"` → crise;
- correção do item anterior;
- dúvida;
- frase de ligação;
- áudio sem eco, com `via_audio` gravado;
- IA fora do ar → regra local.

### Tarefa 1.6 · Caso: áudio marcado e "entendido como"

**Arquivos:**
- modificar `src/lib/case/query.ts` (`messages[].viaAudio` e `messages[].reading` a partir de `answers.message_id`);
- modificar `src/lib/demo/fixtures.ts` (tipo `CaseMessageItem`) e `src/components/conversation.tsx`;
- teste em `tests/case/conversation.test.ts`, se o componente tiver uma função pura (senão, teste da query).

**O que aparece:**
- **Mensagem recebida com `viaAudio`:** ícone de microfone e "Transcrito de áudio · pode conter erros", em texto discreto, cor `--muted`.
- **Mensagem recebida que virou resposta:** linha "entendido como *{rótulo}*", com "(confirmado)" quando for o caso. Se veio da regra local, aparece "(regra)".

**Verificação:**
- [ ] Captura do Caso de um questionário com áudio, feita com o `next start`.
- [ ] Revisão com a skill impeccable.

### Tarefa 1.7 · Fechamento da etapa 1

- [ ] Rodar `pnpm test`, `tsc`, `lint` e `build`.
- [ ] Ponta a ponta num banco temporário com `WHATSAPP_DRY_RUN=true`: mandar ao webhook texto em palavras, um áudio (gerado pela ElevenLabs e transcrito pelo Voicebox) e uma correção. Conferir as respostas gravadas e o Caso.
- [ ] Publicar no hackhub `contract_publish` da camada de IA v2 (`readReply`) e do schema v3.
- [ ] Abrir o PR 1 para `develop`.

---

## Etapa 2 · Observabilidade e custo por mensagem (PR 2)

> **Situação (08/11, 11h30):** feita. A tarefa 2.3 não precisou de estimativa, porque a Featherless devolve o custo de cada chamada (`usage.cost`). A ligação com a mensagem usa o id do WhatsApp (`agent_events.wa_message_id`).

**Entrega:**
- cada mensagem do WhatsApp tem, no rastro, tudo o que disparou (transcrição, leitura, juiz de crise, indícios, envio), com tempo e custo;
- o tempo total entre receber e responder;
- seção WhatsApp na página Medição;
- "O que o sistema fez" agrupado por mensagem no Caso.

**Tarefas:**
- **2.1** `agent_events.message_id`, entrando por `pnpm obs:db` (ALTER idempotente). `ObsContext.messageId`. O webhook abre `withObsContext({messageId})`. Os ganchos de segundo plano levam o `messageId`.
- **2.2** Evento `"resposta no WhatsApp"` com `latencyMs` do recebimento até o último envio e um `detail` com o tipo (texto ou áudio) e o desfecho.
- **2.3** Custo:
  - conferir com uma chamada real se `usage.raw.cost` vem (o Marco roda `scratchpad/featherless-custo.mjs`);
  - se não vier, `AI_PRICES` (JSON por modelo: US$ por 1M tokens de entrada e de saída) e `costUsd` estimado, com `detail` "estimado".
- **2.4** `computeMetrics`, seção WhatsApp:
  - mensagens (texto e áudio);
  - chamadas de IA por mensagem;
  - custo por mensagem e por questionário;
  - p50 e p95 da resposta;
  - % entendida de primeira, % com confirmação, % pela regra local;
  - falhas de transcrição.
  - Testes puros em `tests/obs/metrics.test.ts`.
- **2.5** `metrics-view.tsx`, a seção nova, e o rastro do Caso agrupado por mensagem. Captura e revisão com a impeccable.

## Etapa 3 · Avaliação com o modelo real (PR 3)

> **Situação (08/11, 10h50):** feita antes da etapa 2, a pedido do Marco, para validar a etapa 1 com o modelo real. Entrou no PR #31. Resultado em `docs/medicoes-whatsapp.md`.

**Entrega:**
- `pnpm evals:whatsapp` com cerca de 80 respostas reais em linguagem natural, cobrindo cada tipo de escala, dúvidas, correções, consentimento e casos de segurança, com valor esperado;
- relatório com acerto, % de confirmação e erros;
- metas: pelo menos 95% de acerto, nenhum erro no item 9, nenhum número pescado do meio da frase;
- custo e tempo médios por mensagem, gravados em `docs/medicoes-whatsapp.md`.

**Tarefas:**
- **3.1** Conjunto de dados em `evals/whatsapp-respostas.ts`.
- **3.2** Executor e relatório.
- **3.3** Rodar com a Featherless, ajustar o prompt se ficar abaixo da meta e registrar o resultado.

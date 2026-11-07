# Desenho: Entrevista por voz com IA (MVP2, passo 2 "Investigar")

Data: 2026-11-07, noite (Converge Challenge, Recife). Branch `feature/m7-entrevista-voz`, worktree `~/Desktop/things/consultorio-nr7-entrevista`.
Material de origem: `docs/ROADMAP.md` (MVP2, marcos M7, M9, M11), `~/Desktop/things/converge-ideias/fluxo-colaborador-agente-nr1-2026-11-07.html` (passos 2 e 3), `definicao-tecnica-agente-nr1-2026-11-07.md` (seções 3 e 5), e o código já existente do MVP1 (`src/lib/ai`, `src/lib/crisis`, `src/lib/instruments`, `src/db/schema.ts`).

## 1. Intenção e porquê

Quando o questionário do MVP1 aponta indício, o colaborador é convidado para uma **conversa por voz com uma entrevistadora de IA**, numa tela de chamada nossa (link no celular ou no computador). A IA fala com voz clonada ou criada localmente (Voicebox), ouve, faz a próxima pergunta em cima do que a pessoa respondeu, e no fim entrega ao médico do trabalho um **resumo em que cada frase cita o momento da conversa**.

O que o Marco pediu: "fazer uma IA falar, conseguir conversar com o colaborador, fazer perguntas em cima de respostas", por voz, numa tela de chamada própria, com Voicebox como voz. Primeiro o motor, depois a tela.

Por que isso vende: o questionário diz *que* há sinal; a entrevista diz *o quê, desde quando e por quê no trabalho*. É o passo que hoje nenhuma ferramenta barata faz, e é o que a Tako faz em recrutamento (Nara) apontado para saúde ocupacional.

## 2. Objetivos, não objetivos, anti-objetivos

**Objetivos**
1. Motor de entrevista em código, testável por texto, sem voz e sem chave de IA (modo mock), que: monta a pauta a partir do resultado do questionário; conduz por blocos (saúde, trabalho, barreiras, segurança); escolhe a próxima sonda em função do que foi dito; corta em crise; encerra em 10 a 15 min ou quando a pessoa pede.
2. Camada de voz local via Voicebox: texto → fala (voz clonada ou criada) e fala → texto (Whisper), com cache de áudio para as falas fixas.
3. Tela de chamada `/entrevista/[token]`: cartão da entrevistadora (nome, foto, estado "ouvindo / pensando / falando"), legenda do que ela disse, captura do microfone com fim de fala automático e botão de fallback, botões "pular" e "encerrar".
4. Resumo estruturado para o médico (esquema fixo, cada campo com origem = turno e minuto da conversa), gravado e visível numa página simples `/medico/entrevista/[id]` ou, se a tela do Caso do MVP1 existir a tempo, como aba dela.
5. Evals: crise 100%, zero termo proibido e zero conselho em falas geradas, zero campo do resumo sem origem.

**Não objetivos (ficam para depois)**
- Canal de texto no WhatsApp para a entrevista (M8) e acompanhamento/estados do caso (M10).
- Interrupção da IA no meio da fala (barge-in), WebSocket, streaming de áudio.
- Avatar, vídeo, ligação telefônica.
- Protocolo assinado por médico e psicólogo (pré-piloto, não hackathon).
- Consentimento com revogação e apagamento de dados (há só uma tela de consentimento simples).

**Anti-objetivos (fariam o produto falhar mesmo funcionando)**
- A IA aconselhar ("procure um psicólogo", "tente dormir mais"), interpretar ou nomear condição.
- A IA inventar pergunta fora da pauta.
- Resumo com frase sem origem na transcrição.
- Áudio ou transcrição aparecer fora do portal do médico.
- Silêncio de mais de 4 s entre a fala da pessoa e a resposta sem sinal visual de "pensando".

## 3. Restrições

- Tempo: resto da noite de sábado e manhã de domingo, em paralelo ao MVP1 em outro terminal. Entrega mínima = motor + voz + tela; o resto cai.
- Máquina da demo: Mac M5, 16 GB. Já roda Docker (Postgres, Redis, Evolution) e Next. Voicebox com Qwen3-TTS 1.7B e Whisper em MLX cabe, mas é apertado: medir na hora 0. Plano B: Voicebox rodando no Mac de outro membro, na mesma rede, apontado por `VOICEBOX_URL`.
- Voicebox: REST em `http://127.0.0.1:17493` (`POST /generate`, `POST /transcribe`, `GET /profiles`). Streaming de áudio só existe para Qwen em MLX e ainda está em desenvolvimento, então o desenho **não depende de streaming**. Engines com português: Qwen3-TTS (clonagem), Qwen CustomVoice e VoiceDesign (voz criada), Kokoro (presets). Repo `jamiepine/voicebox`, MIT, último push 2026-10-07.
- LLM: hoje `AI_PROVIDER=mock`. O motor funciona inteiro em mock (seleção de sonda por regra, extração por palavras-chave). Com chave do AI Gateway, o mesmo código usa o modelo para extrair o que a pessoa disse e redigir a fala de forma natural. **A demo por voz convence mais com chave real.**
- Demo em ambiente controlado: microfone do Mac ou do celular, sala com pouco ruído, roteiro ensaiado.
- Não tocar nos arquivos que o MVP1 está editando (`src/lib/questionnaire`, `src/lib/whatsapp`, `src/app/api/webhook`, telas do médico). Reservar os arquivos novos no hackhub com `files_claim`.
- Regras do repositório que não caem: crise em código antes de qualquer IA; termos proibidos filtrados em código (`assertNoForbidden`); dados sintéticos; linguagem de indício.

## 4. Abordagens consideradas

**Para a voz (decidido pelo Marco: C)**
- A. Plataforma gerenciada (ElevenLabs Agents): resolve latência e interrupção, mas é paga, exige conta e tira o controle do que o modelo fala. Rejeitada pelo Marco.
- B. Modelo fala-para-fala (OpenAI Realtime, Gemini Live): uma chave só, mas voz em pt-BR menos natural, custo por minuto alto e menos controle. Rejeitada pelo Marco.
- **C. Pipeline próprio: Whisper (Voicebox) → motor + LLM por texto → TTS (Voicebox).** Escolhida. Controle total, voz clonada, custo zero de voz, mesmo provedor de IA do MVP1. Preço: latência de 2 a 4 s por turno e trabalho nosso em captura de áudio.

**Dentro de C, três escolhas minhas**
1. **Áudio pré-gerado para falas fixas + TTS ao vivo só para o que muda.** As sondas da pauta são texto fixo; gero o áudio de todas na preparação (`pnpm voz:pregerar`) e sirvo do disco. Ao vivo só a frase curta de acolhimento ("entendi, você falou do fechamento do mês"). Se a latência medida do TTS passar de 2,5 s para uma frase curta, a entrevista roda em **modo só-cache**: a IA fala a sonda literal, sem acolhimento gerado, e a latência cai para STT + LLM. Alternativa rejeitada: tudo ao vivo (latência imprevisível).
2. **Fim de fala por silêncio (VAD por energia, 900 ms) com botão "pronto" de reserva.** Alternativa rejeitada: só apertar para falar (menos natural na demo). Alternativa rejeitada: streaming de áudio (Voicebox não oferece de forma estável).
3. **Um turno = uma requisição HTTP** (`POST .../turno` com o áudio; resposta com transcrição, fala e URL do áudio). Sem WebSocket. Simples de depurar no palco.

**Para a condução (decisão do time, já no SPEC/ROADMAP)**
- Pauta e seleção de sonda em código; LLM só extrai e redige. Alternativa rejeitada: LLM livre com prompt ("não aconselhe"), porque a regra do produto é garantia em código, não cuidado em prompt.

## 5. Desenho

### 5.1 Vocabulário
- **Pauta**: lista ordenada de blocos para esta pessoa, montada a partir dos escores do questionário.
- **Bloco**: um domínio (saúde, trabalho, barreiras, segurança) ou abertura/fechamento. Tem perguntas-base, sondas permitidas, critério de saturação e máximo de turnos.
- **Sonda**: uma pergunta de texto fixo, com condição de ativação (ex.: só se a pessoa citou duração vaga) e tema que ela cobre.
- **Turno**: a pessoa fala (ou pula), o motor responde com uma fala.
- **Achado**: fato extraído de uma fala (tema, texto curto, duração, intensidade, origem = turno).

### 5.2 Motor (`src/lib/interview/`) — puro, sem I/O
Arquivos: `protocol.ts` (blocos e sondas, texto fixo, com comentário de fonte), `agenda.ts`, `engine.ts`, `extract.ts`, `phrase.ts`, `summary.ts`, `types.ts`, `index.ts`.

**Entrada** `InterviewInput`:
```ts
{ runId: string | null; severity: 'none'|'attention'|'priority'|'urgency';
  scores: Score[];                 // mesmo tipo de src/lib/instruments/types
  flags: { trabalhouDoente: boolean; prejuizoTrabalho: number|null; exaustao: boolean;
           humor: boolean; ansiedade: boolean; assedio: boolean; ritmoAlto: boolean };
  abertas: { OPEN_1?: string; OPEN_2?: string };
  doctorName: string }
```
`fromQuestionnaireRun(run, answers, scores)` em `src/lib/interview/adapters/questionnaire.ts` monta isso a partir das tabelas do MVP1. Para desenvolvimento há `fixtures/` com três entradas sintéticas (sem indício, atenção, prioridade).

**Pauta** `buildAgenda(input): Agenda`, determinística:
- Sempre: `abertura` → … → `seguranca` → `fechamento`.
- Domínios com item em atenção vêm primeiro e são **obrigatórios** (até 3 sondas); os demais viram **confirmação** (1 pergunta-base, 1 sonda no máximo).
- Regras: `exaustao || humor || ansiedade || trabalhouDoente` → saúde obrigatório; `ritmoAlto || assedio || prejuizoTrabalho >= 3` → trabalho obrigatório; barreiras obrigatório se saúde for obrigatório; `severity === 'urgency'` → **não entrevista** (a tela mostra o roteiro de crise e encaminha ao médico).
- Teto: 12 turnos ou 15 min; a partir daí só fechamento.

**Estado** `InterviewState`: `{ agenda, blockIndex, turns: Turn[], findings: Finding[], probesAsked: string[], status: 'consent'|'running'|'crisis'|'done'|'stopped', startedAt, endedAt, mode: 'live'|'cache_only' }`.

**Passo** `step(state, event): Promise<{ state, say: Utterance }>` com `event = { kind: 'start' } | { kind: 'speech', text, audioMs } | { kind: 'skip' } | { kind: 'stop' }`. Ordem fixa dentro de `step`:
1. **Crise em código**: `detectCrisis(text)` (reuso de `src/lib/crisis`). Se bater, `status='crisis'`, fala = roteiro de crise adaptado à voz (CVV 188, SAMU 192, "vou avisar a Dra. X agora"), fim.
2. **Extração**: `ai.extractFindings({ blockId, probeId, text })` → `Finding[]` em esquema zod `{ tema, texto, duracao?, intensidade?: 'leve'|'moderada'|'forte', mencionaTrabalho: boolean, pediuParar: boolean }`. No mock: regex de duração ("há 3 meses", "desde setembro"), palavras-chave por tema, "parar/encerrar" → `pediuParar`.
3. **Seleção da próxima sonda** (código): se `pediuParar` → fechamento. Senão, dentro do bloco atual, primeira sonda cuja condição está ativa e ainda não foi feita (ex.: `semDuracao` quando nenhum achado do bloco tem duração); se nenhuma, ou bloco saturado (achados ≥ 2 e duração presente) ou turnos do bloco no máximo → próximo bloco, pergunta-base.
4. **Redação da fala** `ai.phraseUtterance({ acknowledgement: Finding|null, probeText })` → `{ ack: string }` de no máximo 1 frase curta que reflete o que a pessoa disse sem avaliar ("você falou que o cansaço é mais no fim do dia"). Fala final = `ack + ' ' + probeText` (o texto da sonda nunca é alterado pelo LLM). Filtros em código sobre `ack`: `assertNoForbidden` + lista de padrões de conselho (`você deveria`, `procure`, `tente`, `é importante que você`, `recomendo`); se bater, `ack` vira vazio. No mock: `ack` = modelo fixo por tema ("Entendi.", "Obrigada por contar.").
5. Em `mode: 'cache_only'`, o passo 4 é pulado: `ack` fixo do mock.

**Fala** `Utterance = { text: string; probeId: string | null; cacheKey: string | null; blockId; final: boolean }`. `cacheKey` existe quando a fala é 100% texto fixo (sonda sem ack, abertura, fechamento, crise).

**Resumo** `summarizeInterview(state): InterviewSummary` em esquema zod:
```ts
{ dificuldades_relatadas: [{ relato, duracao?, origem: ['turno 3 · 01:12'] }],
  impacto_no_trabalho: [{ texto, origem }], fatores_do_trabalho: [{ texto, origem }],
  barreiras_atendimento: [{ texto, origem }],
  sinais_de_alerta: { risco: boolean, origem },
  pontos_para_avaliacao: [{ texto, origem }], nao_respondido: string[],
  duracao_min: number, turnos: number }
```
`ai.summarizeInterview(turns, findings)` devolve o esquema; em código, **toda entrada com `origem` vazia ou que aponte para turno inexistente é descartada**, e `assertNoForbidden` roda em cada texto. No mock, o resumo é montado direto dos `findings` (sem LLM). Fonte do esquema: fluxo do colaborador, seção 4.1.

**Extensão da camada de IA**: `src/lib/ai/types.ts` ganha `extractFindings`, `phraseUtterance`, `summarizeInterview` (com implementações em `mock.ts` e `gateway.ts`, prompts em `prompts.ts`). Para não colidir com o terminal do MVP1, as três funções e seus prompts vivem em **arquivos novos** `src/lib/ai/interview.ts` (tipos + esquemas), `src/lib/ai/interview-mock.ts`, `src/lib/ai/interview-gateway.ts`, exportados por um `getInterviewAi()` em `src/lib/ai/interview.ts` que lê o mesmo `AI_PROVIDER`. `types.ts`, `mock.ts`, `gateway.ts` e `index.ts` **não são editados**.

### 5.3 Voz (`src/lib/voice/`)
- `voicebox.ts`: `tts({ text, profileId, language: 'pt' }) → Buffer (wav)`, `stt(audio: Buffer, mime) → { text, ms }`, `health() → { ok, profiles }`. Timeouts: TTS 20 s, STT 15 s. Erro vira `VoiceUnavailable`.
- `cache.ts`: `getOrGenerate(cacheKey, text)` grava em `public/voz/<profile>/<hash>.wav`; `pregerar()` percorre todas as falas fixas do protocolo (`cacheKey`) e gera. Script `scripts/voz-pregerar.ts`.
- `src/app/api/entrevista/[token]/turno/route.ts`: recebe `multipart` com `audio` (webm/opus ou wav) ou `{ text }` (modo texto para teste), converte com `ffmpeg` para wav 16 kHz se preciso, chama `stt`, carrega estado do banco, `step`, gera ou busca o áudio da fala, grava turno e áudio, responde `{ heard: string, say: string, audioUrl: string, status, blockLabel, elapsedMs }`.
- Quando Voicebox está fora: a tela mostra a fala em texto e usa `speechSynthesis` do navegador como reserva (voz feia, mas a demo não trava). Decisão minha.
- Variáveis: `VOICEBOX_URL=http://127.0.0.1:17493`, `VOICEBOX_PROFILE_ID`, `VOICEBOX_LANGUAGE=pt`, `INTERVIEW_MODE=live|cache_only`, `INTERVIEWER_NAME=Helena`.

### 5.4 Tela de chamada (`src/app/entrevista/[token]/page.tsx`)
- Estados: `consentimento` (texto curto: quem vai ouvir, que só a Dra. X vê, botão "aceito e quero começar", botão "prefiro não") → `chamada` → `encerrada`.
- Cartão central: foto redonda, nome, estado em pastilha: **ouvindo** (anel pulsando com o volume do mic), **pensando** (anel girando), **falando** (onda). Legenda abaixo com a fala atual. Linha fina do bloco atual ("Sobre o trabalho · 2 de 4").
- Botões: "pronto" (encerra o turno à mão), "pular pergunta", "encerrar". Tudo com texto, sem ícone sozinho.
- Captura: `getUserMedia` → `MediaRecorder` (webm/opus) + `AnalyserNode` para energia; começa a gravar quando a fala da IA termina; fecha o turno após 900 ms de silêncio depois de ter detectado voz, ou ao apertar "pronto"; máximo 60 s por turno. Enquanto a IA fala, o mic fica fechado (evita eco).
- Mobile-first, funciona no Safari do iPhone e no Chrome. Paleta do MVP1 (vermelho + pastéis). Desenho e crítica pela skill `impeccable` antes do PR.
- Sem WebSocket: cada turno é um `fetch`.

### 5.5 Página do médico (`src/app/medico/entrevista/[id]/page.tsx`)
- Acima: nome do colaborador, gravidade do questionário, duração, data. Esquerda: transcrição por turno com minuto. Direita: resumo por seção; cada frase com a origem clicável que rola até o turno. Áudio por turno com botão de ouvir.
- Se a tela do Caso do MVP1 existir, um link "Entrevista" na tela do Caso leva aqui (edição mínima, combinada com quem fizer o Caso; se não der, fica a URL direta).
- Convite: `POST /api/entrevista` cria a entrevista para um `runId` (ou para uma fixture, em dev) e devolve o link com token. Botão "Convidar para entrevista" na página do médico, ou `pnpm entrevista:convite --fixture prioridade` para a demo.

### 5.6 Dados (tabelas novas, sem mexer nas existentes)
- `interviews` (id, run_id → questionnaire_runs nullable, token único, status, mode, agenda jsonb, state jsonb, interviewer_profile, started_at, ended_at, created_at)
- `interview_turns` (id, interview_id, idx, speaker 'ai'|'person', text, audio_path, started_ms, duration_ms, created_at)
- `interview_summaries` (interview_id pk, json, created_at)
Áudio da pessoa fica em `data/entrevistas/<id>/<idx>.wav` fora de `public/`; só é servido pela rota autenticada do médico.

### 5.7 Protocolo v0 (texto fixo, `protocol.ts`)
Fonte: fluxo do colaborador seção 3.1 e ROADMAP MVP2. Marcado como **v0, não assinado por médico/psicólogo**.
- **Abertura**: "Oi, eu sou a Helena. Eu trabalho com a Dra. {medico}. Essa conversa leva uns dez minutos, e só ela vai ouvir o que você disser. Você pode pular qualquer pergunta ou parar quando quiser. Posso começar?"
- **Saúde**: base "O que você tem sentido nas últimas semanas?"; sondas: `desdeQuando` "Desde quando é assim?", `frequencia` "Isso acontece todo dia ou em períodos?", `piora` "O que você percebe que piora?", `alivia` "E o que alivia?", `procurou` "Você já procurou alguém por isso?", `tratamento` "Faz algum acompanhamento ou tratamento hoje?".
- **Trabalho**: base "E no trabalho, o que está mais difícil agora?"; sondas: `quandoMudou` "Quando isso começou a mudar?", `carga` "Quantas horas a mais você tem feito, mais ou menos?", `pausa` "Você consegue parar e descansar durante o dia?", `chefia` "Como está com a chefia e com os colegas?", `oQueFaltaria` "O que você precisaria ter para dar conta?".
- **Barreiras**: base "O que impediu você de buscar ajuda até agora?"; sondas: `horarioGarantido` "Se tivesse um horário garantido, você iria?", `pertoOuOnline` "Prefere algo perto de casa ou online?", `medoEmpresa` "Você tem receio de a empresa saber?".
- **Segurança** (sempre, sem sondas): "Nessas semanas, você teve pensamentos de se machucar, ou de que não vale a pena continuar?" Resposta positiva (padrões de crise ou "sim" após essa pergunta) → roteiro de crise.
- **Fechamento**: "Obrigada por conversar comigo. O que você contou vai só para a Dra. {medico}, e nada vai para a empresa. Ela entra em contato com você em até {prazo}. Se precisar de alguém agora, o CVV atende no 188, de graça, o dia todo."

### 5.8 Latência (orçamento por turno, alvo ≤ 4 s)
STT Whisper turbo local 0,5 a 1,5 s · LLM extração + redação 1 a 2 s (uma chamada só, saída em esquema) · TTS da frase de acolhimento 0,8 a 2 s (ou 0 em cache) · rede local. Medido na hora 0 com `scripts/voz-medir.ts`; o resultado define `INTERVIEW_MODE`.

### 5.9 Demo (encaixe no roteiro de 3 min)
Depois do caso subir para "prioridade" no MVP1: "A Dra. convida para a entrevista." Abre o link no celular, a Helena fala, a pessoa responde 3 ou 4 turnos ao vivo (saúde → trabalho), encerra. Na página do médico aparece o resumo com as origens. Se o tempo apertar, mostrar a página do médico já preenchida por uma entrevista gravada antes.

### 5.10 Ordem de corte
Página do médico vira JSON cru → `ack` gerado por LLM (fica `cache_only`) → pular pergunta → VAD (fica só o botão "pronto") → voz clonada (fica preset do Kokoro/CustomVoice) → **não caem**: motor com testes, crise em código, tela de chamada falando e ouvindo, resumo com origem.

### 5.11 Decisões minhas após a revisão do construtor
1. **HTTPS para o celular.** `getUserMedia` exige contexto seguro; `http://IP-do-Mac:3100` no iPhone não libera o microfone. A demo suporta dois modos: navegador do Mac (`localhost`, sem túnel) e celular via túnel HTTPS criado na hora 0 (`cloudflared tunnel --url http://localhost:3100`, sem conta; alternativa `tailscale funnel`, já usado pelo Marco). `INTERVIEW_PUBLIC_URL` define o domínio do link do convite. Safari iOS grava mp4/aac, não webm: a rota sempre converte com `ffmpeg` (já instalado) para wav 16 kHz antes do STT.
2. **Login e middleware.** A T11 do MVP1 vai proteger `/api/*` e `/(app)/*` por cookie `session=ok`. As rotas do colaborador (`/entrevista/[token]`, `/api/entrevista/[token]/turno`) precisam ficar públicas: peço ao dono da T11 (o próprio Marco, no outro terminal) uma linha na lista de exceções; até lá, a página do médico `/medico/entrevista/[id]` e a rota de áudio `/api/medico/entrevista/[id]/audio/[idx]` checam o mesmo cookie `session=ok` num guard próprio (`src/lib/interview/guard.ts`), para não depender do tempo do outro terminal. Áudio da pessoa nunca é servido de `public/`.
3. **Crise durante a entrevista mexe no caso do MVP1.** Quando `interviews.run_id` existe, a crise faz `UPDATE questionnaire_runs SET severity='urgency'` naquele run (só atualização de linha; nenhuma coluna nova), para o caso subir na Fila do médico como a regra do produto exige. Teste cobre isso.

### 5.12 Divisão com o Antigravity #2 (22h)
O Marco pediu ao agente Antigravity #2 (Maestro) que construa as telas (M5 do médico, `/entrevista/[token]` e a aba "Entrevista" em `/caso/[runId]`) na worktree `consultorio-nr7-ui`, branch `feature/m5-telas-medico`, com impeccable e taste-skill. Ele libera `/entrevista/*` e `/api/entrevista/*` no middleware da T11. Com isso, as seções 5.4 e 5.5 passam a ser dele; a pergunta 8.3 está respondida (aba no Caso). **Eu fico com** motor (`src/lib/interview`), IA da entrevista (`src/lib/ai/interview*`), voz (`src/lib/voice`), rotas `/api/entrevista/*` e `/api/medico/entrevista*`, tabelas novas e scripts. **Contrato**: `src/lib/interview/contract.ts` (zod + comentários com os endpoints). Até a merge, as telas usam dados falsos no formato do contrato.

## 6. O que fica para quem constrói
- Nomes exatos de componentes, hooks e estrutura dentro de `src/app/entrevista`.
- Limiar de energia do VAD e parâmetros do `MediaRecorder`.
- Formato do `cacheKey` e hash.
- Conversão de webm/opus para wav (ffmpeg via `child_process` ou aceitar webm direto se o Voicebox aceitar).
- Texto exato dos prompts de extração, redação e resumo.
- Os três fixtures sintéticos.

## 7. Como saber que deu certo
- Em modo mock, sem Voicebox: `pnpm test` passa; uma entrevista inteira roda por texto num teste com fixture "prioridade" e produz resumo com ≥ 3 entradas, todas com origem.
- Crise: 10 frases de risco + "sim" no bloco segurança → 100% cortam.
- 30 turnos sintéticos: 0 termo proibido, 0 padrão de conselho nas falas geradas.
- Ponta a ponta: abrir o link, falar, ouvir a Helena responder em ≤ 4 s, 3 turnos, encerrar, resumo visível ao médico com origem clicável.
- Latência medida e registrada em `docs/medicoes-voz.md`.

## 8. Decisões do Marco (7/11, 22h30)
1. **Chave do AI Gateway**: a providenciar pelo Marco; até lá o motor roda em mock. O código fica pronto para os dois modos.
2. **Voz criada por descrição** (Qwen VoiceDesign no Voicebox), sem clonar ninguém. Entrevistadora: Helena. Descrição inicial (minha): "mulher brasileira, 35 a 45 anos, voz calma e acolhedora, ritmo pausado, sem sotaque marcado". Plano B: preset pt do Qwen CustomVoice ou Kokoro.
3. **Onde o médico vê**: aba "Entrevista" em `/caso/[runId]`, construída pelo Antigravity #2 (seção 5.12).

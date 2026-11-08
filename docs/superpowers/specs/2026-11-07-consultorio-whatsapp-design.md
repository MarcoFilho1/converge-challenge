# Desenho: Consultório NR-7 por WhatsApp (primeira funcionalidade)

Data: 2026-11-07 (Converge Challenge, Recife, build de ~11,5 h).
Nome de trabalho da pasta: `consultorio-nr7` (trocar quando o time escolher o nome).
Material de origem: `~/Desktop/things/converge-ideias/definicao-tecnica-agente-nr1-2026-11-07.md` (seções 2, 3, 6, 7) e `fluxo-colaborador-agente-nr1-2026-11-07.html` (passos 1 a 4). Este documento recorta a **Porta Consultório** e descarta, por agora, a Porta Setor.

## 1. Intenção e porquê

A ideia foi nichada: fica só a parte do médico do trabalho (NR-7 / PCMSO). O sistema acompanha os colaboradores de uma empresa por **questionários no WhatsApp**, enviados por um bot que roda no **celular da própria empresa**. Cada resposta é conferida, por RAG, contra uma base de documentos psicológicos e normativos para apontar **indícios** (nunca diagnóstico). O **médico do trabalho** vê tudo num dashboard: contatos, conversas, respostas e os indícios encontrados, com a citação do trecho do documento que sustentou cada indício.

Por que agora: a NR-1 exige gestão de fatores psicossociais desde 26/5/2026 e multa desde 24/9/2026. O PCMSO (NR-7) é onde o médico usa esses resultados por pessoa. Não existe ferramenta barata que conduza a triagem pelo WhatsApp e entregue ao médico um resumo com origem verificável.

## 2. Objetivos, não objetivos, anti-objetivos

**Objetivos da primeira funcionalidade**
1. Médico entra no dashboard por uma tela de login simples (sem autenticação real) e tem acesso completo.
2. Tela de conexão mostra o QR Code; alguém lê com o celular da empresa; o estado da conexão aparece ao vivo.
3. Cadastro de contatos (colaboradores): nome, telefone, setor, cargo. CSV ou manual.
4. Disparo de questionário para um contato ou para um grupo, e envio de lembrete.
5. Bot conduz o questionário item a item pelo WhatsApp, aceita respostas numéricas ou por texto, guarda cada resposta.
6. A cada resposta, o sistema consulta a base de documentos e grava **indícios** com trecho e fonte.
7. Pontuação dos instrumentos em código (não LLM), com a regra de indício do fluxo do colaborador.
8. Corte de crise em código: item 9 do PHQ-9 ou padrões de risco na fala interrompem o questionário, mostram CVV 188 e SAMU 192 e marcam o caso como urgência no dashboard.
9. Dashboard: lista de contatos com estado (não enviado, em andamento, concluído, urgência), conversa completa de cada um, resumo dos indícios e escores, fila ordenada por gravidade.
10. Paleta vermelha com tons pastéis; telas desenhadas e revisadas com a skill impeccable.

**Não objetivos (ficam para depois)**
- Meet/entrevista por voz com IA (passo 2 do fluxo).
- Porta Setor, anonimizador, k-anonimato, dossiê do PGR.
- Autenticação real, múltiplos médicos, multiempresa.
- Integração com a API oficial da Meta.
- Apagar dados a pedido, retenção, RIPD.

**Anti-objetivos (fariam o produto falhar mesmo funcionando)**
- O bot dizer a alguém que ela "tem burnout/depressão". Linguagem só de indício.
- O LLM inventar número ou indício sem trecho de documento de origem.
- Dado individual aparecer fora do portal do médico.
- Usar o MBI (Maslach) ou qualquer instrumento pago.

## 3. Restrições

- Tempo: ~11,5 h de build, 4 pessoas, demo de 3 min no fim.
- Máquina: Mac do Marco, Docker 29 (OrbStack), Node 22, pnpm. Portas 3000, 5432, 6379 e 8080 **já estão ocupadas** por outros serviços; usar 3100 (Next), 5434 (Postgres), 6380 (Redis), 8082 (Evolution).
- WhatsApp: celular real da empresa (ou de alguém do time na demo), número não oficial. Evolution API usa Baileys; risco de ban se houver spam. Enviar só a quem foi cadastrado, com intervalo entre mensagens.
- Dados: só sintéticos na demo. Telefones reais só do time.
- LGPD: dado de saúde é sensível. Mesmo sem autenticação real agora, o banco do consultório é separado e nada dele é exposto por API pública sem a sessão de login.
- Custo de LLM: baixo; uma chamada por resposta recebida mais uma por resumo.
- **Operacional (revisor, pergunta 6):** a primeira hora do plano valida Evolution API + QR num celular real e a chave do provedor de LLM. Plano B (whatsapp-web.js) fica pronto para troca se a Evolution falhar. Chave do LLM: ver pergunta aberta ao Marco em 8.

## 4. Abordagens consideradas

**WhatsApp**
- **A. Evolution API em Docker (escolhida pelo Marco).** Serviço separado com Baileys, sem Chromium. REST para criar instância e pegar QR, webhook para receber mensagens. Estável, bem documentada em português, celular trocável. Custo: Docker com Postgres e Redis, ~30 a 45 min de setup.
- B. whatsapp-web.js dentro do app. Mais rápido de começar, mas Puppeteer/Chromium pesa a máquina e quebra com atualizações do WhatsApp Web. Plano B se o Docker falhar.
- C. Venom. Mesma base do wwebjs, menos mantido. Descartado.

**RAG**
- **A. Postgres com pgvector no mesmo container do Evolution (escolhida, decisão minha).** Um banco para o app, um para o Evolution. Menos peças. Chunks de ~500 tokens, embedding por chunk, busca por similaridade com filtro por tipo de documento.
- B. Banco vetorial separado (Chroma, Qdrant). Mais uma peça para cair na demo. Descartado.
- C. Sem vetor: o LLM lê os documentos inteiros a cada resposta. Caro e lento; perde a citação precisa. Descartado.

**Onde o "indício" nasce**
- **A. Duas camadas (escolhida, decisão minha).** Escore e regra de indício em código (determinístico, reprodutível). RAG + LLM só para *explicar* a resposta com trechos dos documentos e para ler respostas em texto livre. O LLM nunca decide "indício sim/não" sozinho.
- B. LLM decide tudo lendo os documentos. Não auditável, alucina. Descartado.

## 5. O que foi decidido

### 5.1 Pilha
- Next.js 15 (App Router, TypeScript) na porta 3100. Server Actions e Route Handlers para API.
- Postgres 16 com pgvector (imagem `pgvector/pgvector:pg16`) na 5434, com dois bancos: `evolution` e `consultorio`. Redis na 6380 só para o Evolution.
- Evolution API v2 (imagem `atendai/evolution-api:v2.x`) na 8082, com webhook apontando para `http://host.docker.internal:3100/api/webhook/whatsapp`.
- Camada de IA com provedor trocável por `.env` (ver seção 8): `mock` por padrão, `gateway` (Vercel AI SDK + AI Gateway, Claude Sonnet 5.5) quando houver chave.
- Drizzle ORM para o schema do app. `docker-compose.yml` na raiz sobe tudo.
- impeccable para desenho e crítica das telas antes do PR.

### 5.2 Fluxo do colaborador (via WhatsApp)

> **Atualizado em 7/11 20h com a pesquisa `docs/questionario-whatsapp.md`, que prevalece sobre os itens 2 e 3 abaixo e sobre a regra de 5.3.** Roteiro completo: tronco de presenteísmo → WPAI Q5 (se tronco sim) → PHQ-2 (+ itens 3–8 se ≥2) → PHQ item 9 sempre → GAD-2 (+ itens 3–7 se ≥2) → BAT-12 → COPSOQ 2A, 4A, 12B, 23 → 2 abertas (5 a 8,5 min). SPS-6 sai (licença Merck/Stanford). Demo: tronco, WPAI Q5, BAT 1, PHQ 1, 2 e 9, COPSOQ 2A, aberta 1. Regra: urgência = PHQ item 9 ≥1 ou crise no texto; prioridade = C e (A ou B), ou C grave; atenção = (A e B) ou C ou assédio. Cortes: PHQ-9 ≥10 (grave ≥15), GAD-7 ≥10 (grave ≥15), BAT-12 média ≥2,54 (grave ≥2,96), WPAI Q5 ≥3 (operacional). Implementado em `src/lib/instruments/`.

1. Médico seleciona contatos e clica "Enviar questionário". Bot envia: quem é, o que vai perguntar, quanto tempo leva (~6 min), que o destinatário é o médico do trabalho, e pede consentimento ("responda SIM para começar").
2. Blocos, nesta ordem: tronco da SPS-6 (trabalhou com problema de saúde no último mês?) → SPS-6 (6 itens) → WPAI-GH (4 itens) → BAT-12 (12 itens) → PHQ-9 (9 itens) → GAD-7 (7 itens) → 2 abertas ("o que no trabalho está mais difícil agora?", "o que ajudaria?"). Um item por mensagem, com a escala em texto (ex.: "1 nunca · 2 raramente · 3 às vezes · 4 frequentemente · 5 sempre").
3. Resposta fora do formato: o LLM interpreta texto para o valor da escala; se não der, o bot repete o item uma vez.
4. "PARAR" encerra a qualquer momento; o que foi respondido fica.
5. Fim: "Obrigado. Suas respostas vão para o Dr(a). X. Se precisar de ajuda agora: CVV 188."

### 5.3 Pontuação e indício (em código)
- SPS-6 soma 6 a 30; WPAI prejuízo no trabalho 0 a 10; BAT-12 média por dimensão (exaustão, distanciamento, prejuízo cognitivo, prejuízo emocional); PHQ-9 soma 0 a 27; GAD-7 soma 0 a 21.
- INDÍCIO = (A) tronco SPS-6 sim **e** (B) SPS-6 abaixo do corte ou WPAI ≥ 3 **e** (C) BAT exaustão alta ou PHQ-9 ≥ 10 ou GAD-7 ≥ 10.
- Gravidade: atenção = A+B; prioridade = A+B+C; urgência = PHQ-9 item 9 > 0 ou padrão de risco na fala.
- Cortes padrão da literatura brasileira; ajustáveis por constante no código. Documentar a fonte de cada corte junto da constante.
- **Decisão minha (revisor, pergunta 3):** a regra acima é de *presenteísmo*. Para não esconder caso grave de quem respondeu "não" no tronco, acrescento uma trilha clínica: qualquer (C) positivo sozinho vira pelo menos **atenção**, com etiqueta "sinal clínico sem presenteísmo relatado". Questionário incompleto (PARAR, crise, demo curta): pontua só os instrumentos completos, os demais aparecem como "não avaliado", e o caso recebe a etiqueta "parcial". A gravidade usa o que existe.

### 5.4 RAG
- Pipeline de ingestão: `pnpm ingest` lê PDFs/HTML da pasta `knowledge/`, divide em chunks, embeda, grava em `document_chunks` com metadados (documento, página, tipo: instrumento | norma | guia | protocolo de crise).
- Base inicial (pesquisa concluída, lista completa em `docs/fontes-base-de-conhecimento.md`; 7 PDFs já em `knowledge/`): Guia MTE de fatores psicossociais (2025), NR-1 (2025), NR-7, COPSOQ II-Br curto com cortes seguro/atenção/risco (RBSO 2026), BAT versão brasileira + cortes do manual, SRQ-20 validação BR, Cartilha Amarela MTE (assédio e protocolo de ajuda), texto do CVV sobre como ajudar quem pensa em suicídio, GAD-7 (Moreno 2016), PHQ-9 (Santos 2013). SPS-6 e WPAI entram como Markdown escrito à mão (ver decisão abaixo). Não usar MBI nem JCQ completo (licença).
- A cada resposta recebida: busca os 5 chunks mais próximos do par (item, resposta) e pede ao LLM, com saída em esquema fixo, `{relevante: boolean, tema, explicacao_curta, trechos:[{documento, pagina, texto}]}`. Se o LLM devolver `relevante` sem trecho, o registro é descartado e logado.
- **Decisão minha (revisor, pergunta 2):** o resultado do RAG é só *explicação anexada*. Ele nunca entra na gravidade nem na ordem da fila. Gravidade vem só da regra em código (5.3). Na tela do Caso, o bloco "Indícios" mostra os itens que a regra marcou; cada um traz embaixo os trechos que o RAG achou para aquela resposta. `evidence.flagged_by` fica para rastrear a origem, não para decidir.
- **Decisão minha (revisor, pergunta 1):** quando o manual de um instrumento não for de uso livre para embedar, escrevemos à mão um arquivo Markdown em `knowledge/instrumentos/<nome>.md` com itens, escala, pontuação e cortes, citando o artigo de validação brasileiro. Isso garante trecho de origem para todo corte, mesmo sem o PDF original.
- No fim do questionário: o LLM gera um resumo estruturado no esquema do fluxo do colaborador (dificuldades relatadas, impacto funcional, fatores do trabalho, pontos para avaliar, não respondido), cada campo citando item ou trecho.

### 5.5 Corte de crise
- Em código, antes de qualquer chamada de LLM: PHQ-9 item 9 > 0 **ou** regex de padrões (lista em `src/lib/crisis-patterns.ts`, pt-BR: "me matar", "não vale a pena viver", "sumir", "acabar com tudo", etc.).
- Ação: interrompe o questionário, envia CVV 188 e SAMU 192, oferece continuar depois, marca o caso como **urgência** e destaca no topo da fila do médico.
- **Decisão minha (revisor, pergunta 5):** `crisis` é estado terminal do run. A mensagem final diz "quando quiser continuar, escreva CONTINUAR". Esse comando abre um **novo** run que começa do item seguinte ao interrompido, herdando as respostas; a urgência do run anterior fica registrada no caso. Mensagem com padrão de risco fora de um run ativo (horas depois, por exemplo) cria um run com status `crisis` imediatamente e dispara o mesmo aviso. O webhook, portanto, sempre passa toda mensagem recebida pelo detector de crise antes de qualquer outra coisa.

### 5.6 Dashboard (médico)
Telas, nesta ordem de prioridade:
1. **Login**: campo de e-mail e senha, qualquer valor entra; grava cookie de sessão simples.
2. **Conexão**: QR Code do Evolution, estado (desconectado, aguardando leitura, conectado, número conectado), botão "nova sessão".
3. **Contatos**: tabela (nome, telefone, setor, estado do questionário, gravidade), importar CSV, adicionar manual, selecionar e "Enviar questionário" / "Lembrar".
4. **Fila**: casos ordenados por gravidade (urgência, prioridade, atenção, sem indício), com escores em pastilhas.
5. **Caso**: à esquerda a conversa completa do WhatsApp; à direita escores, indícios com o trecho e a fonte, resumo estruturado, ações: "encaminhar", "acompanhar", "encerrar" (só mudam o estado por enquanto).
- Paleta: vermelho como cor de marca e de urgência, fundo e cartões em tons pastéis (rosa claro, pêssego, areia). Verde pastel só para "sem indício". Contraste checado pela impeccable.
- Atualização ao vivo da conversa por polling de 3 s (sem WebSocket na v1).

### 5.7 Modelo de dados (banco `consultorio`)
- `contacts` (id, name, phone_e164, sector, role, created_at)
- `questionnaire_runs` (id, contact_id, status: pending|consent|in_progress|done|stopped|crisis, current_item, started_at, finished_at, severity)
- `messages` (id, run_id, direction: in|out, text, wa_message_id, created_at)
- `answers` (id, run_id, instrument, item_code, raw_text, value_numeric)
- `scores` (run_id, instrument, dimension, value, cutoff, flagged)
- `evidence` (id, run_id, answer_id, theme, explanation, chunk_id, flagged_by: rule|rag)
- `summaries` (run_id, json, created_at)
- `documents` (id, title, source_url, kind, license) e `document_chunks` (id, document_id, page, text, embedding vector(1536))
- `wa_sessions` (instance_name, state, phone, updated_at)

### 5.8 Demo (3 min)
1. Login → Conexão: alguém do time lê o QR com o celular.
2. Contatos: importar CSV sintético de 12 pessoas; um deles é o telefone de uma pessoa do time.
3. Enviar questionário; a pessoa responde ao vivo no palco (versão curta de 8 itens para a demo, flag `DEMO_SHORT=true`).
   - **Decisão minha (revisor, pergunta 4):** os 8 itens são: tronco SPS-6; SPS-6 item 2 (concentração); WPAI item 3 (prejuízo no trabalho 0 a 10); BAT-12 itens 1 e 2 (exaustão); PHQ-9 itens 1, 2 e 9. Roteiro no palco: sim · 2 · 7 · 4 · 4 · 2 · 2 · 0 → cai em **prioridade** (A+B+C). Para mostrar a crise, a pessoa manda depois uma frase livre com padrão de risco. Os outros 11 contatos do CSV têm runs sintéticos já gravados cobrindo sem indício, atenção, prioridade e um parcial.
4. Fila mostra o caso subindo para "prioridade"; abrir o Caso: conversa, escores, indícios com trecho da NR-1 e do manual do BAT.
5. Mostrar o corte de crise com uma frase de risco: bot responde com CVV, caso vira urgência.

### 5.9 Ordem de corte se faltar tempo
Resumo estruturado → importação CSV (fica só manual) → GAD-7 → lembrete → polish visual. **Não caem:** QR Code conectando, questionário rodando no WhatsApp, indício com trecho de documento, corte de crise, tela do Caso.

## 6. O que fica para quem constrói
- Divisão exata dos chunks, modelo de embedding e dimensão do vetor.
- Formato exato das mensagens do bot (texto, emojis, quebras).
- Como armazenar a sessão do Evolution entre reinícios (volume Docker).
- Tratamento de duplicidade de webhook e de mensagens fora de ordem.
- Dados sintéticos do CSV.
- Estrutura de pastas e nomes de componentes.

## 7. Como saber que deu certo
- Ponta a ponta: QR lido → questionário enviado → respostas gravadas → escores e indícios aparecem no Caso com trecho e fonte.
- Zero indício sem trecho de origem (teste automático sobre 20 respostas sintéticas).
- Zero termo proibido no texto gerado ("você tem", "diagnóstico", "burnout", "depressão") em 20 resumos sintéticos.
- Corte de crise dispara em 100% de 10 frases de teste e em PHQ-9 item 9 > 0.

## 8. Decisão do Marco sobre o LLM (aprovado em 7/11)
- Sem chave por agora. Toda chamada de IA passa por uma camada única `src/lib/ai/` com duas implementações escolhidas por variável de ambiente:
  - `AI_PROVIDER=mock` (padrão): embeddings determinísticos (hash do texto → vetor), "LLM" que devolve indícios e resumos a partir de regras simples sobre a resposta e os chunks recuperados por busca textual. Funciona offline e permite a demo inteira.
  - `AI_PROVIDER=gateway`: Vercel AI SDK com AI Gateway (`AI_GATEWAY_API_KEY`), modelo de chat e de embeddings definidos por `AI_CHAT_MODEL` e `AI_EMBEDDING_MODEL`.
- A interface da camada (embed, classifyAnswer, summarizeRun) e os esquemas de saída são os mesmos nos dois modos. Trocar de modo é só editar `.env` e rodar a ingestão de novo.
- Busca vetorial fica no pgvector nos dois modos; no mock a dimensão do vetor é a mesma do modelo real para não migrar o schema depois.

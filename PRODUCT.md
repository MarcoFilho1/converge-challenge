# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Médico do Trabalho (PCMSO / NR-7):** Usuário primário do dashboard. Atua em clínicas de SST ou ambulatórios corporativos, avaliando periódicos e casos priorizados. Precisa identificar rapidamente colaboradores em urgência, prioridade ou atenção, ler os escores validados, inspecionar os trechos normativos/clínicos que sustentam cada indício e encaminhar/acompanhar o caso sem expor nenhum dado individual à empresa.
2. **Colaborador da Empresa:** Responde ao questionário inicial via WhatsApp e, quando há indício, participa de uma entrevista curta por voz na web (`/entrevista/[token]`) conduzida pela entrevistadora de IA (Helena), com consentimento explícito e garantia de sigilo médico.

## Product Purpose

Permitir que o médico do trabalho acompanhe fatores psicossociais e sinais de presenteísmo, esgotamento e sofrimento mental dos colaboradores por meio de questionários validados no WhatsApp e entrevista estruturada por voz na web, entregando uma fila priorizada e prontuários onde cada indício e cada frase do resumo citam obrigatoriamente sua fonte (item do instrumento, trecho de norma/manual via RAG ou minuto da entrevista).

## Positioning

Diferente de pesquisas de clima genéricas ou chatbots terapêuticos não auditáveis, o Consultório NR-7 calcula escores, gravidade e corte de crise de forma 100% determinística em código (nunca delegando decisão clínica ao LLM) e exige rastreabilidade probatória para cada indício (trecho literal da NR-1, NR-7, manuais BAT-12, PHQ-9, GAD-7, WPAI, COPSOQ II ou turno/minuto da entrevista), mantendo sigilo médico estrito (LGPD art. 11 / CFM 2.454/2026).

## Operating Context

- Uso diário pelo médico do trabalho em desktop (1440px) e tablet/notebook durante consultas ocupacionais (PCMSO / NR-7), e uso mobile (390px) pelo colaborador no WhatsApp e na sala de entrevista por voz (`/entrevista/[token]`).
- Conectado ao aparelho WhatsApp do consultório/empresa via Evolution API (QR Code Baileys) e ao motor de voz local Voicebox (Whisper STT + Qwen3-TTS).

## Capabilities and Constraints

- **Linguagem estritamente de indício:** O sistema usa apenas "indício", "sinal" e "relatou". Termos diagnósticos ("você tem", "diagnóstico", "burnout", "depressão", "transtorno") são bloqueados em código (`assertNoForbidden`).
- **Corte de crise determinístico:** Frases de risco ou item 9 do PHQ-9 ≥ 1 interrompem imediatamente o fluxo, apresentam CVV 188 e SAMU 192 e elevam o caso a `Urgência` no topo da fila do médico.
- **Trilha de Gravidade em código:** `Urgência` (crise ou PHQ-9 #9 ≥ 1), `Prioridade` (sinal clínico C + presenteísmo A ou prejuízo B, ou C grave), `Atenção` (A+B, C isolado com etiqueta "sinal clínico sem presenteísmo relatado", ou assédio COPSOQ), `Sem indício`.
- **Rastreabilidade obrigatória:** Nenhum indício é gravado sem `chunk_id` da base de conhecimento; nenhuma frase do resumo da entrevista entra sem referência ao turno/minuto.

## Brand Commitments

- Marca **praevenius** (logo em azul e pêssego, decisão do Guilherme em 8/11/2026). Paleta: azul `#006EB8` para a ação principal, links e marca; pêssego `#FDD4BD` para destaques acolhedores; fundo `#F8FAF9`; superfícies brancas; texto grafite azulado `#24363B`.
- Vermelho clínico (`--alert: #B3261E`) só para urgência, crise e escores acima do corte. Nunca como cor de marca.
- Direção de interface "Prontuário em ordem" (escolhida pelo Marco em 8/11/2026): sem cor na moldura, uma ação azul por tela, gravidade como um ponto colorido, cada caso explicado por uma frase em português calculada em código, detalhe técnico dobrado.

## Evidence on Hand

- Base de conhecimento real em `knowledge/` e `docs/fontes-base-de-conhecimento.md` (NR-1 2025, NR-7, Guia MTE 2025, Cartilha Amarela MTE, BAT-12 Brasil, PHQ-9 Santos 2013, GAD-7 Moreno 2016, WPAI-GH Ciconelli 2006, COPSOQ II-Br RBSO 2026, protocolo CVV 188).
- Dados de demonstração são explicitamente sintéticos (`scripts/demo-contatos.csv` e `scripts/seed.ts`).

## Product Principles

1. **Código decide, IA explica e resume:** Pontuação, gravidade, pauta de entrevista e corte de crise são determinísticos; o modelo apenas organiza relatos e anexa trechos de referência.
2. **Proveniência visível em cada tela:** Todo alerta, escore ou resumo mostra sua regra ou citação de origem ao lado do número.
3. **Sigilo médico na estrutura da interface:** A interface do médico deixa claro o escopo restrito ao PCMSO/NR-7 e nunca oferece exportação individual para RH/empresa.
4. **Calma clínica e precisão tabular:** O vermelho é reservado para urgência e sinais acima do ponto de corte; o restante da interface opera com sobriedade tipográfica e alinhamento numérico rigoroso.

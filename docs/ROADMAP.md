# Roadmap · Consultório NR-7 por WhatsApp

Converge Challenge, Recife, 7–8/11/2026. Atualizado em 07/11/2026, 20h.

## O produto em uma frase

O médico do trabalho acompanha os colaboradores da empresa por questionários validados no WhatsApp, e o sistema aponta quem merece atenção, sempre com a fonte que sustenta cada indício.

## Por que agora

- A NR-1 obriga toda empresa a gerenciar riscos psicossociais desde 26/05/2026. Multas desde 24/09/2026.
- A NR-7 (PCMSO) é onde o médico do trabalho usa esses sinais por pessoa.
- Hoje isso é feito com formulário em papel ou planilha, uma vez por ano, sem acompanhamento.

## Regras que não mudam em nenhuma fase

- Não é diagnóstico. O sistema fala em "indício" e "sinal", nunca em "você tem", "burnout", "depressão" ou "transtorno".
- Corte de crise em código, antes de qualquer IA. Frase de risco ou item 9 do PHQ-9 interrompe tudo, mostra CVV 188 e SAMU 192 e marca urgência para o médico.
- Pontuação e gravidade são calculadas em código. A IA só explica e resume.
- Nenhum indício aparece sem o trecho do documento de origem.
- Só o médico vê o indivíduo. A empresa não recebe dado individual.
- Dados sintéticos na demo. Telefone real só do time.

---

## MVP1 · Questionário pelo WhatsApp (sem entrevista)

**O que entrega.** O médico entra no dashboard, conecta o celular da empresa pelo QR Code, cadastra os colaboradores e dispara o questionário. O bot pergunta um item por mensagem. Cada resposta é pontuada e conferida contra a base de documentos. O médico vê a fila por gravidade e abre cada caso com conversa, escores, indícios com fonte e um resumo.

**Fluxo do colaborador**

1. Recebe mensagem: quem fala, quanto tempo leva, que só o médico vê. Responde SIM para começar.
2. Responde os itens com número ou texto curto. Pode escrever PARAR a qualquer hora.
3. Se escrever algo de risco, o bot para, manda CVV 188 e SAMU 192 e avisa o médico. CONTINUAR retoma depois.
4. Ao fim, recebe agradecimento e o lembrete do CVV.

**Questionário.** Pesquisado e fechado em `docs/questionario-whatsapp.md`. Só instrumentos validados no Brasil e de uso livre, com o texto original:

| Bloco | Itens | Para quê |
|---|---|---|
| Presenteísmo | Pergunta-tronco (trabalhou doente nos últimos 30 dias?) e WPAI Q5 (prejuízo de 0 a 10) | Se o problema de saúde atrapalha o trabalho |
| Humor | PHQ-2, com os outros itens do PHQ-9 só se der positivo. O item 9 é sempre perguntado | Rastreio de depressão e segurança |
| Ansiedade | GAD-2, com o GAD-7 completo só se der positivo | Rastreio de ansiedade |
| Cansaço no trabalho | BAT-12 | Esgotamento ligado ao trabalho |
| Ambiente de trabalho | COPSOQ II-Br: ritmo, influência, apoio do chefe, assédio | O porquê no trabalho, que é o foco da NR-1 |
| Abertas | O que está mais difícil? O que ajudaria? | A voz do colaborador |

Leva de 5 a 8,5 minutos. A demo usa 8 itens: tronco, WPAI Q5, BAT 1, PHQ 1, 2 e 9, ritmo e uma aberta.

**Gravidade (em código)**

| Nível | Quando |
|---|---|
| Urgência | Item 9 do PHQ-9 acima de zero, ou frase de risco em qualquer mensagem |
| Prioridade | Sofrimento (BAT-12 ≥2,54, PHQ-9 ≥10 ou GAD-7 ≥10) junto com presenteísmo ou prejuízo no trabalho. Ou sofrimento grave sozinho |
| Atenção | Presenteísmo com prejuízo no trabalho, ou sofrimento sozinho, ou relato de assédio |
| Sem indício | Nenhum dos anteriores |

**Telas do médico.** Login simples, Conexão (QR Code), Contatos (cadastro, CSV, disparo), Fila (por gravidade), Caso (conversa, escores, indícios com trecho, resumo, encaminhar/acompanhar/encerrar). Paleta vermelha com tons pastéis.

**Pilha.** Next.js 16, Postgres com pgvector, Evolution API em Docker (celular da empresa vira o bot), Redis, Vitest. IA em modo simulado por padrão, trocável por chave real via `.env`.

**Marcos e tarefas.** Cada tarefa é uma issue no hackhub e tem as interfaces exatas no plano (`docs/superpowers/plans/2026-11-07-consultorio-whatsapp.md`).

| Marco | Tarefas | Quem | Status |
|---|---|---|---|
| M1 Infra e banco | T1 esqueleto + Docker · T2 schema | Marco | Pronto (PR #2) |
| M2 Questionário e regras | T3 itens e pontuação · T4 detector de crise · T5 camada de IA · T8 motor do questionário | Marco | T3, T4, T5 prontas; T8 em andamento |
| M3 WhatsApp | T7 cliente Evolution · T10 webhook | Marco | T7 pronta; T10 depois da T8 |
| M4 RAG e indícios | T6 ingestão dos documentos · T9 indícios com fonte e resumo | **Livre** | A fazer |
| M5 Telas do médico | T11 login e tema · T12 Conexão · T13 Contatos · T14 Fila · T15 Caso | **Livre** | A fazer |
| M6 Demo | T16 dados sintéticos · T17 evals de segurança · T18 polimento e ensaio | T16 e T17 livres, T18 Marco | A fazer |

**Ordem de corte se faltar tempo.** Evals viram checagem manual, depois importação CSV, depois GAD-7, depois lembrete, depois polimento. Não caem: QR conectando, questionário rodando, indício com fonte, corte de crise e tela do Caso.

**Demo de 3 minutos**

1. Login e QR Code lido ao vivo pelo celular.
2. Importa a lista de colaboradores.
3. Dispara o questionário curto. Alguém do time responde no palco.
4. A Fila mostra o caso subindo para "prioridade". O Caso mostra conversa, escores e indícios com o trecho da fonte.
5. Uma frase de risco: o bot responde com CVV e o caso vira urgência no topo da fila.

---

## MVP2 · Entrevista com IA (depois do MVP1)

**O que acrescenta.** Quando o questionário dá indício, o colaborador é convidado para uma entrevista curta com IA, por texto no WhatsApp ou por voz numa página web. A entrevista investiga o contexto: o que a pessoa sente, desde quando, o que no trabalho pesa, e o que impede de procurar ajuda. O médico recebe um resumo em que cada frase cita o que a pessoa disse.

**Fluxo em quatro passos**

1. **Identificar.** É o MVP1. O questionário decide "indício sim ou não" em código.
2. **Investigar.** Entrevista de 10 a 15 minutos, presa a uma pauta fixa.
3. **Encaminhar.** Resumo estruturado para o médico, com origem de cada frase. Sem médico na empresa, o colaborador escolhe um atendimento externo.
4. **Acompanhar.** Estados encaminhado, agendado, atendido e reavaliado. Lembretes e reaplicação no prazo que o médico definir.

**Protocolo da entrevista.** Três domínios mais um bloco de segurança. Cada domínio tem perguntas-base fixas e sondas permitidas. A IA não cria perguntas fora disso, não aconselha e não nomeia condição.

| Domínio | Exemplo de pergunta-base |
|---|---|
| Dificuldade de saúde | O que você sente? Desde quando? Já procurou alguém? |
| Condições de trabalho | O que no trabalho está mais difícil agora? Carga, prazos, turno, chefia? |
| Barreiras para buscar ajuda | O que impediu de buscar ajuda até agora? |
| Segurança (sempre) | Pensamentos de se machucar? Resposta positiva corta a entrevista e aciona o protocolo de crise. |

Um motor de pauta em código monta a ordem: os domínios com item em atenção no questionário vêm primeiro.

**Peças técnicas novas**

- Motor de pauta em código, alimentado pelas respostas do MVP1.
- Agente de entrevista preso ao bloco atual, que só escolhe a próxima sonda.
- Canal de texto no WhatsApp, reaproveitando o bot do MVP1.
- Canal de voz numa página web: fala para texto, modelo, texto para fala. Sem avatar.
- Resumo com citação obrigatória de cada frase da transcrição.
- Máquina de estados do caso com lembretes e reavaliação.
- Consentimento específico para a entrevista, revogável, e apagar dados a pedido.

**O que precisa antes de ir para piloto**

- Um médico do trabalho e um psicólogo revisam e assinam a versão 1 do protocolo.
- Avaliação às cegas de resumos por médicos: nota mínima 4 de 5, zero invenções.
- Relatório de impacto à proteção de dados e contrato de operador com a clínica.

**Marcos propostos do MVP2**

| Marco | Entrega |
|---|---|
| M7 Pauta | Protocolo em arquivo + motor de pauta com testes |
| M8 Entrevista por texto | Agente no WhatsApp preso à pauta, com corte de crise |
| M9 Resumo citado | Resumo em que cada frase aponta o trecho da conversa |
| M10 Acompanhamento | Estados do caso, lembretes e reavaliação |
| M11 Voz na web | Página com entrevista por voz |

---

## Como contribuir

1. Leia o desenho e o plano em `docs/superpowers/`.
2. No hackhub, pegue uma issue livre com `issue_claim`. Respeite as dependências.
3. Git flow: crie `feature/<tarefa>` a partir de `develop`, abra PR para `develop`. Nada direto em `main` ou `develop`.
4. Escreva o teste antes do código. Rode `pnpm test` antes do PR.
5. Toda tela passa pela skill impeccable antes do PR.

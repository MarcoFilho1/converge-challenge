# Questionário pelo WhatsApp: itens, cortes e roteiros

Pesquisa feita em 07/11/2026 para o MVP do hackathon. Objetivo: triagem de presenteísmo e sofrimento relacionado ao trabalho, para o médico do trabalho decidir quem chamar primeiro. **Não é diagnóstico.** Os dados individuais vão só para o médico.

Fontes: PDFs locais em `knowledge/`, formulários oficiais baixados (Pfizer/PHQ, Reilly/WPAI), artigos na SciELO e PMC e resumos do PubMed. A lista completa está na seção 9. Onde não consegui confirmar o texto validado, está escrito **NÃO CONFIRMADO**.

---

## 0. Resumo

### 0.1 Os dois roteiros

| | **(a) Completo, para uso real** | **(b) Demo de palco** |
|---|---|---|
| Blocos | Consentimento → tronco de presenteísmo → WPAI-GH Q5 → PHQ-2 (+PHQ itens 3–8 se PHQ-2 ≥2) → **PHQ item 9 sempre** → GAD-2 (+GAD itens 3–7 se GAD-2 ≥2) → BAT-12 → 4 itens do COPSOQ II-Br → 2 perguntas abertas → encerramento | Tronco → WPAI Q5 → BAT item 1 (exaustão) → PHQ item 1 → PHQ item 2 → PHQ item 9 → COPSOQ 2A (ritmo) → 1 pergunta aberta |
| Itens | Mínimo 22 fechados + 2 abertos; máximo 35 fechados + 1 de seguimento + 2 abertos | 8 |
| Tempo estimado* | **5 a 8,5 min** (típico ~7 min) | ~1 min com respostas prontas |
| Fica de fora | SPS-6 (vira módulo opcional), WPAI Q1–Q4 e Q6, PHQ-9 completo quando o PHQ-2 dá negativo, GAD-7 completo quando o GAD-2 dá negativo, BAT-23, HSE | Quase tudo. A demo **não** gera escore validado, só mostra o fluxo |

*Estimativa minha, não de um artigo: 10 a 12 s por item fechado no WhatsApp e 40 a 50 s por pergunta aberta.

### 0.2 Cortes adotados

| Medida | Corte | Fonte |
|---|---|---|
| Tronco de presenteísmo | "Sim" = A | Paschoalin, tese UFRJ 2012, questionário B6 (p. 154) |
| WPAI-GH Q5 (0–10) | **≥3** = B (**operacional, sem validação**) | O WPAI não tem corte validado. Escore de presenteísmo = Q5 × 10% |
| SPS-6, se usar o módulo | **6–18** = desempenho reduzido (B) | Koopman 2002, citado por Paschoalin, tese 2012, p. 63, Tabela 1 |
| PHQ-2 como porta de entrada | **≥2** abre os itens 3–8 | Levis 2020, JAMA (PHQ-2 ≥2 seguido de PHQ-9 ≥10) |
| PHQ-9 | **≥10** = C. ≥15 = grave | de Lima Osório 2009 (Brasil, SCID): ≥10. Manual Pfizer: 10 = alerta amarelo, 15 = vermelho |
| PHQ item 9 | **≥1** (qualquer resposta diferente de "nenhuma vez") = urgência | Manual Pfizer p. 2. Simon 2016 |
| GAD-2 como porta de entrada | **≥2** abre os itens 3–7 (escolha de produto, ver 1.2) | Manual Pfizer recomenda ≥3; Silva 2018 (Manaus) mostra baixa sensibilidade com ≥3 |
| GAD-7 | **≥10** = C. ≥15 = grave | Manual Pfizer p. 6; Plummer 2016. **Não há corte validado no Brasil** |
| BAT-12 (média 1–5) | **≥2,54** = risco (C). **≥2,96** = burnout provável/grave | Schaufeli 2023, SJWEH, Tabela 3 (amostra conjunta) |
| COPSOQ, comportamentos ofensivos | Qualquer "sim" = W (fator do trabalho) | Sato 2026 (RBSO): não se classificam porque são "situações inaceitáveis" |

### 0.3 Regra de indício proposta

- **Urgência:** PHQ item 9 ≥1, ou texto livre com sinal de crise. Passa por cima de tudo.
- **Prioridade:** C com A ou B. Ou C grave sozinho (PHQ-9 ≥15, GAD-7 ≥15 ou BAT-12 ≥2,96).
- **Atenção:** A+B, ou C sozinho, ou W.
- **Sem indício:** o resto.

A seção 7 explica cada mudança em relação à regra atual.

---

## 1. Que perguntas entram e por quê

### 1.1 PHQ-2 como porta de entrada para o PHQ-9

- **O que mede:** humor deprimido e perda de interesse, os dois sintomas centrais de depressão. São os itens 1 e 2 do PHQ-9.
- **Evidência:**
  - Meta-análise com dados individuais de 100 estudos (44.318 pessoas; Levis 2020, JAMA 323:2290):
    - PHQ-2 ≥2: sensibilidade 0,91, especificidade 0,67.
    - PHQ-2 ≥3: sensibilidade 0,72, especificidade 0,85.
    - **PHQ-2 ≥2 seguido de PHQ-9 ≥10:** sensibilidade 0,82 contra 0,86 do PHQ-9 sozinho, que não é diferença significativa. Especificidade levemente maior.
    - Essa combinação poupa o PHQ-9 completo em **57%** das pessoas.
  - **Brasil:**
    - de Lima Osório 2009 (177 mulheres na atenção primária, SCID): melhor corte do PHQ-2 "entre 3 e 4"; PHQ-9 ≥10.
    - Pesquisa Nacional de Saúde 2013/2019 (de Oliveira 2026, Sci Rep; 148.733 pessoas): PHQ-2 ≥3 teve 96,4% de especificidade contra PHQ-9 ≥10. A referência ali foi o PHQ-9, não uma entrevista clínica.
  - Não achei validação do PHQ-2 como porta de entrada em trabalhadores brasileiros.
- **Decisão:** usar **≥2** como porta de entrada, porque em triagem perder um caso custa mais do que fazer 6 perguntas a mais. O manual Pfizer recomenda ≥3 para triagem isolada. Aqui o PHQ-2 só decide se o resto do PHQ-9 é perguntado.
- **Custo da decisão:** quem tem PHQ-2 ≤1 nunca chega a ter PHQ-9 ≥10 calculado. Os itens 3–8 não perguntados poderiam somar 9 ou mais. É exatamente essa a perda de sensibilidade de 0,86 para 0,82 medida por Levis 2020.

### 1.2 GAD-2 como porta de entrada para o GAD-7

- **O que mede:** nervosismo e preocupação incontrolável, os dois itens centrais da ansiedade generalizada.
- **Evidência:**
  - Plummer 2016 (Gen Hosp Psychiatry 39:24), meta-análise: GAD-2 ≥3 com sensibilidade 0,76 e especificidade 0,81 para ansiedade generalizada. GAD-7 aceitável entre 7 e 10 (no corte 8: 0,83/0,84).
  - Manual Pfizer: GAD-2 ≥3 deve levar ao GAD-7 completo. GAD-7 ≥10 é o corte para avaliação adicional.
  - **Brasil:**
    - Silva 2018 (Manaus, 4.001 adultos, base populacional; J Affect Disord 236:180): contra o GAD-7, o GAD-2 teve **sensibilidade de apenas 63,9%** e especificidade de 97,4%. Os autores concluíram que o GAD-2 "não é útil como ferramenta de rastreamento". O resumo não informa o corte usado.
    - Moreno 2016 (Temas em Psicologia 24:367) valida só a estrutura fatorial e a confiabilidade do GAD-7 em português (alfa 0,916). **Não traz ponto de corte.**
- **Decisão:** porta de entrada **≥2**, não ≥3, para compensar a baixa sensibilidade vista em Manaus. Isso é escolha de produto, não corte validado.
  - Com GAD-2 ≤1, chegar a GAD-7 ≥10 exigiria média ≥1,8 nos 5 itens restantes, o que é pouco provável.
  - Se os 5 itens extras couberem no tempo, a alternativa mais segura é aplicar o GAD-7 inteiro e cortar a porta de entrada.

### 1.3 BAT-12, BAT-4 ou pergunta única de burnout

- **O que mede:** o burnout em quatro partes: exaustão, distanciamento mental, prejuízo cognitivo e prejuízo emocional. É o bloco mais ligado ao trabalho, porque todos os itens falam "no trabalho".
- **BAT-12:**
  - Validado no Brasil por Sinval 2022 (IJERPH 19:1344): 2.217 pessoas no Brasil e 886 em Portugal, estrutura de segunda ordem com ajuste satisfatório.
  - Tem cortes por curva ROC (Schaufeli 2023, SJWEH 49:293, Tabela 3, amostra conjunta de Holanda, Bélgica e Finlândia, com casos diagnosticados): **laranja ≥2,54**, **vermelho ≥2,96** na média dos 12 itens.
    - Laranja: sensibilidade 0,88–0,98 e especificidade 0,72–0,83 conforme o país.
    - Vermelho: sensibilidade 0,60–0,72 e especificidade 0,90–0,94.
  - Os autores dizem que os cortes gerais podem ser usados "provisoriamente" em outros países.
- **BAT-4** (Hadžibajramović 2024, PLoS One e0297843):
  - Itens: mentalmente exausto (BAT 1), entusiasmo (9), concentração (17) e reações exageradas (23).
  - Validado em 8 países, **nenhum deles o Brasil**. Não tem pontos de corte; os autores dizem que eles ainda precisam ser criados.
  - Os autores recomendam uso **em nível de grupo ou de organização**, não individual.
  - **Não serve para a regra individual.**
- **Pergunta única de burnout:** não achei nenhuma versão validada em português do Brasil.
- **Escores por parte:** os cortes de exaustão existem só para o BAT-23, que tem 8 itens de exaustão. **No BAT-12 só o escore total tem corte.** Por isso a regra C usa o total do BAT-12, não "exaustão alta".
- **Decisão:** BAT-12 no roteiro completo. Na demo, só o item 1 ("No trabalho, sinto-me mentalmente exausto"), sem corte validado.

### 1.4 SPS-6 ou pergunta única de presenteísmo; WPAI-GH completo ou só a Q5

- **Tronco:** a pergunta de filtro do estudo brasileiro do SPS-6 (Paschoalin, tese 2012, B6) é uma pergunta única de presença no trabalho apesar de problema de saúde. Ela define o grupo "presenteísta". Usamos como **A**.
- **SPS-6:**
  - Mede o quanto o problema de saúde atrapalhou o trabalho em duas partes: "trabalho finalizado" e "distração evitada".
  - Adaptado no Brasil em 153 profissionais de enfermagem (Paschoalin 2013, RLAE 21:388): CCI 0,91; alfa 0,72 e 0,71.
  - Problemas:
    1. **Pertence à Merck e à Stanford** (rodapé da Figura 1 do artigo; Paschoalin obteve autorização do autor). Para produto, é preciso pedir licença.
    2. Validado só em enfermagem, por entrevista face a face.
    3. Há divergência na pontuação entre o artigo e a tese (ver seção 3.3).
    4. Custa 6 itens.
- **WPAI-GH:**
  - Versão brasileira de Ciconelli 2006 (São Paulo Med J 124:325): CCI 0,79–0,90.
  - A **Q5** (0–10, prejuízo enquanto trabalhava nos últimos 7 dias) gera sozinha o escore de presenteísmo do WPAI (Q5 × 10%).
  - As Q2–Q4 (horas perdidas e trabalhadas) servem para absenteísmo e perda total. Exigem lembrar horas, cansam no WhatsApp, e a empresa já tem dados de faltas.
- **Decisão:**
  - Usar **tronco + WPAI Q5**. A Q5 só é perguntada se o tronco for "sim".
  - SPS-6 vira **módulo opcional**, se a licença for obtida e houver tempo. Ele leva o roteiro completo a ~9,5 min no pior caso.
  - **B = WPAI Q5 ≥3.** O WPAI **não tem corte validado**. ≥3 (≥30% de prejuízo) é escolha operacional a calibrar com o médico. O painel deve mostrar o número, não só sim ou não.

### 1.5 Itens de fatores do trabalho (o porquê para a NR-1)

- **Por que entram:**
  - A NR-1, cap. 1.5, trata de fatores de risco do trabalho, não de diagnóstico individual (o Guia MTE deixa isso claro).
  - A NR-7, item 7.3.2 a), manda o PCMSO "rastrear e detectar precocemente os agravos à saúde relacionados ao trabalho".
  - Sem algum item sobre o trabalho, o médico só vê sintomas.
- **Fonte escolhida: COPSOQ II-Br curto** (Sato et al. 2026, RBSO 51:e21, acesso aberto, CC BY 4.0).
  - Traz em português os 40 itens, as escalas (Quadro 3) e os cortes seguro/atenção/risco por dimensão (Tabela 1).
  - O HSE não serve: a tradução para pt-BR não é validada e a licença proíbe alterar itens.
- **Itens propostos** (um por fator; ver seção 4):
  - **2A** ritmo
  - **4A** influência, que corresponde a controle
  - **12B** apoio do superior
  - **23** bullying, que corresponde a assédio
  - Opcional: **20** atenção sexual indesejada
- **Limites (importante):**
  1. Os cortes do COPSOQ valem para a soma dos **2 itens** de cada dimensão. Com 1 item por fator **não há corte validado**: o item serve como descrição do porquê, não como escore.
  2. Sato 2026 diz que a aplicação "deve seguir rigorosamente os princípios éticos: a participação é anônima e os resultados são analisados coletivamente" (p. 13). No nosso fluxo a resposta é identificada e vai ao médico, sob consentimento e sigilo médico. **Para o PGR da empresa, use só dados agrupados e sem identificação.** O artigo alerta para o risco de identificação indireta em empresas pequenas (p. 8).
  3. Para medir dimensões com corte, troque os 4 itens avulsos por 2 dimensões completas (4 itens), por exemplo Ritmo (2A+2B) e Suporte social (12A+12B). Isso deixa assédio de fora.

### 1.6 Item 9 do PHQ-9: perguntar sempre

- **Recomendação: sempre perguntar**, mesmo com PHQ-2 negativo. Custa 1 item.
- **Evidência:**
  - Simon 2016 (J Clin Psychiatry 77:221; 509.945 adultos, 1,2 milhão de PHQ):
    - O risco acumulado de tentativa de suicídio em 2 anos vai de ~0,5% ("nenhuma vez") a 3,5% ("quase todos os dias").
    - O risco de morte vai de 0,04% a 0,19%.
    - O risco extra ficou 2 a 5 vezes maior por pelo menos 18 meses.
    - Mas **39% das tentativas** nos 30 dias seguintes ocorreram em quem respondeu "nenhuma vez". O item 9 é um preditor forte, mas não pega todos.
  - Manual Pfizer (p. 2): resposta positiva ao item 9 exige avaliação; "a decisão final sobre o risco real de autolesão requer entrevista clínica".
  - O item 9 junta pensamentos passivos ("seria melhor estar morto/a") e de autolesão, por isso gera falsos positivos. Mesmo assim, para triagem é o melhor que existe em formato validado e de uso livre.
  - O C-SSRS não tem validação formal no Brasil (ver `fontes-base-de-conhecimento.md`). Use-o só como roteiro para a entrevista do médico.
  - **NÃO CONFIRMADO:** não achei estudo que informe que proporção de quem pontua no item 9 tem PHQ-2 negativo.
- **Como agir:**
  - Item 9 ≥1 dispara **urgência**: mensagem de segurança na hora e aviso ao médico por um canal monitorado, não só o painel.
  - Pergunte depois se a pessoa quer continuar; não encerre de forma brusca.
  - Texto da mensagem na seção 5.4.
  - A Cartilha Amarela (p. 24) desfaz o mito: "Falar sobre o suicídio não aumenta o risco. Ao contrário, protege."

### 1.7 O que cortar para caber em 6 a 8 minutos

| Cortado | Economia | Por quê |
|---|---|---|
| SPS-6 (vira módulo opcional) | 6 itens | Licença Merck/Stanford, validado só em enfermagem, repete a WPAI Q5 |
| WPAI Q1–Q4 e Q6 | 5 itens | Horas exigem esforço de memória. Absenteísmo vem da empresa. Q6 não é sobre trabalho |
| PHQ itens 3–8 quando PHQ-2 <2 | 6 itens em ~57% das pessoas | Levis 2020 |
| GAD itens 3–7 quando GAD-2 <2 | 5 itens | Ver 1.2 |
| BAT-23 / sintomas secundários do BAT | 11 a 21 itens | O BAT-12 tem cortes e validação no Brasil |
| HSE (35 itens) | — | Tradução não validada, não pode alterar itens |

Contagem do roteiro completo:
- Mínimo: tronco "não", portas de entrada negativas → 22 fechados.
- Típico: tronco "sim", uma porta positiva → 29.
- Máximo: 35 fechados + 1 de seguimento ("quem?" no assédio).
- Somar sempre as 2 abertas.
- Tempo: **5 a 8,5 min**.

---

## 2. Regras gerais de apresentação no WhatsApp

1. **Um item por mensagem**, com o texto do item **exatamente** como na versão validada.
2. **Repita no topo de cada item a frase de instrução e o período de lembrança** do instrumento. Exemplo: "Durante as últimas 2 semanas, com que freqüência você foi incomodado/a por:". Cada bloco usa um período diferente: tronco 30 dias, WPAI 7 dias, PHQ/GAD 2 semanas, BAT sem período, COPSOQ 4 semanas/12 meses (ver 4.3). Misturar isso confunde a resposta.
3. **Escala numa linha só**, com o número que será pontuado (quando houver um) e o rótulo validado completo:
   `0 nenhuma vez · 1 vários dias · 2 mais da metade dos dias · 3 quase todos os dias`
4. Aceite o número ou o rótulo escrito ("vários dias"). **Resposta ambígua ("mais ou menos", "às vezes sim") = perguntar de novo, nunca adivinhar.** Se usar LLM para interpretar texto livre, ele só pode mapear para uma opção exata ou pedir esclarecimento.
5. Botões interativos ajudam: reply buttons até 3 opções, list message até 10 linhas. São os limites da API do WhatsApp Business que conheço; **verifique os limites atuais.** A WPAI Q5 (11 opções) e o BAT (5) cabem melhor como número digitado ou lista.
6. Mostrar o progresso ajuda a reduzir abandono: "Bloco 2 de 5". É sugestão de produto, sem fonte específica.
7. Retomada: se a pessoa parar, o bot retoma do item seguinte, dentro do prazo do período de lembrança (por exemplo, até 7 dias).
8. **Mudar o meio** (papel → tela, um item por tela) é considerado modificação "menor" pelas boas práticas de ePRO da ISPOR (Coons et al., 2009, Value Health 12:419). Mudar o texto do item, as opções ou o período **não é**.

### O que não pode ser alterado

| Instrumento | Licença | Regra |
|---|---|---|
| PHQ-9, PHQ-2, GAD-7, GAD-2 | Pfizer: "Não é necessária permissão para reproduzir, traduzir, exibir ou distribuir" (rodapé do formulário pt-BR) | Não reescrever itens. Os escores derivados (PHQ-2, GAD-2) saem da tradução oficial selecionando os itens (manual Pfizer p. 7) |
| BAT | "Não proprietário, uso gratuito sem pedir permissão"; "o instrumento não deve ser modificado"; citar Schaufeli, Desart & De Witte 2020 (burnoutassessmenttool.be) | Não reescrever, não trocar "exausto" por "exausto/a" sem consultar os autores, não trocar as palavras da escala |
| WPAI-GH | Reilly Associates (reillyassociates.net). **NÃO CONFIRMEI os termos de uso**; consultar antes de produto | Usar o texto da tradução oficial pt-BR |
| SPS-6 | Merck & Co. e Stanford University School of Medicine | Pedir licença para uso comercial. A troca de "(problema de saúde)" por termos semelhantes é permitida pela nota do próprio instrumento |
| COPSOQ II-Br | Artigo Sato 2026 em CC BY 4.0; o modelo de planilha é pedido em lafipe@ufscar.br | Aplicação prevista anônima e coletiva (ver 1.5) |
| HSE Indicator Tool | OGL v3, não alterar itens nem pontuação | Fora do bot |

**Ortografia:** os formulários oficiais do PHQ/GAD usam "freqüência" (grafia anterior ao Acordo de 2009). Atualizar para "frequência" não muda o sentido. Se atualizar, registre a mudança na documentação. Nos itens abaixo o texto está **como no original**.

---

## 3. Itens: presenteísmo e prejuízo

### 3.1 Tronco de presenteísmo (A)

- **Texto** (Paschoalin HC. *Presente no trabalho, mesmo doente: o presenteísmo na enfermagem*. Tese, EEAN/UFRJ, 2012, Apêndice, questionário item B6, p. 154; também na p. 62):

  > NOS ÚLTIMOS 30 DIAS, você esteve presente no trabalho apesar de apresentar algum problema de saúde ou algum sinal ou sintoma de adoecimento?

- **Respostas:** 1 Não · 2 Sim. No original: "Não. Passe para a pergunta B7" e "Sim. Se sim, qual(ais)?".
- **Pontuação:** Sim = A. O "qual(ais)?" é texto livre e opcional. No WhatsApp dá para pedir em uma linha, mas isso aumenta o tempo.
- **Observação:** no estudo é uma pergunta de filtro, não um item pontuado do SPS-6. Ela define quem respondeu ao SPS-6.

### 3.2 WPAI-GH, Q5: prejuízo no trabalho (B)

- **Texto** (tradução oficial pt-BR, arquivo `WPAI-GH__Portuguese-Brazil_.doc`, reillyassociates.net/WPAI_Translations.html; versão validada por Ciconelli et al., São Paulo Med J 2006;124(6):325-32, Anexo).
- Introdução (enviar uma vez, antes da Q5):

  > As perguntas a seguir referem-se ao efeito dos seus problemas de saúde na sua capacidade de trabalhar e de realizar atividades normais. Por problemas de saúde estamos nos referindo a qualquer problema ou sintoma físico ou emocional.

- Q5:

  > Durante os últimos sete dias, até que ponto seus problemas de saúde afetaram sua produtividade enquanto estava trabalhando? Considere os dias em que você ficou limitado em relação à quantidade ou ao tipo de trabalho que você pôde realizar, os dias em que você realizou muito menos do que gostaria ou os dias em que você não conseguiu trabalhar de forma tão cuidadosa como o normal. Se seus problemas de saúde apenas afetaram um pouco seu trabalho, escolha um número baixo. Escolha um número alto se seus problemas de saúde afetaram muito seu trabalho.

- **Escala:** 0 a 10.
  - 0 = "Os problemas de saúde não tiveram nenhum efeito sobre meu trabalho"
  - 10 = "Os problemas de saúde me impediram completamente de realizar meu trabalho"
- **No WhatsApp:** `Responda de 0 a 10 · 0 = não tiveram nenhum efeito sobre meu trabalho · 10 = me impediram completamente de realizar meu trabalho`. Encurtar a âncora na linha da escala é aceitável se o texto completo aparecer na mensagem.
- **Pontuação:** % de prejuízo no trabalho = Q5 × 10. Mais alto = pior.
- **Corte:** **não existe corte validado.** B = Q5 ≥3 é operacional.
- **Atenção:**
  - No original, a Q5 só é perguntada a quem está empregado e trabalhou mais de 0 horas nos últimos 7 dias. Nosso filtro é o tronco "sim". Se a pessoa disser que não trabalhou nos últimos 7 dias, registre "não se aplica".
  - A versão inglesa V2.0 da Q5 termina com "Consider only how much health problems affected productivity while you were working". Essa frase **não está** no arquivo pt-BR baixado (datado de 2007). Pode ser uma versão anterior da tradução. **NÃO CONFIRMEI** se existe arquivo pt-BR V2.0 mais novo.

### 3.3 SPS-6 (módulo opcional, só se tronco = sim e houver licença)

- **Texto** (Paschoalin HC, Griep RH, Lisboa MTL, Mello DBC. Rev Latino-Am Enfermagem 2013;21(1):388-95, **Figura 1**, telas 4 e 5).
- Instrução:

  > Por favor, descreva suas experiências no trabalho nos últimos 30 dias. Essas experiências podem ter sido influenciadas por diversos fatores pessoais e do ambiente e alteradas ao longo do tempo. Para cada afirmativa abaixo, escolha uma única resposta que melhor retrata seu grau de concordância ou discordância, considerando suas experiências de trabalho nos últimos 30 dias.

| # | Item (texto validado) | Direção |
|---|---|---|
| 1 | Devido ao meu (problema de saúde)* foi muito mais difícil lidar com o estresse no meu trabalho | **invertido** |
| 2 | Apesar do meu (problema de saúde)*, consegui terminar tarefas difíceis no meu trabalho | direto |
| 3 | Devido ao meu (problema de saúde)*, não pude ter prazer no trabalho | **invertido** |
| 4 | Eu me senti sem ânimo para terminar algumas tarefas no trabalho, devido ao meu (problema de saúde)* | **invertido** |
| 5 | No trabalho consegui me concentrar nas minhas metas apesar do meu (problema de saúde)* | direto |
| 6 | Apesar do meu (problema de saúde)*, tive energia para terminar todo o meu trabalho | direto |

*Nota do instrumento: "dor nas costas", "problema cardiovascular", "doença" etc. podem substituir "problema de saúde". O bot pode usar o que a pessoa escreveu no "qual(ais)?" do tronco.

- **Escala, como no artigo:**
  - Eu discordo totalmente
  - Eu discordo parcialmente
  - Não concordo nem discordo
  - Eu concordo parcialmente
  - Eu concordo totalmente
- **No WhatsApp:** `1 discordo totalmente · 2 discordo parcialmente · 3 não concordo nem discordo · 4 concordo parcialmente · 5 concordo totalmente`. Mostre sempre 1 a 5 e converta internamente.
- **Pontuação** (tese de Paschoalin 2012, p. 63, Tabela 1):
  - Itens 1, 3 e 4: discordo totalmente = 5 … concordo totalmente = 1.
  - Itens 2, 5 e 6: discordo totalmente = 1 … concordo totalmente = 5.
  - Soma de 6 a 30. **6 a 18 = desempenho reduzido** (Koopman et al. 2002, segundo a tese). Mais alto = menos afetado.
- **Divergência a registrar:** no artigo de 2013, a Figura 1 marca com † os itens 2, 5 e 6 como os de "pontuação revertida", o contrário da Tabela 1 da tese. As duas convenções dão o mesmo resultado se o sentido do corte for invertido junto. **Use a da tese e de Koopman (1, 3 e 4 invertidos; ≤18 = prejuízo)**, que bate com a regra "SPS-6 abaixo do corte".

---

## 4. Itens: sofrimento e fatores do trabalho

### 4.1 PHQ-9 (PHQ-2 = itens 1 e 2; item 9 sempre)

- **Texto** (formulário oficial "QUESTIONÁRIO SOBRE A SAÚDE DO/A PACIENTE (PHQ-9)", Portuguese for Brazil, Pfizer, phqscreeners.com, arquivo `PHQ9_Portuguese for Brazil.pdf`, 1 página. A literatura atribui a tradução a Fráguas et al. 2006).
- Instrução:

  > Durante as últimas 2 semanas, com que freqüência você foi incomodado/a por qualquer um dos problemas abaixo?

| # | Item |
|---|---|
| 1 | Pouco interesse ou pouco prazer em fazer as coisas |
| 2 | Se sentir "para baixo", deprimido/a ou sem perspectiva |
| 3 | Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume |
| 4 | Se sentir cansado/a ou com pouca energia |
| 5 | Falta de apetite ou comendo demais |
| 6 | Se sentir mal consigo mesmo/a — ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo/a |
| 7 | Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão |
| 8 | Lentidão para se movimentar ou falar, a ponto das outras pessoas perceberem? Ou o oposto – estar tão agitado/a ou irrequieto/a que você fica andando de um lado para o outro muito mais do que de costume |
| 9 | Pensar em se ferir de alguma maneira ou que seria melhor estar morto/a |

- **Escala:** 0 Nenhuma vez · 1 Vários dias · 2 Mais da metade dos dias · 3 Quase todos os dias.
- **No WhatsApp:** `0 nenhuma vez · 1 vários dias · 2 mais da metade dos dias · 3 quase todos os dias`
- **Pontuação:** soma de 0 a 27. Nenhum item invertido.
  - PHQ-2 = itens 1 e 2, de 0 a 6.
  - Faixas (manual Pfizer p. 5–6): 5 leve, 10 moderada, 15 moderadamente grave, 20 grave.
- **Cortes:**
  - PHQ-2 ≥2 abre os itens 3–8 (Levis 2020).
  - PHQ-9 ≥10 = C:
    - de Lima Osório 2009: ≥10 em mulheres brasileiras na atenção primária, com SCID.
    - Santos 2013 (Pelotas, população geral, MINI, n=447): sensibilidade 77,5% e especificidade 86,7%. O resumo em inglês escreve "> 9"; a lista de fontes do projeto anota "≥9". **Não consegui abrir o texto completo** (scielosp bloqueado) para conferir se é ≥9 ou ≥10.
    - Adotar ≥10 segue Osório 2009 e o manual.
  - Item 9 ≥1 = urgência.
- **Item 9 com PHQ-2 negativo:** envie com a instrução completa no topo, como os outros itens. O PHQ-9 fica incompleto e o total não é calculado. Registre "PHQ-9 não aplicado (PHQ-2 <2)", não um escore baixo.
- **Item de dificuldade (opcional, sem pontuação):** "Se você assinalou qualquer um dos problemas, indique o grau de dificuldade que os mesmos lhe causaram para realizar seu trabalho, tomar conta das coisas em casa ou para se relacionar com as pessoas?" (Nenhuma / Alguma / Muita / Extrema dificuldade). O manual (p. 2) diz que ele não entra em nenhum escore, mas acompanha o prejuízo. Vale incluir quando o PHQ-9 for completo.

### 4.2 GAD-7 (GAD-2 = itens 1 e 2)

- **Texto** (formulário oficial "GAD-7", Portuguese for Brazil, Pfizer, phqscreeners.com, arquivo `GAD7_Portuguese for Brazil.pdf`. É a versão usada por Moreno et al. 2016, que cita "Pfizer Inc. (2013). Portuguese for Brazil version of the GAD-7 Screener").
- Instrução:

  > Durante as últimas 2 semanas, com que freqüência você foi incomodado/a pelos problemas abaixo?

| # | Item |
|---|---|
| 1 | Sentir-se nervoso/a, ansioso/a ou muito tenso/a |
| 2 | Não ser capaz de impedir ou de controlar as preocupações |
| 3 | Preocupar-se muito com diversas coisas |
| 4 | Dificuldade para relaxar |
| 5 | Ficar tão agitado/a que se torna difícil permanecer sentado/a |
| 6 | Ficar facilmente aborrecido/a ou irritado/a |
| 7 | Sentir medo como se algo horrível fosse acontecer |

- **Escala:** igual à do PHQ (0 a 3).
- **Pontuação:** soma de 0 a 21. GAD-2 de 0 a 6. Nenhum item invertido.
  - Faixas (manual p. 6): 5 leve, 10 moderada, 15 grave.
- **Cortes:** GAD-2 ≥2 abre os itens 3–7 (escolha de produto). GAD-7 ≥10 = C, porque o manual recomenda ≥10 para avaliação adicional. **Sem corte validado no Brasil.**

### 4.3 BAT-12, versão para o trabalho

- **Texto** (Versão Brasileira do Burnout Assessment Tool (BAT) para o trabalho, `knowledge/instrumentos/bat-brasil.pdf`, p. 1–2. Os itens com * formam a "Versão reduzida", conforme a nota da p. 2. Numeração do formulário brasileiro de 23 itens. Validação: Sinval et al. 2022).
- Instrução (p. 1; corrigido só o artefato "você̂" do PDF):

  > Leia atentamente as frases abaixo e assinale a resposta que corresponde à frequência com que você se sente desse modo no seu trabalho.

| Parte | Nº no formulário | Item |
|---|---|---|
| Exaustão | 1 | No trabalho, sinto-me mentalmente exausto |
| Exaustão | 3 | Acho difícil recuperar minha energia depois de um dia de trabalho |
| Exaustão | 4 | No trabalho, sinto-me fisicamente exausto |
| Distanciamento mental | 9 | Eu luto para encontrar algum entusiasmo pelo meu trabalho |
| Distanciamento mental | 11 | Sinto forte aversão pelo meu trabalho |
| Distanciamento mental | 13 | Sou pessimista sobre o que meu trabalho significa para os outros |
| Controle cognitivo | 14 | Em meu trabalho, tenho dificuldade em manter o foco |
| Controle cognitivo | 17 | Tenho dificuldade em me concentrar quando estou trabalhando |
| Controle cognitivo | 18 | Cometo erros no trabalho porque minha mente está em outras coisas |
| Controle emocional | 19 | No trabalho, sinto-me incapaz de controlar as minhas emoções |
| Controle emocional | 20 | Eu não me reconheço na maneira como reajo emocionalmente no trabalho |
| Controle emocional | 23 | No trabalho, eu posso ter reações exageradas sem querer |

- **Escala:** 1 Nunca · 2 Raramente · 3 Algumas vezes · 4 Com frequência · 5 Sempre.
- **No WhatsApp:** `1 nunca · 2 raramente · 3 algumas vezes · 4 com frequência · 5 sempre`
- **Pontuação:** média dos 12 itens, de 1 a 5. **Nenhum item invertido.** Médias por parte (3 itens cada) servem para descrever, mas **não têm corte no BAT-12**.
- **Cortes** (Schaufeli et al. 2023, Scand J Work Environ Health 49(4):293-302, Tabela 3, amostra conjunta):
  - **≥2,54** = laranja (risco de burnout).
  - **≥2,96** = vermelho (burnout grave provável).
  - Os autores chamam os cortes de "provisórios" para outros países. Não há corte brasileiro.
- **Outros valores:** a lista de fontes do projeto cita "≥3,29 risco muito alto; 2,83–3,28 risco". Esses números parecem ser normas estatísticas do manual de 2020, não cortes clínicos. Preferi os cortes por curva ROC de 2023, que são mais recentes e usam casos diagnosticados.
- **Gênero:** o formulário brasileiro usa "exausto" no masculino. Trocar por "exausto/a" seria uma modificação não autorizada ("should not be modified"). Mantenha como está ou consulte os autores da versão brasileira (Vazquez, UFCSPA).
- **Itens do BAT-4,** se um dia for usado em grupo: 1, 9, 17 e 23 (Hadžibajramović 2024).

### 4.4 Fatores do trabalho: COPSOQ II-Br curto

- **Texto** (Sato TO et al. Rev Bras Saude Ocup 2026;51:e21, **Tabela 1**, p. 10–12; escalas no **Quadro 3**, p. 9–10. Os autores se baseiam em Gonçalves et al. 2021).

| Código | Fator NR-1 | Item (texto do artigo) | Escala e pontuação (Quadro 3) |
|---|---|---|---|
| 2A | Demanda/ritmo | É necessário manter um ritmo acelerado no trabalho? | 4 sempre · 3 frequentemente · 2 às vezes · 1 raramente · 0 nunca. **Mais alto = mais risco** |
| 4A | Controle | Você tem um alto grau de influência nas decisões sobre o seu trabalho? | 4 sempre … 0 nunca. **Mais alto = menos risco** |
| 12B | Apoio | Com que frequência você recebe ajuda e suporte do seu superior imediato? | 4 sempre … 0 nunca. **Mais alto = menos risco** |
| 23 | Assédio | Você foi exposto a bullying no seu local de trabalho nos últimos 12 meses? | sim, diariamente · sim, semanalmente · sim, mensalmente · sim, poucas vezes · não. Se sim: quem (colegas; gerente, supervisor; subordinados; clientes, fregueses, pacientes), podendo marcar mais de um |
| 20 (opcional) | Assédio sexual | Você foi exposto a atenção sexual indesejada no seu local de trabalho durante os últimos 12 meses? | Igual ao 23 |

- **No WhatsApp:**
  - Itens de frequência: `0 nunca · 1 raramente · 2 às vezes · 3 frequentemente · 4 sempre`, na ordem crescente, convertendo para risco no código.
  - Itens 20 e 23: `1 sim, diariamente · 2 sim, semanalmente · 3 sim, mensalmente · 4 sim, poucas vezes · 5 não`.
- **Cortes:** só existem por dimensão (soma de 2 itens, de 0 a 8). Exemplos da Tabela 1:
  - Ritmo: 0–3 seguro · 4–5 atenção · 6–8 risco.
  - Influência: 5–8 seguro · 4 atenção · 0–3 risco.
  - Suporte social: 6–8 seguro · 4–5 atenção · 0–3 risco.
  - **Com um item só, use como descrição.** O sinal W (seção 7) é operacional.
- **Comportamentos ofensivos:** não são classificados em seguro/atenção/risco, porque "configuram situações inaceitáveis no ambiente de trabalho"; a organização deve "oferecer suporte à vítima e acesso a canais seguros de denúncia" (p. 12).
- **NÃO CONFIRMADO:**
  - O questionário completo do COPSOQ costuma trazer **uma definição de bullying** antes do item 23. O artigo de Sato 2026 não traz essa definição, e não consegui o texto brasileiro (Gonçalves 2021, tese UFSCar). Sem ela, "bullying" pode ser entendido de formas diferentes. Pedir o instrumento completo em lafipe@ufscar.br.
  - O artigo também não mostra o enunciado geral nem o período de lembrança dos itens 1–19. No COPSOQ II costuma ser "últimas 4 semanas", mas **não confirmei para o II-Br**.

### 4.5 Perguntas abertas

Não são instrumento validado. São do desenho do time e não têm pontuação:

1. "O que no trabalho está mais difícil agora?"
2. "O que ajudaria?"

Todo texto livre passa por uma checagem de sinais de crise (ideação, plano, despedida). Se houver sinal, o caso vira **urgência**, mesmo com item 9 = 0.

---

## 5. Mensagens do bot (rascunho)

Os campos `[ ]` são preenchidos pela equipe. A revisão jurídica e de LGPD fica por conta do médico e da empresa. Dado de saúde é dado pessoal sensível (LGPD, art. 11).

### 5.1 Consentimento

> Olá, [nome]. Aqui é o canal de saúde ocupacional de [Dr./Dra. nome], médico/a do trabalho responsável pelo PCMSO da [empresa].
>
> Queremos saber como sua saúde e seu trabalho estão se afetando. São perguntas curtas, uma por vez, e levam de 5 a 8 minutos.
>
> - **Quem vê suas respostas:** só [Dr./Dra. nome], sob sigilo médico. A empresa **não** recebe suas respostas individuais, só números agrupados por setor, sem nomes.
> - **Para que serve:** ajudar o médico a decidir com quem conversar primeiro. **Não é diagnóstico** e **não é usado para contratar, promover ou demitir ninguém** (NR-7, 7.3.2.2).
> - **É voluntário.** Você pode pular, parar quando quiser (escreva PARAR) ou pedir para apagar seus dados.
> - **Este WhatsApp não é atendido o tempo todo.** Em emergência, ligue 192 (SAMU). Para conversar com alguém agora: 188 (CVV, 24 h, gratuito).
>
> Mais detalhes sobre seus dados: [link]
>
> Você aceita participar?
> 1 Sim, aceito · 2 Não quero participar

Se a resposta for 2: "Tudo bem, obrigado. Se mudar de ideia, é só escrever COMEÇAR. Se precisar falar com [Dr./Dra.], [contato]."

### 5.2 Abertura (depois do aceite)

> Obrigado. Vou mandar uma pergunta por vez. Responda com o **número** da opção.
> Não há resposta certa ou errada; responda pensando em como você realmente está.
> São 5 partes: 1) trabalho e saúde · 2) humor · 3) ansiedade · 4) cansaço no trabalho · 5) seu ambiente de trabalho.
> Vamos começar.

### 5.3 Cabeçalhos de bloco

Exemplo de formato de cada item:

> **Parte 2 de 5 · Humor**
> Durante as últimas 2 semanas, com que freqüência você foi incomodado/a por:
> **Pouco interesse ou pouco prazer em fazer as coisas**
> 0 nenhuma vez · 1 vários dias · 2 mais da metade dos dias · 3 quase todos os dias

### 5.4 Mensagem de segurança (item 9 ≥1 ou texto com sinal de crise)

Baseada na Cartilha Amarela MTE 2025 (p. 3: 188, 192, CAPS/UBS) e no material do CVV.

> Obrigado por contar isso para a gente. O que você está sentindo importa, e existe ajuda.
>
> **Se você está pensando em se machucar agora ou não se sente seguro/a:** ligue **192 (SAMU)** ou vá ao pronto-socorro/UPA mais próximo.
> **Para conversar com alguém agora:** ligue **188 (CVV)**, de graça, 24 horas, com sigilo. Ou use o chat em cvv.org.br.
> Você também pode procurar o CAPS ou a Unidade Básica de Saúde perto de você.
>
> [Dr./Dra. nome] vai ver sua resposta e vai entrar em contato com você [até quando a equipe garantir]. Este WhatsApp não é acompanhado o tempo todo; por isso, se piorar, use os números acima.
>
> Quer continuar o questionário?
> 1 Sim · 2 Prefiro parar por agora

Ao mesmo tempo, avisar o médico por um canal monitorado (ligação ou SMS, com plano B), não só no painel. Não prometa um prazo que a equipe não consiga cumprir.

### 5.5 Encerramento

> Pronto, terminamos. Muito obrigado pelo seu tempo.
> Suas respostas foram para [Dr./Dra. nome], só para ele/ela. Se for o caso, ele/ela vai chamar você para conversar.
> Se quiser falar antes, escreva aqui ou ligue [contato].
> Lembrete: em emergência, 192. Para conversar a qualquer hora, 188 (CVV).

**Não mostre escore nem classificação à pessoa** ("seu resultado indica…"). O desenho é triagem para o médico. Devolver resultado automático exige outro cuidado: a avaliação de efeitos negativos de feedback em triagem online é tema de pesquisa (ensaio DISCOVER, J Med Internet Res 2025, PMID 40305104).

---

## 6. Roteiros finais, em ordem

### 6.1 (a) Completo, para uso real

| Ordem | Item | Condição | Fonte |
|---|---|---|---|
| 0 | Consentimento | sempre | 5.1 |
| 1 | Tronco de presenteísmo (B6) | sempre | 3.1 |
| 2 | WPAI-GH Q5 (0–10) | se 1 = sim | 3.2 |
| 2b | SPS-6 (6 itens) | **opcional**: se 1 = sim e houver licença | 3.3 |
| 3–4 | PHQ itens 1 e 2 | sempre | 4.1 |
| 5–10 | PHQ itens 3–8 | se PHQ-2 ≥2 | 4.1 |
| 11 | **PHQ item 9** | **sempre** | 4.1 |
| 12–13 | GAD itens 1 e 2 | sempre | 4.2 |
| 14–18 | GAD itens 3–7 | se GAD-2 ≥2 | 4.2 |
| 19–30 | BAT-12 | sempre | 4.3 |
| 31–34 | COPSOQ 2A, 4A, 12B, 23 (+ "quem?" se 23 = sim) | sempre | 4.4 |
| 35–36 | Duas perguntas abertas | sempre (podem ser puladas) | 4.5 |
| — | Encerramento | sempre | 5.5 |

- **Por que essa ordem:** o núcleo de segurança e triagem (tronco, Q5, PHQ-2 e item 9) vem nos primeiros 3 a 11 itens. Assim, mesmo quem abandona no meio deixa o essencial. BAT e COPSOQ vêm depois. As perguntas abertas ficam no fim.
- **Tempo:** 22 a 35 itens fechados + 2 abertas ≈ **5 a 8,5 min** (típico ~7 min). Com o SPS-6, até ~9,5 min.

### 6.2 (b) Demo de 8 itens (~1 min no palco)

| Ordem | Item | Papel na história |
|---|---|---|
| 1 | Tronco: "NOS ÚLTIMOS 30 DIAS, você esteve presente no trabalho apesar de apresentar algum problema de saúde ou algum sinal ou sintoma de adoecimento?" | Presenteísmo (A) |
| 2 | WPAI Q5 (0–10) | Prejuízo (B) |
| 3 | BAT 1: "No trabalho, sinto-me mentalmente exausto" | Exaustão |
| 4 | PHQ 1: "Pouco interesse ou pouco prazer em fazer as coisas" | Humor |
| 5 | PHQ 2: "Se sentir 'para baixo', deprimido/a ou sem perspectiva" | Humor |
| 6 | PHQ 9: "Pensar em se ferir de alguma maneira ou que seria melhor estar morto/a" | Segurança: mostra a mensagem 5.4 |
| 7 | COPSOQ 2A: "É necessário manter um ritmo acelerado no trabalho?" | O porquê no trabalho (NR-1) |
| 8 | Aberta: "O que no trabalho está mais difícil agora?" | Voz do trabalhador |

**Regra só para a demo** (avisar no palco que é demonstração, não escore validado):
- A = sim.
- B = Q5 ≥3.
- C = BAT 1 ≥4 ("com frequência" ou "sempre") ou PHQ-2 ≥3. Nenhum dos dois é corte validado para item único; o PHQ-2 ≥3 é o corte de triagem do manual.
- Urgência = item 9 ≥1.

Para o palco, prepare dois personagens fictícios:
- Um que cai em "prioridade": sim · 6 · 4 · 2 · 2 · 0 · 4 · "metas dobraram e não tenho apoio".
- Um que mostra a mensagem de segurança (item 9 = 1).

---

## 7. Regra de indício: precisa mudar?

**Regra atual:**
- A = trabalhou com problema de saúde.
- B = SPS-6 abaixo do corte ou WPAI ≥3.
- C = BAT exaustão alta ou PHQ-9 ≥10 ou GAD-7 ≥10.
- Atenção = A+B. Prioridade = A+B+C. Urgência = item de risco.

**Mudanças sugeridas:**

1. **"BAT exaustão alta" → BAT-12 total ≥2,54.** O BAT-12 não tem corte por parte; os cortes de exaustão são do BAT-23 (8 itens). Se quiser exaustão separada, aplique os 8 itens de exaustão do BAT-23: corte laranja ≥3,06 e vermelho ≥3,31 (Schaufeli 2023, Tabela 3).
2. **B sem SPS-6 por padrão:** B = WPAI Q5 ≥3, um corte operacional que precisa ser calibrado. Com o módulo SPS-6: B = SPS-6 ≤18 (itens 1, 3 e 4 invertidos) ou Q5 ≥3.
3. **C sozinho não pode ficar invisível.** Pela regra atual, quem tem PHQ-9 = 18 mas não marcou presenteísmo (estava afastado, ou não ligou o sofrimento à saúde) não recebe nenhuma marcação. Proposta: **C sozinho = atenção**; **C grave sozinho = prioridade**.
4. **Prioridade = C + (A ou B)**, em vez de exigir A+B+C. A sem B (trabalhou doente mas nega prejuízo) junto com sofrimento significativo ainda merece prioridade.
5. **Novo sinal W (fator do trabalho):** qualquer "sim" no assédio (23 e, se usado, 20) já leva a **atenção**, mesmo sem sintomas. Isso também vai para o relatório agrupado do PGR. Como sinal descritivo para o médico (não muda o nível), marque também quem tiver 2 ou mais destes 3: ritmo "frequentemente/sempre", influência "raramente/nunca", apoio "raramente/nunca". Esse sinal é operacional, sem validação.
6. **Urgência** = PHQ item 9 ≥1, **ou** sinal de crise no texto livre. Ela não depende das portas de entrada.
7. **Porta de entrada negativa ≠ escore baixo.** Se o PHQ-2 for <2, registre "PHQ-9 não aplicado". C só pode ser marcado pelo PHQ quando o PHQ-9 tiver sido aplicado. O mesmo vale para o GAD.

**Regra final:**

```
URGÊNCIA    = PHQ9_item9 >= 1  OU  crise_no_texto
PRIORIDADE  = C E (A OU B)   OU   C_grave
ATENÇÃO     = (A E B)  OU  C  OU  W_assedio
SEM INDÍCIO = resto

A        = tronco == "sim"
B        = WPAI_Q5 >= 3            (OU SPS6_total <= 18, se módulo)
C        = BAT12_media >= 2.54  OU  PHQ9 >= 10  OU  GAD7 >= 10
C_grave  = BAT12_media >= 2.96  OU  PHQ9 >= 15  OU  GAD7 >= 15
W_assedio = COPSOQ_23 != "não"  (OU COPSOQ_20 != "não")
```

Mostre ao médico sempre os números brutos e as respostas abertas, não só o rótulo.

---

## 8. Itens cujo texto ou corte validado NÃO consegui confirmar

1. **Definição de "bullying"** que costuma vir antes do item 23 do COPSOQ, e o **enunciado e período de lembrança** dos itens 1–19 do COPSOQ II-Br. O artigo de 2026 só traz os itens.
2. **PHQ-9 em Santos 2013:** se o corte é ≥9 ou >9 (≥10). O resumo em inglês diz "> 9"; o texto completo estava bloqueado.
3. **WPAI-GH:** termos de licença, e se existe tradução pt-BR V2.0 mais nova. O arquivo baixado não tem a última frase da Q5 da V2.0 inglesa.
4. **GAD-2 / GAD-7:** não há corte validado no Brasil. O único dado brasileiro sobre o GAD-2 (Manaus) mostra baixa sensibilidade. A porta de entrada ≥2 é escolha de produto.
5. **PHQ-2 como porta de entrada em trabalhadores brasileiros:** não achei estudo. Os dados brasileiros são em mulheres na atenção primária (Osório 2009) e na PNS (contra o PHQ-9).
6. **Pergunta única de burnout em pt-BR:** não achei validação. **BAT-4:** sem validação brasileira e sem cortes.
7. **SPS-6:** divergência sobre quais itens são invertidos entre o artigo (Figura 1, † em 2, 5 e 6) e a tese (Tabela 1, 1, 3 e 4 invertidos). Adotei a tese e Koopman. Também falta a licença Merck/Stanford.
8. **Proporção de quem pontua no item 9 com PHQ-2 negativo:** não achei o número.
9. **Limites da API do WhatsApp** (3 botões, 10 linhas de lista) e **tempo por item**: vêm do meu conhecimento ou são estimativas. Confirmar.
10. **WPAI Q5 ≥3:** corte operacional, sem validação.

---

## 9. Referências usadas

- **PHQ-9 pt-BR**, formulário oficial Pfizer: https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/PHQ9_Portuguese%20for%20Brazil.pdf
- **GAD-7 pt-BR**, formulário oficial Pfizer: https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/GAD7_Portuguese%20for%20Brazil.pdf
- **Manual PHQ/GAD-7** (cortes, item 9, versões curtas): https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412/instructions.pdf
- Moreno AL et al. Factor structure, reliability, and item parameters of the Brazilian-Portuguese version of the GAD-7. *Temas em Psicologia* 2016;24(1):367-76 (`knowledge/instrumentos/gad-7-moreno-2016.pdf`).
- Levis B et al. Accuracy of the PHQ-2 alone and in combination with the PHQ-9. *JAMA* 2020;323(22):2290-2300. PMID 32515813.
- de Lima Osório F et al. Discriminative validity of the PHQ-9 and PHQ-2 in Brazilian women in primary care. *Perspect Psychiatr Care* 2009;45(3):216-27. PMID 19566694.
- Santos IS et al. Sensibilidade e especificidade do PHQ-9 entre adultos da população geral. *Cad Saúde Pública* 2013;29(8):1533-43. PMID 24005919.
- de Oliveira LRF et al. Agreement among brief PHQ versions… Brazilian National Health Survey. *Sci Rep* 2026;16:20491. PMID 42082720.
- Plummer F et al. Screening for anxiety disorders with the GAD-7 and GAD-2: systematic review and meta-analysis. *Gen Hosp Psychiatry* 2016;39:24-31. PMID 26719105.
- Silva MT et al. Generalized anxiety disorder… Amazon, Brazil. *J Affect Disord* 2018;236:180-6. PMID 29747135.
- Potential harms of feedback after web-based depression screening: secondary analysis of the randomized controlled DISCOVER trial. *J Med Internet Res* 2025. PMID 40305104.
- Simon GE et al. Risk of suicide attempt and suicide death following completion of the PHQ depression module. *J Clin Psychiatry* 2016;77(2):221-7. PMID 26930521.
- **BAT versão brasileira** (`knowledge/instrumentos/bat-brasil.pdf`); termos de uso: https://burnoutassessmenttool.be/en/
- Sinval J et al. Burnout Assessment Tool (BAT): validity evidence from Brazil and Portugal. *IJERPH* 2022;19(3):1344. PMC8834921.
- Schaufeli WB et al. How to assess severe burnout? Cutoff points for the BAT. *Scand J Work Environ Health* 2023;49(4):293-302. PMC10713992.
- Hadžibajramović E et al. The ultra-short version of the BAT (BAT4). *PLoS One* 2024;19(2):e0297843. PMC10889892.
- Santin Júnior LJ et al. BAT – General version in nursing workers. *Rev Latino-Am Enfermagem* 2025;33:e4425. PMID 39907387.
- Paschoalin HC et al. Adaptação transcultural e validação do Stanford Presenteeism Scale. *Rev Latino-Am Enfermagem* 2013;21(1):388-95: https://www.scielo.br/j/rlae/a/nqQFFZKhVXQPMDw93Jr3PVN/?lang=pt
- Paschoalin HC. *Presente no trabalho, mesmo doente: o presenteísmo na enfermagem*. Tese, EEAN/UFRJ, 2012: https://repositorio.ufjf.br/jspui/bitstream/ufjf/6173/1/heloisacampospaschoalin.pdf
- Frauendorf R et al. SPS-6 e AS-WIS em português. *Clin Rheumatol* 2014;33(12):1751-7. PMID 24221505.
- Ciconelli RM et al. The Brazilian Portuguese version of the WPAI-GH. *São Paulo Med J* 2006;124(6):325-32. PMC11068280. Texto pt-BR: http://www.reillyassociates.net/WPAI-GH__Portuguese-Brazil_.doc
- Sato TO et al. COPSOQ II-Br curto no contexto da NR-1. *Rev Bras Saude Ocup* 2026;51:e21: https://www.scielo.br/j/rbso/a/TqV5Fd6XGF8chdcY8byGK5S/?format=pdf&lang=pt
- NR-7 (`knowledge/normas/nr-07-pcmso-2022.pdf`), itens 7.3.2 a) e 7.3.2.2.
- Cartilha Amarela MTE 2025 (`knowledge/crise/cartilha-amarela-mte-2025.pdf`), p. 3 (contatos) e p. 24–25 (mitos).
- Coons SJ et al. Recommendations on evidence needed to support measurement equivalence between electronic and paper-based PRO measures (ISPOR ePRO Task Force). *Value Health* 2009;12(4):419-29. Citado de memória, não reconferido nesta sessão.

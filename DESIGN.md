# DESIGN.md · Praevenius / Consultório NR-7

Direção "Prontuário em ordem" (estilo `achromatic-ledger` da taste-skill, com a paleta Praevenius). Escolhida pelo Marco em 8/11/2026 entre três protótipos, porque a interface anterior mostrava informação demais de uma vez.

## Princípios

1. **Uma pergunta por tela.** Fila: quem precisa de mim e por quê. Caso: o que apareceu e o que faço. Colaboradores: quem recebe o questionário. WhatsApp: está conectado.
2. **A frase vem antes do número.** Todo caso abre com uma frase em português calculada em código (`src/lib/case/describe.ts`), nunca pela IA.
3. **Cor com papel definido.** O azul emoldura: fundo `--frame` com a folha branca por cima, item ativo do menu, a ação principal, etiquetas de fonte e passos numerados. O pêssego carrega a voz humana: a frase do caso, a fala da pessoa e avisos. Gravidade aparece em etiqueta tingida com ponto e texto. Vermelho só em urgência e em escore acima do corte. Cada pessoa tem um avatar pastel. Sem gradiente, sem sombra pesada, sem ícone decorativo.
4. **Detalhe dobrado.** Resumo, fontes, conversa e entrevista ficam em seções recolhíveis no fim do Caso.
5. **Sem enfeite.** Sem chamada em maiúsculas acima de títulos, sem cartões de indicador, sem fonte monoespaçada fora de código, sem cartão dentro de cartão.

## Tokens (src/app/globals.css)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F8FAF9` | Fundo de blocos recuados (citações, conversa, QR) |
| `--card` | `#FFFFFF` | Fundo do app |
| `--raised` | `#EEF3F5` | Item ativo da navegação, hover |
| `--rule` / `--border` | `#E8EEF1` / `#DCE5E9` | Fios de 1px entre linhas e seções |
| `--ink` / `--ink-2` / `--muted` | `#24363B` / `#3B5056` / `#51646A` | Texto principal, secundário, metadado |
| `--primary` / `--brand` | `#006EB8` | A ação principal e links |
| `--peach` / `--peach-soft` | `#FDD4BD` / `#FEEBDF` | Destaques acolhedores (sala da Helena) |
| `--alert` / `--alert-ink` | `#B3261E` / `#7D1612` | Urgência, crise, escore acima do corte |
| `--sev-priority-dot` / `--sev-attention-dot` | `#C2521F` / `#A86F0B` | Pontos de prioridade e atenção |
| `--frame` / `--frame-line` | `#E8F0F6` / `#D5E2EB` | Fundo azul-claro atrás da folha e sua borda |
| `--brand-tint` / `--brand-deep` | `#F1F6FB` / `#0A4F80` | Hover e etiquetas azuis / texto azul sobre fundo claro |
| `--sheet-shadow` | sombra azulada de 2 camadas | Folha branca e cartão do login |

## Tipografia

IBM Plex Sans, números com `tabular-nums`. Títulos de tela 24px/600 (Caso 28px), frase de abertura do Caso 18px, corpo 14px, metadado 12–13px.

## Componentes

- `AppShell`: barra lateral de 220px com marca, três itens (Fila com a contagem de casos abertos, Colaboradores, WhatsApp) e a médica.
- `QueueView`: tabela agrupada por gravidade (Urgência, Prioridade, Atenção); colunas Colaborador, O que apareceu, Respondeu, Abrir. No celular vira lista.
- `CaseView`: nome, linha de gravidade, frase, escores numa linha, ações (Encaminhar consulta, Convidar para entrevista, Acompanhar, Encerrar caso), "Por que é …" com a origem de cada critério, e as dobras.
- `EvidenceList`: explicação uma vez por resposta, trechos cortados em 240 caracteres com "ver trecho completo".

---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: ["src/app/login/page.tsx","src/app/(app)/conexao/page.tsx","src/app/(app)/contatos/page.tsx","src/app/(app)/fila/page.tsx","src/app/(app)/caso/[runId]/page.tsx","src/app/entrevista/[token]/page.tsx"]
---

# Surface Brief · Dashboard do Médico (M5) & Sala de Entrevista por Voz (M11)

## Scope & Mode
- **Dashboard do Médico (`/login`, `/conexao`, `/contatos`, `/fila`, `/caso/[runId]`):** Mode `Operate` (e `Read` para os trechos citados de normas/manuais e transcrições).
- **Sala de Entrevista por Voz (`/entrevista/[token]`):** Mode `Operate` mobile-first com foco acústico tranquilo e consentimento explícito.

## Direction contract

THESIS: Uma bancada clínica ocupacional auditável onde o código decide a gravidade e a IA apenas organiza evidências com citação literal da fonte, recusando o visual genérico de "dashboard SaaS de RH" com cartões de ícones coloridos, gráficos arco-íris ou diagnósticos automatizados.

OWN-WORLD: Estilo `framed-sheet` (seed `935023105`): chassi em L em areia quente (`--bg: #FBF5F2`) abrigando navegação lateral de 232px e barra superior de 48px sem divisória; área de trabalho sobre folha branca (`--card: #FFFFFF`) recuada 8px das bordas direita e inferior com raio de `16px` e borda de `1px solid #EAE2DE` sem sombra. Tipografia `IBM Plex Sans` + `IBM Plex Mono` (`tabular-nums`) para escores, pontos de corte, telefones E.164 e minutagem. Vermelho clínico (`--brand: #B3261E`) estritamente abaixo de 3% dos pixels, reservado para casos em `Urgência`, valores acima do corte (`flagged`) e sublinhado ativo de 2px.

STORY: O médico do trabalho entra no sistema, verifica a conexão do aparelho WhatsApp, dispara o questionário validado para a lista de colaboradores e trabalha a fila priorizada por gravidade determinística, inspecionando no prontuário de cada caso a conversa integral, a matriz da regra A·B·C, os trechos de normas/instrumentos citados e a entrevista por voz conduzida pela Helena.

FIRST VIEWPORT: Na Fila (`/fila`), título `Fila de triagem NR-7` (22px/600) com a descoberta principal logo abaixo ("1 caso em urgência imediata e 2 em prioridade aguardam avaliação médica") e ação primária em tinta escura (`#2B1D1B`); faixa única dividida por fios de 1px com os 4 contadores de filtro por gravidade (`Urgência`, `Prioridade`, `Atenção`, `Sem indício`); tabela limpa sem zebra com escores em pastilhas tabulares e trilha A·B·C visível.

FORM: `framed-sheet` (`taste-skill` `--app` #1) + Matriz de Trilha de Gravidade (A·B·C + Crise) e Anel Acústico da Helena. `seed: none (unavailable)`

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

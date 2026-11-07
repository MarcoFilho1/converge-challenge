# Fontes da base de conhecimento (verificadas em 07/11/2026)

Status: OK = baixado e lido · OK(link) = URL responde, conteúdo confirmado por metadados · Parcial = precisa de navegador (bloqueio a bots).
PDFs já baixados estão em `knowledge/`. Para baixar os outros por script use user-agent de navegador (gov.br, scielosp, ilo.org bloqueiam curl).

## Conjunto mínimo (8) para o RAG do hackathon
1. Guia MTE Fatores de Riscos Psicossociais (2025) — `knowledge/guias/` — https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/guia-nr-01-revisado.pdf — vocabulário dos 13 fatores → temas dos indícios.
2. NR-1 atualizada 2025 — `knowledge/normas/` — .../normas-regulamentadoras-vigentes/nr-01-atualizada-2025-i-3.pdf — cap. 1.5, item 1.5.3.1.4.
3. NR-7 PCMSO — `knowledge/normas/` — .../normas-regulamentadoras-vigentes/nr-07-atualizada-2022-1.pdf.
4. COPSOQ II-Br curto, ensaio no contexto da NR-1 (RBSO 2026, CC BY 4.0) — https://www.scielo.br/j/rbso/a/TqV5Fd6XGF8chdcY8byGK5S/?format=pdf&lang=pt — 40 itens em pt-BR com cortes seguro/atenção/risco por dimensão.
5. BAT versão brasileira (gratuito, não modificar, citar Schaufeli 2020) — `knowledge/instrumentos/bat-brasil.pdf` — cortes do manual (en): BAT-12 média ≥ 3,29 risco muito alto; 2,83–3,28 risco. Manual: https://burnoutassessmenttool.be/handleiding_vragenlijst_eng/ · validação BR/PT: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8834921/
6. SRQ-20 validação BR (Gonçalves 2008) — https://www.scielo.br/j/csp/a/7dgFYgCkbXw9BgwY7dY94Nb/?format=pdf&lang=pt — corte ≥ 8; item 17 (ideação) = sinal vermelho.
7. Cartilha Amarela MTE (2025) — `knowledge/crise/` — assédio, mitos sobre suicídio, como ajudar, 188/192/190/180, CAPS/UBS.
8. CVV "O que posso fazer para ajudar quem pensa em suicídio?" — https://cvv.org.br/o-que-posso-fazer-para-ajudar-quem-pensa-em-suicidio/ — base do texto de hand-off; 188, chat https://cvv.org.br/chat/.

## Instrumentos usados pelo bot (itens e cortes)
- PHQ-9 (domínio público) — validação BR Santos 2013: https://scielosp.org/pdf/csp/2013.v29n8/1533-1543/pt — faixas 0–4/5–9/10–14/15–19/20–27; item 9 = gatilho de crise. Oficial: https://www.phqscreeners.com/select-screener (Portuguese for Brazil).
- GAD-7 (domínio público) — `knowledge/instrumentos/gad-7-moreno-2016.pdf` — cortes 5/10/15.
- BAT-12 — item 5 acima.
- SPS-6 — Paschoalin et al. 2013 (acesso aberto; buscar PDF na SciELO) — escrever `knowledge/instrumentos/sps-6.md` à mão com itens e corte.
- WPAI-GH — Ciconelli et al. 2006 — escrever `knowledge/instrumentos/wpai-gh.md` à mão.
- HSE Indicator Tool (OGL v3, não alterar itens/pontuação) — `knowledge/instrumentos/hse-indicator-tool-manual.pdf` · itens: https://www.hse.gov.uk/stress/assets/docs/indicatortool.pdf — não entra no bot da v1; fica na base para explicar demanda/controle/apoio.

## Apoio internacional (opcional)
- WHO Guidelines on mental health at work (2022, CC BY-NC-SA 3.0 IGO): https://iris.who.int/server/api/core/bitstreams/6152a556-6893-4c4e-9ed8-094478bb25eb/content
- WHO/ILO policy brief (2022): https://iris.who.int/server/api/core/bitstreams/c920460c-9dab-4f9a-ab36-8a83359b35c1/content
- OIT Workplace stress (2016): https://www.ilo.org/publications/workplace-stress-collective-challenge
- ISO 45003: norma paga; factsheet LRQA: https://assets.lrqa.com/m/7223ba4bb382485f/original/ISO-45003-Datasheet-GB-2022.pdf
- Prevenção do suicídio, manual OMS/Fiocruz (pt): https://www.icict.fiocruz.br/sites/www.icict.fiocruz.br/files/suicideprev_para%20profissionais%20de%20Saude.pdf
- Manual MS/OPAS 2006 equipes de saúde mental: https://www.nescon.medicina.ufmg.br/biblioteca/imagem/1241.pdf
- Portaria MTE 1.419/2024: https://www.in.gov.br/web/dou/-/portaria-mte-n-1.419-de-27-de-agosto-de-2024-580778271
- Manual GRO/PGR 2026 + Perguntas e Respostas (maio/2026): https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/manual_gro_pgr_da_nr_1.pdf

## Não usar
- MBI (Maslach): pago (Mind Garden).
- JCQ completo (Karasek): licenciado pelo JCQ Center. Alternativa livre: Job Stress Scale resumida (Alves 2004): https://www.scielo.br/j/rsp/a/55vCVJNvKpJcsGNjhpq5W4r/?format=pdf&lang=pt
- ISTAS21: exige cadastro.
- C-SSRS: sem validação formal no Brasil; só referência de fluxo.

## Caveats
- OMS/OPAS: CC BY-NC-SA, ok no hackathon; rever se virar produto comercial.
- HSE: tradução para pt-BR não é versão validada.
- O Guia MTE deixa claro: NR-1 trata de fatores do trabalho, não de diagnóstico individual. O bot fala em "indício", nunca em diagnóstico.

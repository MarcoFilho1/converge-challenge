# Consultório NR-7 por WhatsApp

MVP do Converge Challenge: o médico do trabalho conecta o celular da empresa por QR Code, envia questionários validados pelo WhatsApp e vê conversa, escores, indícios com trecho de fonte e fila por gravidade.

- Roadmap: `docs/ROADMAP.md`
- Desenho: `docs/superpowers/specs/2026-11-07-consultorio-whatsapp-design.md`
- Plano (tarefas T1–T18): `docs/superpowers/plans/2026-11-07-consultorio-whatsapp.md`

## Subir local

```bash
cp .env.example .env
docker compose up -d        # Postgres+pgvector :5434, Redis :6380, Evolution API :8082
pnpm install
pnpm dev                    # http://localhost:3100
pnpm test
```

IA roda em modo simulado (`AI_PROVIDER=mock`). Para ligar a IA real:

```bash
# 1. preencha AI_GATEWAY_API_KEY no .env
pnpm ai:check      # confere embeddings (1536 dimensões) e chat em menos de um minuto
# 2. troque AI_PROVIDER=mock por AI_PROVIDER=gateway no .env
pnpm ingest        # refaz os vetores da base com o modelo real
pnpm evals         # confere origem, termos e crise com a IA real
```

Outros comandos: `pnpm db:push` (schema), `pnpm ingest` (base de conhecimento), `pnpm evals` (checagens de segurança no banco de teste).

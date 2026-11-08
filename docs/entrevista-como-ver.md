# Entrevista por voz — como rodar e ver

## Subir
```bash
docker compose up -d            # postgres (5434), redis, evolution
cp .env.example .env            # se ainda não tiver; ajuste DOCTOR_NAME
pnpm entrevista:db              # cria SÓ as tabelas da entrevista (não use db:push desta branch no banco do MVP1)
pnpm dev                        # http://localhost:3100
```

## Sem Voicebox (modo texto, tela fala com a voz do navegador)
`.env`: `VOICE_PROVIDER=none`, `AI_PROVIDER=mock`.
```bash
pnpm entrevista:convite --fixture prioridade     # imprime o link /entrevista/<token>
```
Abra o link no navegador (tela do Antigravity #2) ou converse pela API:
```bash
T=<token>
curl -s -X POST localhost:3100/api/entrevista/$T/start -H 'content-type: application/json' -d '{"consent":true}'
curl -s -X POST localhost:3100/api/entrevista/$T/turno -F text="pode"
curl -s -X POST localhost:3100/api/entrevista/$T/turno -F text="um cansaço grande há três meses"
curl -s -X POST localhost:3100/api/entrevista/$T/stop
```
Detalhe para o médico (cookie de login `session=ok`):
```bash
curl -s localhost:3100/api/medico/entrevista/<id> -H 'cookie: session=ok' | jq .summary
```

## Com Voicebox (voz da Helena)
1. Instale o Voicebox (`https://voicebox.sh/download/mac-arm`), baixe o engine Qwen VoiceDesign e crie a voz "Helena" por descrição. Copie o id do perfil.
2. `.env`: `VOICE_PROVIDER=voicebox`, `VOICEBOX_URL=http://127.0.0.1:17493`, `VOICEBOX_PROFILE_ID=<id>`, `VOICEBOX_LANGUAGE=pt`.
3. `pnpm voz:medir` → grava `docs/medicoes-voz.md` e recomenda `INTERVIEW_MODE` (`live` ou `cache_only`).
4. `pnpm voz:pregerar` → áudio de todas as falas fixas em `data/voz/`.
5. Reinicie `pnpm dev` e crie um convite novo.

## Celular (microfone exige HTTPS)
```bash
cloudflared tunnel --url http://localhost:3100     # imprime https://xxxx.trycloudflare.com
```
`.env`: `INTERVIEW_PUBLIC_URL=https://xxxx.trycloudflare.com`, reinicie o `pnpm dev`, gere o convite de novo e abra no celular.

## Checagens
```bash
pnpm test                 # inclui motor, voz, rotas
pnpm evals:entrevista     # crise 100%, 0 termo proibido/conselho, 0 resumo sem origem
```

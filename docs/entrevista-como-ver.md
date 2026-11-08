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
1. Instale o Voicebox 0.5.0 (`Voicebox_0.5.0_aarch64.dmg` nas releases de jamiepine/voicebox). Baixe os modelos `kokoro` e `whisper-turbo`:
   `curl -X POST localhost:17493/models/download -H 'content-type: application/json' -d '{"model_name":"kokoro"}'` (idem `whisper-turbo`).
2. Crie a voz "Helena" (preset português do Kokoro; a 0.5.0 ainda não tem voz por descrição):
   `curl -X POST localhost:17493/profiles -H 'content-type: application/json' -d '{"name":"Helena","language":"pt","voice_type":"preset","preset_engine":"kokoro","preset_voice_id":"pf_dora","default_engine":"kokoro"}'` → copie o `id`.
3. `.env`: `VOICE_PROVIDER=voicebox`, `VOICEBOX_URL=http://127.0.0.1:17493`, `VOICEBOX_PROFILE_ID=<id>`, `VOICEBOX_LANGUAGE=pt`, `VOICEBOX_ENGINE=kokoro`.
4. **Aquecer na ordem certa depois de abrir o Voicebox** (bug de MLX da 0.5.0: se o Whisper carregar depois do Kokoro, a transcrição dá "There is no Stream(gpu, 2) in current thread"): primeiro uma transcrição (`curl -X POST localhost:17493/transcribe -F file=@qualquer.wav -F language=pt -F model=turbo`, ~50 s na primeira vez), depois `pnpm voz:medir`. Se o erro aparecer, feche o Voicebox (Cmd+Q) e repita. Não use `/models/whisper-turbo/unload`: derruba o servidor.
5. `pnpm voz:medir` → grava `docs/medicoes-voz.md` e recomenda `INTERVIEW_MODE` (`live` ou `cache_only`).
6. `pnpm voz:pregerar` → áudio das 43 falas fixas em `data/voz/`.
7. Reinicie `pnpm dev` e crie um convite novo.

## Celular (microfone exige HTTPS)
```bash
brew install cloudflared                            # se ainda não tiver
cloudflared tunnel --url http://localhost:3100      # imprime https://xxxx.trycloudflare.com
# alternativa já instalada no Mac do Marco: tailscale funnel 3100
```
`.env`: `INTERVIEW_PUBLIC_URL=https://xxxx.trycloudflare.com`, reinicie o `pnpm dev`, gere o convite de novo e abra no celular.

## Checagens
```bash
pnpm test                 # inclui motor, voz, rotas
pnpm evals:entrevista     # crise 100%, 0 termo proibido/conselho, 0 resumo sem origem
```

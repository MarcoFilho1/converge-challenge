# Medições de voz (Voicebox)

Data: 2026-11-08T00:52:39.057Z · perfil: b74ef372-5fb1-49bf-9458-7bccb78e3dcf

| Medida | p50 | p95 |
|---|---|---|
| TTS (frase de 8 a 15 palavras) | 631 ms | 832 ms |
| STT (mesmo áudio) | 1033 ms | 1088 ms |

Recomendação: INTERVIEW_MODE=live (regra: live se p95 do TTS ≤ 2500 ms).

## Ponta a ponta no servidor Next (7/11, 21h50, Mac M5 16 GB)
Turno com áudio da pessoa (conversão ffmpeg + Whisper turbo + extração mock + TTS Kokoro ao vivo): 2,1 a 2,2 s no servidor (log do `next dev`). Falas fixas vêm do cache. Transcrição de mp4/aac (Safari) e webm/opus (Chrome) conferidas palavra a palavra.
Primeira carga depois de abrir o Voicebox: Whisper ~48 s, Kokoro ~20 s. Aquecer antes da demo.

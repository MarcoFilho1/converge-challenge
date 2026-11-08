# Medições · leitura das respostas do WhatsApp

Rodada de 08/11/2026, 11:01:06 com o modelo real (moonshotai/Kimi-K2-Instruct-0905 na Featherless), `pnpm evals:whatsapp`.
Cada resposta passa por readReply (IA) e pelo conferidor em código (judgeReading), exatamente como no motor.

| Medida | Resultado | Meta |
|---|---|---|
| Acerto | 71/71 (100.0%) | ≥ 95% |
| Erros no item 9 (gravar "nenhuma vez" sem negação, ou perder um valor ≥ 1) | 0 | 0 |
| Número pescado do meio da frase | 0 | 0 |
| Pediu confirmação | 8% das respostas | — |
| Chamadas de IA | 64 (as outras 7 eram rótulo exato, resolvidas pela regra local) | — |
| Tempo por chamada de IA | p50 2145 ms · p95 4920 ms | — |
| Custo (devolvido pela Featherless) | US$ 0.053555 no total · US$ 0.0008368 por chamada | — |
| Frase de ligação: fala que toca no próximo item | mentions = [PHQ9_4] | contém PHQ9_4 |
| Frase de ligação: assunto só parecido | mentions = [] | vazio |

## Erros

Nenhum.

Resultado: PASSOU na meta.

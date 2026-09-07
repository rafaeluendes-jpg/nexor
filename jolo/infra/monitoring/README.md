# Acompanhamento

## O que olhar

| Sinal | Onde | Quando se preocupar |
|---|---|---|
| API de pe | `GET /health` | qualquer resposta que nao seja 200 |
| Banco e fila | `GET /readiness` | diz qual dos dois caiu |
| Fila parada | Redis, fila `inbound` | mensagens acumulando sem sair |
| Webhook recusado | registro da API, "webhook recusado" | varios seguidos = segredo errado |
| Erro 500 | registro da API | qualquer um merece olhada |

## Registro (log)

Tudo em JSON, uma linha por evento, com identificacao de correlacao para
seguir uma mesma chamada do inicio ao fim. Nivel em `LOG_LEVEL`
(`info` em producao, `debug` para investigar).

Nenhum registro guarda senha, token ou chave.

## Verificacao automatica simples

```cron
*/5 * * * * curl -fsS https://api.SEU-DOMINIO/health > /dev/null || echo "API fora do ar" | mail -s "Jolo CRM" voce@dominio
```

Servicos como UptimeRobot ou Better Stack fazem o mesmo com aviso no
celular, sem manter script.

## Erros de aplicacao

Ha lugar reservado para o Sentry (`SENTRY_DSN` no `.env`). Sem a chave,
nada e enviado para fora.

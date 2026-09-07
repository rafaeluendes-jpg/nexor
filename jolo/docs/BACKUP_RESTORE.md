# Copia de seguranca e restauracao

O que precisa ser salvo:

| O que | Onde vive | Como salvar |
|---|---|---|
| Banco do CRM | Postgres (ou Supabase) | `scripts/backup.sh` |
| Arquivos enviados | `var/storage` ou Supabase Storage | copia da pasta / painel |
| Configuracao | `.env` do servidor | cofre de senhas, fora do Git |

## Fazer a copia

```bash
./scripts/backup.sh                 # grava em var/backups
./scripts/backup.sh /mnt/backup     # ou na pasta que voce escolher
```

O script:

1. gera um arquivo `jolo-crm-DATA_HORA.dump` (formato custom do Postgres);
2. **confere que a copia e legivel** antes de dizer que deu certo;
3. apaga copias com mais de 30 dias (`RETENCAO_DIAS` muda isso).

Copia que ninguem testou nao e copia. Por isso a conferencia esta dentro
do proprio script.

## Automatizar (todo dia as 3 da manha)

```cron
0 3 * * * cd /caminho/do/jolo && ./scripts/backup.sh >> var/backups/backup.log 2>&1
```

Guarde uma copia **fora do servidor**: se o disco morrer, as copias que
estavam nele morrem junto.

Com Supabase, o backup automatico do proprio Supabase ja roda; ainda
assim mantenha a copia local, porque ela e sua e voce consegue restaurar
em qualquer lugar.

## Restaurar

```bash
./scripts/restaurar.sh var/backups/jolo-crm-2026-09-07_185430.dump
```

Ele pede confirmacao por escrito, porque **apaga o banco de destino**
antes de restaurar. Para restaurar em outro banco (o jeito seguro de
testar):

```bash
createdb jolo_teste
./scripts/restaurar.sh var/backups/ARQUIVO.dump \
  "postgresql://jolo:SENHA@localhost:5432/jolo_teste"
```

No fim ele mostra a contagem de usuarios, leads, contatos e etapas do
funil. E assim que voce sabe que a restauracao veio inteira.

## Teste de restauracao feito (07/09/2026)

| Etapa | Resultado |
|---|---|
| Copia gerada | `jolo-crm-2026-09-07_185430.dump`, 120 KB |
| Indice da copia legivel | sim |
| Banco de destino | `jolo_restauracao_teste` (banco novo, separado) |
| Restauracao | concluida sem erro |
| Conferencia (usuarios, leads, contatos, etapas) | 4, 3, 3, 14 — igual ao banco de origem |
| Banco de teste | apagado depois da conferencia |

Refaca este teste **uma vez por mes**. Uma copia que nunca foi restaurada
nao vale como copia.

## Quanto tempo se perde no pior caso

Com copia diaria as 3 da manha, o pior caso e perder o movimento do dia
ate a hora da falha. Se isso for demais para a operacao, o caminho e o
backup continuo do Supabase (point-in-time), que e uma decisao de plano
e de custo.

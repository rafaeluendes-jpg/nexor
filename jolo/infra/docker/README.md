# Banco e fila em containers

Sobe o Postgres e o Redis que a API e os workers usam.

```bash
cd infra/docker
cp ../../.env .env          # usa as mesmas variaveis
docker compose up -d
docker compose ps           # os dois precisam ficar "healthy"
```

Para parar sem perder dado: `docker compose stop`.
Para apagar tudo, inclusive os dados: `docker compose down -v` (nao tem volta).

Backup e restauracao: `docs/BACKUP_RESTORE.md`.

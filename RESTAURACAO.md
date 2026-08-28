# Joia — backup e recuperação

Escrito na Fase 5, depois de medir o que existe de verdade hoje.

## As três cópias que existem, e o que cada uma cobre

| | Onde mora | Guarda | Cobre | **Não** cobre |
|---|---|---|---|---|
| **1. Backup do sistema** | tabela `backups`, no mesmo Supabase | o objeto `DB` do **navegador**, 1×/dia, as 30 mais novas | "apaguei um cadastro sem querer" | perder o projeto; e é a foto do que **um aparelho** tinha, não do banco |
| **2. Backup do Supabase** | infraestrutura deles (plano Pro) | o banco inteiro, 1×/dia, **7 dias** | "o banco corrompeu ontem" | mais de 7 dias atrás; perder a conta |
| **3. Cópia fora** (`ferramentas/backup.js`) | onde você guardar | o banco inteiro, tabela por tabela | tudo acima **e** perder a conta | o que você não rodar |

A 1 e a 2 já existiam. A 3 é nova, e existe porque **cópia que mora dentro
do que ela deveria proteger não é cópia.** Se o projeto Supabase for
apagado, suspenso por cobrança ou invadido, a 1 e a 2 vão junto.

## Como tirar a cópia de fora

```
SUPABASE_URL=https://cevghkndzpzvnzwifhnm.supabase.co \
SUPABASE_SERVICE_KEY=<service_role, do painel: Project Settings > API> \
node ferramentas/backup.js
```

Escreve `backup/joia-AAAA-MM-DD-HHMM.json` mais um `.sha256`.
**Guarde fora do Supabase** — Drive, HD externo, outro provedor.

A chave `service_role` ignora a RLS de propósito: backup que só enxerga o
que um usuário enxerga não é backup. Ela **não** pode ir para o
repositório nem para o navegador — só para a variável de ambiente.

Por padrão o `audit_log` fica de fora (é 73% do banco e não é dado de
negócio). `--com-auditoria` inclui.

**O script falha inteiro se qualquer tabela falhar, e não escreve nada.**
Um arquivo com 40 das 84 tabelas parece um backup, abre como um backup, e
só revela o que falta no dia em que você precisa dele.

`testes/backup.js` roda o script de verdade contra um servidor de mentira
e confere as três coisas: traz todas as linhas (inclusive além da
primeira página de 1.000), escreve manifesto e soma de conferência, e não
deixa arquivo pela metade quando uma tabela falha. 15 testes.

## O que fazer em cada caso

### "Alguém apagou um cadastro hoje"
Sistema → Backup e Restauração → escolher a cópia do dia → restaurar.
É a cópia 1. Confira antes qual aparelho a gerou: ela é a foto daquele
aparelho.

### "Os dados sumiram depois de uma atualização"
Não restaure nada ainda. Primeiro: **ligue a nuvem e veja se o dado está
lá.** Boa parte dos sumiços de 2026 foi o aparelho com a cópia local
vazia, não o banco. Em Backup e Restauração há o `nexor_respaldo`, a
cópia local tirada antes de cada download.

### "O banco corrompeu / migration errada"
Painel do Supabase → Database → Backups → restaurar o dia anterior.
São 7 dias de retenção. **Avise as lojas antes:** restaurar volta o banco
inteiro, e o que foi vendido depois do ponto escolhido se perde.

### "Perdi a conta do Supabase"
Aqui só a cópia 3 salva. Criar projeto novo, aplicar o schema
(`exportar_schema()` gera o baseline), e carregar o JSON tabela por
tabela na ordem das dependências.

## O que ainda não está resolvido — seja honesto sobre isto

- **A cópia 3 é manual.** Ninguém a tira sozinho. Enquanto for manual,
  ela vale o quanto a disciplina de rodar valer. O automático precisa de
  um lugar para guardar (R2, Drive, S3) e de uma credencial para lá.
- **Restauração completa nunca foi ensaiada.** Um backup só é backup
  depois de ter sido restaurado uma vez. O ensaio certo é num projeto
  Supabase separado, nunca no de produção.
- **PITR (voltar a um minuto exato) não está no plano Pro** — é um
  adicional pago. Sem ele, o mais fino que dá é o backup diário.

## O `audit_log`

Era 395 MB, 296.092 linhas, 73% do banco — crescendo ~50 mil linhas/dia
com 416 vendas no total. A conta explicou:

```
estoque_unidade UPDATE  148.705 linhas — 147.395 sem mudança nenhuma
pedidos         UPDATE   99.245 linhas —  98.777 sem mudança nenhuma
bases_catalogo  UPDATE   16.216 linhas —  16.211 sem mudança nenhuma
```

**285 mil das 296 mil linhas registravam que nada mudou.** A sincronização
reenvia cada linha a cada conferência (45 s) e a cada evento do realtime;
o upsert grava por cima com o mesmo conteúdo, o gatilho dispara igual e
guarda duas cópias idênticas do registro em `jsonb`.

Corrigido: `tg_auditar()` agora ignora `UPDATE` que não mudou nada. Nenhuma
informação se perde — uma entrada que registra "nada mudou" não responde
a pergunta nenhuma.

**As antigas foram apagadas (27/08).** 291.063 linhas removidas, 6.187
mantidas: todo INSERT (2.632), todo DELETE (1.451) e todo UPDATE que
mudou alguma coisa (2.082). Nenhuma linha vazia sobrou.

A trilha tem uma trava de imutabilidade (`tg_audit_imutavel`, que bloqueia
UPDATE e DELETE na tabela). Ela foi levantada e devolvida **na mesma
transação** — se o apagamento falhasse, a trava voltaria junto. Conferida
depois: ligada.

Em seguida, `VACUUM FULL` devolveu o espaço ao disco:

| | antes | depois |
|---|---|---|
| Banco inteiro | 539 MB | **152 MB** |
| `audit_log` | 395 MB | **8,2 MB** |

Rodou em segundos, com loja vendendo (última venda 12 min antes), e zero
conexões ficaram esperando trava. O sistema é offline-first: a venda é
gravada no aparelho e sobe depois, então o que pausa é a sincronização,
não a frente de caixa.

A maior tabela agora é `backups` (89 MB) — as 30 cópias diárias do
sistema. Essa é dado de verdade, e é para ficar.

# Joia — modularização do index.html

Este arquivo é o projeto. Substitui qualquer anotação fora do repositório:
mora ao lado do código, é versionado, e todo Claude que abrir o repo lê.

## O problema

`index.html` tem 51.598 linhas e 2,6 MB — cerca de 700 mil tokens. Nenhuma
janela de contexto o comporta. Quem edita edita às cegas, e o resultado
está no histórico: a V179 sozinha causou dois P0 no caixa, a V191 escreveu
uma proteção que nunca foi ligada, e 42 funções continuam órfãs no arquivo.

Não é limitação de quem edita. É o arquivo.

## A ideia

A fonte vira modular. **O que vai ao ar continua sendo um `index.html` só** —
o service worker guarda um arquivo, o Pages publica um arquivo, e a loja
abre sem internet porque é um arquivo. Nada disso muda.

```
src/01-cabeca.html          ┐
src/css/01-principal.css    │
src/js/03-armazenamento.js  ├─ montar.js ─→ index.html   (idêntico)
src/js/07-roteador.js       │
src/03-rodape.html          ┘
```

## A garantia

`testes/montagem.js` corta o `index.html` de hoje, emenda de volta e compara
**byte a byte**. Se o hash bate, é impossível o recorte ter perdido uma
linha — uma função a menos mudaria o hash. É aritmética, não confiança.

O teste não lê `src/` do disco: ele recorta em memória. Por isso continua
valendo depois da V201, da V210 e de qualquer correção publicada. Não há
nada para manter em dia.

## A virada já aconteceu: quem manda é o src/

Até a Fase 2, o `index.html` era a fonte e o `src/` era saída descartável.
Na Fase 3 isso inverteu:

| | antes | agora |
|---|---|---|
| Fonte | `index.html` | **`src/`** |
| Gerado | `src/` | **`index.html`** (`npm run montar`) |
| Commitado | só o `index.html` | os dois |

O `index.html` continua commitado porque é ele que o GitHub Pages publica e
que o service worker guarda no aparelho. Ele virou artefato de build — como
um lockfile: gerado, versionado, e **nunca editado à mão**.

Isso cria o único risco novo da virada: o `index.html` pode ficar fora de
compasso com o `src/` e ninguém perceber — até a loja abrir a versão errada.

É o que `testes/montagem.js` impede. Ele lê o `src/` do disco, emenda, e
compara com o `index.html` do disco byte a byte:

- editou o `index.html` à mão? **reprova**
- mexeu no `src/` e esqueceu o `npm run montar`? **reprova**

Roda no `npm test` e no CI a cada envio. Não existe caminho para publicar
uma coisa diferente do que a fonte diz.

## Fases

| Fase | O que | Estado |
|---|---|---|
| 0 | Ferramentas de recorte e a prova de diff-zero | **feita** |
| 1 | Fechar o furo crítico de acesso (senha de operador) | **feita (1A)** |
| 2 | O recorte por módulo de negócio | **feita** |
| 3 | A virada — `src/` passa a ser a fonte, `index.html` gerado | **feita** |
| 4 | Segurança completa — os 103 alertas e a escrita robusta | **feita** |
| 5 | Backup e recuperação | **feita** |
| 6 | Limpeza + auditoria dos botões e permissões que não funcionam | a fazer |

### Fase 3 — a virada

O `index.html` publicado é **byte a byte o mesmo** de antes da virada
(sha256 `a0d1c8ef`, 2.776.900 bytes). A loja não vê diferença nenhuma: mesmo
arquivo, mesmo service worker, mesmo cache.

Duas travas novas entraram no `npm test` e no CI:

**`testes/montagem.js`** — o `index.html` tem de ser exatamente o que o
`src/` produz. Conferido: uma linha acrescentada à mão no `index.html` faz o
teste reprovar apontando o número da linha.

**`testes/versao.js`** — `VERSAO` (em `src/js/06-interface.js`) e `VERSAO_SW`
(em `sw.js`) têm de ser a mesma. Foi o defeito da V195: o `index.html` subiu
novo e o `sw.js` ficou velho, o navegador não trocou o service worker, e a
loja ficou presa na versão antiga. Regra que depende de alguém lembrar é a
que falha; agora ela reprova a publicação. Conferido: subir só a `VERSAO`
para V202 faz o teste reprovar.

### Fase 1 — o que foi corrigido

`senha_operador_definir/conferir/quem_tem` são `SECURITY DEFINER`, ou seja
ignoram a RLS, e aceitavam `p_loja` de quem chama quando `minha_loja()`
devolvia null — que é o que ela devolve, sem erro, para quem não fez login.
As três tinham `EXECUTE` concedido ao papel `anon`.

A 1A criou `loja_permitida(uuid)` — a sessão manda, `p_loja` é só desempate —
e tirou `anon` e `PUBLIC` das cinco funções. Conferido depois de aplicar:
`anon` não executa nenhuma; quem está logado executa todas.

Fica para a Fase 4: apertar `conferir`/`quem_tem` do mesmo jeito, depois de
apagar as 7 contas de teste que ainda vivem no Supabase Auth de produção
(`admin@teste.local`, `gestor.a@teste.local`, `p20a@teste.com`…).

### Fase 5 — backup

O que existia: o backup do sistema (foto do navegador, dentro do mesmo
Supabase) e o backup diário do Supabase (7 dias, plano Pro). Faltava a
cópia **fora** — nenhuma das duas sobrevive a perder a conta.

`ferramentas/backup.js` lê o banco tabela por tabela e escreve um arquivo
com manifesto e soma de conferência. Falha em qualquer tabela: não
escreve nada. `testes/backup.js` roda o script de verdade contra um
servidor que imita o PostgREST — 15 testes.

O procedimento de recuperação, caso a caso, está em **`RESTAURACAO.md`**.

Achado no caminho: **285 mil das 296 mil linhas do `audit_log`
registravam que nada mudou** — a sincronização reenvia cada linha a cada
45 s, o upsert grava o mesmo conteúdo e o gatilho guardava duas cópias
idênticas em jsonb. Eram 395 MB, 73% do banco, crescendo 2 GB por mês.
`tg_auditar()` passou a ignorar `UPDATE` que não mudou nada.

### Fase 4 — a auditoria de segurança

103 alertas → **71**, zero ERRO, funções abertas ao anônimo 34 → 8. O
modelo de acesso, as regras para escrever função nova e o que ficou em
aberto estão em **`SEGURANCA.md`**.

Verificado depois de aplicar, rodando como `anon`: o cardápio público
continua lendo as sete tabelas dele, e `clientes`, `pedidos_online`,
`pedidos`, `lojas`, `operador_senhas`, `lancamentos_financeiros` e
`whatsapp_config` devolvem **zero**.

### Fase 2 — como o recorte foi feito

Nada de divisão inventada: o arquivo já trazia dentro dele os **BLOCO 8 a
28** — Cardápio, PDV, Entregadores, Financeiro, Estoque, Ficha Técnica,
Produção, Relatórios. O recortador passou a usar essa marcação, e só o que
continuou grande demais foi quebrado por tamanho, nas tarjas de seção.

Duas travas, porque um corte no lugar errado partiria uma função ao meio:

1. **JS** — o pedaço só é aceito se compilar sozinho (`new Function`).
   Corte que parte uma função é recusado, e o próximo marco é tentado.
2. **CSS** — o equivalente: tirar os comentários e conferir se as chaves
   fecham. Pedaço terminando com chave aberta é corte recusado.

Isso virou teste permanente: `testes/montagem.js` reprova se qualquer
arquivo de JS não compilar sozinho. Emendar idêntico prova que nada se
perdeu; compilar sozinho prova que o corte caiu num lugar útil.

## Estado do recorte hoje (V201.0.0) — 48 partes

**Nenhum arquivo passa de 2.500 linhas.** O `07-roteador`, que tinha 33.312,
virou 27 arquivos por módulo de negócio:

```
src/
  01-cabeca.html                          94
  css/01-principal/                    12.697 em 6 partes
  css/02-complemento.css                  106
  02-corpo.html                            38
  js/00-abertura.js                        12
  js/01-icones.js                         107
  js/02-modulos.js                        200
  js/03-armazenamento/                  3.824 em 2 partes
  js/04-utilitarios.js                    361
  js/05-login.js                          418
  js/06-interface.js                      467
  js/07-roteador/
    00-navegacao.js                       407
    08-modulo-cardapio.js               1.579
    09-modulo-pdv/                      6.714 em 3 partes
    10-acerto-com-entregadores.js         817
    11-categorias-financeiras...js        308
    12-formas-de-pagamento.js             141
    13-lancamentos-financeiros/         3.747 em 2 partes
    14-fluxo-de-caixa.js                  155
    15-conciliacao-bancaria.js            252
    16-fornecedores.js                    113
    17-frente-de-caixa-financeiro.js      684
    18-gestao-de-clientes-crm.js          360
    19-cupons-de-desconto.js              215
    20-base-do-estoque...js               716
    21-ficha-tecnica.js                 1.143
    22-movimentacao-de-estoque/         3.006 em 2 partes
    23-estoque-total-e-contagem.js        716
    24-historico-de-posicao...js          612
    25-notas-de-entrada.js                594
    26-producao...js                      613
    27-comparativo-anual.js               325
    28-relatorios/                     10.094 em 5 partes
  03-rodape.html                            3
```

Três arquivos de CSS se chamam `usuarios-e-permissoes`: é o bloco colado
oito vezes que a Fase 6 vai apagar. O recorte não escondeu a duplicação —
deu nome a ela.

## Comandos

```
npm run montar     # gera o index.html a partir do src/   ← depois de editar
npm test           # as 10 suítes, montagem e versão incluídas
npm run mapa       # regenera o MAPA.md

node ferramentas/dividir.js    # re-recorta o src/ a partir do index.html.
                               # So faz sentido para refazer o recorte do zero:
                               # depois da virada, quem manda e o src/.
```

## Como corrigir um bug agora

1. Ache o módulo em `src/js/07-roteador/` (ou rode `npm run mapa` e leia o `MAPA.md`)
2. **Leia o arquivo inteiro** — nenhum passa de 2.500 linhas, todos cabem
3. Edite ali
4. Suba `VERSAO` em `src/js/06-interface.js` **e** `VERSAO_SW` em `sw.js`
5. `npm run montar`
6. `npm test`
7. Commit. O `index.html` vai no mesmo commit, como consequência.

# Joia — contexto permanente

Leia antes de mexer em qualquer coisa. Vale para toda sessão, aqui e no
Claude Code do computador do Rafael.

## O que é

ERP de gestão para food service, **em produção**. Seis lojas da rede Jolô
Gelato operam nele todo dia, na frente de caixa. Não é projeto de estudo:
um bug seu para uma loja de vender.

- Sistema: **`src/` é a fonte**; `index.html` é **gerado** (`npm run montar`)
- Publicação: GitHub Pages, **só a partir da `main`** → joiagest.com.br
- Banco: Supabase, projeto `cevghkndzpzvnzwifhnm` ("Joia Gestão Inteligente")
- Robô do WhatsApp: repositório separado `rafaeluendes-jpg/nexor-whatsapp`
- Decisões de produto e histórico: `DECISOES.md`
- Visão técnica: `ARQUITETURA.md`
- Índice do código: **rode `node ferramentas/mapear.js`** e leia o `MAPA.md`.
  Ele não é commitado de propósito: gerado na hora, aponta as linhas certas
  da versão de hoje. Um mapa guardado apontaria linhas de duas versões atrás

## As regras que não se quebram

1. **Não publicar sem ordem explícita.** Empurrar para a `main` é publicar
   na loja, na hora. Trabalhe na branch; o merge é decisão do Rafael.
2. **Não rodar migration nem SQL de escrita no Supabase de produção** sem
   ordem explícita. Não existe desfazer.
3. **`npm test` antes de qualquer publicação.** São 9 suítes; elas leem as
   funções de dentro do `index.html` e rodam as de verdade.
4. **Nunca editar o `index.html` à mão.** Ele é gerado a partir do `src/`.
   Edite o módulo e rode `npm run montar`. `npm test` reprova se os dois
   estiverem fora de compasso.
5. **`VERSAO` (em `src/js/06-interface.js`) e `VERSAO_SW` (em `sw.js`)
   sobem juntas.** Se só uma subir, o navegador da loja continua servindo
   o sistema velho do cache — foi o defeito da V195. `testes/versao.js`
   reprova a publicação quando não batem.

## Por que este arquivo existe

O `index.html` tem ~700 mil tokens. **Não cabe em nenhuma janela de
contexto**, nem na maior. Quem edita esse arquivo está sempre vendo um
pedaço dele, e é daí que vem a maior parte dos bugs recentes:

| | |
|---|---|
| V179 | apagou `fundoSugerido` sem perceber → travou abrir caixa (V185 restaurou) |
| V179 | usou o índice `'ci'`, que não existia mais → fechamento não abria (V189) |
| V191 | escreveu `marcarNovoAqui` e nunca a chamou → proteção era código morto (V192) |

Hoje ainda há **42 funções que ninguém chama** (listadas no `MAPA.md`).

Então, ao mexer neste sistema:

- **Ache o módulo primeiro.** `src/js/07-roteador/` tem um arquivo por
  módulo de negócio — PDV, cardápio, estoque, financeiro, relatórios.
  Nenhum passa de 2.500 linhas: cabem inteiros no seu contexto. Leia o
  arquivo todo antes de mexer nele.
- **Procure antes de editar.** Antes de tocar numa função, veja todos os
  lugares que a citam (`grep -rn` no `src/`). O `MAPA.md` diz onde cada
  uma mora.
- **Nunca reescreva um bloco inteiro de memória.** Troque as linhas exatas.
  O que você reescreve sem ter lido, você apaga.
- **Ligou a função nova em algum lugar?** Se ela não é chamada, ela não
  existe. Confira antes de fechar.
- **Rode `node testes/montagem.js`** se mexeu na estrutura do arquivo.

## Modularização em curso

O plano e o andamento estão em `MODULARIZACAO.md`. Duas regras enquanto ela
não termina:

Commit de correção mexe em `src/` (e no `index.html` gerado, que vai junto
porque é ele que o Pages publica). O `index.html` no `git diff` deve ser
sempre consequência do `src/`, nunca causa — `npm test` garante isso.

## O padrão de entrega (ordem do Rafael, 28/08/2026)

Este é um sistema profissional, em produção, em várias unidades. Nada de
tela improvisada, botão que só parece funcionar, dado de mentira
apresentado como real ou recurso pela metade.

**Antes de dizer que algo está pronto, obrigatoriamente:**

1. `npm test` — a bateria inteira, verde.
2. `node ferramentas/varrer.js` — abre as 94 telas e aperta todos os
   botões, num DOM. Zero tela que não monta, zero botão sem função,
   zero erro no clique.
3. `node ferramentas/auditar.js` — abre o sistema no **Chromium de
   verdade**, computador (1440) e celular (390). Zero erro de console,
   zero rolagem horizontal, zero elemento cortado, zero alvo de toque
   menor que o dedo, zero texto técnico na tela.
4. `node ferramentas/provar.js` — os fluxos: abre caixa, vende,
   **recarrega a página e confere que nada sumiu**, fecha, exporta,
   e testa permissão por perfil. Ele também salva fotos das telas em
   `/tmp/provas` — **olhe as fotos**. Defeito visual não aparece em
   teste que passa: a etiqueta virando barra vazia e a comanda do PDV
   espremida em 82 px no celular só apareceram na fotografia.
5. `node ferramentas/conferir-nuvem.js` — compara **campo por campo** o
   que o código manda para o Supabase com o que o banco realmente aceita:
   coluna que não existe, chave de `on_conflict` sem índice único, id
   local indo para coluna `uuid`. Os quatro testes acima rodam com a nuvem
   desligada — **nenhum deles vê esse tipo de erro**, e foi daí que
   vieram os quatro defeitos de 01/09/2026. A referência é
   `ferramentas/esquema-nuvem.json`; depois de qualquer migration,
   regrave-o com a consulta que está no fim do `conferir-nuvem.js`.
   Ele já entra no `npm test`, e vale também para o robô do WhatsApp e o
   cardápio digital quando as pastas irmãs estão ao lado.
6. Corrigir tudo o que apareceu e **rodar os cinco de novo**.
7. **Todo passo a passo que for para o Rafael tem de ser executado antes**,
   no navegador, no estado exato em que ele está. Em 29/08/2026 eu mandei
   ele clicar num botão que não existia naquela situação — a faixa com o
   botão só aparecia quando havia DOIS caixas abertos, e ele tinha um. Se
   a instrução não foi clicada aqui, ela não é instrução: é palpite.

Quando houver mais de um caminho, escolher o mais seguro, mais estável,
mais fácil de manter e compatível com o que já existe. Não inventar
aparência nova por módulo: a identidade visual e os componentes são os
que já estão no sistema, e cor se escreve com os tokens (`--acc`,
`--red`, `--red-soft`...), nunca com um valor solto no meio do código.

**Não devolver ao Rafael tarefa técnica que dá para fazer aqui.** Ele não
é programador: não se pergunta a ele nome de tabela, biblioteca ou forma
de implementar. Só depende dele o que só ele pode fazer — autorização,
pagamento, credencial, decisão comercial, ou configuração numa conta que
o assistente não alcança.

**Publicar continua sendo decisão dele** (regra 1). Com uma diferença que
ele autorizou: corrigir defeito do que já está publicado, com a bateria
completa verde, sobe direto; regra de negócio nova ou recurso novo espera
ordem.

**A resposta no chat tem no máximo três linhas**, neste formato:

```
Pronto: [o que ficou concluído].
Testei: [o que foi verificado].
Acesse aqui: [link].
```

Se não estiver pronto: `Ainda não está pronto. / Problema encontrado: … /
Próxima ação: …`. Se depender dele: `Isso depende de você: … / Acesse: … /
Passo a passo: 1. … 2. … 3. …`. Relatório técnico, quando precisar, é
arquivo separado — no chat vai só o resumo e o link.

## Como falar com o Rafael

Português. Ele não é programador de formação, mas conhece o sistema dele a
fundo — explique o mecanismo, não só a conclusão. Sem jargão gratuito.
Quando algo der errado, diga o que quebrou e por quê, sem enfeitar.

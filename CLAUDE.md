# Joia — contexto permanente

Leia antes de mexer em qualquer coisa. Vale para toda sessão, aqui e no
Claude Code do computador do Rafael.

## O que é

ERP de gestão para food service, **em produção**. Seis lojas da rede Jolô
Gelato operam nele todo dia, na frente de caixa. Não é projeto de estudo:
um bug seu para uma loja de vender.

- Sistema: `index.html` — arquivo único, ~2,6 MB, ~51.600 linhas
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
4. **`VERSAO` (em `index.html`) e `VERSAO_SW` (em `sw.js`) sobem juntas.**
   Se só uma subir, o navegador da loja continua servindo o sistema velho
   do cache — foi o defeito da V195.

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

- **Procure antes de editar.** Antes de tocar numa função, veja todos os
  lugares que a citam (`grep -n`). O `MAPA.md` diz em que linha cada uma mora.
- **Nunca reescreva um bloco inteiro de memória.** Troque as linhas exatas.
  O que você reescreve sem ter lido, você apaga.
- **Ligou a função nova em algum lugar?** Se ela não é chamada, ela não
  existe. Confira antes de fechar.
- **Rode `node testes/montagem.js`** se mexeu na estrutura do arquivo.

## Modularização em curso

O plano e o andamento estão em `MODULARIZACAO.md`. Duas regras enquanto ela
não termina:

- Commit de **correção de bug** mexe em `index.html` e `sw.js`.
- Commit de **modularização** mexe em `ferramentas/`, `MODULARIZACAO.md` e,
  a partir da virada, `src/`. **Nunca em `index.html`.**

Assim os dois trabalhos nunca colidem, e isso é verificável no `git diff`.

## Como falar com o Rafael

Português. Ele não é programador de formação, mas conhece o sistema dele a
fundo — explique o mecanismo, não só a conclusão. Sem jargão gratuito.
Quando algo der errado, diga o que quebrou e por quê, sem enfeitar.

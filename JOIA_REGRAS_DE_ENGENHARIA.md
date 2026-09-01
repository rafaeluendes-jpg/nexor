# Joia — regras de engenharia

Ordem do Rafael, 01/09/2026. Vale para toda alteração no Joia, aqui e no
Claude Code do computador dele, mesmo quando ele não repetir o pedido.

Leia junto com o `CLAUDE.md`, que continua sendo o contexto do sistema.
Este arquivo diz **como se altera**; o `CLAUDE.md` diz **o que é**.

---

## A regra que manda em todas as outras

**Corrigir uma coisa não autoriza alterar outra.**

O que já funciona continua funcionando exatamente como antes, a menos que
o pedido cite aquela funcionalidade.

```
PRESERVAR → ALTERAR SÓ O NECESSÁRIO → TESTAR → COMPARAR → ENTREGAR
```

Nunca:

```
ALTERAR → PUBLICAR → DESCOBRIR NA LOJA O QUE QUEBROU
```

Uma alteração só está concluída quando **o que foi pedido funciona E o que
já funcionava continua funcionando**.

---

## 1. Configuração da loja é dado, não é código

Nenhuma atualização de código pode apagar, resetar, substituir ou recriar
o que o dono configurou: taxas de cartão, formas de pagamento, horários,
PDV, delivery, cardápio, categorias, produtos, operadores, senhas,
usuários, permissões, unidades, impressoras, bancos, caixas, WhatsApp,
Assistente Carla, parâmetros financeiros, estoque, integrações,
preferências — qualquer coisa configurável.

```
CÓDIGO / DEPLOY  ≠  CONFIGURAÇÃO DO CLIENTE
```

Publicar JavaScript, CSS, HTML ou Service Worker **não** pode restaurar
valor de fábrica no banco.

Valor de fábrica só entra quando **o registro ainda não existe**:

```
SE NÃO EXISTE:  cria o padrão
SE EXISTE:      preserva exatamente o que está lá
```

Proibido "ao iniciar → gravar configuração padrão" quando já existe
configuração gravada.

**Como isto é garantido hoje**, e o que quebrou quando faltou:

| Trava | Onde | O que impede |
|---|---|---|
| A semente só entra com a lista vazia | `baseFormas`, `baseFin`, `baseMov`, … | repor 1,99% / 3,49% por cima do que o dono gravou |
| Download que falha não é "a nuvem está vazia" | `volta()` | os dois turnos desativados voltando sozinhos (29/08) |
| Nada sobe antes de baixar | `sincronizar()` | aparelho atrasado gravar a cópia velha por cima (31/08) |
| Entrar de novo não limpa o aparelho | `entrarPeloAuth`, ramo `_mesmoDono` | o login zerar o `DB` e a semente repor tudo (31/08) |

`node ferramentas/auditar-configuracoes.js` confere as quatro a cada
publicação e reprova se alguma sair do lugar.

---

## 2. Uma fonte da verdade por configuração

Não pode existir tela A gravando num lugar, tela B lendo de outro, o PDV
usando um terceiro e a atualização restaurando um quarto valor.

Para cada configuração tem de estar claro: a tela que edita, a função que
grava, a função que lê, a tabela e o campo, o valor de fábrica, quem pode
alterar, e o escopo (empresa / unidade / usuário).

O `MAPA` (em `src/js/03-armazenamento/01-inicio.js`) é essa lista para
tudo que sincroniza: coleção do aparelho ↔ tabela da nuvem, campo a
campo. Configuração nova entra no MAPA — não em caminho paralelo.

---

## 3. Proibido reset silencioso

Apagar dado não é proibido. Apagar **sem decisão** é.

Só pode apagar debaixo de uma pergunta explícita à pessoa
(`await pergunta(...)`, `await confirmar(...)`) ou de uma verificação de
que quem entrou é **outro** dono. A auditoria de configurações trata como
risco qualquer `localStorage.clear()`, `removeItem('nexor_dados')`,
`indexedDB.deleteDatabase()`, `caches.delete()` ou `DB._hash = {}` fora
dessas condições.

`DB._hash = {}` merece nome próprio: é a memória do que já foi enviado.
Zerada, o envio seguinte acha que tudo mudou e empurra a cópia local por
cima da nuvem. Foi o defeito do caixa que reabria (V227) e o da taxa de
cartão (31/08/2026).

Corrija a **causa**, nunca o efeito visual.

---

## 4. Alteração cirúrgica

Antes de editar qualquer arquivo:

1. identifique o defeito;
2. **reproduza** o defeito;
3. ache a causa raiz;
4. liste os arquivos e funções afetados;
5. liste as dependências;
6. determine o **menor** conjunto possível de alterações.

Depois altere só esse conjunto. Não aproveite a correção para
reorganizar, renomear, mudar layout, mexer no banco, "melhorar" o que
está em volta, limpar código ou refatorar vizinhança — salvo quando for
tecnicamente indispensável, e aí o motivo fica escrito no commit.

---

## 5. Prova, não impressão

Não vale como prova: "a função existe", "o arquivo não tem erro de
sintaxe", "o teste unitário isolado passou".

Vale: **antes** o defeito acontece; **depois** não acontece; e as
funcionalidades vizinhas continuam funcionando.

Quando o defeito envolve tela, execute o **fluxo real** no navegador. Há
defeito que só aparece assim — o campo que perdia o cursor a cada letra
passava em qualquer teste de leitura de código.

---

## 6. Todo defeito vira barreira

Achou um defeito de verdade:

1. reproduza;
2. escreva um teste que **falha por causa dele**;
3. corrija;
4. rode de novo — o teste passa;
5. o teste fica para sempre.

O mesmo defeito não volta calado numa versão futura. É assim que a
bateria cresce: hoje são 40+ suítes, e cada uma nasceu de um estrago.

---

## 7. Persistência é obrigatória

Para qualquer configuração tocada pela alteração:

```
CONFIGURAR → SALVAR → SAIR DA TELA → VOLTAR      → conferir
CONFIGURAR → SALVAR → F5                          → conferir
CONFIGURAR → SALVAR → SAIR → ENTRAR DE NOVO       → conferir
CONFIGURAR → SALVAR → TROCAR DE TELA → VOLTAR     → conferir
CONFIGURAR → SALVAR → VERSÃO NOVA / PUBLICAÇÃO    → conferir
```

Tem de continuar **exatamente** igual.

`node ferramentas/persistir.js` faz isso no Chromium, no fluxo real, com
a taxa de cartão como sentinela — configura pela tela, salva pelo botão,
e confere depois de cada travessia, inclusive o cálculo no PDV.

---

## 8. Banco e migrations

Migration de estrutura não destrói configuração. Antes de tocar tabela
com dado: conte os registros, confira os campos, preserve os valores,
execute, compare antes e depois.

`ALTER TABLE` não autoriza zerar dado. `DROP`, `DELETE` e `TRUNCATE` em
produção, nunca como efeito colateral — só por ordem explícita do Rafael
(regra 2 do `CLAUDE.md`).

Depois de qualquer migration, regrave `ferramentas/esquema-nuvem.json`
com a consulta que está no fim de `ferramentas/conferir-nuvem.js`.

---

## 9. Sync, offline e conflito

O sistema é offline-first: o aparelho manda enquanto está sem rede, e
acerta depois. Isso cria conflito, e o conflito precisa de regra escrita —
nenhum módulo inventa a sua.

As regras de hoje:

- **Nada sobe antes de baixar.** Enquanto o aparelho não completar um
  download nesta sessão, ele não escreve na nuvem (`NUVEM.baixou`).
- **A nuvem é a fonte da verdade para o que existe nos dois lados**,
  exceto o que foi alterado aqui e ainda não subiu (`_novoAqui`,
  `_filhoPendente`, `_fechamentoPendente`).
- **O que só existe no aparelho é preservado** no download.
- **Download vazio não é nuvem vazia**: `[]` de uma consulta que falhou
  mantém o que está aqui.
- **Exclusão só é espelhada** por aparelho que já baixou.

---

## 10. Service Worker e cache

Atualizar o sistema troca **arquivos**. Não toca em **dado**.

`sw.js` só pode mexer em cache de arquivo. `localStorage`, `IndexedDB`,
fila offline e dados persistentes são território do cliente. A auditoria
de configurações reprova se o Service Worker citar qualquer um deles.

`VERSAO` e `VERSAO_SW` sobem juntas — se só uma subir, a loja continua
servindo o sistema velho do cache (defeito da V195).

---

## 11. Portão de publicação

```
node ferramentas/portao.js
```

Nove etapas, na ordem, parando na primeira reprovação:

1. montagem — o `index.html` é o espelho do `src/`
2. estrutura e versão — `VERSAO` e `VERSAO_SW` juntas
3. bateria de testes — as suítes todas
4. configurações — nenhuma rotina apaga o que a loja configurou
5. nuvem — o que o código manda é o que o banco aceita
6. varredura — as 94 telas montam, todo botão tem função
7. auditoria visual — computador (1440) e celular (390)
8. provas — os fluxos da loja no Chromium
9. persistência — a configuração sobrevive a tudo

Sai com 0 só quando tudo passou. **Qualquer outro resultado: não
publique.** E mesmo com o portão verde, publicar continua sendo decisão
do Rafael (regra 1 do `CLAUDE.md`); a exceção que ele autorizou é
correção de defeito do que já está publicado.

---

## 12. Não dizer "corrigido" sem prova

Toda correção é entregue com:

```
CAUSA RAIZ:
ARQUIVOS ALTERADOS:
O QUE FOI ALTERADO:
O QUE FOI PRESERVADO:
TESTE QUE REPRODUZIA:
TESTE APÓS CORREÇÃO:
REGRESSÕES TESTADAS:
PERSISTÊNCIA TESTADA:
PUBLICAÇÃO: SIM / NÃO
VERSÃO:
```

Esse bloco vai em arquivo ou no commit. **No chat continuam valendo as
três linhas** do `CLAUDE.md` — o Rafael lê o resumo, não o relatório.

---

## 13. Baseline funcional

`BASELINE.md` registra o que está aprovado e funcionando. Alteração que
não tem relação com um item da baseline tem de preservar aquele item.
Quando uma funcionalidade for validada, ela entra na lista com a data e
com o que a prova.

---

## 14. O roteiro de toda alteração

Antes de começar, a pergunta é sempre a mesma:

> **O que esta solicitação realmente autoriza alterar?**

Definido o escopo:

```
DIAGNÓSTICO → CHECKPOINT → TESTE ANTES → ALTERAÇÃO MÍNIMA
→ TESTE DEPOIS → REGRESSÃO → PERSISTÊNCIA → SEGURANÇA → PUBLICAÇÃO
```

Este protocolo não existe para travar a evolução do sistema. Existe para
que funcionalidade nova venha **junto** com as antigas preservadas, com as
configurações preservadas, e com zero regressão conhecida.

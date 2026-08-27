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

## Enquanto não termina: quem manda é o index.html

`src/` **não é uma segunda cópia**. É saída, gerada por
`node ferramentas/dividir.js` a partir do `index.html` atual. Se ficar velha,
não se sincroniza nada — regenera-se em segundos.

Por isso `src/` e `MAPA.md` **não são commitados** nesta fase (estão no
`.gitignore`). Um mapa guardado apontaria as linhas de duas versões atrás, e
linha errada é justamente o erro que se quer evitar. Uma verdade só, sempre:
o `index.html`.

Isso responde à pergunta que dá medo: **não dá para as duas versões
divergirem, porque não existem duas versões.**

## Fases

| Fase | O que | Estado |
|---|---|---|
| 0 | Ferramentas de recorte e a prova de diff-zero | **feita** |
| 1 | Fechar o furo crítico de acesso (senha de operador) | **feita (1A)** |
| 2 | O recorte por módulo de negócio | **feita** |
| 3 | A virada — `src/` passa a ser a fonte, `index.html` gerado | a fazer |
| 4 | Segurança completa — os 103 alertas e a escrita robusta | a fazer |
| 5 | Backup e recuperação | a fazer |
| 6 | Limpeza + auditoria dos botões e permissões que não funcionam | a fazer |

A virada (Fase 3) é o único momento delicado, e é um commit só, em hora
escolhida — de preferência com a loja fechada. Mesmo nela o risco é baixo:
o diff-zero garante que o arquivo publicado é idêntico ao que já estava lá.

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
node ferramentas/dividir.js    # recorta o index.html atual em src/
node ferramentas/montar.js     # emenda src/ e escreve na saída padrão
node ferramentas/mapear.js     # regenera o MAPA.md
node testes/montagem.js        # recorta e emenda: tem que dar idêntico
npm test                       # a suíte inteira, montagem incluída
```

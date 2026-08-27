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
| 0 | `CLAUDE.md`, `MAPA.md`, `dividir.js`, `montar.js`, teste de diff-zero | **feita** |
| 1 | Conferir o recorte parte por parte; CSS e JS abrindo em editor de verdade | a fazer |
| 2 | Quebrar `js/03-armazenamento.js` (3.776 linhas) por responsabilidade | a fazer |
| 3 | Quebrar `js/07-roteador.js` (33.313 linhas) por módulo de negócio: PDV, Estoque, Financeiro, Cardápio, Delivery, Clientes, Relatórios, Configuração | a fazer |
| 4 | **A virada** — `src/` passa a ser a fonte, `index.html` passa a ser gerado | a fazer |
| 5 | Limpeza: as ~2.210 linhas de CSS duplicado e as 42 funções órfãs | a fazer |

A virada (Fase 4) é o único momento delicado, e é um commit só, em hora
escolhida — de preferência com a loja fechada. Mesmo nela o risco é baixo:
o diff-zero garante que o arquivo publicado é idêntico ao que já estava lá.

## Estado do recorte hoje (V200.0.0)

| Parte | Linhas |
|---|---|
| `01-cabeca.html` | 94 |
| `css/01-principal.css` | 12.697 |
| `css/02-complemento.css` | 106 |
| `02-corpo.html` | 38 |
| `js/00-abertura.js` | 12 |
| `js/01-icones.js` | 107 |
| `js/02-modulos.js` | 200 |
| `js/03-armazenamento.js` | 3.776 |
| `js/04-utilitarios.js` | 361 |
| `js/05-login.js` | 418 |
| `js/06-interface.js` | 467 |
| `js/07-roteador.js` | **33.313** |
| `03-rodape.html` | 3 |

Seis dos oito arquivos de JS já cabem inteiros num contexto. O `07-roteador`
é a Fase 3 — é onde moram PDV, Estoque, Financeiro e os relatórios.

## Comandos

```
node ferramentas/dividir.js    # recorta o index.html atual em src/
node ferramentas/montar.js     # emenda src/ e escreve na saída padrão
node ferramentas/mapear.js     # regenera o MAPA.md
node testes/montagem.js        # recorta e emenda: tem que dar idêntico
npm test                       # a suíte inteira, montagem incluída
```

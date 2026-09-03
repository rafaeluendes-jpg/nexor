# JOIA — Seletor de sucursal escondido para usuário de unidade (frontend)

**03/09/2026. URGENTE.** Logado em Santa Fé, a Ficha Técnica mostrava o
campo "Sucursais" e deixava abrir/selecionar Alphaville. O seletor de
sucursal não pode existir para usuário de uma loja.

## Regra única

`vejoVariasUnidades()` — verdadeiro só para quem tem visão multiunidade
(matriz/dono via `mestre`/`tudo`, ou usuário com mais de uma sucursal
atribuída). Uma função só, para todas as telas usarem a mesma regra.

## O que foi escondido/travado para o usuário de unidade (V301)

- **Ficha Técnica**: o seletor "Sucursais" no topo da composição só aparece
  para visão multiunidade; e as opções saem de `sucursaisDoUsuario()`, nunca
  da lista de todas as lojas. O usuário de loja fica preso à própria unidade
  (a ficha e o custo mostrados são os dela). A grade "Sucursais" da edição de
  ficha (liberação por unidade) também some — e o que já estava liberado é
  preservado no salvar.
- **Topo (seletor de Loja)**: vira um rótulo fixo com o nome da própria loja,
  sem seta e sem troca, para quem não é multiunidade. (A troca já era travada
  no back do app por `podeTrocarUnidade()`/`podeSucursal()` desde a V202 —
  agora nem o botão aparece.)
- **Relatórios**: o filtro "Sucursais" (multi-seleção `seletorSuc`, usado em
  vários relatórios), o "marcar todas", e os seletores únicos de sucursal do
  Cardápio Digital, do Zap/Gestão e do Comparativo passam a usar
  `sucursaisDoUsuario()` — o de uma loja vê só a própria; a matriz vê todas.

- Teste: `testes/isolamento-sucursal.js` (a regra por perfil + as travas no
  código). `node ferramentas/portao.js`: 9 etapas verdes.

## O que ainda NÃO está fechado (é o projeto de RLS por unidade)

Isto é a **camada de frontend** — esconde os seletores. NÃO garante, por si,
que um usuário de unidade fique impedido de ler dados de outra loja alterando
ID, rota, requisição ou parâmetro. Como está no
`JOIA_SEGURANCA_ISOLAMENTO_UNIDADES_03092026.md`:

- O RLS do banco isola por **empresa/rede** (`loja_id`), não por **unidade**
  (`sucursal_ref`). Todos os usuários da Jolô têm o mesmo `loja_id`.
- Vários relatórios ainda **somam/mostram números de todas as unidades**
  (agregação por `sucAtivas()` na parte de dados, não só no seletor).
- O Financeiro não tem dimensão de unidade nas tabelas de conta/lançamento.

O isolamento de verdade (banco + permissões + relatórios) é o projeto por
etapas descrito naquele documento, com migração e teste por perfil (gerente
de A não lê B; matriz vê tudo; plataforma vê tudo). Não é um ajuste de
frontend, e o protocolo manda não disparar essa reescrita do núcleo
financeiro/segurança de 6 lojas ao vivo sem o escopo fechado com o Rafael.

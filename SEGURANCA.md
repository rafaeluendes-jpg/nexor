# Joia — revisão de segurança

Feita em 01/09/2026 · V282. Leitura do código e do banco de produção, sem
ataque — nada foi disparado contra o Supabase com as lojas abertas.

Cobre o que de fato quebra num sistema como este: uma loja lendo os dados
da outra, a chave secreta vazando para o navegador, entrada do cliente
virando comando na tela, e quem-pode-o-quê.

## Resultado: nada crítico aberto

### 1. Uma loja não lê a outra (isolamento no banco) — OK

- As **87 tabelas** têm RLS (segurança por linha) ligado. Nenhuma exposta.
- Toda tabela de negócio isola por `loja_id`, com a mesma regra:
  `loja_id = minha_loja()` (a rede toda para o dono/admin, a empresa toda
  para a plataforma). O caixa entra pela `caixa_id` da própria loja; os
  itens do pedido, pela `pedido_id` da própria loja — a corrente é fechada.
- As 8 funções que decidem isso (`minha_loja`, `minha_rede`, `sou_admin`,
  `posso`, …) são `SECURITY DEFINER` **com `search_path` fixo em `public`**.
  Sem esse `search_path` fixo, um usuário poderia criar uma função falsa e
  enganar a checagem — é a falha clássica do Supabase, e aqui está fechada.
- As 7 tabelas "sem política" são todas de **backup** (`bkp_*`) e a de
  sessão do app: RLS ligado sem política = ninguém lê pelo navegador,
  fechado por padrão. Correto.

### 2. A chave secreta não está no navegador — OK

- O que o navegador carrega é a chave **publicável**
  (`sb_publishable_…`), que é pública de propósito e só funciona debaixo
  do RLS acima. A chave secreta (`service_role`, que ignora o RLS) **não
  aparece** em `src/`, no `index.html`, no `sw.js` nem no cardápio.
- No robô do WhatsApp (repositório separado, servidor) a `service_role` é
  necessária e está certa: vem de **variável de ambiente**, o `.env` está
  no `.gitignore`, e o histórico do git nunca a carregou.

### 3. Entrada do cliente não vira comando na tela (XSS) — OK

- No cardápio público, todo texto vindo de fora — nome do produto, nome
  da loja, o nome que o cliente digita na comanda — passa pela função de
  escape `E()` antes de ir para a tela.
- Na tela da loja, o pedido online do cliente (nome, telefone, endereço,
  observação) também é escapado em toda exibição. Um cliente não consegue
  injetar código no computador do lojista por um pedido.

### 4. Quem pode o quê — OK, e é fino

- As gravações não são "qualquer um logado": cada uma exige a permissão da
  tela (`posso('financeira/lancamentos-financeiros')`, `posso('pdv/pdv')`,
  …). Apagar lançamento financeiro, caixa ou movimentação exige `gestor`.
- Cadastro de unidade e distribuição de permissão: só matriz/plataforma.
- `operador_senhas` e `operador_tentativas` são **cofre fechado**
  (`USING false`): nem o dono lê pelo navegador — as senhas de operador
  ficam fora de alcance. Correto.
- O layout do menu só o dono do Nexor escreve (trava por e-mail no banco).

## Riscos residuais (baixos, ficam anotados)

- **Cardápio público expõe o WhatsApp da loja** ao mundo (a política `anon`
  lê `cardapio_config` de toda loja com cardápio ligado). É um número
  comercial, publicado de propósito no próprio cardápio — aceitável, mas
  fica registrado que é um dado legível sem login.
- **Pedido online anônimo**: qualquer visitante cria pedido para qualquer
  loja com cardápio ligado. É o que um cardápio público precisa; o risco é
  pedido falso (spam), não vazamento. Se um dia virar problema, a defesa é
  limite por IP / captcha, não RLS.
- **8 funcionalidades sem prova automática** (ver `BASELINE.md`): não é
  falha de segurança, é falta de barreira de regressão.

## Como manter

Esta revisão é de leitura, então não entra no portão como teste que
dispara. O que entrou no portão foi o `conferir-nuvem.js` (forma dos dados)
e o `auditar-configuracoes.js` (nada apaga configuração). Uma mudança de
RLS ou de função de segurança deve ser revista à mão, aqui, e a data acima
atualizada.

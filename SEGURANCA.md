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

---

# Varredura de senha exposta — 01/10/2026

Pedido do Rafael: "faça uma verificação, vê se tem alguma senha exposta no
Dalu, na Central Rafaelos e no R2 (…) veja se tem alguma senha exposta e
faça essa cópia". O motivo dele é concreto: parte do código está em
repositório **público**, e qualquer pessoa lê.

## Resultado: nenhuma senha exposta

Os 10 repositórios da conta foram varridos arquivo por arquivo (varredura
própria, que procura chave privada SSH/PGP, senha de banco em texto, token
do GitHub, token do Asaas, chave da AWS, token do Meta/WhatsApp, string de
conexão com senha, chave VAPID privada, `senha:`/`password:` em código, e
JWT do Supabase — este último **decodificado**, para separar a chave `anon`
da `service_role` em vez de adivinhar pelo nome).

| Repositório | Visibilidade | Segredo grave |
|---|---|---|
| nexor | pública | nenhum |
| nexor-whatsapp | pública | nenhum |
| nexor-app | pública | nenhum |
| delivery | pública | nenhum |
| painel-rafael-ulian | pública | nenhum |
| rafaellos-centro-de-gestao | privada | nenhum |
| Rafael-gest-o- (Dalu) | privada | nenhum |
| r2on | privada | nenhum |
| jolo-central | privada | nenhum |
| sistema-inteligente | privada | nenhum |

O que apareceu, e por que não é problema:

- **Chave `anon` / `sb_publishable_…` do Supabase**: nasce para ir ao
  navegador. Não é senha. Só vale debaixo do RLS — conferido abaixo.
- **Senhas de mentira em arquivo de teste**: `"T3ste-Erro-" + uuid` e
  `"teste-descartavel-$$"` no Dalu, senha do servidor de mentira no
  `painel-rafael-ulian`, e a entrada de um teste de limpeza no
  `jolo-central`. São a *entrada* do teste, descartadas no fim.
- **`service_role` como palavra** em SQL legítimo (`grant … to
  service_role`). A chave com esse papel não está em nenhum repositório.
- **Senha de banco local** no `sistema-inteligente`: `docker-compose.yml`,
  `.env.example`, `ci.yml` e `scripts/db-local.sh` trazem
  `si_owner:si_owner` — é o banco que sobe no computador de quem programa
  e o banco de mentira da esteira de testes, não existe fora dali. O
  `docs/HOSPEDAGEM.md` usa marcadores (`<API_DB_PASSWORD>`), não senha.

## O histórico também foi varrido, não só o código de hoje

Num repositório público, segredo apagado ontem continua legível no commit
de anteontem. Então os 5 repositórios públicos foram varridos **objeto por
objeto, em todos os ramos e todos os commits** — 3.862 arquivos de
histórico ao todo — procurando token do GitHub, token do Asaas, chave da
AWS, chave privada SSH/PGP e qualquer JWT (com o papel decodificado).

| Repositório público | Arquivos no histórico | Segredo |
|---|---|---|
| nexor | 3.290 | 0 |
| nexor-whatsapp | 225 | 0 |
| nexor-app | 54 | 0 |
| delivery | 126 | 0 |
| painel-rafael-ulian | 167 | 0 |

Zero. E o buscador foi provado contra defeito plantado: um repositório com
um token do GitHub e uma chave `service_role` gravados num commit e
**apagados no commit seguinte** — ele achou os dois e identificou o papel
`service_role`. Zero aqui é zero, não é cegueira.

## A pergunta que importa: a chave pública basta para entrar?

A chave que o Joia carrega no navegador é a publicável
(`sb_publishable_tH04wQ…`), e ela está no `index.html`, que é público.
Nenhum JWT antigo aparece no código nem no histórico — só essa. Então ela
foi testada **com o papel anônimo de verdade dentro do banco de
produção**, que é exatamente o que a API faz quando alguém usa essa chave.
Somente leitura; nada foi escrito.

O que o papel anônimo consegue ler:

| | |
|---|---|
| `perfis`, `app_usuarios`, `app_sessoes`, `api_chaves` | **0 linhas** |
| `operador_senhas`, `operador_tentativas` | **0 linhas** (cofre `USING false`) |
| `pedidos`, `pedido_pagamentos`, `caixas`, `lancamentos_financeiros` | **0 linhas** |
| `clientes`, `lojas`, `empresas`, `config_loja`, `whatsapp_config` | **0 linhas** |
| `insumos`, `fichas_tecnicas`, `movimentacoes_estoque`, `turnos` | **0 linhas** |
| `produtos`, `categorias`, `cardapio_config` | o cardápio público (1 loja) |

E o que ele **é**, perante as funções que decidem o acesso:

    minha_loja() → null      sou_admin() → false
    minhas_lojas() → vazio   minha_rede_plena() → false
    vejo_todas_unidades() → false    sou_plataforma() → nem pode chamar

Como toda regra de escrita passa por uma dessas, a escrita também está
fechada. `operador_senhas` e `operador_tentativas` são `USING false` —
nem o dono lê pelo navegador.

**Conclusão: o código ser público não abre o banco.** A chave que está lá
é a pública, e ela só enxerga o cardápio.

## Os avisos do painel do Supabase, um por um

O painel mostra 24 + 15 + 56 avisos. Nenhum é brecha:

- **24 "RLS ligada sem política"** — 19 tabelas `arquivo.bkp_*` e 5 do
  `public` (`api_chaves`, `app_sessoes`, `fiscal_conta`, `fiscal_eventos`,
  `fiscal_unidades`). RLS ligada **sem** política significa *ninguém lê*:
  é fechado por padrão, e foi conferido — 0 linhas. É o aviso dizendo
  "esta tabela está inútil pela API", não "está aberta".
- **15 funções `SECURITY DEFINER` que o anônimo pode chamar** — são as que
  precisam ser chamadas antes do login (`app_entrar`, que tem freio:
  `pg_sleep(0.4)` por tentativa e bloqueio de 15 minutos após 5 falhas),
  as que exigem um token válido (`app_dados`, `app_sair`), as do cardápio
  público (`lojas_com_cardapio`), e as de contexto, que devolvem
  `null`/`false` sem sessão. Nenhuma devolve dado de loja.
- **56 para quem está logado** — é o desenho do sistema: o aplicativo não
  fala com tabela, fala com função (`venda_registrar`, `caixa_fechar`, …),
  e cada uma confere a permissão por dentro.

## Riscos residuais (os mesmos de 01/09, continuam baixos)

- **Pedido online anônimo**: visitante cria pedido para loja com cardápio
  ligado. É o que um cardápio público precisa; o risco é pedido falso, não
  vazamento. Defesa, se virar problema: limite por IP / captcha.
- **WhatsApp da loja legível no cardápio**: número comercial, publicado de
  propósito.

## O que ainda vale fazer (não é falha; é reduzir superfície)

1. Tornar privados os 5 repositórios públicos — `nexor`, `nexor-whatsapp`,
   `nexor-app`, `delivery`, `painel-rafael-ulian`. Só o Rafael pode: é
   clique na conta dele (Settings → General → Danger Zone → Change
   visibility). O `delivery` e o `nexor-app`, se servirem página pelo
   GitHub Pages, param ao virar privados — conferir antes.
2. Cópia de tudo no servidor, fora do GitHub: `ferramentas/espelhar-vps.sh`.

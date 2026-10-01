# Revisão de segurança — 01/10/2026

Pergunta do Rafael: "está 100% seguro? tem senha exposta no código? dá para
rodar em todas as lojas, com usuários, dentro da LGPD? nada vazado?"

Resposta curta: **não há senha nem chave secreta exposta**, e a base está
bem protegida. Achei **duas falhas pequenas no banco**, que estão abertas
hoje. As duas pedem uma alteração no Supabase de produção, que só sai com
ordem do Rafael (regra 2). A VPS não dá para conferir daqui; para ela há uma
lista no fim deste relatório.

## 1. O que foi conferido e passou

| Conferência | Resultado |
|---|---|
| Senha, chave ou token gravado no código (`src/`, `supabase/`, `ferramentas/`, `sw.js`) | **Nenhum.** As funções de borda leem a chave secreta só do ambiente (`Deno.env`). `ferramentas/backup.js` também lê do ambiente. |
| Histórico inteiro do git (todas as branches): chave `service_role`, `sb_secret_`, JWT | **Nada.** O único token no repositório é a chave **publicável** (`sb_publishable_…`), que é pública por natureza e foi feita para ir ao navegador. |
| Senhas `'1234'` e `'4321'` em `ferramentas/semente-loja.js` e `conferir-cadastros.js` | São dados de teste do simulador. Não vão para o banco de verdade. |
| Senhas no banco | `app_usuarios.senha`, `usuarios_sistema.senha` e `senha_caixa` estão **vazias em 100% das linhas**: 6 de 6 e 11 de 11. Senha só existe como hash (`senha_hash`, cofre). Há um gatilho, `tg_senha_nunca_em_claro`, que impede gravar senha em claro. |
| Senha no aparelho | O navegador guarda só o hash (`hashSenhaLocal`), nunca a senha. |
| Token fiscal (Spedy) | `fiscal_config.api_token` está vazio. A chave vive no Vault, e as tabelas fiscais têm RLS sem política: ninguém de fora lê. |
| RLS (cada loja só vê o que é dela) | **88 de 88 tabelas** com RLS ligada. |
| O que alguém **sem login** acessa | Só o cardápio público: produtos, categorias, opções, formas, áreas de entrega e unidades com cardápio ativo. Também pode **criar** pedido online, mas não pode **ler** pedidos. Nenhuma política aberta (`true`) para anônimo. |
| Login do app | `app_entrar` confere por hash e tem trava de tentativas. |
| Senha do operador no PDV | A conferência que o sistema usa trava 5 minutos depois de 5 erros. |
| API RDS | Só leitura, chave guardada só como sha-256, dados pessoais mascarados. |
| Backups antigos (esquema `arquivo`) | RLS ligada e sem política. Ninguém de fora lê. |

## 2. Falhas encontradas (abertas hoje)

### A. A ficha da unidade aparece para quem não fez login — **média**

A regra do cardápio público ("cardapio publico - unidades") libera a linha
**inteira** da tabela `sucursais`. A tela do cardápio só precisa de nome,
endereço e telefone. Mas qualquer pessoa com a chave pública (que está no
site) também lê os campos abaixo.

Conferido como usuário anônimo, só leitura: **4 unidades** visíveis. Delas,
4 mostram a `mensalidade`, 2 mostram o `login_responsavel` (o e-mail de
login do responsável) e 1 mostra o telefone. Também ficam abertos `plano`,
`dia_vencimento`, `cobranca_situacao` e `razao_social`.

- **LGPD:** o e-mail de login é dado pessoal.
- **Segurança:** o e-mail entrega metade do que é preciso para tentar entrar no sistema.

De menor peso: `formas_pagamento` mostra ao anônimo a taxa de cartão
(`taxa_pct`, `taxa_fixa`). É informação comercial, não dado pessoal.

**Correção proposta** (migration, precisa de ordem):
- Para o papel `anon`, tirar o `SELECT` da tabela inteira em `sucursais`.
- Devolver só as colunas que o cardápio usa: `id, loja_id, nome, apelido, nome_fantasia, telefone, endereco, numero, complemento, cidade, uf, cep, cor, ativa`.
- O mesmo em `formas_pagamento`, sem as colunas de taxa e de conta.
- **Antes de aplicar:** conferir o que o cardápio digital (repositório separado) pede dessas tabelas. Se ele pedir `select=*`, ele quebra. Ajusta-se o pedido dele primeiro.

### B. Uma porta antiga de conferir a senha do operador, sem trava — **baixa**

Existem duas versões de `senha_operador_conferir`:
- A que o sistema usa, com 3 parâmetros (`03-zap-e-mais-3.js:3154`), trava depois de 5 erros.
- A versão antiga, com 2 parâmetros, ainda existe e **não tem trava**.

Só quem já fez login no sistema consegue chamá-la. Mesmo assim, ela permite
testar a senha de autorização de um operador sem ser bloqueado.

**Correção proposta:** apagar a versão de 2 parâmetros (`drop function
public.senha_operador_conferir(text, text)`). Nenhuma tela a chama. Fazer o
mesmo com `senha_operador_definir(text, text)`, se também não tiver uso.

### Avisos do Supabase que não são falha

- 15 funções "executáveis sem login" e 58 "executáveis com login": são as
  funções do próprio sistema (login, cardápio, `minha_loja`...), e cada uma
  confere dentro de si quem está chamando. Esse aviso aparece em todo
  sistema que usa funções assim.
- 7 funções sem `search_path` fixo: risco baixo. Dá para corrigir junto com
  a migration acima, sem mudar comportamento.

## 3. LGPD — situação

O que já está certo:
- Cada loja só enxerga os próprios dados (RLS em todas as tabelas).
- Senhas só em hash.
- A API externa mascara CPF e telefone.
- O cliente do cardápio não consegue ler pedidos, nem os dele nem os dos outros.

O que falta para ficar redondo:
1. Fechar a falha A.
2. Ter um texto de **política de privacidade** no cardápio digital, onde o cliente digita nome, telefone, CPF e endereço. Isso é decisão comercial e jurídica, não de código.
3. Definir **por quanto tempo** guardar CPF e telefone de cliente de pedido online, e quem atende o pedido "apague meus dados".

## 4. VPS da Hostinger — não dá para conferir daqui

Esta sessão não tem acesso ao servidor. A separação em Docker com o nginx
como única porta é o desenho certo. Ela só está "segura" depois que alguém
rodar no servidor a lista de conferência que está no PDF "Servidor Jolô na
Hostinger" (seção 4):
- portas abertas;
- `.env` com permissão restrita;
- firewall;
- backup testado.

O robô do WhatsApp guarda a `service_role` no servidor. Por isso a proteção
da VPS importa tanto quanto a do código.

## 5. Nada é "100%"

Nenhum sistema é 100% seguro. O que dá para afirmar com prova:
- não há senha nem chave exposta no código nem no histórico;
- não há tabela sem proteção;
- não há senha em claro no banco.

Com A e B fechadas, a base fica no nível certo para rodar em todas as lojas.

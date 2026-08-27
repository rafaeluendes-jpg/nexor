# Joia — modelo de segurança

Como o acesso funciona, o que já está garantido, e as regras para não
abrir buraco novo. Escrito na Fase 4, depois de uma auditoria completa do
banco de produção.

## A regra que explica todas as outras

**O `index.html` é público.** Qualquer pessoa abre o navegador e lê o
código inteiro, incluindo a chave anônima do Supabase. Então:

> Nenhuma verificação feita em JavaScript é segurança. Ela é conveniência
> de interface. **Quem protege o dado é o banco** — Row Level Security e
> as funções `SECURITY DEFINER`.

Esconder um botão não impede ninguém de chamar a API. Se a regra não está
numa política de RLS, ela não existe.

## Quem é quem

| Papel | `perfis.cargo` | Enxerga |
|---|---|---|
| Plataforma | `plataforma` | tudo, todas as empresas — é o dono da Joia |
| Matriz | `admin` (sem `sucursal_ref`) | todas as lojas da própria empresa |
| Sucursal | `admin`/`gerente` (com `sucursal_ref`) | a própria unidade |
| Operador de caixa | não tem login no Supabase | assina operações com senha própria |

As funções que respondem isso — todas `SECURITY DEFINER`, todas lendo
`auth.uid()`:

```
minha_loja()      a loja da sessão            sou_admin()      matriz da empresa
minha_empresa()   a empresa da sessão         sou_plataforma() dono da Joia
minha_rede(loja)  a loja está na minha rede?  conta_ativa()    acesso não revogado
loja_permitida(x) a loja x é minha, ou eu mando nela?  ← criada na Fase 1
```

## O que o anônimo pode

O cardápio digital é público: ele lê com a chave anônima, sem login. Por
isso `anon` tem `SELECT` em sete tabelas — e **em todas ele passa por
`loja_com_cardapio(loja_id)`**, ou seja, só enxerga loja que publicou
cardápio:

`produtos`, `categorias`, `sucursais`, `cardapio_config`,
`formas_pagamento`, `areas_entrega`, `grupos_opcoes`

E pode **inserir** em `pedidos_online` — só isso, e só em loja com
cardápio ativo. **Não pode ler `pedidos_online`**: nome, telefone e
endereço de cliente exigem sessão da rede. Conferido rodando como `anon`:

```
produtos 27 · categorias 8 · sucursais 4 · cardapio_config 4 · formas 5
clientes 0 · pedidos_online 0 · pedidos 0 · lojas 0 · operador_senhas 0
lancamentos_financeiros 0 · whatsapp_config 0
```

Funções que `anon` ainda executa, e por quê:

| Função | Motivo |
|---|---|
| `app_entrar`, `app_dados`, `app_sair` | é a entrada do aplicativo: ninguém está logado ainda |
| `loja_com_cardapio` | as próprias políticas do cardápio a chamam |
| `minha_loja`, `sou_admin`, `minha_empresa`, `minha_rede` | aparecem em 42, 40, 36 e 1 políticas que valem para `anon`. Tirar o EXECUTE faria a avaliação da política falhar e derrubaria o cardápio. Para `anon` devolvem null/false |

## Regras para escrever função nova

Foram estas três que faltaram e viraram a falha da Fase 1:

1. **`SECURITY DEFINER` ignora a RLS.** Quem escreve uma precisa refazer
   à mão a verificação que a RLS faria. Não existe meio-termo.
2. **Nunca aceite a loja de quem chama.** `minha_loja()` devolve `null`
   sem erro para quem não fez login — um `if lj is null then lj := p_loja`
   entrega a escolha da loja ao atacante. Use `loja_permitida(p_loja)`:
   a sessão manda, o parâmetro é só desempate.
3. **Revogue de `PUBLIC`, não de `anon`.** Em Postgres a função nasce com
   `EXECUTE` para `PUBLIC`, e `anon` herda daí. Revogar só de `anon` não
   faz nada:
   ```sql
   revoke all on function public.minha_funcao(args) from public, anon;
   grant execute on function public.minha_funcao(args) to authenticated;
   ```
4. **Sempre `set search_path`.** Sem isso, quem chama aponta `public`
   para um schema próprio e troca por baixo o que a função acha que está
   chamando.

## Senha

| Onde | Como |
|---|---|
| Login do sistema | Supabase Auth |
| Cópia local (para operar sem internet) | SHA-256 com o login como sal, em `senhaLocal`. Nunca em texto puro |
| Senha do operador de caixa | bcrypt (`crypt` + `gen_salt('bf',10)`) em `operador_senhas`, que tem política `USING (false)` — cofre fechado, só as funções entram |
| Login do aplicativo | bcrypt, atraso de 0,4 s por tentativa, 5 falhas bloqueiam 15 min, token de 256 bits |

## O que a auditoria da Fase 4 fechou

103 alertas → **71**, e **zero ERRO**. Funções abertas ao anônimo: 34 → 8.

| | |
|---|---|
| Tomada de conta de operador sem login | fechada (Fase 1A) |
| Operador de uma loja mexendo em outra | fechado (`loja_permitida`) |
| `senha_operador_conferir` adivinhando a loja pelo `operador_ref` | removido (4B) |
| View `vw_vendas_sem_pagamento` rodando como dono | agora `security_invoker` |
| 6 funções com `search_path` solto | fixado |
| 15 gatilhos e 4 funções internas abertas ao anônimo | revogados |
| `pedidos_online` aceitando pedido em qualquer loja | agora só loja com cardápio |
| 6 contas de teste vivas em produção | apagadas |

## O que continua em aberto

- **`rafaellos@gelato.com`** — conta no Auth sem perfil, último acesso
  13/08. Não apaguei porque não é claramente de teste. Se não for de
  ninguém, apagar.
- **6 tabelas `bkp_*`** com dado real (250 linhas de insumos, 8 de
  usuários do sistema, 3 de configuração do WhatsApp). Estão trancadas
  (RLS ligada, nenhuma política), mas são resíduo de agosto. Guardar
  cópia e apagar.
- **48 funções `SECURITY DEFINER` executáveis por quem está logado.**
  É o esperado — mas cada uma precisa checar por dentro o que a RLS
  checaria. Revisão uma a uma ainda não foi feita.

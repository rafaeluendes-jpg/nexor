# Auditoria de segurança — 29/09/2026

Pedido do Rafael: nenhuma senha exposta, nenhum dado de cliente vazando,
nos quatro sistemas (Joia, Central, CRM, landing) e no robô do WhatsApp.

Tudo aqui foi conferido **só lendo**: nada foi alterado no Supabase de
produção. As correções que tocam o Joia e a Central estão listadas no fim
e esperam ordem do Rafael (regra 2 do CLAUDE.md).

## 1. Senhas e chaves no código

| Sistema | Resultado |
|---|---|
| `nexor` (Joia + CRM + landing) | Nenhum segredo. Só a chave **publicável** do Supabase do Joia, feita para ir ao navegador. |
| `jolo-central` | Nenhum segredo. Só a chave **anon** da Central, também pública por projeto. |
| `nexor-whatsapp` | Nenhum segredo. |
| CRM (`.env` na VPS) | Fora do Git, arquivo `600` (só o root lê), senhas geradas no servidor. |

Procurado: chaves `sb_secret_`, JWT de `service_role`, tokens da OpenAI
(`sk-`), da Meta (`EAA…`), do GitHub, da AWS e do Google, chaves privadas
e senha dentro de endereço de banco. Arquivos `.env`, `.pem`, `.key` e de
credencial versionados: nenhum (só os `.env.example`, sem valor).

**Limite desta conferência:** as cópias locais são rasas (últimos commits).
O histórico completo só é conferido quando o código sair do GitHub (item 3).

## 2. Banco do Joia e da Central (Supabase)

O verificador de segurança do próprio Supabase **não acusou nenhuma
tabela aberta**: todas têm proteção por linha (RLS) ligada. As chaves
públicas que estão no navegador, sozinhas, não abrem dado.

Conferido por dentro:

- **Login do app do Joia (`app_entrar`)**: senha com hash, bloqueio de 15
  minutos após 5 erros, atraso proposital a cada erro. Bom.
- **Criação de acessos (`criar-usuario`)**: confere a sessão e o cargo antes
  de tudo; a chave de administrador nunca vai ao navegador. Bom.
- **Segredos da Central** (chaves da Meta, LiveKit, AssemblyAI): guardados no
  cofre do banco; só administrador vê, e só de uma lista fechada. A senha
  do agendamento exige 32+ caracteres (adivinhar é inviável). Bom.

Pontos a corrigir (baixo risco, nenhum expõe dado hoje):

| # | Onde | O que | Correção |
|---|---|---|---|
| A | Joia | Função `teste` pública, sem uso | Apagar |
| B | Joia | `criar-usuario` aceita senha de 6 caracteres | Subir o mínimo para 10 |
| C | Joia | `criar-usuario` aceita chamada de `localhost` em produção | Tirar `localhost` da lista |
| D | Joia e Central | Funções de gatilho (`tg_*`, `sug_anexo_mexeu`) podem ser chamadas pela API | Retirar essa permissão |
| E | Central | Proteção contra senha vazada desligada no login | Ligar |

## 3. Código público no GitHub

**O risco mais concreto.** `nexor` (Joia + CRM) e `nexor-whatsapp` estão
**públicos**: qualquer pessoa lê como o sistema funciona. Não há senha no
código, mas conhecer o código facilita procurar falha.

Não dá para simplesmente fechar hoje: o `joiagest.com.br` é publicado a
partir desse repositório e, no plano gratuito do GitHub, fechar derruba o
sistema das lojas. Resolve junto com a mudança para a VPS: o código passa
a morar no servidor, fechado, e o GitHub deixa de ser usado.

## 4. CRM e servidor (VPS)

- Banco e fila escutam só em `127.0.0.1`; API e telas também, atrás do nginx.
- Termo de uso obrigatório (LGPD) — a API recusa tudo até o aceite.
- Pedido para parar no WhatsApp respeitado na hora.
- Backup diário do banco, documentos e configuração, 30 dias.
- Assinatura da Meta conferida em toda mensagem que chega.

## O que depende do Rafael

1. **Ordem para aplicar A a E no Supabase** (ou aplicar já na versão que vai
   para a VPS — o resultado é o mesmo, e as lojas não sentem).
2. A mudança do Joia e da Central para a VPS (item 3).

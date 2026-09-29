# Mudança de tudo para a VPS da Hostinger

Pedido do Rafael (29/09/2026): CRM, Joia e Central Jolô como três projetos
dentro da VPS, com os bancos, os documentos e o código ali, backup diário,
sem Cloudflare, sem GitHub e sem Supabase.

## Onde cada coisa está hoje

| O quê | Onde roda | Banco | Endereço (DNS) |
|---|---|---|---|
| CRM + site | VPS | Postgres na VPS | jologelato.com.br (HostGator) |
| Joia (ERP das lojas) | GitHub Pages | Supabase `cevghkndzpzvnzwifhnm` | joiagest.com.br (Cloudflare) |
| Cardápio digital | GitHub Pages (`/delivery`) | Supabase do Joia | links das lojas passam por joiagest.com.br |
| Robô do WhatsApp | repositório `nexor-whatsapp` | Supabase do Joia | — |
| Central Jolô | Cloudflare Workers (US$ 5/mês) | Supabase `cvarnbkjlvpjehjulsuc` | centraljolo.com.br (Cloudflare) |

VPS hoje: 2 processadores, 8 GB de memória (4,7 GB em uso), 96 GB de disco
(14 GB em uso).

## Os dois pontos que decidem a mudança

1. **Backup só dentro da VPS não é backup.** Se a VPS quebra, é invadida ou
   a conta tem problema, o sistema e as cópias somem juntos. Hoje o GitHub
   e o Supabase são, sem querer, a cópia de fora. Antes de desligar
   qualquer um deles, a cópia diária precisa ir também para fora da VPS,
   criptografada: backup da própria Hostinger e/ou um segundo lugar de
   guarda.
2. **O Joia e a Central conversam direto com o Supabase** (login, dados,
   atualização ao vivo). Trazer os bancos significa instalar na VPS o mesmo
   conjunto de serviços do Supabase, um para cada sistema. Com 8 GB e metade
   em uso, não cabe com folga: é preciso subir o plano da VPS (sugestão:
   4 processadores / 16 GB).

## Ordem (da mais segura para a mais delicada)

1. **Segurança da VPS**: só as portas 80/443 e SSH por chave, bloqueio
   automático de tentativas, atualizações de segurança automáticas, banco
   sem porta aberta para fora, senhas só em arquivos `.env` de acesso root,
   e conferência automática de que nenhuma senha entrou em código.
2. **Backup diário criptografado**, na VPS e fora dela, com teste de
   restauração.
3. **Central na VPS** (ainda usando o banco do Supabase) → trocar o endereço
   → desligar o Worker.
4. **Joia + cardápio na VPS** (ainda com o banco do Supabase) → trocar o
   endereço → desligar o GitHub Pages. Sem mexer em nada da operação das
   lojas.
5. **Bancos para a VPS**, um por vez, de madrugada, com as lojas fechadas.
   O Supabase fica ligado por 30 dias como reserva.
6. **Código**: os repositórios passam a morar na VPS, com o histórico
   inteiro e cópia no backup de fora.
7. **Cancelar** Cloudflare, GitHub e Supabase, só depois de 30 dias
   estáveis.

## Decisões do Rafael (29/09/2026)

- VPS sobe para 4 processadores / 16 GB.
- Cópia de fora: backup diário automático da própria Hostinger, além do
  backup criptografado dentro da VPS.

## Feito

- 29/09/2026: bloqueio automático de quem erra a senha do SSH (fail2ban:
  5 erros em 10 min = 1 dia bloqueado). O login por senha continua ligado
  porque hoje não há chave SSH cadastrada; desligar agora trancaria o
  Rafael para fora. Trocar por chave é passo da etapa 1.

## O que depende do Rafael

- Subir o plano da VPS (etapa 5).
- Escolher onde fica a cópia de fora (etapa 2).
- As chaves da Central e do Joia que hoje estão guardadas na Cloudflare e
  no Supabase (entregues direto no servidor, nunca no chat).
- Apontar os endereços (painel da Cloudflare e da HostGator) quando cada
  etapa estiver pronta.

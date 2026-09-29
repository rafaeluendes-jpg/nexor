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

- ~~VPS sobe para 4 processadores / 16 GB.~~ Corrigido no mesmo dia: a
  medição por processo mostrou que dos 4,9 GB em uso, 3,9 GB eram 15
  conversas abertas do assistente e só ~0,5 GB os sistemas. Estimativa com
  tudo dentro: ~3,5 GB (Central ~0,3; dois bancos com o conjunto enxuto do
  Supabase — banco, API, login e tempo real — ~1 GB cada). **8 GB bastam.**
  Para caber, conversas antigas do assistente precisam ser fechadas.
- Cópia de fora: backup diário automático da própria Hostinger, além do
  backup criptografado dentro da VPS.

## Feito

- 29/09/2026: bloqueio automático de quem erra a senha do SSH (fail2ban:
  5 erros em 10 min = 1 dia bloqueado). O login por senha continua ligado
  porque hoje não há chave SSH cadastrada; desligar agora trancaria o
  Rafael para fora. Trocar por chave é passo da etapa 1.
- 29/09/2026: backup diário da Hostinger (fora da VPS) contratado pelo
  Rafael, 11 meses.
- 29/09/2026: **Central rodando na VPS** — `/opt/central`, usuário próprio
  `central` sem shell, serviço `jolo-central` (127.0.0.1:3002, disco só
  leitura fora de `.next`, 1 GB de teto), nginx `centraljolo.com.br` em
  HTTP. Falta: chave de serviço (`guardar-chave-central.sh`), apontar o
  endereço e emitir o certificado. O código já lê `process.env` quando
  não está na Cloudflare; nada foi mudado nele.
- 29/09/2026: **Joia montado na VPS** — `publicar-joia.sh` sai sempre da
  `main`, com a mesma lista fechada de arquivos do Pages, em
  `/var/www/joia/versoes/*` com troca instantânea. Conferido byte a byte
  com o que está no ar (index.html, sw.js, manifest, supabase.js, atalhos
  das lojas: iguais). nginx `joiagest.com.br` em HTTP, com `no-cache` no
  index.html e no sw.js. Falta: apontar o endereço e o certificado.
- 29/09/2026: varredura de segredos (gitleaks, histórico inteiro dos dois
  repositórios): nenhum segredo real; 5 alarmes, todos exemplo de
  documentação (`SUA_CHAVE`) ou nome de variável.
- 29/09/2026: `jolo-backup-sistemas` (todo dia 03:40, 30 dias): código
  com histórico inteiro (git bundle), Joia no ar e configuração do
  servidor com os segredos. Restauração provada (clone do bundle da
  Central).

- 29/09/2026 ~15:50: **Central virou para a VPS.** Rafael tirou o domínio
  do Worker e criou o registro A (DNS only) na Cloudflare; certificado
  Let's Encrypt emitido na hora (`centraljolo.com.br`), HTTP→HTTPS.
  Provado no Chromium: /entrar abre, login errado responde "Login ou
  senha incorretos" (a Central conversa com o Supabase de dentro da VPS),
  zero erro de console. O Worker continua existindo em
  `jolo-central.rafaeluendes.workers.dev` até o cancelamento.
- 29/09/2026 16:05: **defeito na virada da Central, corrigido.** Login
  CERTO devolvia 502 ("upstream sent too big header"): a sessão do
  Supabase vem em cookies grandes e o buffer padrão do nginx (4–8 KB) não
  cabia. No navegador aparecia "Application error: a client-side
  exception". O teste da virada usou login ERRADO, que não devolve
  cookie — por isso não pegou. Corrigido: `proxy_buffer_size 64k` no site
  da Central e `large_client_header_buffers 8 32k`
  (`/etc/nginx/conf.d/jolo-cabecalhos.conf`). **Lição: prova de virada
  tem de incluir um login que dá certo.**
- Falta na Central: a chave da IA (`ANTHROPIC_API_KEY`) estava só no
  Worker, cifrada — não dá para copiar. Sem ela, os recursos de IA da
  Central (marketing, ata do Jolô Meet) dizem que falta a chave. Precisa
  de uma chave nova do console da Anthropic, guardada em
  `/etc/jolo/central.env`.

## Banco da Central para a VPS — ensaiado em 29/09/2026

- Supabase oficial (docker) em `/opt/supabase-central`: banco, login,
  API, arquivos, tempo real e funções; tudo só em 127.0.0.1 (porta
  18000), sem painel e sem pooler. Mesmo JWT secret da nuvem: as chaves
  e as sessões de hoje continuam valendo. Senhas em `/etc/jolo` (600).
- Cookie da sessão com nome fixo na Central (commit e9d41b1 do
  jolo-central): ninguém cai na tela de entrar na troca.
- Roteiro: `scripts/central-banco-virar.sh` (ENSAIO=1 para ensaiar).
  Ensaio de ponta a ponta: 88 tabelas iguais, 548 fotos, 13 segredos do
  cofre, 21 regras de acesso às fotos, gatilho de novo usuário, 5 rotinas
  (desligadas no ensaio), 7 funções. Login e 22 telas no Chromium sem
  erro; foto assinada abre; função recusa quem não está logado.
- Funções que não vieram (sondas de teste, ninguém chama): sonda-push,
  medir-tempo, livekit-provar.
- **Muda com a troca:** "esqueci minha senha" deixa de mandar e-mail —
  quem mandava era o Supabase da nuvem. Precisa de uma conta de e-mail
  (SMTP). Até lá, a senha se troca pela própria Central.
- Na troca o roteiro desliga as rotinas da NUVEM (senão aviso em dobro)
  — única escrita na nuvem. O Worker em `*.workers.dev` continua
  gravando na nuvem se alguém usar aquele endereço: apagar o Worker
  depois da troca.

## A virada dos endereços — ordem segura

1. Trocar só o registro A dentro da Cloudflare (efeito em ~5 min) e
   emitir o certificado na hora: a janela sem HTTPS é de ~1 minuto.
2. Só depois, com tudo na VPS e certificado emitido, levar o DNS da
   Cloudflare para o Registro.br com os MESMOS registros — as duas
   respostas apontam para a VPS, então a propagação não derruba nada.

Central: pode virar de dia. Joia: depois que as lojas fecham.

## Achado que muda o plano: QR Code das mesas

O cardápio digital mora em `rafaeluendes-jpg.github.io/delivery` — endereço
do GitHub, não nosso. O Joia gera o QR Code das mesas com esse endereço
(`src/js/07-roteador/09-modulo-pdv/02-transferencia-e-mais-6.js:1131`), e os
atalhos das lojas (`/santafe`, `/jales`...) também levam para lá. **QR já
impresso nas mesas aponta para o GitHub.** Cancelar a conta do GitHub
apaga esse endereço e todos os QR impressos param de abrir. Antes de
cancelar: cardápio num endereço nosso, QR novo impresso, e o endereço
antigo mantido como redirecionamento até trocar todos os impressos
(uma conta gratuita do GitHub só com o redirecionamento).

`app.joiagest.com.br` (painel do franqueado, repositório `nexor-app`) também
está no GitHub Pages e entra na mudança.

## Ainda falta (além do que depende do Rafael)

- Cardápio digital (`/delivery`, hoje no GitHub Pages) e robô do WhatsApp.
- Bancos do Joia e da Central (Supabase → VPS), com cópia diária deles
  antes: precisa da senha do banco de cada projeto.
- Repositórios de código morando na VPS, e o `publicar-joia.sh` lendo de
  lá em vez do GitHub.

## O que depende do Rafael

- Subir o plano da VPS (etapa 5).
- Escolher onde fica a cópia de fora (etapa 2).
- As chaves da Central e do Joia que hoje estão guardadas na Cloudflare e
  no Supabase (entregues direto no servidor, nunca no chat).
- Apontar os endereços (painel da Cloudflare e da HostGator) quando cada
  etapa estiver pronta.

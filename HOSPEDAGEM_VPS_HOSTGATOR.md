# Mudar o Joia para a VPS da HostGator?

Resposta ao pedido do Rafael de 22/09/2026: *"a gente tem uma VPS já paga
na HostGator; como faço para mudar o Joia para dentro dela, junto com o
Supabase?"*

**Resposta curta: dá para fazer, mas não compensa — e o pedaço perigoso é
o banco.** Abaixo está o porquê, e o que eu faria com a VPS em vez disso.

---

## 1. De que o Joia é feito hoje

| peça | onde está | quanto custa | o que acontece se cair |
|---|---|---|---|
| O sistema (as telas) | GitHub Pages | **grátis** | as lojas continuam vendendo: o aparelho tem o sistema guardado |
| O banco (Supabase) | Supabase, plano **Pro** | já pago | as lojas continuam vendendo, mas param de conversar entre si |
| A API de leitura | dentro do Supabase | incluso | relatórios e o Codex ficam sem resposta |
| O robô do WhatsApp | repositório separado | — | o robô para |

O banco tem **201 MB** — é pequeno. O problema nunca foi tamanho.

Vale lembrar o que já está montado a seu favor: o Joia é **offline-first**.
Cada aparelho da loja guarda o sistema e os dados inteiros. Se a internet,
o GitHub ou o Supabase caírem no sábado à tarde, **a loja continua
vendendo**. Isso é o que protege o caixa hoje.

---

## 2. O que muda em cada peça, se for para a VPS

### As telas (o sistema em si) — mudança pequena, ganho pequeno
Hoje o GitHub Pages entrega o sistema de graça, com certificado de
segurança automático e servidores espalhados pelo mundo. Na VPS, quem
entrega é uma máquina só, em um lugar só, e o certificado passa a ser
responsabilidade nossa (renovação, expiração). É factível e reversível —
mas troca algo que nunca deu problema por algo que dá manutenção.

### O banco (Supabase) — é aqui que mora o risco
Hospedar o Supabase por conta própria significa passar a cuidar, todo dia:

- **Backup.** Hoje o plano Pro faz cópia automática e permite voltar o
  banco para um ponto no tempo. Na VPS, backup é rotina que alguém
  configura, testa e confere — e backup que nunca foi testado não é backup.
- **Atualização de segurança.** Hoje é automática. Na VPS, é tarefa.
- **Disco cheio.** Numa VPS, disco cheio **para o banco**. Não é hipótese
  distante: é a falha mais comum de servidor pequeno.
- **Madrugada e fim de semana.** Se o servidor travar num domingo, quem
  levanta? Hoje isso não é problema de ninguém da rede.
- **Tamanho da máquina.** O Supabase completo pede uns 4 GB de memória só
  para ficar de pé. VPS de plano básico costuma ter 2 GB.

Trocaríamos um serviço que já está pago, funcionando e com socorro, por
uma máquina que passa a depender de manutenção nossa. **Não há economia:**
a VPS já está paga e o Supabase Pro também — mudar não devolve dinheiro,
só transfere risco para dentro de casa.

### O que a mudança NÃO resolve
Nenhum dos problemas que a gente vem corrigindo (caixa gêmeo, nota que
voltava, configuração que se perdia) tem a ver com onde o sistema está
hospedado. Eram defeitos de código, e continuariam iguais na HostGator.

---

## 3. O que eu faria com a VPS — ela não precisa ficar parada

A VPS está paga; o desperdício é deixá-la ociosa. Três usos que valem a
pena, **sem encostar no banco das lojas**:

1. **O robô do WhatsApp.** É exatamente o tipo de coisa que precisa de uma
   máquina ligada o tempo todo. Hoje ele não tem casa própria — a VPS é a
   casa certa.
2. **Uma cópia de segurança nossa, todo dia.** Uma rotina que baixa o banco
   inteiro do Supabase e guarda na VPS. Assim a rede passa a ter backup em
   **dois lugares diferentes**, um deles sob seu controle. Isso é ganho de
   verdade, e é barato de fazer.
3. **O cardápio digital**, quando ele for para o ar com domínio próprio.

---

## 4. Se, mesmo assim, você quiser mudar tudo

Eu faço, é seu sistema. Só não seria com a loja no meio do expediente. O
caminho seria este, em ordem, e leva alguns dias:

1. Conferir se a VPS tem tamanho e acesso para isso (memória, disco e
   acesso de administrador).
2. Subir o Supabase na VPS e deixar **rodando em paralelo**, sem loja
   nenhuma usando, até provar que tudo responde igual.
3. Configurar backup automático para fora da VPS — antes de migrar, não
   depois.
4. Copiar o banco num domingo à noite, virar a chave, e ficar de plantão
   na segunda de manhã.
5. Manter o Supabase atual pago por mais um mês, desligado, como rede de
   segurança. Se algo der errado, a volta é imediata.

---

## 5. O que depende de você

1. **Decidir:** manter o banco no Supabase (recomendo) ou migrar tudo.
2. Se topar a ideia da seção 3, me diga **qual é o plano da VPS**
   (quanta memória, quanto disco) e me passe o acesso — eu ponho o robô do
   WhatsApp e o backup diário para rodar lá.

Eu não enxergo sua conta da HostGator daqui; o que está escrito acima vale
para VPS em geral, e a seção 4 começa justamente conferindo o plano real.

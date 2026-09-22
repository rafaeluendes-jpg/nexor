# Recuperar o acesso à conta do Supabase

Situação (22/09/2026): o Rafael não consegue mais receber o código no
e-mail nem no celular da verificação em duas etapas.

**Antes de tudo, o mais importante: nada está em risco.** O projeto está
no ar, saudável, e as lojas continuam funcionando normalmente — perder o
acesso ao painel não derruba nada. E a sessão do assistente continua
alcançando o banco, então dá para tirar uma cópia de segurança a qualquer
momento, hoje mesmo, se você quiser.

---

## Passo 1 — tente pelo GitHub (é o caminho mais provável)

A conta que guarda o Joia tem o nome **`rafaeluendes-jpg's Org`** — esse
nome vem de um login do **GitHub**, não de um e-mail. Ou seja: muito
provavelmente a conta foi criada clicando em *"Continue with GitHub"*.

Faça assim:

1. Abra **supabase.com/dashboard**.
2. Clique em **Continue with GitHub** (não em "entrar com e-mail").
3. Se o GitHub já estiver logado no seu navegador, você entra direto — sem
   e-mail, sem código.

Se entrou: pronto, está recuperado. **Aproveite e arrume as duas coisas da
seção 4 antes de fechar a página.**

---

## Passo 2 — se o problema for o próprio GitHub

Então o que precisa ser recuperado é o GitHub, e o Supabase vem junto.

1. Abra **github.com/password_reset** e peça a troca de senha.
2. Se o e-mail também não chegar, abra **support.github.com**, escolha
   *"I can't sign in"* e siga a verificação de identidade. O GitHub
   aceita outras provas além do e-mail (códigos de reserva, um aparelho
   que já estava logado, a chave do computador).
3. Se você ainda estiver logado no GitHub em **algum** aparelho —
   celular, o computador da matriz, um navegador antigo — comece por ali:
   com a sessão aberta dá para trocar o e-mail em *Settings › Emails* sem
   precisar de código nenhum.

---

## Passo 3 — se for mesmo conta de e-mail e senha

Aí só o suporte do Supabase resolve, e o seu caso é dos bons: **você é
cliente pagante (plano Pro)**, e cliente pagante tem atendimento.

Abra **supabase.com/dashboard/support/new** (ou escreva para
`support@supabase.com`) e mande este texto, trocando o que estiver entre
colchetes:

> Hello,
>
> I have lost access to the email address and the 2FA device of my
> Supabase account and I cannot sign in. I am the owner of the
> organization below and an active Pro-plan customer.
>
> - Project ref: `cevghkndzpzvnzwifhnm`
> - Project name: Joia Gestão Inteligente
> - Organization ID: `jcnmdlvzyqtuixtnsjqm`
> - Region: us-east-2
> - Project created on: 2026-07-27
> - Plan: Pro (active)
> - New contact email: [seu e-mail novo]
>
> I can confirm billing details (card last four digits, latest invoice
> number) and any other ownership proof you need.
>
> Thank you,
> Rafael Uendes

**Prova que eles costumam pedir, e que você tem:** os quatro últimos
dígitos do cartão que paga o plano, o valor e a data da última cobrança, e
o número de uma fatura. Procure no e-mail do cartão ou no aplicativo do
banco antes de escrever — com isso em mãos, a recuperação costuma sair em
um ou dois dias úteis.

---

## Passo 4 — assim que entrar, arrume isto (5 minutos, e não acontece de novo)

1. **Troque o e-mail de contato** para um que você controle hoje, e
   confirme o novo.
2. **Gere e guarde os códigos de reserva** da verificação em duas etapas
   (*Account › Security*). São aqueles códigos de uso único: imprima,
   ou guarde no cofre de senhas. É exatamente o que falta agora.
3. **Coloque um segundo dono na organização** (*Organization › Team ›
   Invite*), com uma conta sua diferente ou de alguém de confiança da
   matriz. Assim nunca mais existe uma porta só.
4. Faça o mesmo no **GitHub**: e-mail atual e códigos de reserva salvos.

---

## O que eu posso fazer daqui, se você quiser

- **Tirar uma cópia completa do banco agora** e te entregar o arquivo, para
  ficar com você independente de conta. É só pedir.
- Preparar o texto do suporte já preenchido, se você me passar o e-mail
  novo.

O que eu **não** consigo fazer: provar para o Supabase ou para o GitHub que
a conta é sua. Isso é identidade, e só você pode.

# Política de Privacidade — Joia ERP

> **MINUTA PARA REVISÃO JURÍDICA — NÃO PUBLICAR SEM VALIDAÇÃO DE ADVOGADO.**
>
> Este documento foi escrito a partir dos **fluxos reais** do sistema, verificados
> no banco de dados em 26/08/2026. Nada aqui é invenção: cada categoria de dado
> abaixo corresponde a colunas que existem. Mas conformidade com a LGPD é questão
> jurídica, não técnica — os trechos marcados **[VALIDAR]** dependem de decisão do
> responsável legal.

**Última atualização:** 26 de agosto de 2026
**Versão do sistema:** V183

---

## 1. Quem é o controlador

**[VALIDAR]** Razão social, CNPJ e endereço da empresa que opera o Joia ERP.

Nas redes que usam o sistema (como a Jolô Gelato), a rede é **controladora** dos
dados de seus clientes e funcionários, e o Joia atua como **operador** — trata os
dados em nome dela e conforme suas instruções.

**[VALIDAR]** Esta divisão de papéis precisa constar do contrato entre as partes.

## 2. Encarregado (DPO)

**[VALIDAR]** Nome e e-mail de contato do encarregado pelo tratamento de dados
pessoais, exigido pelo art. 41 da LGPD.

## 3. Que dados são tratados

Levantamento feito diretamente no banco. **57 tabelas** contêm dado pessoal, todas
com Row Level Security ativa.

### 3.1 Clientes da loja
| Dado | Onde | Para quê |
|---|---|---|
| Nome | `clientes.nome` | identificar o pedido e chamar pelo nome no balcão |
| Telefone | `clientes.telefone` | avisar que o pedido saiu; atendimento pelo WhatsApp |
| Endereço (rua, bairro) | `clientes.rua`, `.bairro` | entregar o pedido |
| CPF | `clientes.cpf` | emissão de nota fiscal, quando solicitada |
| Data de nascimento | `clientes.nascimento` | **[VALIDAR]** verificar se ainda há finalidade; se não houver, é coleta excessiva (art. 6º, III) |

### 3.2 Pedidos
Nome do cliente, endereço de entrega e CPF quando informado, em `pedidos` e
`pedidos_online`. Retenção vinculada à obrigação fiscal — ver seção 6.

### 3.3 Funcionários e usuários
Nome, e-mail de acesso e função, em `usuarios_sistema`, `perfis` e `operadores`.

**Senhas:** desde a V183 **nenhuma senha é armazenada em texto puro**. A autenticação
usa o Supabase Auth; as senhas de autorização do caixa são guardadas como hash
bcrypt em `operador_senhas` e nunca retornam ao navegador.

### 3.4 WhatsApp
Telefone e conteúdo das mensagens trocadas com a atendente automática, em
`whatsapp_mensagens` e `assistente_conversas`.

**[VALIDAR]** Definir prazo de retenção das conversas. Hoje não há expurgo automático.

### 3.5 Fornecedores e entregadores
CNPJ, e-mail, telefone e, no caso de entregadores, CPF.

### 3.6 Registros de auditoria
`audit_log` guarda quem alterou o quê e quando, incluindo o e-mail do usuário.
Finalidade: segurança e rastreabilidade (art. 7º, IX — legítimo interesse).

## 4. Com que base legal

**[VALIDAR — esta seção é a que mais precisa de advogado.]** Enquadramento sugerido:

- **Execução de contrato** (art. 7º, V): dados necessários para o pedido e a entrega
- **Obrigação legal** (art. 7º, II): CPF e dados fiscais da nota
- **Legítimo interesse** (art. 7º, IX): registros de auditoria e segurança
- **Consentimento** (art. 7º, I): comunicação promocional, se houver

## 5. Com quem os dados são compartilhados

| Quem | O que recebe | Onde fica |
|---|---|---|
| Supabase | banco de dados completo | Estados Unidos (região us-east-2) |
| Meta (WhatsApp) | telefone e mensagens | conforme política da Meta |
| Groq / Google (IA) | trechos de mensagem para classificação | conforme política de cada um |
| GitHub Pages | hospedagem da interface (sem dados pessoais) | Estados Unidos |

**[VALIDAR — ponto crítico.]** Os dados ficam **fora do Brasil**. A LGPD exige base
específica para transferência internacional (art. 33). Precisa de análise e,
possivelmente, cláusulas contratuais com os fornecedores.

## 6. Por quanto tempo

**[VALIDAR]** Hoje o sistema **não apaga nada automaticamente**. Prazos sugeridos,
todos dependentes de confirmação jurídica e fiscal:

- documentos fiscais: **5 anos** (prazo fiscal)
- cadastro de cliente sem compra: **[VALIDAR]**
- conversas de WhatsApp: **[VALIDAR]**
- registros de auditoria: **[VALIDAR]**

## 7. Direitos do titular

A LGPD garante confirmação, acesso, correção, anonimização, portabilidade,
eliminação e informação sobre compartilhamento (art. 18).

**Situação técnica hoje, sem enfeite:**

| Direito | Situação |
|---|---|
| Acesso e confirmação | possível por consulta direta ao banco |
| Correção | possível pela tela de clientes |
| Eliminação | possível, **mas** dados de nota fiscal têm retenção legal obrigatória |
| Portabilidade | **não há exportação automática** — precisa ser feita manualmente |

**[VALIDAR]** Definir canal de atendimento ao titular e prazo de resposta.

## 8. Segurança

Medidas verificadas nesta auditoria:

- Row Level Security em **86 de 86** tabelas
- isolamento entre empresas testado com sessão real: **0 vazamentos em 13 tentativas**
- senha em texto puro: **0**
- chave privilegiada no navegador: **não** (só a chave publicável)
- trilha de auditoria com autor, data e operação
- transporte por HTTPS

## 9. Incidentes

**[VALIDAR]** A LGPD exige comunicação à ANPD e aos titulares em caso de incidente
relevante (art. 48). **Não existe procedimento formal definido.** Os registros de
auditoria permitem investigar quem acessou o quê e quando.

## 10. Alterações

**[VALIDAR]** Como as mudanças desta política serão comunicadas.

# Manual do CRM

## Entrar

`https://crm.jologelato.com.br`. E-mail e senha da sua conta. Cinco
tentativas erradas seguidas bloqueiam o acesso por alguns minutos.

## O funil

Quatorze etapas, na ordem do processo de franquia:

| Etapa | O que significa |
|---|---|
| Novo lead | chegou e ainda ninguem falou com ele |
| IA qualificando | a IA esta fazendo as primeiras perguntas |
| Qualificado | tem perfil: capital, praca e prazo batem |
| Reuniao agendada | tem dia e hora marcados |
| Apresentacao realizada | ja viu a apresentacao da franquia |
| Visita a unidade | conheceu uma loja da rede |
| COF enviada | recebeu a Circular de Oferta de Franquia |
| Prazo COF | os dez dias legais de analise estao correndo |
| Negociacao | discutindo praca, prazo e condicoes |
| Contrato | assinando |
| Ganho | virou franqueado |
| Perdido | nao vai seguir |
| Nutricao | tem perfil, mas nao agora |
| Sem resposta | sumiu |

Arrastar o cartao muda a etapa. Toda mudanca fica registrada com quem
fez e quando: da para reconstruir a historia do lead inteira.

## O cartao do lead

Nome, telefone, cidade, pontuacao, temperatura, de onde veio, quem
atende e qual a proxima acao.

**Temperatura** vem da pontuacao: 70 ou mais e quente, entre 40 e 69 e
morno, abaixo de 40 e frio. A pontuacao soma capital compativel (25),
prazo curto (20), praca disponivel (20), perfil empreendedor (15),
disponibilidade (10) e engajamento na conversa (10).

## Conversas

Toda conversa do WhatsApp aparece aqui, com o historico inteiro.

**Assumir o atendimento** tira a IA da conversa na hora. Enquanto voce
for o dono, so voce responde. **Liberar** devolve a conversa para a IA.
Isso evita o pior cenario: a IA e o humano respondendo por cima um do
outro.

## Origem do lead

Cada lead guarda por onde entrou (Instagram, Google, indicacao...) e
qual campanha o trouxe. **A primeira origem nunca e trocada**: se a
pessoa veio pelo Instagram e voltou depois pelo Google, o credito
continua sendo do Instagram, que foi quem realmente trouxe.

## Papeis

| Papel | O que faz |
|---|---|
| Super admin | tudo, inclusive apagar lead |
| Admin | tudo, menos apagar lead |
| Expansao | leads, conversas, funil, tarefas, reunioes, documentos |
| Atendente | conversas e leads permitidos |
| Marketing | campanhas, origem, anuncios, numeros e relatorios |
| Visualizacao | so olha |

Quem nao tem permissao nao consegue a acao nem por fora da tela: quem
decide e o servidor.

## Tarefas

O que o time precisa fazer, com prazo e dono. Tarefa sem dono nao anda:
quando voce cria sem escolher responsavel, ela fica com voce.

O sistema tambem cria tarefa sozinho: lead que nao respondeu em 24 horas
vira "Retomar contato", e a IA cria tarefa quando decide passar a conversa
para uma pessoa.

Tarefa com prazo vencido aparece marcada em vermelho.

## Agenda

Reunioes e visitas. Marque a reuniao pela ficha do lead: assim ela ja fica
ligada a pessoa certa e **o lead anda no funil sozinho** para "Reuniao
agendada". Quando a reuniao acontece, marque "Aconteceu" e o lead vai para
"Apresentacao realizada".

Nao da para marcar reuniao no passado.

## COF

A Circular de Oferta de Franquia tem prazo legal: entre o **recebimento**
pelo candidato e a assinatura do contrato precisam passar 10 dias.

O sistema faz isso funcionar assim:

1. **Abrir o processo** pela ficha do lead.
2. **Registrar o envio** — a data em que a COF foi entregue.
3. **Registrar o recebimento** — e daqui que o prazo comeca a correr.
4. **Liberar o contrato** — so aparece depois do prazo cumprido.

Se alguem tentar liberar antes, o sistema recusa e diz quantos dias faltam.
Nao e um aviso que da para ignorar: e uma trava.

Dois dias antes do fim do prazo, o processo aparece com alerta.

## Documentos

COF, contrato, ficha de qualificacao, documentos do candidato. Aceita PDF,
JPG, PNG, DOCX e XLSX, ate 20 MB.

Ficam numa area privada do servidor: nao existe link publico. Cada abertura
de arquivo fica registrada na auditoria, com quem abriu e quando.

## Pracas

As cidades da rede, com a situacao de cada uma: disponivel, em analise, em
negociacao, reservada ou vendida. Praca marcada como vendida some da lista
que a IA oferece aos candidatos.

## Relatorios

Conversao entre todas as etapas, tempo medio de primeira resposta, tempo
parado em cada etapa, desempenho por campanha, origem, cidade e
responsavel, leads esquecidos, motivos de perda e quantas vezes a IA
precisou chamar uma pessoa.

## Configuracoes

Aqui ficam as regras do negocio, e nao dentro do codigo:

- **Horario de atendimento** — quais dias e horas ha gente para atender.
- **Quem atende o lead novo** — sempre a mesma pessoa, rodizio, por cidade,
  por estado, por campanha, ou ninguem (fila geral).
- **Pesos da pontuacao** — o que faz um lead ser quente.

Mudou aqui, vale na proxima mensagem que chegar.

## Planilha

A exportacao gera um Excel com uma linha por lead e vinte e uma colunas:
dados de contato, origem, campanha, etapa, pontuacao, temperatura,
responsavel e datas. Serve para acompanhar por fora e para dar satisfacao
a quem nao usa o sistema.

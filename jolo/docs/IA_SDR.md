# A IA que faz o primeiro atendimento

## O que ela faz

Responde a primeira mensagem, se apresenta, faz as perguntas de
qualificacao (cidade, capital, prazo, experiencia, disponibilidade),
tira duvidas basicas sobre a franquia e marca o interesse em reuniao.

## O que ela nao faz

- **Nao encosta no banco de dados.** Nenhuma consulta, nenhuma escrita
  direta. Ela so age por dez ferramentas autorizadas, e cada uma valida
  o que recebe.
- **Nao inventa numero.** Investimento, cidades disponiveis, prazo de
  retorno e duracao do treinamento saem de dados cadastrados, nao da
  cabeca dela.
- **Nao fecha negocio.** Ela qualifica e passa adiante.
- **Nao insiste depois que a pessoa pede para parar.**

## As dez ferramentas

| Ferramenta | Para que |
|---|---|
| `getLead` | ler o que ja se sabe do lead |
| `updateLead` | gravar nome, cidade, capital, prazo |
| `setQualificationAnswer` | guardar a resposta de cada pergunta |
| `changeStage` | mover a etapa do funil |
| `createTask` | criar tarefa para o time |
| `createNote` | deixar observacao no lead |
| `scheduleMeeting` | registrar interesse e horario de reuniao |
| `handoffToHuman` | passar para uma pessoa |
| `getFranchiseFAQ` | responder duvida comum com dado aprovado |
| `getAvailableCities` | dizer quais pracas estao livres |

## Quando ela passa para uma pessoa

- o lead pede para falar com alguem;
- o assunto sai do roteiro (juridico, contrato, excecao comercial);
- o lead ficou quente e ja da para marcar reuniao;
- ela nao entendeu depois de duas tentativas;
- o lead demonstrou irritacao.

Ao passar, ela cria a tarefa e avisa. A conversa fica com dono e a IA
para de responder ali.

## Ligar e desligar

Sem `OPENAI_API_KEY` e com `AI_PROVIDER=disabled`, a IA fica desligada e
**nada quebra**: cada mensagem que chega vira tarefa para o time
responder a mao. E o comportamento certo enquanto nao ha credencial: nao
inventar resposta.

Para ligar: `AI_PROVIDER=openai` e a chave no `.env`.

## Custo

Cada conversa gasta creditos do provedor. `AI_MAX_TOKENS` limita o
tamanho da resposta. Vale acompanhar o gasto na primeira semana antes de
deixar solto.

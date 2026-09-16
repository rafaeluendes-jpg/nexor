# Robô do WhatsApp (Carla) — por que ficava mudo ou virava "Nina", e o que fechou de vez

Data: 16/09/2026 · Versões: V329, V334, V335 (Joia) e dois commits no robô (`nexor-whatsapp`).

## O que o Rafael viu

1. A Carla parava de responder por um dia inteiro (14/09: oito clientes sem resposta).
2. A Carla se apresentava como **"Nina"**, sem saudação e sem regras (16/09).
3. O cliente via **"Aguardando esta mensagem"** no lugar da resposta.
4. Esses problemas voltavam depois de corrigidos.

## As quatro causas, cada uma com a sua porta fechada

| # | Causa (comprovada no registro de alterações da nuvem) | Porta fechada |
|---|---|---|
| 1 | O botão **LOJA LIGADA/DESLIGADA** grava "robô ligado" na nuvem só no clique. Se a loja religa num instante sem nuvem, o cardápio volta sozinho (sincronização) e o robô fica desligado. | **V329**: o robô na nuvem é conferido com o interruptor a cada religada da nuvem e a cada sincronização com clique pendente. |
| 2 | A tela **Robô do WhatsApp** nunca baixava a configuração da nuvem. Num aparelho sem ela, mostrava a cópia local de fábrica ("Nina", vazia) e a **troca de aba salvava isso por cima** da Carla. Foi o que Santa Fé fez em 15/09 às 21:50. | **V334**: a tela só aparece depois de trazer a nuvem; o salvar recusa subir cópia que não passou por essa leitura; a religada da nuvem também traz a configuração. |
| 3 | Santa Fé tinha **duas linhas** de configuração na nuvem (uma "Carla" completa e uma "Nina" vazia), criadas pelo próprio sistema quando não achava a linha pelo uuid. O robô ora lia uma, ora outra. | Linha duplicada apagada (backup `bkp_whatsapp_config_20260916b`). **V335**: o sistema nunca mais cria segunda linha (procura pela referência e pelo uuid; cria com o uuid). Robô: lê todas as linhas da unidade e fica com a mais completa. |
| 4 | O WhatsApp do cliente pede reenvio quando não consegue abrir a mensagem; o robô **não sabia reenviar** (faltavam `getMessage` e o contador de tentativas do Baileys). | Robô: guarda as últimas 500 mensagens enviadas e atende o pedido de reenvio. |

## Como a Carla foi restaurada

O registro de alterações (`audit_log`, linha 317698) guardava a configuração inteira de antes da sobrescrita. Foi copiada de volta: nome Carla, saudação (76 caracteres), regras (972), respostas prontas, mensagens de fase, avaliação. Robô ligado.

## Guardiões que travam a regressão (todos no portão)

- `testes/robo-segue-o-interruptor.js` — 17 testes (causa 1).
- `testes/robo-le-a-nuvem-antes.js` — 21 testes (causas 2 e 3): a tela traz a nuvem antes, o salvar sobe a Carla, o salvar recusa sem leitura, `gravarCfgZap` nunca cria segunda linha.
- `testes/interruptor-da-loja.js` — 44 verificações.
- Robô: `npm test` (121 testes) passando nos dois commits.

## O que ainda depende de gente

Nada. Se a loja quiser mudar o nome ou as regras da atendente, faz pela tela **Robô do WhatsApp** — que agora mostra o que está na nuvem antes de deixar salvar.

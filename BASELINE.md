# Joia — baseline funcional aprovada

O que está validado e funcionando. Uma alteração que **não tem relação**
com um item desta lista tem de preservar aquele item exatamente como está.

Um item só entra aqui com a prova que o sustenta — um teste da bateria,
uma prova no navegador, ou uma conferência no banco de produção. Sem
prova, não entra.

Regra de uso: antes de publicar, o `node ferramentas/portao.js` roda tudo
o que sustenta esta lista. Se um item cair, ele reprova.

Última revisão: **01/09/2026 · V282**

---

## Aprovados

| Funcionalidade | O que está garantido | Prova |
|---|---|---|
| **Login e sessão** | Entrar de novo com o mesmo usuário/unidade preserva o aparelho inteiro; outro usuário limpa tudo | `testes/login-nao-apaga-configuracao.js` (20) |
| **Permissões por perfil** | Cada perfil vê só o que é dele | `ferramentas/provar.js` §5 |
| **Matriz e unidades** | Fechar o caixa de uma loja não toca no da outra; a matriz tem mais de um dono | `provar.js` §7, §10e |
| **PDV — venda** | Abrir caixa, vender, somar; recarregar e nada sumir | `provar.js` §1, §2 |
| **PDV — troco** | Forma "dinheiro" aceita receber a mais e calcula o troco | `provar.js` §10d |
| **PDV — turnos** | O PDV obedece a tela de Turnos | `provar.js` §10c |
| **PDV — sabor de gelato** | Sabor não desconta a base duas vezes na venda | `provar.js` §10t |
| **Formas de pagamento** | Taxa, prazo e conta sobrevivem a sair da tela, F5, trocar de módulo, versão nova e à semente de fábrica; o PDV aplica a taxa | `ferramentas/persistir.js` (32) |
| **Contas e bancos** | Conta renomeada continua renomeada depois de recarregar | `persistir.js` §8 |
| **Caixa — fechamento** | Fechado aqui não reabre no download; o comprovante cabe no papel | `provar.js` §8, §10 |
| **Caixa — abertura** | A abertura imprime | `provar.js` §10b |
| **Sangria e suprimento** | Saem no papel para assinar, e a sangria aparece no fechamento | `provar.js` §10f, `testes/sangria-nao-some.js` (28) |
| **Cancelamento de venda** | Papel e coluna no Kanban | `provar.js` §10g |
| **Cardápio digital** | Loja desligada não aceita pedido; o aviso distingue "desligada" de "fechada" | `/home/user/delivery/teste-loja-desligada.js` (17) |
| **Interruptor da loja** | O botão liga e desliga de verdade o cardápio e o robô | `testes/interruptor-da-loja.js` (41) |
| **Pedido do cardápio** | Chega, aceita, e não some; sai com endereço e sabor legível | `provar.js` §10i, §10n |
| **Estoque — contagem** | Não se perde ao sair da tela; sobe inteira com preços, retroativa e movimentação | `testes/contagem-nao-se-perde.js` (36), `contagem-sobe-inteira.js` (20) |
| **Estoque — baixa manual** | Acha o item por 2 letras, sem acento, em qualquer ordem; o cursor não se perde; cadastra motivo sem sair da tela | `testes/baixa-manual-encontra-e-cadastra.js` (28), `provar.js` §10u |
| **Estoque — movimentação** | O rodapé soma o dia; o filtro por motivo corta certo | `provar.js` §10s |
| **Pedido de base** | Sobe com os itens; o olhinho abre o pedido inteiro | `testes/pedido-base-sobe-inteiro.js` (42) |
| **Financeiro — frente de caixa** | A lista não cabe numa janelinha; o período padrão não esconde o dia 1º | `provar.js` §10q, `testes/dia-primeiro.js` (18) |
| **Relatórios — canais** | Delivery e cardápio digital são um canal só, e batem com os pedidos | `testes/canais-e-horarios.js` (43) |
| **Relatórios — data e hora** | Melhor dia e pico de horário no fuso de São Paulo | `testes/canais-e-horarios.js` |
| **Impressão** | O papel não sai com um palmo de branco; a medição que falha não vira 200 mm | `provar.js` §10h, §10k |
| **Sincronização — envio** | Aparelho que ainda não baixou não escreve na nuvem | `testes/aparelho-atrasado-nao-manda.js` (17) |
| **Sincronização — download** | Download que falha não apaga o que está no aparelho nem abre porta para a semente | `aparelho-atrasado-nao-manda.js` |
| **Sincronização — contador** | "N alterações esperando" conta o que o motor realmente envia | `testes/contador-nao-mente.js` (30) |
| **Sincronização — forma** | Todo campo que sobe existe como coluna; a chave do upsert é índice único de verdade | `ferramentas/conferir-nuvem.js` (923), `testes/conferir-nuvem.js` (11) |
| **Offline** | O que foi lançado sem rede sobe quando a rede volta, sem duplicar | `provar.js` §2, `testes/reconciliacao.js` |
| **Service Worker** | Troca arquivo, não toca em dado; `VERSAO` e `VERSAO_SW` sobem juntas | `testes/versao.js`, `ferramentas/auditar-configuracoes.js` |
| **Telas** | As 94 montam, todo botão tem função, zero erro no clique | `ferramentas/varrer.js` |
| **Visual** | Zero rolagem horizontal, zero alvo pequeno, zero texto técnico na tela, computador e celular | `ferramentas/auditar.js` |

---

## Ainda não coberto por prova automática

Estes funcionam, mas nada os segura contra uma regressão. Entram na lista
acima quando ganharem prova.

- Assistente Carla (robô do WhatsApp) — hoje só a conferência de colunas
  contra o banco (`nexor-whatsapp/teste-colunas.js`, 5)
- Dashboard e gráficos
- Cadastro de operadores e troca de senha
- Impressoras: seleção e configuração por aparelho
- Cupons e promoções
- Acerto com entregadores
- Fiado e clientes
- Backup e restauração

---

## Como isto se mantém

Quando uma funcionalidade for validada — por um teste novo, uma prova no
navegador ou uma conferência no banco — ela entra na tabela com o que a
sustenta. Quando um defeito for corrigido, o teste que o reproduzia entra
junto: é assim que a barreira cresce, e é por isso que a lista de
"aprovados" só aumenta.

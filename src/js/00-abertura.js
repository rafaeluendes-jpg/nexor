/* ==========================================================
   NEXOR
   BLOCO 1  icones
   BLOCO 2  estrutura de modulos
   BLOCO 3  armazenamento (local por enquanto)
   BLOCO 4  utilitarios
   BLOCO 5  login
   BLOCO 6  interface
   BLOCO 7  roteador
   BLOCO 8  MODULO CARDAPIO
   ========================================================== */

/* ==========================================================
   A SESSAO PRECISA EXISTIR ANTES DE ALGUEM ESCREVER NELA

   `var SESSAO={usuarioId:null,login:null}` morava no BLOCO 28, a 33 mil
   linhas daqui. O bloco 5 (login) tem codigo de topo que roda no
   carregamento — o "manter conectado", que devolve a pessoa para o
   sistema sem digitar de novo. Ele faz `SESSAO.usuarioId=...`.

   `var` sobe a DECLARACAO, mas nao a atribuicao. Entao, na hora em que o
   bloco 5 rodava, SESSAO ainda valia `undefined`, e a linha estourava:

       Cannot set properties of undefined (setting 'usuarioId')

   O erro caia num `catch` que so anota — a pessoa nao via nada. Dois
   estragos, e o segundo e o grave:

   1. o "manter conectado" nunca funcionou: sempre voltava para o login;
   2. `abrirSessao()` nao rodava, entao `NUVEM.loja` ficava vazia. E
      `carimbarOrigem()` desiste quando nao ha loja — sem carimbo, o
      cadastro novo nao sobe E nao recebe a marca `_novoAqui`, que e o
      que impede o download de apaga-lo. Cria o produto, aparece o aviso
      de "ainda nao chegou a nuvem", e na sincronizacao seguinte ele some.

   E, mesmo que nao estourasse, a atribuicao la do bloco 28 rodava DEPOIS
   e zerava a sessao que o bloco 5 tinha acabado de restaurar.

   Aqui e o primeiro bloco de JavaScript do arquivo. Antes disto nao ha
   codigo nenhum.
   ========================================================== */
var SESSAO={usuarioId:null,login:null};

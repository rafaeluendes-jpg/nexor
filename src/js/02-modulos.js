/* ===== BLOCO 2 — MODULOS ===== */
var MOD=[
{id:'cardapio',n:'Gestão de Cardápio',ic:'book',it:[{id:'cfg-cardapio',n:'Configuração de Cardápio'}]},
{id:'pdv',n:'PDV',ic:'pos',it:[{id:'pdv',n:'PDV'},
 {id:'pedidos-online',n:'Pedidos do Cardápio'}]},
{id:'financeira',n:'Gestão Financeira',ic:'money',it:[
 {id:'categorias-financeiras',n:'Categorias Financeiras'},
 {id:'formas-pagamento',n:'Formas de Pagamento'},
 {id:'contas-bancarias',n:'Contas Bancárias'},
 {id:'acerto-entregadores',n:'Acerto com Entregadores'},
 {id:'lancamentos-financeiros',n:'Lançamentos Financeiros'},
 {id:'compras-sem-vinculo',n:'Compras sem Vínculo'},
 {id:'fluxo-caixa',n:'Fluxo de Caixa'},
 {id:'conciliacao-bancaria',n:'Conciliação Bancária'},
 {id:'fornecedores',n:'Fornecedores'},
 {id:'frente-caixa',n:'Frente de Caixa'}]},
{id:'clientes',n:'Gestão de Clientes',ic:'users',it:[
 {id:'cadastro-clientes',n:'Cadastro de Clientes'},{id:'cupons-clientes',n:'Cupons de Desconto'}]},
{id:'estoque',n:'Gestão de Estoque',ic:'box',it:[
 {id:'producao',n:'Produção'},
 {id:'ficha-tecnica',n:'Ficha Técnica'},
 {id:'ingredientes-insumos',n:'Ingredientes e Insumos'},
 {id:'grupo-ingredientes',n:'Grupo de Ingredientes'},
 {id:'movimentacao-estoque',n:'Movimentação de Estoque'},
 {id:'transferencia',n:'Transferência de Mercadoria'},
 {id:'posicao-estoque',n:'Estoque Total'},
 {id:'contagem-estoque',n:'Contagem de Estoque'},
 {id:'historico-posicao',n:'Movimentação de Mercadoria'},
 {id:'notas-entrada',n:'Notas de Entrada'}]},
{id:'relatorios',n:'Gestão de Relatórios',ic:'file',it:[
 {id:'faturamento-dia',n:'Faturamento por Dia'},
 {id:'itens-consumidos',n:'Itens Consumidos'},
 {id:'itens-vendidos',n:'Itens Vendidos'},
 {id:'vendas-area-entrega',n:'Vendas por Área de Entrega'},
 {id:'vendas-forma-pagamento',n:'Vendas por Forma de Pagamento'},
 {id:'vendas-periodo',n:'Vendas por Período'},
 {id:'dre',n:'DRE'},
 {id:'cmv-mercadoria',n:'CMV por Mercadoria'},
 {id:'cancelamentos',n:'Cancelamentos'},
 {id:'vendas-mesa',n:'Vendas por Mesa'},
 {id:'cupons-fiscais',n:'Cupons Gerados'},
 {id:'pedidos-base',n:'Pedidos de Base'},
 {id:'cupons',n:'Cupons de Desconto'}]},
{id:'dashboard',n:'Gestão e Dashboard',ic:'chart',it:[
 {id:'canais-venda',n:'Canais de Venda'},
 {id:'faturamento',n:'Faturamento'},
 {id:'venda-data-hora',n:'Venda por Data e Hora'},
 {id:'comparativo-anual',n:'Comparativo Anual e Mensal'}]},
/* ==========================================================
   CONTROLE DIARIO — o caderno da operacao
   Hoje a perda e anotada em papel e depois digitada de novo no sistema:
   trabalho dobrado e sujeito a esquecimento. Aqui a pessoa registra na hora,
   e no fim do dia lanca tudo de uma vez na movimentacao de estoque.
   Modulo proprio de proposito: e a area do FRANQUEADO, e outras coisas dele
   virao para ca. Nao e um segundo lugar de baixar estoque — nada sai do
   saldo enquanto esta aqui.
   ========================================================== */
{id:'controle',n:'Controle Diário',ic:'caderno',it:[
 {id:'baixa-manual',n:'Baixa Manual'},
 {id:'pedido-base',n:'Fazer Pedido de Base'},
 {id:'bases-valores',n:'Bases e Valores'}]},
{id:'loja',n:'Configuração da Loja',ic:'store',it:[
 {id:'cfg-loja',n:'Mapa do Sistema'},
 {id:'carga-inicial',n:'Importar Dados'},
 {id:'cfg-sucursais',n:'Sucursais da Franquia'},
 {id:'liberacao',n:'Liberação por Unidade'},

 {id:'cfg-pdv',n:'Configuração do PDV'},
 {id:'cfg-movimentacao',n:'Motivos de Baixa de Estoque'},
 {id:'areas-entrega',n:'Áreas de Entrega'},
 {id:'canais-integracao',n:'Canais de Venda e Integração'},
 {id:'cfg-gerente',n:'Assistente Joia'},
 {id:'cfg-dre',n:'Configuração do DRE'},
 {id:'dados-fiscais',n:'Dados Fiscais da Empresa'},
 {id:'modelo-impressao',n:'Modelo de Impressão'},
 {id:'motivo-cancelamento',n:'Motivo de Cancelamento'},
 /* ==========================================================
    A TELA DE OPERADORES EXISTIA E NAO ESTAVA EM MENU NENHUM

    `telaOperadores()` estava escrita, funcionando, e sem nenhuma porta
    de entrada: nao havia item de menu nem rota apontando para ela. Quem
    precisava cadastrar alguem so para assinar cancelamento e abrir caixa
    era obrigado a criar um USUARIO, com e-mail e senha de acesso ao
    sistema — um login a mais so para digitar uma senha no balcao.

    Operador e diferente de usuario: nao entra no sistema, so assina.
    ========================================================== */
 {id:'operadores',n:'Operadores do Caixa'},
 {id:'status-vendas',n:'Status de Vendas'},
 {id:'mesas',n:'Mesas e QR Code'},
 {id:'totem',n:'Totem de Autoatendimento'},
 {id:'fiscal',n:'Configuração Fiscal'},
 {id:'turnos',n:'Turnos'},
 {id:'usuarios-permissoes',n:'Usuários e Permissões'}]},

{id:'tecnico',n:'Administração',ic:'gear2',it:[
 {id:'central-tecnica',n:'Mapa do Sistema'},
 {id:'instalacao',n:'Empresas Clientes'},
 {id:'financeiro-nexor',n:'Mensalidades das Unidades'},
 {id:'diagnostico-sistema',n:'Diagnóstico do Sistema'},
 {id:'sincronizacao',n:'Sincronização'},
 {id:'backup',n:'Backup e Restauração'},
 {id:'layout-menu',n:'Layout do Menu'},
 {id:'reset-sistema',n:'Dados de Teste e Reinício'}]}
];
/* telas exclusivas da franqueadora — franquia nao ve nem por permissao */
/* ----------------------------------------------------------
   DOIS PAPEIS DIFERENTES

   PLATAFORMA  — o dono da Joia. Cuida do produto: infraestrutura,
                 contas, servidores. NAO opera dados de cliente.
   FRANQUEADORA— o cliente que contratou. Manda na propria rede:
                 unidades, usuarios, dados, backup e importacao.
   ---------------------------------------------------------- */
var SO_PLATAFORMA=['tecnico/central-tecnica','tecnico/instalacao','tecnico/diagnostico-sistema',
  'tecnico/backup','tecnico/reset-sistema','tecnico/layout-menu'];
/* ==========================================================
   EMPRESAS CLIENTES VOLTOU A SER SO DO DONO (18/08, mesmo dia)
   A V76 abriu esta tela para a franqueadora cadastrar sucursais. Revisto:
   cadastrar unidade JA tem lugar proprio — Configuracao da Loja >
   Sucursais da Franquia. Duas telas fazendo a mesma coisa foi o que
   espalhou o cadastro e produziu um dia inteiro de dados desencontrados.
   Uma dona por assunto. O limite no banco (painel_empresas so devolve a
   propria loja para quem nao e plataforma) fica de pe: nao atrapalha e
   protege se a tela for reaberta um dia.
   ---- texto antigo, mantido para historia ----
   EMPRESAS CLIENTES SAIU DA LISTA DO DONO
   A franqueadora precisa cadastrar as proprias sucursais com todos os campos,
   e é esta a tela que faz isso. Ela passou para SO_FRANQUEADORA: continua
   fora do alcance de franqueado, e agora obedece a marcacao do contrato.
   O que impede a franqueadora de ver os OUTROS clientes da Joia nao é esta
   lista — é o banco: painel_empresas() so devolve a propria loja para quem
   nao é plataforma. Trava no servidor, nao no menu. ========================================================== */
/* ----------------------------------------------------------
   MODULOS CONTRATADOS
   A lista vem do banco (tabela clientes_nexor) e e regravada a
   cada sincronizacao. O cliente le, nunca escreve: no Supabase
   so quem tem perfil 'plataforma' consegue alterar o contrato.
   Modulo fora do contrato nao aparece para ninguem da rede,
   nem para a franqueadora.
   ---------------------------------------------------------- */
var MODULOS_BASE=['cardapio','pdv','clientes','estoque','financeira','relatorios',
                  'dashboard','loja','tecnico'];
function contratoDaRede(){
  var c=DB._contrato;
  if(!c||!c.modulos||!c.modulos.length)return null;   /* sem contrato: nada e bloqueado */
  return c;
}
function moduloContratado(mid){
  if(ehPlataforma())return true;            /* o dono do produto ve tudo */
  var c=contratoDaRede();
  if(!c)return true;
  if(MODULOS_BASE.indexOf(mid)<0)return true;
  return c.modulos.indexOf(mid)>=0;
}
/* O contrato travava o modulo inteiro: ou o cliente tinha Relatorios, ou nao
   tinha nenhum. Agora o dono da Joia pode fechar telas soltas — o cliente
   contrata Relatorios e o dono decide se Cancelamentos entra ou nao.
   Lista de bloqueio, e nao de liberacao: contrato antigo continua valendo. */
function recursoContratado(mid,iid){
  if(ehPlataforma())return true;
  var c=contratoDaRede();
  if(!c||!c.bloqueados||!c.bloqueados.length)return true;
  return c.bloqueados.indexOf(mid+'/'+iid)<0;
}
var SO_FRANQUEADORA=['loja/carga-inicial'];
var MOD_PLATAFORMA=[];   /* V67: nenhum modulo bloqueado inteiro — o filtro fino e o SO_PLATAFORMA */
var ADM_MESTRE='rafael@uendes.com';
/* quem e a plataforma nao depende de marcacao guardada: e o login, e so ele.
   Assim ninguem vira dono da Joia copiando um usuario ou editando um cadastro. */
function ehPlataforma(u){
  u=u||usuarioLogado();
  return !!(u&&String(u.login||'').toLowerCase()===ADM_MESTRE);
}
/* ==========================================================
   QUEM E A FRANQUEADORA
   Antes isto era a marca "acesso total". O efeito colateral: tirar o
   acesso total da franqueadora para escolher o que ela ve fazia ela
   DEIXAR DE SER MATRIZ — perdia a Liberacao por Unidade, a lista de
   acessos das unidades, as Bases e Valores. Uma coisa nao tem a ver
   com a outra: ser matriz e POSICAO na rede, ver tudo e PERMISSAO.
   Agora a posicao vem de onde o acesso esta na rede:
     - sem unidade nenhuma  = acesso da empresa inteira = franqueadora
     - unidade marcada como matriz = franqueadora
   O "tudo/mestre" continua valendo, para nao mudar quem ja funciona.
   ========================================================== */
function ehFranqueadora(u){
  u=u||usuarioLogado();
  if(!u)return false;
  if(u.mestre||u.plataforma||u.tudo)return true;
  var ss=u.sucursais||[];
  if(!ss.length)return true;                  /* empresa inteira */
  try{
    var base=(typeof baseSuc==='function'?baseSuc():(DB.sucursais||[]))||[];
    return ss.some(function(sid){
      var sc=base.find(function(x){return x.id===sid});
      return !!(sc&&sc.matriz);
    });
  }catch(e){ return false; }
}

/* ==========================================================
   SEMENTE — uma loja de mentira, montada como a de verdade

   Usada pela varredura (ferramentas/varrer.js) e pelos testes. Tem os
   tres casos de produto que existem no cardapio da Jolo: um ligado a
   insumo direto, um ligado a ficha com destino, e um que nao baixa
   estoque. Mais formas de pagamento, turno, operador com senha, area de
   entrega com zona, cliente e contas.
   ========================================================== */
baseMov(); baseFicha(); baseFormas(); baseUsr(); baseOper(); baseTurnos();
    DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true}];
    DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
    DB.insumos=[
      {id:'in_leite',nome:'Leite',unidade:'l',custo:5,controlaEstoque:true},
      {id:'in_casq',nome:'Casquinha',unidade:'un',custo:0.8,controlaEstoque:true},
      {id:'in_gv',nome:'Gelato Venda',unidade:'kg',custo:0,controlaEstoque:true,gelatoVenda:true},
      {id:'in_nut',nome:'Nutella',unidade:'kg',custo:60,controlaEstoque:true}];
    DB.fichas=[
      {id:'fi_base',nome:'BASE CHOCOLATE',unidade:'kg',rendimento:10,rendUnidade:'kg',
       unidadesVenda:100,destinoId:'in_gv',destinoModo:'igual',destinoFator:1,
       itens:[{insumoId:'in_leite',qtd:4,unidade:'l'}]},
      {id:'fi_nut',nome:'BORDA NUTELLA',unidade:'kg',rendimento:1,unidadesVenda:50,
       itens:[{insumoId:'in_nut',qtd:1,unidade:'kg'}]}];
    DB.categorias=[{id:'ct1',nome:'Gelatos',ordem:1,ativo:true}];
    var disp={pdv:true,delivery:true,cardapio:true};
    DB.produtos=[
      {id:'pr_casq',nome:'Casquinha',categoriaId:'ct1',preco:12,ativo:true,ordem:1,
       vinculaEstoque:true,insumoId:'in_casq',insumoQtd:1,insumoUn:'un',
       grupos:['go1'],disponivel:disp},
      {id:'pr_pote',nome:'Pote 100g',categoriaId:'ct1',preco:20,ativo:true,ordem:2,
       vinculaEstoque:true,fichaId:'fi_base',disponivel:disp},
      {id:'pr_agua',nome:'Água',categoriaId:'ct1',preco:5,ativo:true,ordem:3,
       vinculaEstoque:false,disponivel:disp}];
    /* a opção guarda só nome e preço quando vai para a comanda: a baixa de
       estoque acha a ficha PELO NOME. Por isso os dois têm de bater. */
    DB.grupos=[{id:'go1',nome:'Bordas',min:0,max:1,forcado:false,canais:[],sucursais:[],
      /* nome da opcao DIFERENTE do nome da ficha, como e na loja de verdade:
         "Borda de Doce de Leite" para a ficha "BORDA DOCE LEITE". O vinculo
         que vale e o fichaId. */
      opcoes:[{nome:'Borda de Nutella',preco:3,fichaId:'fi_nut'}]}];
    DB.formasPag=[{id:'fp_din',nome:'Dinheiro',tipo:'dinheiro',ativo:true,ordem:1},
      {id:'fp_deb',nome:'Débito',tipo:'cartao',ativo:true,ordem:2},
      {id:'fp_pix',nome:'Pix',tipo:'pix',ativo:true,ordem:3}];
    DB.turnos=[{id:'tn1',nome:'Tarde',ini:'12:00',fim:'23:00',ativo:true}];
    DB.usuarios=[{id:'us_cx',login:'ana',nome:'Ana',ativo:true,senha:'',perms:{}},
      {id:'us_ger',login:'bia',nome:'Bia',ativo:true,tudo:true,senha:'',perms:{}}];
    /* A senha de AUTORIZAÇÃO não mora no usuário — operAtivos() zera esse
       campo de propósito, porque o valor fica no cofre da nuvem. Quem carrega
       senha local é "Operadores do Caixa", e para nomes iguais ela preenche a
       lacuna do usuário. Sem isso ninguém aparece na lista de sangria,
       cancelamento ou fechamento, que EXIGEM senha. */
    DB.operadores=[{id:'op_bia',nome:'Bia',funcao:'gerente',senha:'1234',ativo:true}];
    DB.entregadores=[{id:'en1',nome:'Zé',ativo:true,taxas:[]}];
    DB.areas=[{id:'ar1',nome:'Jales',taxaPadrao:6,ativa:true,
      zonas:[{id:'zn1',nome:'Centro',taxa:6,ativa:true}]}];
    DB.clientes=[{id:'cl1',nome:'João',telefone:'17999990000',cidade:'Jales',
      zonaId:'zn1',zona:'Centro',endereco:'Rua A, 1'}];
    DB.contas=[{id:'ct_caixa',nome:'Caixa da loja',tipo:'Caixa',saldo:0},
      {id:'ct_cofre',nome:'Cofre',tipo:'Cofre',saldo:0}];
    DB.pedidos=[];DB.caixas=[];DB.movEst=[];DB.lancFin=[];DB.estoqueUn=[];DB.saldos={};
    ['in_leite:500','in_casq:200','in_gv:50','in_nut:5'].forEach(function(x){
      var p=x.split(':');
      ajustaEstoque(insumo(p[0]),Number(p[1]),insumo(p[0]).unidade,1,lojaAtualId());
    });
    salvar();

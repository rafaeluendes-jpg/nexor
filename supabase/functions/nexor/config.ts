export const CONFIG_JS = `
var ICO = {
  grid:'<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  money:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  box:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  store:'<path d="M3 9l1.5-5h15L21 9M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  net:'<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-2h14v2"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  search:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  caret:'<polyline points="9 18 15 12 9 6"/>',
  eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M17.9 18A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.4 18.4 0 0 1 5.1-6M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  power:'<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  back:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  tools:'<path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z"/>',
  check:'<polyline points="20 6 9 17 4 12"/>'
};

function svg(name, size){
  var s = size || 20;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (ICO[name] || '') + '</svg>';
}

var MODULOS = [
  { id:'home', nome:'Dashboard', ico:'grid', desc:'Visao geral do negocio e atalho para todos os modulos.', itens:[] },
  { id:'cardapio', nome:'Gestao de Cardapio', ico:'book', desc:'Monte e organize o cardapio da unidade.', itens:[ {id:'cardapio', nome:'Cardapio'} ] },
  { id:'pdv', nome:'PDV', ico:'cart', desc:'Frente de caixa, configuracoes e relatorios de venda.', itens:[ {id:'frente-caixa', nome:'Frente de Caixa'}, {id:'pdv-config', nome:'Configuracoes'}, {id:'pdv-relatorios', nome:'Relatorios'} ] },
  { id:'financeiro', nome:'Gestao Financeira', ico:'money', desc:'Fluxo de caixa, lancamentos, contas e fornecedores.', itens:[ {id:'acerto-entregadores', nome:'Acerto com Entregadores'}, {id:'categorias-financeiras', nome:'Categorias Financeiras'}, {id:'conciliacao-bancaria', nome:'Conciliacao Bancaria'}, {id:'lancamento-financeiro', nome:'Lancamento Financeiro'}, {id:'contas-bancarias', nome:'Contas Bancarias'}, {id:'fluxo-caixa', nome:'Fluxo de Caixa'}, {id:'formas-pagamento', nome:'Formas de Pagamento'}, {id:'fornecedores', nome:'Fornecedores'}, {id:'fin-frente-caixa', nome:'Frente de Caixa'}, {id:'metodos-pagamento', nome:'Metodos de Pagamento'} ] },
  { id:'clientes', nome:'Gestao de Clientes', ico:'users', desc:'Cadastro de clientes e cupons de desconto.', itens:[ {id:'cadastro-clientes', nome:'Cadastro de Clientes'}, {id:'cupom-desconto', nome:'Cupom de Desconto'} ] },
  { id:'relatorios', nome:'Gestao de Relatorios', ico:'file', desc:'Relatorios de vendas, produtos e resultado financeiro.', itens:[ {id:'vendas-geradas', nome:'Vendas Geradas', grupo:'Relatorios de vendas'}, {id:'faturamento-dia', nome:'Faturamento por Dia', grupo:'Relatorios de vendas'}, {id:'vendas-periodo', nome:'Vendas por Periodo', grupo:'Relatorios de vendas'}, {id:'vendas-area', nome:'Vendas por Area de Entrega', grupo:'Relatorios de vendas'}, {id:'vendas-pagamento', nome:'Vendas por Forma de Pagamento', grupo:'Relatorios de vendas'}, {id:'itens-consumidos', nome:'Itens Consumidos', grupo:'Relatorios de produtos'}, {id:'itens-vendidos', nome:'Itens Vendidos', grupo:'Relatorios de produtos'}, {id:'cmv', nome:'Relatorios de CMV', grupo:'Relatorios de produtos'}, {id:'dre', nome:'DRE', grupo:'Financeiros e gerenciais'}, {id:'gerencial', nome:'Gerencial e Financeiro', grupo:'Financeiros e gerenciais'}, {id:'cupons', nome:'Cupons', grupo:'Financeiros e gerenciais'} ] },
  { id:'estoque', nome:'Gestao de Estoque', ico:'box', desc:'Ficha tecnica, insumos, movimentacao e contagem.', itens:[ {id:'ficha-tecnica', nome:'Ficha Tecnica'}, {id:'grupo-ingredientes', nome:'Grupo de Ingredientes'}, {id:'historico-posicao', nome:'Historico de Posicao de Estoque'}, {id:'ingredientes-insumos', nome:'Ingredientes e Insumos'}, {id:'movimentacao', nome:'Movimentacao de Estoque'}, {id:'nota-entrada', nome:'Nota de Entrada'}, {id:'posicao-estoque', nome:'Posicao de Estoque'}, {id:'contagem-estoque', nome:'Contagem de Estoque'} ] },
  { id:'dashboards', nome:'Gestao de Dashboard', ico:'chart', desc:'Indicadores, faturamento e acompanhamento de venda.', itens:[ {id:'acompanhamento-venda', nome:'Acompanhamento de Venda'}, {id:'canais-venda', nome:'Canais de Venda'}, {id:'faturamento', nome:'Faturamento'}, {id:'venda-data-hora', nome:'Venda por Data e Hora'} ] },
  { id:'loja', nome:'Configuracao da Loja', ico:'store', desc:'Dados da loja, fiscais, turnos, usuarios e sucursais.', itens:[ {id:'area-entrega', nome:'Area de Entrega'}, {id:'canais-integracoes', nome:'Canais de Vendas e Integracoes'}, {id:'config-loja', nome:'Configuracao da Loja'}, {id:'dados-loja', nome:'Dados da Loja'}, {id:'dados-fiscais', nome:'Dados Fiscais'}, {id:'config-entregador', nome:'Configuracao do Entregador'}, {id:'modelo-impressao', nome:'Modelo de Impressao'}, {id:'motivos-cancelamento', nome:'Motivos de Cancelamento'}, {id:'status-venda', nome:'Status de Venda'}, {id:'turnos', nome:'Turnos'}, {id:'usuarios-permissoes', nome:'Usuarios e Permissoes'}, {id:'cadastro-sucursais', nome:'Cadastro de Sucursais'} ] },
  { id:'franquias', nome:'Gestao de Franquias e Sucursais', ico:'net', desc:'Rede completa: unidades, matriz, sucursais e status.', itens:[ {id:'unidades', nome:'Unidades da Rede'}, {id:'nova-unidade', nome:'Cadastrar Nova Unidade'} ] },
  { id:'usuarios', nome:'Usuarios e Permissoes', ico:'shield', desc:'Perfis de acesso e permissoes por modulo e unidade.', itens:[ {id:'perfis', nome:'Perfis de Acesso'}, {id:'lista-usuarios', nome:'Usuarios Cadastrados'} ] }
];

var TELAS_PRONTAS = ['unidades','nova-unidade','perfis','lista-usuarios'];

var UNIDADES = [
  {cod:'001', nome:'Matriz', cidade:'Jales', uf:'SP', resp:'Rafa', status:'ativa', tipo:'Matriz', acesso:'hoje, 08:12'},
  {cod:'002', nome:'Unidade Jales', cidade:'Jales', uf:'SP', resp:'Marcos Antunes', status:'ativa', tipo:'Sucursal', acesso:'hoje, 07:45'},
  {cod:'003', nome:'Unidade Santa Fe do Sul', cidade:'Santa Fe do Sul', uf:'SP', resp:'Juliana Ramos', status:'ativa', tipo:'Franquia', acesso:'ontem, 21:30'},
  {cod:'004', nome:'Unidade Fernandopolis', cidade:'Fernandopolis', uf:'SP', resp:'Carlos Prado', status:'ativa', tipo:'Franquia', acesso:'hoje, 09:02'},
  {cod:'005', nome:'Unidade Sorocaba', cidade:'Sorocaba', uf:'SP', resp:'Patricia Lemos', status:'pendente', tipo:'Franquia', acesso:'--'},
  {cod:'006', nome:'Unidade Petropolis', cidade:'Petropolis', uf:'RJ', resp:'Bruno Faria', status:'inativa', tipo:'Franquia', acesso:'12/07, 18:20'}
];

var PERFIS = [
  {nome:'Administrador Geral', desc:'Acesso total ao sistema e a todas as unidades', escopo:'Todas as unidades'},
  {nome:'Administrador da Matriz', desc:'Gerencia a rede, permissoes e modulos', escopo:'Todas as unidades'},
  {nome:'Gestor de Franquia', desc:'Gerencia uma ou mais franquias da rede', escopo:'Multiplas unidades'},
  {nome:'Gerente de Loja', desc:'Operacao completa da unidade que administra', escopo:'Uma unidade'},
  {nome:'Operador de Caixa', desc:'Frente de caixa e vendas do turno', escopo:'Uma unidade'},
  {nome:'Financeiro', desc:'Lancamentos, fluxo de caixa e conciliacao', escopo:'Uma unidade'},
  {nome:'Estoquista', desc:'Insumos, contagem e movimentacao de estoque', escopo:'Uma unidade'},
  {nome:'Entregador', desc:'Entregas atribuidas e acerto de valores', escopo:'Uma unidade'},
  {nome:'Colaborador', desc:'Acesso basico de consulta', escopo:'Uma unidade'}
];

var USUARIOS_DEMO = [
  {nome:'Rafa', email:'rafa@nexor.app', perfil:'Administrador Geral', unidade:'Matriz', status:'ativa'},
  {nome:'Marcos Antunes', email:'marcos@nexor.app', perfil:'Gerente de Loja', unidade:'Unidade Jales', status:'ativa'},
  {nome:'Juliana Ramos', email:'juliana@nexor.app', perfil:'Gestor de Franquia', unidade:'Unidade Santa Fe do Sul', status:'ativa'},
  {nome:'Carlos Prado', email:'carlos@nexor.app', perfil:'Financeiro', unidade:'Unidade Fernandopolis', status:'ativa'},
  {nome:'Patricia Lemos', email:'patricia@nexor.app', perfil:'Operador de Caixa', unidade:'Unidade Sorocaba', status:'pendente'},
  {nome:'Bruno Faria', email:'bruno@nexor.app', perfil:'Estoquista', unidade:'Unidade Petropolis', status:'inativa'}
];
`;

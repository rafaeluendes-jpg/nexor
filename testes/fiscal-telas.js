/* ==========================================================
   JOIA — O MÓDULO FISCAL (28/09/2026)

   Rodar:  node testes/fiscal-telas.js
   ou:     npm test   (entra na bateria e no portão)

   POR QUE ESTE ARQUIVO EXISTE
   Rafael, 28/09/2026:
     * "tem duas telas iguais" — Dados Fiscais da Empresa abria a mesma
       tela da Configuração Fiscal;
     * "eu preciso de uma tela para ver os cupons fiscais que foram
       emitidos: número do cupom, data e hora que foi vendido, se foi
       emitido, filtro por dia, por mês, personalizado, e na frente o
       status";
     * "a tela da nota fiscal: emitir nota, colocar produto, frete";
     * "todos esses inputs de cada produto: uma tela para ver, editar,
       salvar ou apagar".

   Este guardião prende:
     1. o módulo Fiscal com as quatro telas — e nenhuma porta duplicada;
     2. quem tinha a permissão antiga continua entrando;
     3. NF-e e impostos do produto são da matriz, não da loja;
     4. a taxa de entrega não vira item do cupom;
     5. cupons: status na frente, emitido ou não, atalhos de período;
     6. impostos: nada grava sem Salvar, "Tudo salvo" só com a nuvem
        confirmando, código errado não sai, sair com rascunho pergunta;
     7. NF-e: a soma bate com frete e desconto, CFOP vira 6xxx para
        outro estado, sai sempre pela matriz, e o servidor tranca.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const FUNC = path.join(__dirname, '..', 'supabase', 'functions', 'joia-fiscal', 'index.ts');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const espera = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  console.log('\nCarregando o sistema para o guardião do módulo fiscal…');
  const vc = new VirtualConsole();
  const erros = [];
  vc.on('jsdomError', e => erros.push(String(e && e.message)));
  const html = fs.readFileSync(ARQ, 'utf8');
  const fonte = fs.readFileSync(FUNC, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.open = () => null;
    }
  });
  await espera(900);
  const win = dom.window, doc = win.document;
  if (!doc.getElementById('content')) {
    const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d);
  }
  win.salvar = () => {};
  win.sincronizar = () => {};
  let ultimoToast = ''; win.toast = m => { ultimoToast = m; };
  let ultimoErro = ''; win.painelErro = (a, b) => { ultimoErro = a + ' ' + (b || ''); };
  let respostaConfirmar = true;
  win.confirmar = async () => respostaConfirmar;

  win.DB.sucursais = [
    { id: 'suc_matriz', nome: 'Matriz', ativa: true, matriz: true, cnpj: '42771278000102', uf: 'SP' },
    { id: 'suc_sf', nome: 'Jolo Santa Fe do Sul', ativa: true, cnpj: '50058498000111', cidade: 'Santa Fé do Sul', uf: 'SP' }
  ];
  win.DB.categorias = [{ id: 'c_gel', nome: 'Cascão' }, { id: 'c_taxa', nome: 'Taxa de Entrega' }];
  win.DB.produtos = [
    { id: 'p_gel', nome: 'Cascão 1 Bola', ativo: true, categoriaId: 'c_gel', preco: 19, ncm: '21050010', cest: '2300100', cfop: '5405', csosn: '500', cst: '60', _loja: 'L1' },
    { id: 'p_sem', nome: 'Brownie', ativo: true, categoriaId: 'c_gel', preco: 38, _loja: 'L1' },
    { id: 'p_taxa', nome: 'Taxa de Entrega', ativo: true, categoriaId: 'c_taxa', preco: 7, _loja: 'L1' }
  ];

  /* ---------- 1. o módulo ---------- */
  grupo('O módulo Fiscal, com uma porta para cada coisa');
  const MOD = win.MOD;
  const fiscal = MOD.find(m => m.id === 'fiscal');
  t('existe o módulo Fiscal no menu', !!fiscal);
  const ids = (fiscal && fiscal.it || []).map(i => i.id).join(',');
  t('com Cupons, Notas, Impostos dos Produtos e Configuração', ids === 'cupons,notas,impostos,configuracao', ids);
  const loja = MOD.find(m => m.id === 'loja'), rel = MOD.find(m => m.id === 'relatorios');
  t('"Dados Fiscais da Empresa" (a porta duplicada) saiu do menu',
    !loja.it.some(i => i.id === 'dados-fiscais'));
  t('a Configuração Fiscal não aparece mais em dois lugares', !loja.it.some(i => i.id === 'fiscal'));
  t('os cupons saíram de Relatórios (estão no Fiscal)', !rel.it.some(i => i.id === 'cupons-fiscais'));
  t('o módulo tem ícone próprio', /fiscal:/.test(html.match(/var ICM=\{[\s\S]*?\n\};/)[0]));

  /* ---------- 2. permissões antigas ---------- */
  grupo('Quem tinha a permissão antiga continua entrando');
  const gerente = { id: 'u_sf', nome: 'Santa Fé', login: 'santafe@x', ativo: true, sucursais: ['suc_sf'],
    permissoes: { 'loja/fiscal': true, 'relatorios/cupons-fiscais': true } };
  const operador = { id: 'u_cx', nome: 'Caixa', login: 'caixa@x', ativo: true, sucursais: ['suc_sf'], permissoes: { 'pdv/pdv': true } };
  const rede = { id: 'u_rede', nome: 'Rede', login: 'rede@x', ativo: true, tudo: true, sucursais: [], permissoes: {} };
  let logado = gerente;
  win.usuarioLogado = () => logado;
  win.DB.usuarios = [gerente, operador, rede];
  t('gerente com "Cupons Gerados" antigo vê Fiscal › Cupons', win.podeVer('fiscal', 'cupons'));
  t('gerente com a Configuração Fiscal antiga vê Fiscal › Configuração', win.podeVer('fiscal', 'configuracao'));
  t('NF-e é só da matriz: o gerente da loja não vê', !win.podeVer('fiscal', 'notas'));
  t('impostos do produto são da rede: o gerente da loja não vê', !win.podeVer('fiscal', 'impostos'));
  logado = operador;
  t('o operador sem permissão não vê nada do fiscal',
    !win.podeVer('fiscal', 'cupons') && !win.podeVer('fiscal', 'configuracao') && !win.podeVer('fiscal', 'notas'));
  logado = rede;
  t('a rede vê as quatro telas', ['cupons', 'notas', 'impostos', 'configuracao'].every(i => win.podeVer('fiscal', i)));
  t('desmarcar a tela nova tira também a marcação antiga',
    /delete u\.permissoes\[chave\];[\s\S]{0,160}PERM_EQUIV\[chave\]/.test(html));

  grupo('O endereço antigo leva à tela nova');
  win.lojaAtualId = () => 'suc_sf';
  logado = gerente;
  win.fiscalChamar = async (acao, d) => ({ ok: true, status: 200, d: { ok: true, podeGerir: true, conta: { host: 'sandbox' },
    unidade: { ref: d.sucursal, nome: 'Jolo Santa Fe do Sul', vinculada: true, modo: 'desligado', ambiente: 'homologacao' }, spedy: null } });
  win.DB.fiscalUn = {};
  await win._abrirTela('loja', 'fiscal');
  await espera(20);
  t('loja/fiscal abre a Configuração Fiscal', /Configuração Fiscal/.test(doc.getElementById('content').innerHTML));
  t('e o sistema passa a estar no módulo Fiscal', win.S.mod === 'fiscal' && win.S.it === 'configuracao', win.S.mod + '/' + win.S.it);
  await win._abrirTela('relatorios', 'cupons-fiscais');
  t('relatorios/cupons-fiscais abre os Cupons Fiscais', /<h1>Cupons Fiscais<\/h1>/.test(doc.getElementById('content').innerHTML));

  /* ---------- 4. taxa de entrega ---------- */
  grupo('A taxa de entrega não vira item do cupom');
  win.DB.fiscalUn = { suc_sf: { modo: 'sempre', ambiente: 'homologacao', vinculada: true, serie: 1, regime: 'simplesNacional' } };
  win.DB.formasPag = [{ id: 'fp_pix', nome: 'Pix', tipo: 'pix', ativa: true }];
  const venda = { id: 'ped_taxa1', numero: 9, sucursalId: 'suc_sf', total: 26, taxa: 0,
    itens: [{ produtoId: 'p_gel', nome: 'Cascão 1 Bola', qtd: 1, total: 19 },
            { produtoId: 'p_taxa', nome: 'Taxa de Entrega', qtd: 1, total: 7 }],
    pagamentos: [{ forma: 'fp_pix', valor: 26 }] };
  const mn = win.montarNfce(venda, { doc: '' }, 'suc_sf');
  t('monta sem erro', !mn.erro, mn.erro);
  const nn = mn.nota || { items: [] };
  t('só o sorvete é item', nn.items.length === 1 && nn.items[0].description === 'Cascão 1 Bola');
  t('a taxa vai como "outras despesas"', nn.total && nn.total.othersAmount === 7, JSON.stringify(nn.total));
  t('e a nota continua fechando no total da venda', nn.total.invoiceAmount === 26);
  const pend = win._fsPendencias({ vinculada: true, spedy: { ie: '1', certificado: {}, nfceToken: true } }).join(' | ');
  t('a taxa de entrega não conta como "produto sem NCM" (só o Brownie conta)', /^1 produto\(s\) ativos sem NCM/.test(pend) || / 1 produto\(s\) ativos sem NCM/.test(' ' + pend), pend);
  t('e a pendência diz onde corrigir', /Fiscal › Impostos dos Produtos/.test(pend));

  /* ---------- 5. cupons ---------- */
  grupo('Cupons fiscais: status na frente, emitido ou não, atalhos');
  win.DB.cupons_f = [
    { id: 'cf1', sucursalId: 'suc_sf', data: '2026-09-28', hora: '14:05', numero: 1, serie: 1, status: 'autorizado',
      emitidoEm: '2026-09-28T14:05:40', total: 19, chave: '3526', origem: 'salao', pedidoNumero: 9 },
    { id: 'cf2', sucursalId: 'suc_sf', data: '2026-09-28', hora: '15:00', status: 'pendente', total: 12, origem: 'salao' }
  ];
  win.hojeISO = () => '2026-09-28';
  win.CFI.de = '';
  win.telaCuponsFiscais();
  const tc = doc.getElementById('content').innerHTML;
  const cab = (tc.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/) || [])[1] || '';
  const ths = (cab.match(/<th[^>]*>([^<]*)<\/th>/g) || []).map(x => x.replace(/<[^>]+>/g, ''));
  t('a primeira coluna com nome é o Status', ths.filter(Boolean)[0] === 'Status', ths.join('|'));
  t('tem Cupom nº, Venda (data e hora) e Emitido', ['Cupom nº', 'Venda', 'Emitido'].every(x => ths.indexOf(x) >= 0), ths.join('|'));
  t('o cupom autorizado mostra a hora da emissão', /28\/09\/2026<small>14:05<\/small>/.test(tc));
  t('o pendente diz "Não emitido"', /Não emitido/.test(tc));
  t('abre no mês corrente', win.CFI.de === '2026-09-01' && win.CFI.ate === '2026-09-28');
  win.periodoCupons('hoje');
  t('atalho Hoje', win.CFI.de === '2026-09-28' && win.CFI.ate === '2026-09-28');
  win.periodoCupons('ontem');
  t('atalho Ontem', win.CFI.de === '2026-09-27' && win.CFI.ate === '2026-09-27');
  win.periodoCupons('mesAnt');
  t('atalho Mês anterior', win.CFI.de === '2026-08-01' && win.CFI.ate === '2026-08-31', win.CFI.de + '..' + win.CFI.ate);
  doc.getElementById('cfMes').value = '2026-02';
  win.periodoCupons('mesEsc');
  t('escolher um mês pega o mês inteiro (fevereiro termina no dia 28)', win.CFI.de === '2026-02-01' && win.CFI.ate === '2026-02-28');
  t('cupom cancelado depois de autorizado conta como emitido',
    win.cupomEmitido({ status: 'cancelado', chave: 'x' }) && !win.cupomEmitido({ status: 'rejeitado' }));

  /* ---------- 6. impostos dos produtos ---------- */
  grupo('Impostos dos Produtos: ver, corrigir, salvar');
  logado = rede;
  win.NUVEM.ligada = true; win.NUVEM.token = 'x'; win.NUVEM.loja = 'L1'; win.NUVEM.url = 'https://x';
  const patches = [];
  let nuvemAceita = true;
  win.api = async (caminho, metodo, corpo) => {
    patches.push({ caminho, metodo, corpo });
    return nuvemAceita ? [Object.assign({ id: 'uuid' }, corpo)] : null;
  };
  win.IMPF.rasc = {}; win.IMPF.estado = '';
  win.telaImpostosProdutos();
  let ti = doc.getElementById('content').innerHTML;
  t('a tela lista os produtos com os códigos', /Cascão 1 Bola/.test(ti) && /value="21050010"/.test(ti));
  t('o produto sem NCM aparece com pendência', /Falta: NCM/.test(ti));
  t('a taxa de entrega não pede código', /vai como taxa de entrega/.test(ti));
  t('abre com "Tudo salvo"', doc.getElementById('impEstado').textContent === 'Tudo salvo');
  win.impMudou('p_sem', 'ncm', '19059090');
  t('mudar um campo marca "não salvo" na hora', /não salvas/.test(doc.getElementById('impEstado').textContent));
  t('nada foi gravado no produto antes do Salvar', !win.DB.produtos[1].ncm);
  win.impPerfil('p_sem', 'pf_rev');
  t('o perfil preenche CFOP, CSOSN e CST', win.IMPF.rasc.p_sem.cfop === '5102' && win.IMPF.rasc.p_sem.csosn === '102');
  t('sair da tela com rascunho pergunta antes', /não salva/.test(win.GUARDA.fn() || ''));
  respostaConfirmar = false;
  win.S.mod = 'fiscal'; win.S.it = 'impostos';
  win.abrir('pdv', 'pedidos-online');
  await espera(10);
  t('e, respondendo "Voltar", continua na tela', win.S.it === 'impostos');
  respostaConfirmar = true;
  nuvemAceita = false;
  await win.impSalvar();
  t('nuvem que não confirma: continua "não salvo" e avisa', win.impSujos().length === 1 && /não confirmou/.test(ultimoErro));
  t('e o produto não muda neste aparelho', !win.DB.produtos[1].ncm);
  nuvemAceita = true; patches.length = 0;
  await win.impSalvar();
  t('salvar grava na nuvem só o produto que mudou', patches.length === 1 && /ref_local=eq\.p_sem/.test(patches[0].caminho), JSON.stringify(patches.map(p => p.caminho)));
  t('com NCM, CFOP e CSOSN no formato do banco',
    patches[0] && patches[0].corpo.ncm === '19059090' && patches[0].corpo.cfop === '5102' && patches[0].corpo.csosn === '102');
  t('"Tudo salvo" só depois da confirmação', doc.getElementById('impEstado').textContent === 'Tudo salvo' && !win.impSujos().length);
  t('e o produto do aparelho ficou com os códigos', win.DB.produtos[1].ncm === '19059090');
  win.impMudou('p_sem', 'ncm', '1905');
  patches.length = 0;
  await win.impSalvar();
  t('NCM com número errado não sai daqui', patches.length === 0 && /Confira/.test(ultimoErro));
  win.impDescartar();
  await win.impLimpar('p_gel');
  t('apagar os códigos vai para o rascunho (só vale no Salvar)',
    win.IMPF.rasc.p_gel && win.IMPF.rasc.p_gel.ncm === '' && win.DB.produtos[0].ncm === '21050010');
  win.impDescartar();
  t('descartar volta ao que estava', !win.impSujos().length);

  /* ---------- 7. NF-e ---------- */
  grupo('NF-e: a nota fecha, o CFOP acompanha o estado, sai pela matriz');
  win.DB.fiscalUn.suc_matriz = { vinculada: true, ambiente: 'homologacao', cnpj: '42771278000102',
    spedy: { nome: 'JOLO GELATO LTDA', cnpj: '42771278000102', uf: 'SP', ie: '111222333444', certificado: { validade: '2027-07-28' } },
    lidoEm: new Date().toISOString() };
  const f = win.nfFormNovo();
  f.dest = { doc: '50.058.498/0001-11', nome: 'ULIAN & SOUZA SORVETERIA LTDA', ie: '614111427118', isentoIe: false,
    email: '', fone: '', cep: '15775-000', rua: 'Rua Nove', numero: '100', compl: '', bairro: 'Centro',
    cidade: 'Santa Fé do Sul', uf: 'SP', ibge: '3546603' };
  f.itens = [
    { descricao: 'Gelato 5 L', ncm: '21050090', cest: '2300100', cfop: '5405', csosn: '500', origem: '0', un: 'UN', qtd: '3', valor: '100', desconto: '' },
    { descricao: 'Casquinha cx', ncm: '19053200', cest: '', cfop: '5102', csosn: '102', origem: '0', un: 'CX', qtd: '2', valor: '25,50', desconto: '1' }
  ];
  f.frete = Object.assign(f.frete, { modalidade: 'byIssuer', valor: '30', transpDoc: '11222333000181', transpNome: 'Transp X',
    volQtd: '4', volEsp: 'isopor', pesoL: '10', pesoB: '12', placa: 'abc1d23', placaUf: 'SP' });
  f.desconto = '10';
  f.pag = 'billetBanking';
  t('nota completa: nada falta', win.nfProblemas(f).length === 0, win.nfProblemas(f).join(' | '));
  const tt = win.nfTotais(f);
  t('total = produtos − desconto + frete (351 − 11 + 30 = 370)', tt.produtos === 351 && tt.desconto === 11 && tt.total === 370, JSON.stringify(tt));
  const nf = win.montarNfe(f);
  const somaFrete = nf.items.reduce((a, i) => a + (i.freightAmount || 0), 0);
  t('o frete dos itens soma o frete da nota', Math.abs(somaFrete - 30) < 0.005 && nf.total.freightAmount === 30);
  const somaDesc = nf.items.reduce((a, i) => a + (i.discountAmount || 0), 0);
  t('o desconto dos itens soma o desconto da nota', Math.abs(somaDesc - 11) < 0.005, somaDesc);
  t('destinatário com CNPJ e IE: não é consumidor final', nf.isFinalCustomer === false && nf.receiver.stateTaxNumber === '614111427118');
  t('mesmo estado: operação interna, CFOP 5xxx', nf.destination === 'internal' && nf.items[0].cfop === 5405);
  t('transportadora, volumes e placa vão na nota',
    nf.transport.freightModality === 'byIssuer' && nf.transport.carrier.name === 'Transp X' &&
    nf.transport.volume.quantity === 4 && nf.transport.vehicle.plate === 'ABC1D23');
  t('pagamento em boleto com o valor da nota', nf.payments[0].method === 'billetBanking' && nf.payments[0].amount === 370);
  t('a cidade vai pelo código do IBGE', nf.receiver.address.city.code === '3546603');
  f.dest.uf = 'MG';
  const nf2 = win.montarNfe(f);
  t('outro estado: interestadual e CFOP 6xxx sozinho', nf2.destination === 'interstate' && nf2.items[0].cfop === 6405 && nf2.items[1].cfop === 6102);
  f.dest.uf = 'SP';
  const vazio = win.nfFormNovo();
  const pv = win.nfProblemas(vazio).join(' | ');
  t('nota vazia diz em português o que falta', /CPF ou CNPJ/.test(pv) && /pelo menos um produto/.test(pv) && /CEP/.test(pv), pv);
  const semIeDest = JSON.parse(JSON.stringify(f)); semIeDest.dest.ie = '';
  t('empresa sem IE: pede a IE ou "Isento" (a SEFAZ recusa com a 232)', /inscrição estadual do destinatário/.test(win.nfProblemas(semIeDest).join('|')));
  semIeDest.dest.isentoIe = true;
  t('marcando Isento, não pede mais — e a nota vai com ISENTO',
    !/inscrição estadual do destinatário/.test(win.nfProblemas(semIeDest).join('|')) && win.montarNfe(semIeDest).receiver.stateTaxNumber === 'ISENTO');
  const dev = win.nfFormNovo(); dev.finalidade = 'devolution';
  t('devolução pede a chave da nota devolvida', /chave da nota/.test(win.nfProblemas(dev).join('|')));

  const pedidos = [];
  win.fiscalChamar = async (acao, d) => { pedidos.push({ acao, d });
    return { ok: true, status: 200, d: { ok: true, nota: { spedyId: 's1', status: 'autorizado', numero: 1 }, notas: [] } }; };
  win.lojaAtualId = () => 'suc_sf';           /* mesmo com outra loja no alto */
  win.NF.form = JSON.parse(JSON.stringify(f));
  win.NF.aba = 'nova';
  await win.nfEmitir();
  const em = pedidos.find(p => p.acao === 'nfe_emitir');
  t('a nota vai ao servidor pela matriz, nunca pela loja do alto', em && em.d.sucursal === 'suc_matriz', em && em.d.sucursal);
  t('depois de autorizada, o rascunho é zerado e volta para a lista', win.NF.aba === 'lista' && !win.NF.form.itens.length);
  win.NF.form = win.nfFormNovo(); win.NF.form.dest.cep = '';
  pedidos.length = 0;
  await win.nfEmitir();
  t('nota incompleta não sai', !pedidos.some(p => p.acao === 'nfe_emitir') && /Falta preencher/.test(ultimoErro));
  await win.telaNotasFiscais();
  t('a tela de NF-e mostra o emitente (a matriz)', /JOLO GELATO LTDA/.test(doc.getElementById('content').innerHTML));

  grupo('O servidor tranca a NF-e');
  t('NF-e só pela matriz', /acao\.startsWith\("nfe_"\)[\s\S]{0,120}!unidadeJoia\?\.matriz/.test(fonte));
  t('e só quem gere a matriz', /acao\.startsWith\("nfe_"\)[\s\S]{0,300}!podeGerir/.test(fonte));
  t('a nota sai com a chave da unidade (o CNPJ da matriz)', /acao\.startsWith\("nfe_"\)[\s\S]{0,500}chaveDaUnidade\(u\)/.test(fonte));
  t('o PUT das configurações leva os dois blocos (NFC-e e NF-e)', /\{ consumerInvoice: bloco, productInvoice: blocoNfe \}/.test(fonte));
  t('a numeração da NF-e também nunca volta', /nextNumber: Math\.max\(1, Number\(pi\.nextNumber\) \|\| 0\)/.test(fonte));
  t('nota com outro CNPJ é barrada', /acao === "nfe_emitir"[\s\S]{0,2500}cnpjNota !== digitos\(u\.cnpj\)/.test(fonte));

  grupo('A inscrição estadual da empresa é cadastrada pela tela');
  t('servidor: troca só a IE e devolve o cadastro como veio (a Spedy exige o PUT inteiro)',
    /acao === "empresa_ie"[\s\S]{0,1200}spedy\(dono, "GET", `\/companies\/\$\{u\.spedy_company_id\}`\)[\s\S]{0,1500}stateTaxNumber: ie/.test(fonte));
  t('servidor: só quem gere a unidade', /acao === "empresa_ie"\) \{\s*if \(!ref \|\| !podeGerir\)/.test(fonte));
  const semIe = win.nfFormNovo(); Object.assign(semIe, JSON.parse(JSON.stringify(f)));
  win.DB.fiscalUn.suc_matriz.spedy = { nome: 'JOLO GELATO LTDA', cnpj: '42771278000102', uf: 'SP', ie: null, certificado: { validade: '2027-07-28' } };
  t('nota da matriz sem IE: a tela diz o que falta antes de mandar', /inscrição estadual da matriz/.test(win.nfProblemas(semIe).join('|')));
  win.DB.fiscalUn.suc_matriz.spedy.ie = '123456789012';
  t('com a IE, não pede mais', !/inscrição estadual da matriz/.test(win.nfProblemas(semIe).join('|')));

  /* ---------- 8. o caixa pergunta ao servidor ---------- */
  /* 28/09/2026, 18:54: Santa Fé ligou "Emitir sempre" pela Configuração
     Fiscal e a venda 2473 saiu sem cupom — o aparelho do caixa nunca tinha
     aberto a tela fiscal e achava que a loja estava desligada. */
  grupo('O caixa pergunta ao servidor se a loja emite — não confia na lembrança');
  let servidor = { suc_sf: { modo: 'sempre', ambiente: 'homologacao', vinculada: true, serie: 1, regime: 'simplesNacional' } };
  const acoes = [];
  win.fiscalChamar = async (acao, d) => {
    acoes.push({ acao, d });
    if (acao === 'estado') return { ok: true, status: 200, d: { ok: true, unidade: Object.assign({ ref: d.sucursal }, servidor[d.sucursal] || { modo: 'desligado' }) } };
    return { ok: true, status: 200, d: { ok: true, nota: { spedyId: 'x1', status: 'autorizado', numero: 5 } } };
  };
  win.NUVEM.ligada = true; win.NUVEM.token = 't';
  win.DB.fiscalUn = {};                         /* o aparelho do caixa nunca abriu a tela fiscal */
  win.DB.cupons_f = [];
  const vCaixa = { id: 'ped_2473', numero: 2473, sucursalId: 'suc_sf', total: 19, taxa: 0,
    itens: [{ produtoId: 'p_gel', nome: 'Cascão 1 Bola', qtd: 1, total: 19 }], pagamentos: [{ forma: 'fp_pix', valor: 19 }] };
  win.DB.pedidos = [vCaixa];
  const cc = win.registrarCupom(vCaixa);
  await espera(60);
  t('o caixa pergunta ao servidor ("estado", leitura leve)', acoes.some(x => x.acao === 'estado' && x.d.leve === true));
  t('e, com a loja ligada lá, emite — mesmo sem nunca ter aberto a tela fiscal',
    acoes.some(x => x.acao === 'emitir') && cc.status === 'autorizado', cc.status);
  acoes.length = 0;
  servidor = { suc_sf: { modo: 'desligado', ambiente: 'homologacao', vinculada: true } };
  win.DB.fiscalUn = { suc_sf: { modo: 'sempre', vinculada: true, ambiente: 'homologacao' } };   /* lembrança velha */
  const v2 = Object.assign({}, vCaixa, { id: 'ped_2474', numero: 2474 });
  win.DB.pedidos.push(v2);
  const c2 = win.registrarCupom(v2);
  await espera(60);
  t('desligada no servidor: não emite, mesmo que o aparelho lembre "sempre"', !acoes.some(x => x.acao === 'emitir') && c2.status === 'sem_cupom', c2.status);
  servidor = { suc_sf: { modo: 'sempre', ambiente: 'homologacao', vinculada: true } };
  win.DB.fiscalUn = {};
  acoes.length = 0;
  await win.fiscalGarantir('suc_sf');
  win.lojaAtualId = () => 'suc_sf';
  await win.fiscalReprocessar();
  t('venda de antes da emissão ligada não vira cupom sozinha depois', !acoes.some(x => x.acao === 'emitir' && x.d.nota && x.d.nota.integrationId === 'ped_2474'));
  t('o PDV confere a configuração fiscal ao abrir', /fiscalGarantir\(lojaAtualId\(\)\)/.test(html));
  t('servidor: a leitura leve não pergunta nada à Spedy', /const chave = !corpo\.leve && \(await chaveDaUnidade\(u\)\)/.test(fonte));

  /* ---------- 9. o cupom fiscal impresso ---------- */
  /* 28/09/2026: "quando o cupom é fiscal, o formato de impressão muda, né?
     Mas está saindo do mesmo jeito" — saía só a ficha. */
  grupo('O cupom fiscal sai na bobina, no leiaute da SEFAZ');
  const xmlAmostra = fs.readFileSync(path.join(__dirname, 'amostra-nfce-autorizada.xml'), 'utf8');
  const iP = fonte.indexOf('const tag = (x: string, n: string)'), jP = fonte.indexOf('if (!saida.chave || !saida.qrCode)');
  let lido = null;
  try {
    const corpoP = fonte.slice(iP, jP).replace(/: string/g, '');
    lido = new Function('xml', corpoP + ';return saida;')(xmlAmostra);
  } catch (e) { lido = null; }
  t('servidor: lê o XML autorizado real (cupom 3 de Santa Fé)', !!lido && lido.numero === '3' && lido.serie === '1', lido && lido.numero);
  t('com o emitente sem "&amp;" no nome', lido && lido.emitente.nome === 'ULIAN & SOUZA SORVETERIA LTDA');
  t('itens, total e pagamento', lido && lido.itens.length === 2 && lido.totais.total === 29 && lido.pagamentos[0].tipo === '03');
  t('chave de 44 números, protocolo e QR Code', lido && lido.chave.length === 44 && lido.protocolo === '13526000017971533' && /^https:\/\/www\.homologacao\.nfce/.test(lido.qrCode));
  t('sabe que é homologação', lido && lido.homologacao === true);
  const linhasD = win.montarDanfeNfce(lido || {}, 48);
  const txtD = linhasD.map(x => x.txt || '').join(' ');
  const longas = linhasD.filter(x => x.tipo !== 'qr' && x.txt && x.txt.length > 48).map(x => x.txt);
  t('papel: avisa homologação — sem valor fiscal', /HOMOLOGAÇÃO - SEM VALOR FISCAL/.test(txtD));
  t('papel: emitente, CNPJ e IE', /ULIAN & SOUZA SORVETERIA LTDA/.test(txtD) && /50\.058\.498\/0001-11/.test(txtD) && /614111427118/.test(txtD));
  t('papel: título do DANFE NFC-e', /Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica/.test(txtD));
  t('papel: valor a pagar e a forma de pagamento por extenso', /Valor a pagar R\$ +29,00/.test(txtD) && /Cartão de Crédito +29,00/.test(txtD));
  t('papel: chave em grupos de 4, número, série e protocolo',
    /3526 0950 0584 9800 0111/.test(txtD) && /NFC-e nº 3 +Série 1/.test(txtD) && /Protocolo de autorização: 13526000017971533/.test(txtD));
  t('papel: consumidor não identificado', /CONSUMIDOR NÃO IDENTIFICADO/.test(txtD));
  t('papel: nenhuma linha passa da largura da bobina', !longas.length, longas.join(' | '));
  const qrL = linhasD.find(x => x.tipo === 'qr');
  t('papel: o QR Code é o do XML autorizado', !!qrL && qrL.txt === lido.qrCode);
  t('o papel desenha o QR Code', /<svg[\s\S]*<path/.test(win.papelHTML([qrL], 48)));
  const impressos = [];
  win.imprimirPapel = (linhas, cols, vias, mm) => { impressos.push({ linhas, cols, mm }); };
  win.fiscalChamar = async (acao, d) => acao === 'danfe' ? { ok: true, status: 200, d: { ok: true, danfe: lido } } : { ok: true, status: 200, d: { ok: true } };
  win.DB.cupons_f = [{ id: 'cfA', sucursalId: 'suc_sf', status: 'autorizado', spedyId: 's1', querEmitir: true,
    data: win.hojeISO(), hora: '00:00', numero: 3 }];
  await win.imprimirDanfe('cfA');
  t('imprimir busca o cupom no servidor e manda para a bobina', impressos.length === 1 && impressos[0].linhas.some(x => x.tipo === 'qr'));
  impressos.length = 0;
  /* 01/10/2026, venda 2584: o XML ainda não estava pronto no segundo da
     autorização — o caixa desistia na primeira e o cupom nunca saía */
  let tentativasDz = 0;
  const fcAntes = win.fiscalChamar;
  win.fiscalChamar = async (acao) => acao !== 'danfe' ? { ok: true, status: 200, d: { ok: true } }
    : (++tentativasDz === 1 ? { ok: false, status: 502, d: { erro: 'O cupom ainda não tem o XML autorizado.' } }
                            : { ok: true, status: 200, d: { ok: true, danfe: lido } });
  win.DB.cupons_f.push({ id: 'cfX', sucursalId: 'suc_sf', status: 'autorizado', spedyId: 's9', querEmitir: true,
    data: win.hojeISO(), hora: '00:00', numero: 4 });
  await win.imprimirDanfe('cfX');
  t('XML ainda não pronto: o caixa tenta de novo sozinho e o cupom sai', tentativasDz === 2 && impressos.length === 1,
    JSON.stringify({ tentativasDz, n: impressos.length }));
  impressos.length = 0;
  win.fiscalChamar = fcAntes;
  win.DB.cupons_f.push({ id: 'cfP', sucursalId: 'suc_sf', status: 'pendente', motivo: 'x' });
  await win.imprimirDanfe('cfP');
  t('cupom que não foi autorizado não imprime', impressos.length === 0);
  const agora = new Date();
  const hhmm = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  const hoje = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
  win.DB.fiscalUn = { suc_sf: { modo: 'sempre', imprime: 'sempre', vinculada: true } };
  const cNovo = { id: 'cfN', sucursalId: 'suc_sf', status: 'autorizado', spedyId: 's2', querEmitir: true, data: hoje, hora: hhmm };
  win.DB.cupons_f.push(cNovo);
  win.fsDepoisDeEmitir(cNovo);
  await espera(20);
  t('loja em "imprimir sempre": o cupom autorizado imprime sozinho', impressos.length === 1);
  impressos.length = 0;
  const cVelho = { id: 'cfV', sucursalId: 'suc_sf', status: 'autorizado', spedyId: 's3', querEmitir: true, data: '2026-01-01', hora: '10:00' };
  win.DB.cupons_f.push(cVelho);
  win.fsDepoisDeEmitir(cVelho);
  await espera(20);
  t('cupom de venda antiga não imprime sozinho no meio do movimento', impressos.length === 0);
  /* ---------- "perguntar" passou a perguntar de verdade (29/09/2026)
     Antes ele NAO imprimia e NAO perguntava: era um buraco calado, e o
     cupom fiscal de Santa Fe nunca saiu na bobina. O guardiao dizia so
     "nao imprime sozinho" — e continuava verde com o buraco. Agora
     prova os dois lados: disse sim, imprime; disse nao, nao imprime. */
  win.DB.fiscalUn.suc_sf.imprime = 'perguntar';
  respostaConfirmar = false;
  const cNao = { id: 'cfQn', sucursalId: 'suc_sf', status: 'autorizado', spedyId: 's4n', querEmitir: true, data: hoje, hora: hhmm };
  win.DB.cupons_f.push(cNao);
  await win.fsDepoisDeEmitir(cNao);
  await espera(20);
  t('loja em "perguntar": nada sai sem alguém mandar', impressos.length === 0);
  respostaConfirmar = true;
  const cPerg = { id: 'cfQ', sucursalId: 'suc_sf', status: 'autorizado', spedyId: 's4', querEmitir: true, data: hoje, hora: hhmm };
  win.DB.cupons_f.push(cPerg);
  await win.fsDepoisDeEmitir(cPerg);
  await espera(20);
  t('loja em "perguntar": disse sim, o cupom fiscal sai', impressos.length === 1);
  await win.fsDepoisDeEmitir(cPerg);
  await espera(20);
  t('e ele não volta a perguntar pelo mesmo cupom', impressos.length === 1);
  impressos.length = 0;
  win.fsChip(cPerg);
  t('e o aviso do caixa oferece "Imprimir cupom fiscal"', /Imprimir cupom fiscal/.test((doc.getElementById('fsChip') || {}).innerHTML || ''));
  t('servidor: o QR Code sai do XML, nunca é montado no navegador', /acao === "danfe"[\s\S]{0,3000}qrCode: tag\(xml, "qrCode"\)/.test(fonte) && !/csc/i.test(html.slice(html.indexOf('function montarDanfeNfce'), html.indexOf('var _fsImprimindo'))));

  grupo('Venda sem emissão não é "pendente de envio"');
  t('venda antiga, nunca mandada emitir, aparece como "Sem cupom fiscal"', win.statusDoCupom({ status: 'pendente' }) === 'sem_cupom');
  t('pendente de verdade (sem internet) continua pendente', win.statusDoCupom({ status: 'pendente', motivo: 'Sem internet' }) === 'pendente');
  t('autorizado continua autorizado', win.statusDoCupom({ status: 'autorizado' }) === 'autorizado');
  win.DB.cupons_f = [
    { id: 'l1', sucursalId: 'suc_sf', data: '2026-09-20', status: 'pendente', total: 10, origem: 'salao' },
    { id: 'l2', sucursalId: 'suc_sf', data: '2026-09-20', status: 'pendente', total: 10, origem: 'salao' },
    { id: 'l3', sucursalId: 'suc_sf', data: '2026-09-28', status: 'pendente', motivo: 'Sem internet', total: 10, origem: 'salao' },
    { id: 'l4', sucursalId: 'suc_sf', data: '2026-09-28', hora: '19:23', status: 'autorizado', numero: 3, total: 53, origem: 'salao' }
  ];
  win.lojaAtualId = () => 'suc_sf';
  win.CFI.de = '2026-09-01'; win.CFI.ate = '2026-09-28'; win.CFI.status = '';
  win.telaCuponsFiscais();
  const tc2 = doc.getElementById('content').innerHTML;
  t('"Pendentes de envio" conta só o que foi mandado emitir', /Pendentes de envio<\/span><b>1<\/b>/.test(tc2));
  t('cada cupom mostra um ícone da situação e abre ao clicar', /<button class="cfSt"[^>]*onclick="verCupom\('l4'\)"[^>]*><svg/.test(tc2));
  t('e o olhinho continua em cada linha', (tc2.match(/title="Ver"/g) || []).length === 4);

  /* 28/09/2026: a primeira versão desta tela chamava o próprio estado de
     IMP e redefinia ORIGENS_FISCAIS — nomes que já existiam em outras
     telas. O arquivo carregado por último vencia: a tela de impostos
     quebrava no Chromium e o cadastro do produto perdia a origem. */
  grupo('Nenhum nome das telas fiscais atropela outro que já existia');
  const srcDir = path.join(__dirname, '..', 'src', 'js');
  const todos = [];
  (function anda(d) { fs.readdirSync(d).forEach(x => { const f = path.join(d, x);
    if (fs.statSync(f).isDirectory()) anda(f); else if (/\.js$/.test(x)) todos.push(f); }); })(srcDir);
  const defs = {};
  todos.forEach(f => { const txt = fs.readFileSync(f, 'utf8');
    (txt.match(/^(?:var|function|async function) ([A-Za-z_$][\w$]*)/gm) || []).forEach(m => {
      const n = m.split(/\s+/).pop(); (defs[n] = defs[n] || []).push(path.basename(f)); }); });
  const meus = ['04-fiscal.js', '05-fiscal-telas.js'];
  const repetidos = Object.keys(defs).filter(n => defs[n].length > 1 && defs[n].some(f => meus.indexOf(f) >= 0));
  t('nenhum nome global repetido entre o fiscal e o resto do sistema', !repetidos.length, repetidos.map(n => n + ' em ' + defs[n].join('+')).join(' | '));
  t('a lista de origens do cadastro do produto continua no formato dele', win.ORIGENS_FISCAIS[0].id === '0' && !!win.ORIGENS_FISCAIS[0].n);

  const ruins = erros.filter(e => /ReferenceError|TypeError/.test(e));
  t('nenhum erro de script durante o teste', !ruins.length, ruins.slice(0, 3).join(' | '));

  console.log('\n──────────────────────────────');
  console.log(R.falhou ? `REPROVADO — ${R.falhou} de ${R.total}` : `TUDO CERTO — ${R.ok} de ${R.total}`);
  console.log('──────────────────────────────\n');
  process.exit(R.falhou ? 1 : 0);
})().catch(e => { console.error('ERRO NO GUARDIÃO:', e); process.exit(1); });

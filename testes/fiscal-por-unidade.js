/* ==========================================================
   JOIA — O CUPOM FISCAL DE CADA LOJA (28/09/2026)

   Rodar:  node testes/fiscal-por-unidade.js
   ou:     npm test   (entra na bateria e no portão)

   POR QUE ESTE ARQUIVO EXISTE
   Rafael, 28/09/2026: *"Cupom fiscal e nota fiscal. A nota fiscal vai ser
   só na matriz. E o cupom fiscal tem que ser configurável nas outras
   lojas."* E dois dias antes a Carla de Santa Fé se apresentou como a de
   Alphaville — configuração de uma loja gravada na outra. No fiscal a
   mesma mistura imprimiria o CNPJ errado num documento da Receita.

   Este guardião prende o que não pode voltar a acontecer:

     1. a venda vira cupom campo a campo, como a Spedy aceita (dinheiro é
        `money`, sorvete de ST sai com CSOSN 500 e CEST, a soma bate);
     2. cada unidade tem a SUA configuração — nada herda da vizinha;
     3. a venda nunca espera o fiscal: sem internet, recusa ou servidor
        fora, o cupom fica pendente e a venda continua gravada;
     4. uma venda é uma nota: o identificador é o da venda;
     5. a chave da API nunca está no navegador;
     6. cancelar exige motivo e passa pelo servidor;
     7. o produto traz os dados fiscais de volta da nuvem (subiam e não
        voltavam — o caixa da loja ficaria sem NCM).
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
  console.log('\nCarregando o sistema para o guardião do fiscal por unidade…');
  const vc = new VirtualConsole();
  const erros = [];
  vc.on('jsdomError', e => erros.push(String(e && e.message)));
  const html = fs.readFileSync(ARQ, 'utf8');
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
  win.painelErro = () => {};

  /* duas lojas da rede, com os nomes que o Rafael vê */
  win.DB.sucursais = [
    { id: 'suc_sf', nome: 'Jolo Santa Fe do Sul', ativa: true, cnpj: '50058498000111' },
    { id: 'suc_alpha', nome: 'Jolo Alphaville', ativa: true }
  ];
  win.lojaAtualId = () => 'suc_sf';
  win.DB.formasPag = [
    { id: 'fp_din', nome: 'Dinheiro', tipo: 'dinheiro', ativa: true },
    { id: 'fp_pix', nome: 'Pix', tipo: 'pix', ativa: true },
    { id: 'fp_cre', nome: 'Crédito', tipo: 'credito', ativa: true },
    { id: 'fp_deb', nome: 'Débito', tipo: 'debito', ativa: true }
  ];
  win.DB.produtos = [
    { id: 'p_gel', nome: 'Cascão 1 Bola', ativo: true, ncm: '21050010', cest: '1701100', cfop: '5405', csosn: '500', cst: '60' },
    { id: 'p_cafe', nome: 'Café', ativo: true, ncm: '21011110', cfop: '5102', csosn: '102', cst: '00' },
    { id: 'p_semncm', nome: 'Picolé novo', ativo: true, cfop: '5405', csosn: '500', cst: '60', cest: '1701200' },
    { id: 'p_semcest', nome: 'Sorbet sem CEST', ativo: true, ncm: '21050090', cfop: '5405', csosn: '500', cst: '60' }
  ];
  win.DB.config = win.DB.config || {};
  win.DB.config.fiscal = { ncm: '', cfop: '5102', csosn: '102', cst: '00', origem: '0' };

  /* ---------- 1. a venda vira cupom ---------- */
  grupo('A venda vira cupom, campo a campo');
  win.DB.fiscalUn = { suc_sf: { modo: 'sempre', ambiente: 'homologacao', vinculada: true, serie: 1,
    regime: 'simplesNacional', pisCst: '07', cofinsCst: '07' } };
  const venda = {
    id: 'ped_teste01', numero: 77, sucursalId: 'suc_sf', total: 30, taxa: 0, desconto: 0,
    itens: [
      { produtoId: 'p_gel', nome: 'Cascão 1 Bola', qtd: 2, unit: 12, total: 24 },
      { produtoId: 'p_cafe', nome: 'Café', qtd: 1, unit: 6, total: 6 },
      { produtoId: 'p_gel', nome: 'Cascão 1 Bola', qtd: 1, unit: 0, total: 0, brindeFidelidade: true }
    ],
    pagamentos: [{ forma: 'fp_din', valor: 20 }, { forma: 'fp_cre', valor: 10 }]
  };
  const m = win.montarNfce(venda, { doc: '' }, 'suc_sf');
  const n = m.nota || {};
  t('monta sem erro', !m.erro, m.erro);
  t('o identificador da nota é o da venda (uma venda, uma nota)', n.integrationId === 'ped_teste01');
  t('consumidor final, operação interna, saída',
    n.isFinalCustomer === true && n.destination === 'internal' && n.operationType === 'outgoing');
  t('o brinde de R$ 0,00 não entra no cupom', (n.items || []).length === 2, (n.items || []).length);
  const gel = (n.items || [])[0] || {};
  t('sorvete de ST sai com CSOSN 500 no Simples', gel.taxes && gel.taxes.icms.csosn === 500, JSON.stringify(gel.taxes));
  t('e com o CEST e o CFOP 5405', gel.cest === '1701100' && gel.cfop === 5405);
  t('PIS e COFINS com o CST da unidade (07 no Simples)',
    gel.taxes && gel.taxes.pis.cst === 7 && gel.taxes.cofins.cst === 7);
  t('dinheiro vai como "money" — não "cash", que a Spedy recusa',
    n.payments && n.payments[0].method === 'money', JSON.stringify(n.payments));
  t('cartão vai com o grupo do cartão', n.payments && n.payments[1].method === 'creditCard' && !!n.payments[1].card);
  const somaItens = (n.items || []).reduce((a, i) => a + i.totalAmount - (i.discountAmount || 0) + (i.othersAmount || 0), 0);
  t('a soma dos itens bate com o total da venda', Math.abs(somaItens - 30) < 0.005, somaItens);
  t('a soma dos pagamentos bate com o total', Math.abs(n.payments.reduce((a, p) => a + p.amount, 0) - 30) < 0.005);

  grupo('Desconto, entrega e CPF');
  const v2 = Object.assign({}, venda, { id: 'ped_teste02', total: 27.5, taxa: 5, desconto: 7.5,
    pagamentos: [{ forma: 'fp_pix', valor: 27.5 }] });
  const n2 = (win.montarNfce(v2, { doc: '52998224725', consumidor: 'Ana' }, 'suc_sf').nota) || {};
  const desc = (n2.items || []).reduce((a, i) => a + (i.discountAmount || 0), 0);
  const outros = (n2.items || []).reduce((a, i) => a + (i.othersAmount || 0), 0);
  t('o desconto é repartido pelos itens', Math.abs(desc - 7.5) < 0.005, desc);
  t('a taxa de entrega entra como outras despesas', Math.abs(outros - 5) < 0.005, outros);
  t('o total da nota é o que o cliente pagou', n2.total && n2.total.invoiceAmount === 27.5);
  t('CPF válido vai para a nota', n2.receiver && n2.receiver.federalTaxNumber === '52998224725');
  const n3 = (win.montarNfce(venda, { doc: '12345678900' }, 'suc_sf').nota) || {};
  t('CPF inválido não vai (a SEFAZ recusaria)', !n3.receiver);

  grupo('Produto incompleto para antes, com o nome do produto');
  const semNcm = win.montarNfce({ id: 'ped_x1', total: 5, itens: [{ produtoId: 'p_semncm', nome: 'Picolé novo', qtd: 1, total: 5 }],
    pagamentos: [{ forma: 'fp_pix', valor: 5 }] }, {}, 'suc_sf');
  t('sem NCM: não emite e diz qual produto', !!semNcm.erro && /Picolé novo/.test(semNcm.erro) && semNcm.faltaCadastro);
  const semCest = win.montarNfce({ id: 'ped_x2', total: 5, itens: [{ produtoId: 'p_semcest', nome: 'Sorbet sem CEST', qtd: 1, total: 5 }],
    pagamentos: [{ forma: 'fp_pix', valor: 5 }] }, {}, 'suc_sf');
  t('ST sem CEST: não emite e explica', !!semCest.erro && /CEST/.test(semCest.erro));
  const zero = win.montarNfce({ id: 'ped_x3', total: 0, itens: [{ produtoId: 'p_gel', qtd: 1, total: 0 }], pagamentos: [] }, {}, 'suc_sf');
  t('venda só de brinde não vira cupom', !!zero.semValor);

  /* ---------- 2. cada unidade com a sua ---------- */
  grupo('Cada unidade com a configuração dela');
  t('unidade sem configuração está desligada — não herda de Santa Fé',
    win.fiscalUn('suc_alpha').modo === 'desligado' && !win.fiscalEmite('suc_alpha'));
  t('Santa Fé ligada', win.fiscalEmite('suc_sf'));
  t('a configuração da rede não carrega chave nem CSC para a nuvem',
    !('token' in win.fiscalSemSegredo({ token: 'x', csc: 'y', ncm: '1' })) &&
    !('csc' in win.fiscalSemSegredo({ token: 'x', csc: 'y', ncm: '1' })) &&
    win.fiscalSemSegredo({ ncm: '1' }).ncm === '1');
  t('o envio da configuração passa pelo filtro de segredo',
    /cfg_fiscal:fiscalSemSegredo\(c\.fiscal\)/.test(html));

  /* ---------- 3. a venda nunca espera ---------- */
  grupo('A venda nunca espera o fiscal');
  const chamadas = [];
  let resposta = null;
  /* o servidor de verdade responde "estado" com a configuração da loja
     (a que está gravada lá) — o caixa pergunta antes de decidir emitir */
  let servidorUnidades = null;
  win.fiscalChamar = async (acao, dados) => {
    if (acao === 'estado') {
      const un = (servidorUnidades || win.DB.fiscalUn)[dados.sucursal] || { modo: 'desligado' };
      return { ok: true, status: 200, d: { ok: true, unidade: Object.assign({ ref: dados.sucursal }, un, { lidoEm: undefined }) } };
    }
    chamadas.push({ acao, dados }); return resposta(acao, dados);
  };
  win.NUVEM.ligada = true; win.NUVEM.token = 't'; win.NUVEM.url = 'https://x.supabase.co'; win.NUVEM.chave = 'k';
  win.DB.pedidos = [venda];
  win.DB.cupons_f = [];

  resposta = () => ({ ok: true, status: 200, d: { ok: true, nota: {
    spedyId: '94252fa3-3931-4940-a36e-c318ff356d25', status: 'autorizado', numero: 12, serie: '1',
    chave: '3526', protocolo: '1352', pdf: 'https://sandbox-api.spedy.com.br/v1/consumer-invoices/94252fa3-3931-4940-a36e-c318ff356d25/pdf',
    ambiente: 'development' } } });
  win.FISCAL_VENDA.cpf = '52998224725';
  const c1 = win.registrarCupom(venda);
  t('o cupom nasce com a unidade da venda', c1.sucursalId === 'suc_sf');
  t('o CPF digitado no pagamento vai para o cupom e é consumido',
    c1.doc === '52998224725' && win.FISCAL_VENDA.cpf === '');
  t('o registro volta na hora — a emissão ainda nem começou', chamadas.length === 0);
  await espera(50);
  t('no modo "sempre" o cupom sai sozinho, logo depois', chamadas.some(c => c.acao === 'emitir'));
  const envio = chamadas.find(c => c.acao === 'emitir') || { dados: {} };
  t('emite pela unidade da venda', envio.dados.sucursal === 'suc_sf');
  t('e com o identificador da venda', envio.dados.nota && envio.dados.nota.integrationId === 'ped_teste01');
  t('fica autorizado, com número e DANFE', c1.status === 'autorizado' && c1.numero === 12 && !!c1.pdf);

  chamadas.length = 0;
  win.DB.fiscalUn.suc_sf.modo = 'desligado';
  const c2 = win.registrarCupom(Object.assign({}, venda, { id: 'ped_teste03' }));
  await espera(30);
  t('desligado: registra, mas não emite', c2.status === 'pendente' && !chamadas.length);
  win.DB.fiscalUn.suc_sf.modo = 'sempre';

  resposta = () => ({ ok: false, status: 0, d: { erro: 'Sem conexão com o servidor fiscal.' } });
  win.DB.pedidos.push(Object.assign({}, venda, { id: 'ped_teste04' }));
  const c3 = win.registrarCupom(win.DB.pedidos[win.DB.pedidos.length - 1]);
  await espera(50);
  t('servidor fora: o cupom fica pendente, não some', c3.status === 'pendente' && !!c3.motivo);
  t('e a venda continua gravada', win.DB.pedidos.some(p => p.id === 'ped_teste04'));

  resposta = () => ({ ok: false, status: 400, d: { erro: 'Rejeição 778: NCM inexistente', status: 'rejeitado' } });
  win.DB.pedidos.push(Object.assign({}, venda, { id: 'ped_teste05' }));
  const c4 = win.registrarCupom(win.DB.pedidos[win.DB.pedidos.length - 1]);
  await espera(50);
  t('recusa da Receita: rejeitado, com o motivo em português', c4.status === 'rejeitado' && /NCM/.test(c4.motivo));

  win.NUVEM.ligada = false;
  win.DB.pedidos.push(Object.assign({}, venda, { id: 'ped_teste06' }));
  const c5 = win.registrarCupom(win.DB.pedidos[win.DB.pedidos.length - 1]);
  await espera(30);
  t('sem internet: pendente, e diz que sai quando a conexão voltar',
    c5.status === 'pendente' && /conex/i.test(c5.motivo || ''));
  win.NUVEM.ligada = true;

  grupo('Uma venda, uma nota');
  chamadas.length = 0;
  let solta;
  resposta = () => new Promise(ok => { solta = () => ok({ ok: true, status: 200, d: { nota: { status: 'autorizado', numero: 13 } } }); });
  win.DB.pedidos.push(Object.assign({}, venda, { id: 'ped_teste07' }));
  win.DB.fiscalUn.suc_sf.modo = 'opcional';
  const c6 = win.registrarCupom(win.DB.pedidos[win.DB.pedidos.length - 1]);
  win.DB.fiscalUn.suc_sf.modo = 'sempre';
  const e1 = win.emitirCupom(c6.id), e2 = win.emitirCupom(c6.id);
  await espera(10);
  t('clique duplo não manda duas vezes', chamadas.filter(c => c.acao === 'emitir').length === 1,
    chamadas.filter(c => c.acao === 'emitir').length);
  solta(); await e1; await e2;
  t('cupom autorizado não é emitido de novo',
    (await win.emitirCupom(c6.id)) && chamadas.filter(c => c.acao === 'emitir').length === 1);

  /* ---------- 4. o que cada loja vê ---------- */
  grupo('Cada loja vê os cupons dela');
  win.DB.cupons_f.push({ id: 'cf_alpha', sucursalId: 'suc_alpha', status: 'autorizado', data: new Date().toISOString().slice(0, 10), total: 9 });
  win.CFI.de = '2000-01-01'; win.CFI.ate = '2999-12-31';
  const vistos = win.filtrarCupons().map(c => c.id);
  t('Santa Fé não vê o cupom de Alphaville', vistos.indexOf('cf_alpha') < 0);
  t('e vê os dela', vistos.indexOf(c1.id) >= 0);

  /* ---------- 4b. a tela fiscal segue a loja do alto ---------- */
  grupo('A tela fiscal mostra a loja escolhida no alto — nunca a da visita anterior');
  /* Rafael, 28/09/2026: trocou a loja no alto para Santa Fé e a tela
     mostrou a empresa e o CNPJ da Matriz */
  const pedidosEstado = [];
  win.fiscalChamar = async (acao, dados) => {
    pedidosEstado.push(dados && dados.sucursal);
    const ref = dados && dados.sucursal;
    return { ok: true, status: 200, d: { ok: true, podeGerir: true, conta: { host: 'sandbox' },
      unidade: { ref, nome: ref, vinculada: true, modo: 'desligado', ambiente: 'homologacao',
        cnpj: ref === 'suc_matriz' ? '42771278000102' : '50058498000111' },
      spedy: { nome: ref === 'suc_matriz' ? 'JOLO GELATO LTDA' : 'ULIAN & SOUZA SORVETERIA LTDA',
        cnpj: ref === 'suc_matriz' ? '42771278000102' : '50058498000111', ie: '1', certificado: null } } };
  };
  win.DB.sucursais.push({ id: 'suc_matriz', nome: 'Matriz', ativa: true, matriz: true });
  let aberta = 'suc_matriz';
  win.lojaAtualId = () => aberta;
  win.DB.fiscalUn = {};
  await win.telaFiscalCfg();
  const tela1 = doc.getElementById('content').innerHTML;
  aberta = 'suc_sf';                       /* troca a loja no alto */
  await win.telaFiscalCfg();
  const tela2 = doc.getElementById('content').innerHTML;
  t('abrindo na Matriz, mostra a empresa da Matriz', /JOLO GELATO LTDA/.test(tela1));
  t('trocando a loja no alto para Santa Fé, mostra a empresa de Santa Fé',
    /ULIAN &amp; SOUZA/.test(tela2) && !/JOLO GELATO LTDA/.test(tela2));
  t('e pede ao servidor os dados de Santa Fé, não os da Matriz', pedidosEstado[pedidosEstado.length - 1] === 'suc_sf');
  t('a tela diz qual unidade está sendo configurada', /id="fsUnidadeNome">Jolo Santa Fe do Sul</.test(tela2));
  t('não existe mais um segundo seletor de loja dentro da tela', !doc.getElementById('fsSuc'));
  /* pelo caminho REAL do menu, como o login de Santa Fé entra (28/09/2026:
     o gerente da loja via "Área restrita — só o administrador da plataforma") */
  grupo('O gerente de Santa Fé abre a Configuração Fiscal pelo menu');
  aberta = 'suc_sf';
  const gerenteSF = { id: 'u_sf', nome: 'Jolo Santa Fe do Sul', login: 'santafe@jologelato.com.br', ativo: true,
    sucursais: ['suc_sf'], permissoes: { 'loja/fiscal': true, 'relatorios/cupons-fiscais': true } };
  const operadorSF = { id: 'u_cx', nome: 'Operador Caixa', login: 'caixa@jologelato.com.br', ativo: true,
    sucursais: ['suc_sf'], permissoes: { 'pdv/pdv': true } };
  let logado = gerenteSF;
  win.usuarioLogado = () => logado;
  win.DB.usuarios = [gerenteSF, operadorSF];
  win.DB.fiscalUn = {};
  await win._abrirTela('loja', 'fiscal');
  await espera(20);
  let telaG = doc.getElementById('content').innerHTML;
  t('abre a tela fiscal de verdade, sem "Área restrita"',
    /Configuração Fiscal/.test(telaG) && !/Área restrita|administração da Joia/.test(telaG), telaG.slice(0, 160));
  t('mostra a unidade dele', /id="fsUnidadeNome">Jolo Santa Fe do Sul</.test(telaG));
  logado = operadorSF;
  await win._abrirTela('loja', 'fiscal');
  await espera(20);
  const telaO = doc.getElementById('content').innerHTML;
  t('o operador sem a permissão não entra', /Sem acesso a esta tela/.test(telaO));
  logado = gerenteSF;

  /* Rafael, 28/09/2026: colou o CSC, clicou em guardar e a tela continuou
     em branco — parecia que nada tinha sido salvo. O que está guardado
     aparece marcado; o código em si nunca volta do cofre. */
  grupo('O que já está guardado aparece marcado na tela');
  win.fiscalChamar = async (acao, dados) => ({ ok: true, status: 200, d: { ok: true, podeGerir: true,
    conta: { host: 'sandbox' },
    unidade: { ref: dados.sucursal, nome: 'Jolo Santa Fe do Sul', vinculada: true, modo: 'desligado',
      ambiente: 'homologacao', cnpj: '50058498000111', cscHomologacao: true, cscProducao: false,
      cscIdHomologacao: '000001', cscIdProducao: null },
    spedy: { nome: 'ULIAN & SOUZA SORVETERIA LTDA', cnpj: '50058498000111', ie: '614111427118',
      certificado: { validade: '2027-03-30T00:00:00' }, nfceToken: true } } });
  win.DB.fiscalUn = {};
  await win.telaFiscalCfg(true);
  const boxCsc = doc.getElementById('fsCscSalvo');
  t('CSC de homologação aparece como guardado, com o ID',
    boxCsc && /CSC de homologação guardado/.test(boxCsc.textContent) && /000001/.test(boxCsc.textContent));
  t('o campo do ID vem preenchido', doc.getElementById('fsCscId').value === '000001');
  t('o campo do código mostra que está guardado, sem mostrar o código',
    /guardado/.test(doc.getElementById('fsCscCod').placeholder) && doc.getElementById('fsCscCod').value === '');
  t('o botão vira "Trocar CSC"', /Trocar CSC/.test(doc.getElementById('fsCscBtn').textContent));
  t('certificado aparece como guardado, com a validade',
    !!doc.getElementById('fsCertSalvo') && /30\/03\/2027/.test(doc.getElementById('fsCertSalvo').textContent));
  t('a senha do certificado mostra que está guardada',
    /guardada/.test(doc.getElementById('fsCertSenha').placeholder) && doc.getElementById('fsCertSenha').value === '');
  doc.getElementById('fsCscAmb').value = 'producao';
  win.fsCscMarcar();
  t('trocando para produção (sem CSC ainda), nada aparece como guardado',
    doc.getElementById('fsCscSalvo').textContent === '' && doc.getElementById('fsCscId').value === '' &&
    !/guardado/.test(doc.getElementById('fsCscCod').placeholder));
  win.lojaAtualId = () => 'suc_sf';
  win.fiscalChamar = async (acao, dados) => { chamadas.push({ acao, dados }); return resposta(acao, dados); };

  /* ---------- 5. PDV ---------- */
  grupo('A tela de pagamento');
  win.PDV = win.PDV || {}; win.PDV.cliente = null;
  win.DB.fiscalUn.suc_sf.modo = 'desligado';
  t('loja desligada: nenhum bloco fiscal na tela', win.blocoFiscalPagamento() === '');
  win.DB.fiscalUn.suc_sf.modo = 'sempre';
  const bloco = win.blocoFiscalPagamento();
  t('modo "sempre": avisa que o cupom sai automático e pede o CPF', /automático/.test(bloco) && /pgCpf/.test(bloco));
  doc.body.insertAdjacentHTML('beforeend', '<input id="pgCpf" value="111.111.111-11">');
  t('CPF inválido barra antes de a venda nascer', !!win.fiscalEscolhido().erro);
  doc.getElementById('pgCpf').value = '529.982.247-25';
  const esc = win.fiscalEscolhido();
  t('CPF válido passa limpo', !esc.erro && esc.cpf === '52998224725' && esc.emitir === true);

  /* ---------- 6. cancelar ---------- */
  grupo('Cancelar exige motivo e passa pelo servidor');
  win.confirmar = async () => true;
  chamadas.length = 0;
  resposta = () => ({ ok: true, status: 200, d: { ok: true, nota: { status: 'cancelado' } } });
  win.prompt = () => 'curto';
  c1.status = 'autorizado'; c1.spedyId = 'abc';
  await win.cancelarCupom(c1.id);
  t('motivo curto não vai para a SEFAZ', !chamadas.length && /15/.test(ultimoToast));
  win.prompt = () => 'Cliente desistiu da compra no balcão';
  await win.cancelarCupom(c1.id);
  const canc = chamadas.find(c => c.acao === 'cancelar');
  t('com motivo, pede o cancelamento pela unidade certa', canc && canc.dados.sucursal === 'suc_sf' && canc.dados.id === 'abc');
  t('e o cupom fica cancelado', c1.status === 'cancelado');

  /* ---------- 7. a chave e o servidor ---------- */
  grupo('A chave nunca está no navegador');
  t('o sistema não fala com a Spedy direto (nenhum endereço dela no navegador)', !/spedy\.com\.br/i.test(html));
  t('não existe X-Api-Key no sistema publicado', !/X-Api-Key/i.test(html));
  t('a tela antiga que guardava o token no aparelho saiu', !/id="fsTok"/.test(html));
  const fonte = fs.readFileSync(FUNC, 'utf8');
  t('servidor: só liga a unidade quando o CNPJ bate', /cnpjUni && cnpjUni !== cnpjEmp/.test(fonte));
  t('servidor: produção só com o CNPJ digitado de volta', /digitos\(c\.confirmaCnpj\) !== cnpj/.test(fonte));
  t('servidor: cancelar é do gerente ou da matriz', /acao === "cancelar"[\s\S]{0,80}!podeGerir/.test(fonte));
  t('servidor: o caixa de uma loja não alcança outra', /perfil\.sucursal_ref !== ref/.test(fonte));
  t('servidor: NFC-e sempre consumidor final e operação interna',
    /n\.isFinalCustomer = true;[\s\S]{0,80}n\.destination = "internal"/.test(fonte));
  t('servidor: cancelamento com "reason", como a Spedy pede', /\{ reason: motivo \}/.test(fonte));
  /* conferido no sandbox em 28/09/2026: a chave de uma loja só emite —
     configurar a empresa (CSC, série, certificado) é com a chave da conta */
  t('servidor: configurar a empresa usa a chave da conta',
    /async function aplicarNaSpedy[\s\S]{0,80}const chave = await chaveDaConta\(\)/.test(fonte));
  /* 28/09/2026: o PUT sem o próximo número deixou a Spedy com null e o
     primeiro cupom de Santa Fé saiu com número 0 — recusado */
  t('servidor: a configuração lê e devolve o próximo número, nunca para trás',
    /GET", `\/companies\/\$\{u\.spedy_company_id\}\/settings`\);[\s\S]{0,200}Math\.max\(1, Number\(atual\.d\?\.consumerInvoice\?\.nextNumber\)[\s\S]{0,200}nextNumber: proximo/.test(fonte));
  t('servidor: o ID do CSC vai para a tela, o código não',
    /cscIdHomologacao: u\?\.csc_id_homologacao/.test(fonte) && !/csc: await segredo|cscCodigo/.test(fonte.split('acao === "estado"')[1].split('acao === "empresas"')[0]));
  t('servidor: o certificado sobe com a chave da conta',
    /acao === "certificado"[\s\S]{0,300}await chaveDaConta\(\)/.test(fonte));
  t('servidor: a nota sai com a chave da unidade',
    /acao === "emitir"[\s\S]{0,400}const chave = await chaveDaUnidade\(u\)/.test(fonte));
  t('servidor: nota com CNPJ diferente do da loja desliga a emissão na hora',
    /cnpjNota !== digitos\(u\.cnpj\)[\s\S]{0,200}modo: "desligado"/.test(fonte));

  grupo('O produto traz os dados fiscais de volta da nuvem');
  t('NCM, CFOP, CSOSN, CST e CEST voltam no download',
    /ncm:x\.ncm\|\|'',cfop:x\.cfop\|\|'',csosn:x\.csosn\|\|'',cst:x\.cst\|\|'',cest:x\.cest\|\|''/.test(html));
  t('origem, GTIN e unidade tributável também',
    /origemFiscal:x\.origem_fiscal\|\|'',gtin:x\.gtin\|\|'',unTrib:x\.unidade_tributavel\|\|''/.test(html));

  const ruins = erros.filter(e => /ReferenceError|TypeError/.test(e));
  t('nenhum erro de script durante o teste', !ruins.length, ruins.slice(0, 3).join(' | '));

  console.log('\n──────────────────────────────');
  console.log(R.falhou ? `REPROVADO — ${R.falhou} de ${R.total}` : `TUDO CERTO — ${R.ok} de ${R.total}`);
  console.log('──────────────────────────────\n');
  process.exit(R.falhou ? 1 : 0);
})().catch(e => { console.error('ERRO NO GUARDIÃO:', e); process.exit(1); });

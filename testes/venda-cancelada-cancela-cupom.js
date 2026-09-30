/* ==========================================================
   JOIA — CANCELAR A VENDA CANCELA O CUPOM FISCAL NA RECEITA
   (V397, 30/09/2026)

   Rodar:  node testes/venda-cancelada-cancela-cupom.js
   ou:     npm run test:canccupom   (entra na bateria e no portão)

   Santa Fé: a venda 2545 foi cancelada no caixa e o cupom 41 continuou
   autorizado — imposto sobre venda que não existe. Rafael: "quando for
   cancelar essa venda, precisa já aparecer na frente de caixa a opção de
   cancelar o cupom fiscal".

   Prende: a tela de cancelar mostra o cupom valendo, já marcado; o
   servidor deixa o caixa cancelar o cupom da venda cancelada (conferida
   no banco); sem o identificador da Spedy o pedido vai pela venda; se a
   venda cancelada ainda não chegou à nuvem, sobe e tenta de novo; cupom
   a caminho que a Receita autorizar depois é cancelado; recusado não é
   reenviado para venda cancelada.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const EDGE = path.join(__dirname, '..', 'supabase', 'functions', 'joia-fiscal', 'index.ts');
const R = { total: 0, ok: 0 };
function t(n, c, d) { R.total++; if (c) { R.ok++; console.log('   ok   ' + n); } else console.log('   FALHA ' + n + (d !== undefined ? '  → ' + d : '')); }

(async function () {
  console.log('\n── 1. O servidor deixa o caixa cancelar o cupom da venda cancelada');
  const ts = fs.readFileSync(EDGE, 'utf8');
  const bloco = (ts.split('if (acao === "cancelar")')[1] || '').split('if (acao ===')[0];
  t('a ação existe', !!bloco);
  t('acha a nota pela venda quando falta o identificador', /if \(!id && corpo\.integrationId\)/.test(bloco));
  t('fora gerente e matriz, exige a venda cancelada no banco', /if \(!podeGerir\)/.test(bloco) &&
    /pv\.fase === "cancelado"/.test(bloco) && /eq\("ref_local", integ\)/.test(bloco));
  t('e da mesma unidade', /pv\.sucursal_id === ref/.test(bloco));
  t('a venda vem da própria nota na Spedy, não do navegador', /g0\.d\?\.integrationId/.test(bloco) && !/corpo\.pedido/.test(bloco));
  t('recusa com código próprio (o caixa sabe tentar de novo)', /codigo: "venda_nao_cancelada"/.test(bloco));

  const vc = new VirtualConsole(); const erros = [];
  vc.on('jsdomError', e => erros.push(e && e.message));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('offline')); w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      w.scrollTo = () => {}; w.print = () => {}; w.alert = () => {}; w.confirm = () => true; w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) }; } });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window;
  w.NUVEM.ligada = true; w.NUVEM.token = 'tk'; w.salvar = () => {}; w.fsChip = () => {};
  let sincs = 0; w.sincronizar = async () => { sincs++; };
  w.fiscalEmite = () => true;
  w.setTimeout = (f) => { f(); return 0; };

  console.log('\n── 2. A tela de cancelar mostra o cupom, já marcado');
  const ped = { id: 'pd_41', numero: 2545, sucursalId: 'suc_sf', data: w.hojeISO(), hora: '17:16', total: 20, itens: [], pagamentos: [] };
  w.DB.pedidos = [ped];
  const cup = { id: 'cf_41', pedidoId: 'pd_41', sucursalId: 'suc_sf', status: 'autorizado', numero: 41, serie: 2, spedyId: '', data: w.hojeISO() };
  w.baseCuponsFiscais().push(cup);
  const html = w.cartaoCancelamento(ped);
  t('aparece "Cancelar também o cupom fiscal nº 41"', /Cancelar também o cupom fiscal nº 41/.test(html), html.slice(-600));
  t('a caixa vem marcada', /id="cvCupom" checked/.test(html));
  t('venda sem cupom valendo não mostra a opção', !/cvCupom/.test(w.cartaoCancelamento({ id: 'pd_x', numero: 1, itens: [] })));
  t('confirmarCancelamento leva a escolha ao cancelamento do cupom',
    /manterCupom:!!cupomV&&!cancelaCupom/.test(String(w.confirmarCancelamento)));

  console.log('\n── 3. Sem o identificador da Spedy, cancela pela venda — e espera a venda chegar na nuvem');
  const chamadas = []; let recusas = 1;
  w.fiscalChamar = async (acao, d) => {
    chamadas.push(acao + ':' + (d.id || d.integrationId || ''));
    if (acao === 'cancelar') {
      if (recusas-- > 0) return { ok: false, status: 403, d: { erro: 'Cancelar cupom é com o gerente ou a matriz.', codigo: 'venda_nao_cancelada' } };
      return { ok: true, d: { ok: true, nota: { spedyId: 'sp41', status: 'cancelado', numero: 41, serie: 2 } } };
    }
    return { ok: true, d: {} };
  };
  ped.fase = 'cancelado';
  const r = await w.cancelarCupomDaVenda(ped, 'Cliente desistiu');
  t('pediu pela venda (integrationId) e tentou de novo depois de subir', JSON.stringify(chamadas) === JSON.stringify(['cancelar:pd_41', 'cancelar:pd_41']) && sincs >= 1, JSON.stringify(chamadas) + ' sincs=' + sincs);
  t('o cupom fica cancelado e sem pendência', r.feito && cup.status === 'cancelado' && !cup.precisaCancelar, JSON.stringify(r) + ' ' + cup.status);

  console.log('\n── 4. Quem desmarca mantém o cupom — e a pendência fica escrita');
  const cup2 = { id: 'cf_42', pedidoId: 'pd_42', sucursalId: 'suc_sf', status: 'autorizado', numero: 42, spedyId: 'sp42', data: w.hojeISO() };
  w.baseCuponsFiscais().push(cup2); chamadas.length = 0;
  const r2 = await w.cancelarCupomDaVenda({ id: 'pd_42', numero: 2546, fase: 'cancelado' }, 'x', { manterCupom: true });
  t('não pede à Receita', chamadas.length === 0 && r2.porque === 'mantido');
  t('fica como pendência em Cupons Fiscais', cup2.precisaCancelar === true && /manter o cupom/.test(cup2.motivoPendencia));

  console.log('\n── 5. Cupom a caminho e cupom recusado');
  const cup3 = { id: 'cf_43', pedidoId: 'pd_43', sucursalId: 'suc_sf', status: 'rejeitado', motivo: 'Duplicidade de NF-e', data: w.hojeISO() };
  w.baseCuponsFiscais().push(cup3);
  const ped3 = { id: 'pd_43', numero: 2547, fase: 'cancelado', data: w.hojeISO() };
  w.DB.pedidos.push(ped3);
  await w.cancelarCupomDaVenda(ped3, 'x');
  t('recusado de venda cancelada não volta a ser emitido', cup3.naoEmitir === true && cup3.status === 'sem_cupom');
  t('o reenvio automático pula venda cancelada', /if\(c\.naoEmitir\|\|ehCancelado\(ped\)\)return false;/.test(String(w.fiscalReprocessar)));
  t('emitirCupom não emite para venda cancelada', /if\(ped&&ehCancelado\(ped\)\)\{c\.naoEmitir=true;/.test(String(w.emitirCupom)));
  t('cupom a caminho que a Receita autorizar depois é cancelado',
    /acompanharCupom\(c\.id\)\.then\(function\(c2\)\{\s*if\(c2&&\(c2\.status==='autorizado'\|\|c2\.status==='contingencia'\)\)\s*return cancelarCupomDaVenda\(ped,motivo,\{segunda:true\}\)/.test(String(w.cancelarCupomDaVenda)));
  t('venda cancelada não imprime cupom', /c\.naoEmitir\)return;/.test(String(w.fsDepoisDeEmitir)));

  console.log('\n── 6. Cupons Fiscais: o cancelamento manual também vai pela venda');
  t('não barra mais o cupom sem identificador', !/!c\.spedyId\)\{\s*toast\('Este cupom não foi emitido/.test(String(w.cancelarCupom)) &&
    /fiscalPedirCancelamento\(c,suc,motivo\)/.test(String(w.cancelarCupom)));

  t('nenhum erro de runtime', erros.length === 0, erros.join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram');
  try { w.close(); } catch (e) {}
  process.exit(R.ok === R.total ? 0 : 1);
})();

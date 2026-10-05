/* ==========================================================
   CAIXA EDITADO APARECE EM CIMA, A SANGRIA ACERTA O FINANCEIRO, E A
   CONCILIAÇÃO VEM EM ORDEM: ENTRADA, DEPOIS SAÍDA (05/10/2026)

   Rodar:  node testes/caixa-editado-e-conciliacao.js
   ou:     npm run test:caixaeditado   (entra na bateria e no portão)

   Rafael: "Quando editar o caixa, clicando para visualizar o caixa,
   aparecer em cima: caixa editado, tanto valor. Quando atualizar a
   sangria na frente de caixa, os lançamentos financeiros e a conciliação
   têm que ter o mesmo valor. E na conciliação: primeiro entrada, depois
   saída — uma sequência lógica."

   Prende:
     1. a edição guarda o que mudou (de → para), quem e quando;
     2. o relatório do caixa mostra "Caixa editado" em cima, com os valores,
        e a Auditoria lista cada edição;
     3. a sangria editada muda o lançamento, a conciliação mostra o mesmo
        valor, e a nuvem é conferida; sem lançamento, avisa;
     4. a conciliação põe, no mesmo dia, as entradas antes das saídas.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
(async function () {
  const erros = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => erros.push(e && e.message));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {}; if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, DB = w.DB, doc = w.document, $ = id => doc.getElementById(id);
  if (!$('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  const avisos = [], painel = []; w.toast = m => avisos.push(String(m)); w.salvar = () => {}; w.telaFrenteCaixa = () => {};
  w.painelErro = (m, d) => painel.push(m + ' | ' + d);
  w.lancarFechamento = () => 0;
  let conferidos = null; w.conferirLancNaNuvem = ids => { conferidos = ids; return Promise.resolve(true); };
  w.usuarioLogado = () => ({ id: 'u1', nome: 'Bia', tudo: true });
  DB.contas = [{ id: 'ct_caixa', nome: 'Caixa da loja', fixa: 'caixa' }, { id: 'ct_itau', nome: 'Itaú', banco: 'itau', saldoInicial: 1000 }];
  DB.formasPag = [{ id: 'fp_din', nome: 'Dinheiro', tipo: 'dinheiro', ativo: true }];
  const cx = { id: 'cx_ed', inicial: 100, operador: 'Op', sucursalId: w.lojaAtualId(), aberto: '04/10/2026 12:00', fechadoEm: '04/10/2026 23:00',
    movimentos: [{ id: 'mv_s1', tipo: 'sangria', valor: 350, hora: '18:00', motivoNome: 'Depósito', lancRef: 'lf_s1' },
      { id: 'mv_s2', tipo: 'sangria', valor: 80, hora: '20:00', motivoNome: 'Troco' }], conferencia: { fp_din: 500 } };
  DB.caixas = [cx]; DB.pedidos = [];
  DB.lancFin = [{ id: 'lf_s1', tipo: 'transferencia', descricao: 'Sangria de caixa: Caixa da loja → Itaú', valor: 350, origem: 'mov-caixa',
    ref: 'mv_s1', contaId: 'ct_caixa', contaDestinoId: 'ct_itau', pago: true, pagamento: '2026-10-04' },
    { id: 'lf_r1', tipo: 'receita', descricao: 'Encomenda', valor: 120, contaId: 'ct_itau', pago: true, pagamento: '2026-10-04', categoriaTxt: 'x' },
    { id: 'lf_d1', tipo: 'despesa', descricao: 'Tarifa', valor: 9.9, contaId: 'ct_itau', pago: true, pagamento: '2026-10-04', categoriaTxt: 'x' }];

  console.log('\n── 1. Editar e guardar o que mudou\n');
  w.editarCaixa('cx_ed');
  const ins = doc.querySelectorAll('.ecMov');
  ins[0].value = '300,00'; ins[1].value = '90,00';
  doc.querySelector('.ecV[data-f="fp_din"]').value = '480,00';
  $('ecIni').value = '120';
  await $('mdOk').onclick();
  const eds = (cx.snapshot && cx.snapshot.edicoes) || [];
  const txt = eds.length ? eds[0].mudancas.map(w.textoMudanca).join(' | ') : '';
  t('a edição ficou guardada com quem e quando', eds.length === 1 && eds[0].por === 'Bia' && !!eds[0].em);
  t('com cada valor que mudou, de → para',
    /Fundo de troco: R\$ 100,00 → R\$ 120,00/.test(txt) && /Informado em Dinheiro: R\$ 500,00 → R\$ 480,00/.test(txt) &&
    /Sangria das 18:00: R\$ 350,00 → R\$ 300,00/.test(txt) && /Sangria das 20:00: R\$ 80,00 → R\$ 90,00/.test(txt), txt);

  console.log('\n── 2. "Caixa editado" em cima do relatório\n');
  w.verCaixa('cx_ed');
  const topo = (doc.querySelector('.vcEditado') || {}).textContent || '';
  t('aparece em cima, com quem editou', /Caixa editado/.test(topo) && /por Bia/.test(topo), topo.slice(0, 120));
  t('e os valores', /Sangria das 18:00: R\$ 350,00 → R\$ 300,00/.test(topo) && /Fundo de troco/.test(topo));
  t('fica antes das abas', (() => { const a = doc.querySelector('.vcEditado'), b = doc.querySelector('.vcAbas');
    return !!(a && b && (a.compareDocumentPosition(b) & 4)); })());
  w.vcAba('aud');
  t('a Auditoria lista a edição com os valores', /Edição administrativa do fechamento/.test($('mdOv').innerHTML) &&
    /Sangria das 18:00/.test($('mdOv').innerHTML));
  w.fecharModal();
  const semEd = { id: 'cx_ok', fechadoEm: 'x', snapshot: { diferencaTotal: 0 } };
  t('caixa nunca editado não mostra nada', w.blocoCaixaEditado(semEd) === '');

  console.log('\n── 3. A sangria acerta o financeiro e a conciliação\n');
  t('o lançamento da sangria passou a 300', DB.lancFin[0].valor === 300);
  await new Promise(r => setTimeout(r, 400));
  t('a nuvem é conferida para esse lançamento', Array.isArray(conferidos) && conferidos.join() === 'lf_s1', String(conferidos));
  t('a sangria sem lançamento é avisada', painel.length === 1 && /Sangria das 20:00/.test(painel[0]), painel.join('|'));
  w.CB.conta = 'ct_itau'; w.CB.de = '2026-10-01'; w.CB.ate = '2026-10-31'; w.CB.marcadas = {}; w.telaConciliacao();
  const linhas = [...doc.querySelectorAll('.cbTab tbody tr')].map(r => r.textContent);
  t('a conciliação mostra o mesmo 300 do financeiro', linhas.some(l => /Sangria de caixa/.test(l) && /300,00/.test(l)), linhas.join(' || ').slice(0, 300));

  console.log('\n── 4. Primeiro entrada, depois saída\n');
  const ordem = linhas.filter(l => /Encomenda|Sangria|Tarifa/.test(l)).map(l => /Tarifa/.test(l) ? 'S' : 'E');
  t('no mesmo dia, as entradas vêm antes das saídas', ordem.join('') === 'EES', ordem.join(''));

  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 3).join(' | '));
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(falhas ? 1 : 0);
})();

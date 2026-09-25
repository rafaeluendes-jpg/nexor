/* ==========================================================
   JOIA — O CAIXA NÃO FECHA COM PEDIDO EM ABERTO

   Rodar:  node testes/caixa-nao-fecha-com-pedido-aberto.js
   ou:     npm run test:pedaberto   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 25/09/2026)
   "Quando a gente foi fechar o caixa, tinha pedido sem estar finalizado,
   e mesmo assim ele fechou. Se tiver algum pedido não finalizado, precisa
   aparecer uma mensagem na frente da tela do PDV. Ao finalizar, consegue
   fechar o caixa."
   Aqui se confere cada tipo de pendência, as que NÃO contam, a tela de
   aviso, o pedido que chega com o fechamento já aberto, e que depois de
   finalizar o caixa fecha.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const esp = ms => new Promise(r => setTimeout(r, ms));
const erros = [];
(async function () {
  console.log('\nCarregando o sistema para o guardião do fechamento com pedido aberto…');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await esp(900);
  const w = dom.window, doc = w.document, $ = id => doc.getElementById(id);
  if (!$('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  w.salvar = () => {};
  w.lojaAtualId = () => 'suc_sf';
  w.baseStatus();
  const cx = { id: 'cx1', sucursalId: 'suc_sf', aberto: '25/09/2026 15:00', inicial: 100, operador: 'Bia', movimentos: [] };
  w.DB.caixas = [cx];
  w.DB.comandas = [];
  w.PDV.comanda = [];
  const ped = (o) => Object.assign({ id: 'p' + Math.random(), numero: 10, tipo: 'loja', total: 10, pagamentos: [],
    caixaId: 'cx1', sucursalId: 'suc_sf', clienteNome: 'Consumidor' }, o);
  const pend = () => w.pedidosNaoFinalizados(cx);

  grupo('O que NÃO impede fechar');
  w.DB.pedidos = [ped({ fase: 'entregue' }), ped({ fase: 'cancelado' }),
    ped({ fase: 'aguardando', caixaId: 'cx_de_ontem' }),
    ped({ fase: 'aguardando', caixaId: null, sucursalId: 'suc_jales' })];
  w.DB.comandas = [{ id: 'c0', mesaNumero: 3, aberta: true, itens: [], sucursalId: 'suc_sf' },
    { id: 'c9', mesaNumero: 4, aberta: false, itens: [{ total: 5 }], sucursalId: 'suc_sf' }];
  t('venda finalizada, cancelada, de outro caixa, de outra unidade, mesa vazia ou fechada: nada pendente',
    pend().length === 0, JSON.stringify(pend()));
  w.fecharCaixa(); await esp(150);
  t('e o fechamento abre normalmente', !!$('fcOp') && !$('cfOv'));
  w.fecharModal(); await esp(50);

  grupo('Cada tipo de pedido em aberto impede');
  for (const f of ['aguardando', 'preparo', 'pronto', 'saiu']) {
    w.DB.pedidos = [ped({ fase: f, numero: 77 })];
    t('pedido em "' + w.statusVenda(f).nome + '"', pend().length === 1 && /#77/.test(pend()[0][0]), JSON.stringify(pend()));
  }
  w.DB.pedidos = [ped({ fase: 'aguardando', caixaId: null, numero: 78 })];
  t('pedido do cardápio da unidade, ainda sem caixa', pend().length === 1);
  w.DB.pedidos = [];
  w.DB.comandas = [{ id: 'c1', mesaNumero: 5, nome: 'Ana', aberta: true, itens: [{ total: 12 }], sucursalId: 'suc_sf' }];
  t('mesa com consumo em aberto', pend().length === 1 && /Mesa 5/.test(pend()[0][0]));
  w.DB.comandas = [];
  w.PDV.comanda = [{ nome: 'Copo 300', qtd: 1, total: 12 }];
  t('venda montada na tela do PDV, ainda não paga', pend().length === 1 && /tela do PDV/.test(pend()[0][0]));
  w.PDV.comanda = [];

  grupo('A mensagem aparece na frente da tela, e o caixa não fecha');
  w.DB.pedidos = [ped({ fase: 'aguardando', numero: 91, clienteNome: 'João' })];
  w.fecharCaixa(); await esp(150);
  const av = $('cfOv');
  t('aparece "Tem pedido não finalizado"', !!av && /Tem pedido não finalizado/.test(av.textContent));
  t('com o número do pedido e o cliente', !!av && /#91/.test(av.textContent) && /João/.test(av.textContent));
  t('o fechamento NÃO abre', !$('fcOp'));
  t('o caixa continua aberto', !cx.fechadoEm);
  let abriu = null; w.abrir = (a, b) => { abriu = a + '/' + b; };
  av.querySelector('[data-cf="1"]').click(); await esp(80);
  t('"Ver pedidos" leva para os pedidos do PDV', abriu === 'pdv/pdv' && w.PDV.aba === 'pedidos', abriu + ' ' + w.PDV.aba);

  grupo('Pedido que chega com o fechamento já aberto');
  w.DB.pedidos = [];
  w.fecharCaixa(); await esp(150);
  t('sem pendência, o fechamento abre', !!$('fcOp'));
  w.DB.pedidos = [ped({ fase: 'preparo', numero: 92 })];
  const c0 = doc.querySelector('.cfV'); if (c0) { c0.value = '100,00'; c0.dispatchEvent(new w.Event('input', { bubbles: true })); }
  $('mdOk').click(); await esp(200);
  t('clicar Confirmar não fecha o caixa', !cx.fechadoEm);
  t('e mostra o aviso', !!$('cfOv') && /#92/.test($('cfOv').textContent));
  const vt = $('cfOv') && $('cfOv').querySelector('[data-cf="0"]'); if (vt) vt.click();
  await esp(50); try { w.fecharModal(); } catch (e) {}

  grupo('Depois de finalizar, fecha');
  w.DB.pedidos[0].fase = 'entregue';
  t('não sobra pendência', pend().length === 0);
  w.fecharCaixa(); await esp(150);
  t('o fechamento abre', !!$('fcOp') && !$('cfOv'));
  w.fecharModal();

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O caixa não fecha com pedido em aberto');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

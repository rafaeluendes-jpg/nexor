/* ==========================================================
   JOIA — HISTÓRICO ANTIGO SOB DEMANDA (Etapa 1)

   Rodar:  node testes/historico-nuvem.js
   ou:     npm run test:historico

   Prova a peça de LEITURA do plano de deixar o aparelho leve: buscar na
   nuvem os pedidos de um período (para relatórios de datas mais antigas
   do que o aparelho guarda).

   Nesta etapa a função ainda NÃO é chamada por nenhum relatório — então
   este teste também garante que ela está pronta e correta, sem que nada no
   sistema tenha mudado de comportamento. Roda a função REAL num DOM,
   dublando só a ida à nuvem (a `api`), que é o único ponto de rede.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

(async function () {
  const vc = new VirtualConsole();
  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window;

  console.log('\n── A peça de leitura existe');
  t('historicoNuvem() existe', typeof win.historicoNuvem === 'function', typeof win.historicoNuvem);

  console.log('\n── Nuvem desligada: devolve vazio, nunca estoura');
  win.NUVEM.ligada = false;
  const off = await win.historicoNuvem('2026-08-01', '2026-08-05');
  t('offline devolve lista vazia', Array.isArray(off) && off.length === 0);

  console.log('\n── Chama a função certa do banco, com o período certo');
  let chamou = null;
  win.NUVEM.ligada = true;
  win.NUVEM.token = 'tok'; win.NUVEM.chave = 'k'; win.NUVEM.url = 'https://x';
  win.api = async (caminho, metodo, corpo) => {
    chamou = { caminho, metodo, corpo };
    return { de: corpo.p_de, ate: corpo.p_ate, pedidos: [
      { id: 'ped_1', total: 24, data: '2026-08-03', sucursalId: 'suc_x',
        itens: [{ nome: 'Cascão', qtd: 1, total: 24 }], pagamentos: [{ forma: 'fp_dinheiro', valor: 24 }] }
    ] };
  };
  const rows = await win.historicoNuvem('2026-08-01', '2026-08-05');
  t('chama a função de leitura do banco (rpc/relatorio_historico)',
    chamou && chamou.caminho === 'rpc/relatorio_historico', chamou && chamou.caminho);
  t('manda o período pedido (p_de/p_ate)',
    chamou && chamou.corpo.p_de === '2026-08-01' && chamou.corpo.p_ate === '2026-08-05');
  t('devolve os pedidos já no formato dos relatórios', rows.length === 1 && rows[0].total === 24);
  t('o pedido traz itens e pagamentos prontos',
    (rows[0].itens || []).length === 1 && (rows[0].pagamentos || []).length === 1);

  console.log('\n── Erro na nuvem não derruba nada: devolve vazio');
  win.api = async () => { throw new Error('500 no banco'); };
  const err = await win.historicoNuvem('2026-08-01', '2026-08-05');
  t('erro na nuvem devolve lista vazia (não estoura)', Array.isArray(err) && err.length === 0);

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · histórico antigo sob demanda (Etapa 1)');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

/* ==========================================================
   JOIA — AS PERMISSÕES DA EQUIPE SALVAM DE VERDADE

   Rodar:  node testes/permissoes-salvam.js
   ou:     npm run test:permsalva   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 24/09/2026)
   "Coloco lá PDV, essas coisas, não tem botão de salvar. E se só deixar
   marcado, quando eu saio, não salva nada." O login da loja não é matriz e
   a sincronização pula usuarios_sistema para ele: as marcações ficavam só
   no aparelho, e o operador entrava com a lista vazia da nuvem.
   Aqui se confere: o botão existe, grava a linha daquele acesso na nuvem,
   só diz "Tudo salvo" depois da resposta do banco e mostra o que ficou.
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
const erros = [];
(async function () {
  console.log('\nCarregando o sistema para o guardião das permissões salvas…');
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
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window, doc = win.document;
  if (!doc.getElementById('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  win.salvar = () => {};
  win.DB.sucursais = [{ id: 'suc_matriz', nome: 'Matriz', matriz: true, ativa: true },
    { id: 'suc_sf', nome: 'Santa Fé', ativa: true, loginResp: 'santafe@jologelato.com.br' }];
  const sf = { id: 'u_sf', nome: 'Santa Fé', login: 'santafe@jologelato.com.br', ativo: true, sucursais: ['suc_sf'],
    permissoes: { 'pdv/pdv': true, 'pdv/pedidos-online': true, 'controle/baixa-manual': true, 'loja/usuarios-permissoes': true } };
  const cx = { id: 'usr_caixajologel', nome: 'Operador Caixa', login: 'caixa@jologelato.com.br', ativo: true,
    sucursais: ['suc_sf'], permissoes: {} };
  win.DB.usuarios = [sf, cx];
  win.usuarioLogado = () => sf;
  win.lojaAtualId = () => 'suc_sf';
  win.NUVEM.ligada = true; win.NUVEM.url = 'https://x.supabase.co'; win.NUVEM.chave = 'k';
  win.NUVEM.token = 't'; win.NUVEM.loja = 'loja-1'; win.NUVEM.cli = null;
  let msg = ''; win.toast = m => { msg = m; };
  let erroPainel = ''; win.painelErro = (a, b) => { erroPainel = a + ' ' + (b || ''); };

  /* a nuvem de mentira: guarda o pedido e devolve a linha como o banco
     devolveria — sem o que a loja não pode liberar */
  const pedidos = [];
  let linhasNaNuvem = 1;
  win.fetch = async (url, init) => {
    const corpo = init && init.body ? JSON.parse(init.body) : null;
    pedidos.push({ url: String(url), metodo: init && init.method, corpo, h: (init && init.headers) || {} });
    const perm = {};
    Object.keys((corpo && corpo.permissoes) || {}).forEach(k => { if (sf.permissoes[k]) perm[k] = corpo.permissoes[k]; });
    const linha = linhasNaNuvem ? [{ login: cx.login, permissoes: perm, sucursais: ['suc_sf'], tudo: false }] : [];
    return { ok: true, status: 200, text: async () => JSON.stringify(linha), json: async () => linha };
  };

  grupo('O botão de salvar existe');
  win.US.sel = cx.id; win.US.permSujo = null;
  win.telaUsuarios();
  let html = doc.getElementById('content').innerHTML;
  t('aparece "Salvar permissões"', /Salvar permissões/.test(html) && !!doc.getElementById('permBtnSalvar'));
  t('sem mudança, diz "Tudo salvo"', (doc.getElementById('permEstado') || {}).textContent === 'Tudo salvo');

  grupo('Marcar sem salvar avisa');
  const caixaPdv = Array.from(doc.querySelectorAll('.permIt')).find(l => l.getAttribute('data-perm') === 'pdv/pdv');
  const ck = caixaPdv && caixaPdv.querySelector('input');
  ck.checked = true; ck.dispatchEvent(new win.Event('change'));
  t('a caixa marcou PDV', cx.permissoes['pdv/pdv'] === true);
  t('diz "Há mudanças ainda não salvas"', /não salvas/.test((doc.getElementById('permEstado') || {}).textContent || ''));
  t('nada foi para a nuvem só de marcar', pedidos.length === 0);

  grupo('Salvar grava na nuvem');
  cx.permissoes['adm/empresas'] = true;   /* algo que a loja não tem: o banco corta */
  doc.getElementById('permBtnSalvar').click();
  await new Promise(r => setTimeout(r, 80));
  const p = pedidos[0] || {};
  t('um pedido PATCH para usuarios_sistema', p.metodo === 'PATCH' && /\/rest\/v1\/usuarios_sistema\?/.test(p.url), p.metodo + ' ' + p.url);
  t('da linha daquele acesso, nesta empresa', /loja_id=eq\.loja-1/.test(p.url) && /login=ilike\.caixa%40jologelato\.com\.br/.test(p.url), p.url);
  t('leva as permissões marcadas', p.corpo && p.corpo.permissoes && p.corpo.permissoes['pdv/pdv'] === true);
  t('a loja não manda acesso total nem unidade', p.corpo && !('tudo' in p.corpo) && !('sucursais' in p.corpo), JSON.stringify(p.corpo));
  t('pede a linha gravada de volta', /return=representation/.test(p.h.Prefer || ''));
  t('só depois diz "Tudo salvo"', /^Tudo salvo/.test(msg), msg);
  t('e avisa o que ficou de fora', /1 tela\(s\) ficaram de fora/.test(msg), msg);
  t('a tela passa a mostrar o que ficou gravado', cx.permissoes['pdv/pdv'] === true && !cx.permissoes['adm/empresas']);
  t('o aviso volta para "Tudo salvo"', (doc.getElementById('permEstado') || {}).textContent === 'Tudo salvo');

  grupo('Se a nuvem não achar o acesso, não mente');
  linhasNaNuvem = 0; msg = ''; erroPainel = '';
  const ok2 = await win.salvarPermissoesUsr();
  t('não diz "Tudo salvo"', ok2 === false && !/Tudo salvo/.test(msg), msg);
  t('mostra o problema', /Não consegui salvar/.test(erroPainel), erroPainel);

  grupo('Sem nuvem, não finge');
  linhasNaNuvem = 1; win.NUVEM.ligada = false; msg = '';
  const ok3 = await win.salvarPermissoesUsr();
  t('avisa que ficou só no aparelho', ok3 === false && /só neste aparelho/.test(msg), msg);
  win.NUVEM.ligada = true;

  grupo('A matriz também salva, com acesso total e unidades');
  const mz = { id: 'u_mz', nome: 'Matriz', login: 'jolo@jologelato.com.br', ativo: true, tudo: true, sucursais: [] };
  win.DB.usuarios.push(mz);
  win.usuarioLogado = () => mz; win.lojaAtualId = () => 'suc_matriz';
  pedidos.length = 0;
  await win.salvarPermissoesUsr();
  const pm = pedidos[0] || {};
  t('manda tudo e sucursais', pm.corpo && pm.corpo.tudo === false && JSON.stringify(pm.corpo.sucursais) === '["suc_sf"]', JSON.stringify(pm.corpo));

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · As permissões da equipe salvam de verdade');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

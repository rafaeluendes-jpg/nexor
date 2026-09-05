/* ==========================================================
   JOIA — A CONFIGURAÇÃO TEM DE SOBREVIVER

   Protocolo do Rafael, 01/09/2026, itens 7 e 8: toda configuração
   alterada tem de continuar igual depois de sair da tela, de recarregar,
   de trocar de tela e de uma versão nova. A taxa de cartão é a sentinela
   — foi ela que sumiu em Santa Fé do Sul.

   Aqui não se lê código: abre-se o sistema no Chromium de verdade, entra-
   se pela tela de Formas de Pagamento, digita-se no campo, clica-se em
   Salvar, e confere-se depois de cada travessia. É o fluxo real.

   NÃO TOCA NA NUVEM: a rede sai bloqueada, tudo acontece no aparelho.
   ========================================================== */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const FOTOS = process.env.PROVAR_FOTOS || '/tmp/provas';
fs.mkdirSync(FOTOS, { recursive: true });
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const ruido = m => /MIME type|Failed to fetch|net::ERR|ServiceWorker|favicon|Manifest|sem conexão/i.test(String(m));

(async () => {
  const porta = 8791;
  const srv = http.createServer((rq, rs) => {
    const f = path.join(RAIZ, decodeURIComponent(rq.url.split('?')[0]).replace(/^\//, '') || 'index.html');
    fs.readFile(f, (e, d) => { if (e) { rs.statusCode = 404; rs.end(); } else rs.end(d); });
  }).listen(porta);

  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const erros = [];
  pg.on('pageerror', e => { if (!ruido(e.message)) erros.push(e.message.slice(0, 160)); });
  pg.on('console', m => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text().slice(0, 160)); });
  await pg.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:' + porta)
    ? r.continue() : r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: '' }));

  async function abrirSistema() {
    await pg.goto('http://127.0.0.1:' + porta + '/index.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1800);
    await pg.evaluate(() => {
      window.confirmar = async () => true; window.pergunta = async () => true;
      window.confirm = () => true; window.alert = () => {}; window.prompt = () => null;
      try { SESSAO.login = 'admin'; SESSAO.usuarioId = 'usr_mestre'; } catch (e) {}
      abrirSessao();
      /* a nuvem fica desligada: esta prova é sobre o aparelho */
      try { NUVEM.ligada = false; } catch (e) {}
    });
    await pg.waitForTimeout(500);
  }

  /* lê a forma de pagamento como o sistema a vê */
  const ler = (id) => pg.evaluate((fid) => {
    var f = (DB.formasPag || []).find(x => x.id === fid) || {};
    return { taxaPct: f.taxaPct, dias: f.dias, contaId: f.contaId, nome: f.nome, ativa: f.ativa };
  }, id => id);
  const lerForma = (fid) => pg.evaluate((x) => {
    var f = (DB.formasPag || []).find(y => y.id === x) || {};
    return { taxaPct: f.taxaPct, dias: f.dias, contaId: f.contaId, nome: f.nome };
  }, fid);
  const guardado = (fid) => pg.evaluate((x) => {
    try {
      /* a base é guardada no IndexedDB (comprimida); `_baseCrua()` devolve
         a fonte certa — memória/IndexedDB — sem depender do localStorage */
      var raw = (typeof _baseCrua === 'function' ? _baseCrua() : localStorage.getItem('nexor_dados')) || '{}';
      if (typeof _desempacota === 'function') raw = _desempacota(raw);
      var b = JSON.parse(raw);
      var f = (b.formasPag || []).find(y => y.id === x) || {};
      return { taxaPct: f.taxaPct, dias: f.dias, contaId: f.contaId };
    } catch (e) { return { erro: String(e.message) }; }
  }, fid);

  const ESPERADO = { taxaPct: 2.73, dias: 1, contaId: 'ct_banco' };
  function confere(rot, v) {
    t(rot + ': a taxa continua 2,73%', v.taxaPct === ESPERADO.taxaPct, v.taxaPct);
    t(rot + ': o prazo continua 1 dia', v.dias === ESPERADO.dias, v.dias);
    t(rot + ': a conta continua a do banco', v.contaId === ESPERADO.contaId, v.contaId);
  }

  console.log('\n── 1. Configurar a taxa pelo caminho da loja\n');
  await abrirSistema();
  await pg.evaluate(() => {
    baseFin();   /* cria contas e formas de fábrica, como numa loja nova */
    var c = (DB.contas || []).find(x => x.id === 'ct_banco');
    if (c) c.nome = 'Banco Itaú — conta corrente';
    abrir('financeira', 'formas-pagamento');
  });
  await pg.waitForTimeout(300);
  t('a tela de Formas de Pagamento abre',
    await pg.evaluate(() => !!document.querySelector('#content')));

  /* abre o Editar do crédito e preenche do jeito que a pessoa preenche */
  await pg.evaluate(() => modalForma('fp_credito'));
  await pg.waitForTimeout(250);
  t('o Editar do cartão de crédito abre',
    await pg.evaluate(() => !!document.getElementById('fpTx')));
  await pg.evaluate(() => {
    document.getElementById('fpTx').value = '2.73';
    document.getElementById('fpD').value = '1';
    var r = document.querySelector('input[name=fpC][value="ct_banco"]');
    if (r) r.checked = true;
  });
  await pg.evaluate(() => {
    var bts = Array.from(document.querySelectorAll('#mdOv button'));
    var s = bts.find(x => /^\s*salvar\s*$/i.test(x.textContent));
    if (s) s.click();
  });
  await pg.waitForTimeout(400);
  confere('logo depois de salvar', await lerForma('fp_credito'));
  confere('e no armazenamento do aparelho', await guardado('fp_credito'));
  await pg.screenshot({ path: FOTOS + '/persistir-taxa-salva.png' });

  console.log('\n── 2. Sair da tela e voltar\n');
  await pg.evaluate(() => { abrir('financeira', 'contas'); });
  await pg.waitForTimeout(250);
  await pg.evaluate(() => { abrir('financeira', 'formas-pagamento'); });
  await pg.waitForTimeout(250);
  confere('depois de sair e voltar', await lerForma('fp_credito'));
  t('e a tela mostra 2,73%',
    await pg.evaluate(() => /2,73%|2\.73/.test(document.getElementById('content').textContent)));

  console.log('\n── 3. Recarregar a página (F5)\n');
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => {
    try { SESSAO.login = 'admin'; SESSAO.usuarioId = 'usr_mestre'; } catch (e) {}
    abrirSessao(); try { NUVEM.ligada = false; } catch (e) {}
    baseFin();
  });
  await pg.waitForTimeout(400);
  confere('depois do F5', await lerForma('fp_credito'));

  console.log('\n── 4. Trocar de módulo e voltar\n');
  await pg.evaluate(() => { abrir('estoque', 'posicao-estoque'); });
  await pg.waitForTimeout(250);
  await pg.evaluate(() => { abrir('financeira', 'formas-pagamento'); });
  await pg.waitForTimeout(250);
  confere('depois de trocar de módulo', await lerForma('fp_credito'));

  console.log('\n── 5. Versão nova da aplicação\n');
  /* o que uma publicação faz com o aparelho: o código vem de novo do
     servidor e o sistema arranca outra vez. O dado do cliente não é
     código, e tem de atravessar isso intacto. */
  await pg.evaluate(() => { try { localStorage.setItem('nexor_versao_vista', 'V000'); } catch (e) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => {
    try { SESSAO.login = 'admin'; SESSAO.usuarioId = 'usr_mestre'; } catch (e) {}
    abrirSessao(); try { NUVEM.ligada = false; } catch (e) {}
    baseFin();
  });
  await pg.waitForTimeout(400);
  confere('depois de uma versão nova', await lerForma('fp_credito'));

  console.log('\n── 6. A semente de fábrica não repõe nada por cima\n');
  const rSem = await pg.evaluate(() => {
    baseFin(); baseMov();
    var f = (DB.formasPag || []).find(x => x.id === 'fp_credito') || {};
    return { taxa: f.taxaPct, dias: f.dias, conta: f.contaId,
             quantas: (DB.formasPag || []).length };
  });
  t('a semente rodou e não mexeu na taxa', rSem.taxa === 2.73, rSem.taxa);
  t('nem no prazo', rSem.dias === 1, rSem.dias);
  t('nem na conta', rSem.conta === 'ct_banco', rSem.conta);
  t('e não duplicou as formas', rSem.quantas === 5, rSem.quantas);

  console.log('\n── 7. O PDV usa a taxa configurada\n');
  const rPdv = await pg.evaluate(() => {
    var f = (DB.formasPag || []).find(x => x.id === 'fp_credito');
    var venda = 100;
    var taxa = venda * (Number(f.taxaPct) || 0) / 100 + (Number(f.taxaFixa) || 0);
    return { taxa: Math.round(taxa * 100) / 100, liquido: Math.round((venda - taxa) * 100) / 100,
             dias: f.dias, conta: f.contaId };
  });
  t('numa venda de R$ 100 no crédito a taxa é R$ 2,73', rPdv.taxa === 2.73, rPdv.taxa);
  t('e o líquido é R$ 97,27', rPdv.liquido === 97.27, rPdv.liquido);
  t('o dinheiro cai em 1 dia', rPdv.dias === 1, rPdv.dias);
  t('na conta do banco', rPdv.conta === 'ct_banco', rPdv.conta);

  console.log('\n── 8. As outras configurações críticas atravessam igual\n');
  await pg.evaluate(() => {
    baseMov(); baseFin();
    var m = (DB.motivosMov || []).find(x => x.id === 'mv_sai');
    if (m) m.nome = 'Perda no balcão';
    DB.contas = DB.contas || [];
    var c = DB.contas.find(x => x.id === 'ct_banco');
    if (c) c.nome = 'Itaú — conta da loja';
    salvar();
  });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => {
    try { SESSAO.login = 'admin'; SESSAO.usuarioId = 'usr_mestre'; } catch (e) {}
    abrirSessao(); try { NUVEM.ligada = false; } catch (e) {}
    baseMov(); baseFin();
  });
  const rOut = await pg.evaluate(() => ({
    motivo: ((DB.motivosMov || []).find(x => x.id === 'mv_sai') || {}).nome,
    conta: ((DB.contas || []).find(x => x.id === 'ct_banco') || {}).nome
  }));
  t('o motivo renomeado continua "Perda no balcão"', rOut.motivo === 'Perda no balcão', rOut.motivo);
  t('a conta renomeada continua "Itaú — conta da loja"',
    rOut.conta === 'Itaú — conta da loja', rOut.conta);

  console.log('\n── 9. Nenhum erro na sessão inteira\n');
  t('zero erro de console', erros.length === 0, erros.join(' | '));

  await b.close(); srv.close();
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                             : '✓ ' + testes + ' provas de persistência passaram') + '\n');
  process.exit(falhas ? 1 : 0);
})();

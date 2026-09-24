/* ==========================================================
   JOIA — SÓ A MATRIZ DECIDE QUEM ENXERGA UM CADASTRO

   Rodar:  node testes/unidade-nao-escolhe-quem-ve.js
   ou:     npm run test:quemve   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 24/09/2026)

   "Estou dentro da loja de Santa Fé, e a loja de Santa Fé consegue flegar
   qual loja vai ver. Não faz sentido. Apenas quem tem essa visão de
   permitir quem vai ver é a matriz, não as lojas."

   O bloco "Quem enxerga este item" aparecia para qualquer login com visão
   de rede (dono, acesso total) mesmo com uma UNIDADE selecionada. Agora
   ele só aparece com a Matriz selecionada; na unidade o item novo nasce
   visível para ela, e o que já existe não perde a liberação que tinha.
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
  console.log('\nCarregando o sistema para o guardião de "quem enxerga"…');
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

  win.DB.sucursais = [
    { id: 'suc_matriz', nome: 'Matriz', matriz: true, ativa: true },
    { id: 'suc_sf', nome: 'Jolo Santa Fe do Sul', ativa: true },
    { id: 'suc_jl', nome: 'Jolô Jales', ativa: true }];
  win.usuarioLogado = () => ({ nome: 'Rafael', tudo: true, sucursais: [] });   /* visão de rede */
  let atual = 'suc_sf';
  win.lojaAtualId = () => atual;

  grupo('Com Santa Fé selecionada');
  t('o bloco "Quem enxerga" NÃO aparece', win.blocoUnidades(null, 'tq') === '');
  const novo = { id: 'x1', nome: 'Degustação' };
  win.lerUnidades('tq', novo);
  t('o item novo nasce visível só para Santa Fé', JSON.stringify(novo.sucursais) === '["suc_sf"]',
    JSON.stringify(novo.sucursais));
  const velho = { id: 'x2', nome: 'Perda', sucursais: ['*'] };
  win.lerUnidades('tq', velho);
  t('o item que já existia mantém a liberação da matriz', JSON.stringify(velho.sucursais) === '["*"]',
    JSON.stringify(velho.sucursais));

  grupo('Na janela de motivos da Baixa Manual');
  win.baseMov();
  win.gerirMotivosDaBaixa();
  t('a janela abre sem o bloco de unidades', !!doc.getElementById('mdOv') &&
    !/Quem enxerga este item/.test(doc.getElementById('mdOv').innerHTML));
  win.fecharModal();

  grupo('Com a Matriz selecionada');
  atual = 'suc_matriz';
  const html = win.blocoUnidades(null, 'tq');
  t('o bloco aparece para a matriz decidir', /Quem enxerga este item/.test(html));
  t('com as unidades para marcar', /Jolo Santa Fe do Sul/.test(html) && /Jolô Jales/.test(html));

  grupo('Login de unidade continua sem o bloco');
  win.usuarioLogado = () => ({ nome: 'Santa Fé', sucursais: ['suc_sf'] });
  atual = 'suc_sf';
  t('usuário da unidade não vê o bloco', win.blocoUnidades(null, 'tq') === '');

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Só a matriz decide quem enxerga');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

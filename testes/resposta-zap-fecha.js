/* ==========================================================
   JOIA — A RESPOSTA SALVA DO ROBÔ VIRA BLOCO FECHADO

   Rodar:  node testes/resposta-zap-fecha.js
   ou:     npm run test:respzap   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 23/09/2026)

   Ele cadastrou a resposta automática da vaga de trabalho, clicou em
   Salvar, viu o aviso verde — e a resposta continuou aberta, com os
   campos de edição. "Dá a impressão que está em editar ainda." Não ficava
   claro se tinha salvado nem onde criar a próxima.

   Agora: resposta salva = bloco fechado, só leitura, com lápis e lixeira.
   Aberta fica só a que está sendo criada ou editada.

   O que este guardião protege ACIMA DE TUDO: fechar o bloco não pode
   apagar a resposta. O Salvar lê a lista pela tela; se o bloco fechado
   tirasse os campos da tela, a resposta sumiria do robô no próximo
   Salvar.
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
async function carregar() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.HTMLElement.prototype.scrollIntoView = function () {};
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião das respostas do robô…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.NUVEM.ligada = false;
  win.salvar = () => {};
  if (!doc.getElementById('content')) {
    const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d);
  }
  win.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true }];
  win.DB.lojaAtual = 'suc_sf'; win.lojaAtualId = () => 'suc_sf';
  win.baseZap();
  const VAGA = { chaves: 'Estão contratando, qual salario, quero saber mais da vaga',
                 resposta: 'Para saber mais sobre a vaga chame no 017992156189, falar com Raylan.' };
  win.DB.zap = win.DB.zap || {};
  win.DB.zap.suc_sf = { ativo: true, respostas: [Object.assign({}, VAGA)] };
  win.ZP.suc = 'suc_sf'; win.ZP.aba = 'respostas'; win.ZP.respAberta = {};
  const cfg = () => win.DB.zap[win.ZP.suc];

  grupo('Resposta já salva aparece fechada');
  win.telaZap();
  let blocos = doc.querySelectorAll('.respZ');
  t('um bloco na tela', blocos.length === 1, blocos.length);
  t('ele é o bloco fechado (salva)', blocos[0] && blocos[0].classList.contains('respZok'));
  t('mostra o texto da resposta por extenso',
    blocos[0] && /017992156189/.test(blocos[0].textContent));
  t('tem lápis para editar', !!(blocos[0] && blocos[0].querySelector('[onclick^="abrirResp(0)"]')));
  t('o campo continua na tela, escondido (o Salvar lê por ele)',
    !!doc.getElementById('zpRc0') && doc.getElementById('zpRc0').value === VAGA.chaves);

  grupo('"nova" abre um bloco em branco, e só ele');
  win.addRespZap();
  blocos = doc.querySelectorAll('.respZ');
  t('agora são dois', blocos.length === 2, blocos.length);
  t('o primeiro continua fechado', blocos[0].classList.contains('respZok'));
  t('o novo está aberto para digitar', !blocos[1].classList.contains('respZok'));
  t('com o cursor dentro dele', doc.activeElement && doc.activeElement.id === 'zpRc1',
    doc.activeElement && doc.activeElement.id);

  grupo('Salvar: nada some, e tudo fecha');
  doc.getElementById('zpRc1').value = 'sem lactose, zero açúcar';
  doc.getElementById('zpRr1').value = 'Temos sabores zero açúcar e sem lactose!';
  await win.salvarZap();
  t('as duas respostas foram gravadas', (cfg().respostas || []).length === 2,
    JSON.stringify(cfg().respostas));
  t('a resposta que estava FECHADA não se perdeu',
    (cfg().respostas || [])[0] && cfg().respostas[0].resposta === VAGA.resposta);
  t('a nova entrou com o que foi digitado',
    (cfg().respostas || [])[1] && cfg().respostas[1].chaves === 'sem lactose, zero açúcar');
  blocos = doc.querySelectorAll('.respZ');
  t('depois de salvar, as duas estão fechadas',
    blocos.length === 2 && [].every.call(blocos, b => b.classList.contains('respZok')),
    [].map.call(blocos, b => b.className).join(' | '));
  t('e o aviso de salvo apareceu', toasts.some(m => /salva/i.test(m)), toasts.join(' | '));

  grupo('Editar e excluir');
  win.abrirResp(0);
  blocos = doc.querySelectorAll('.respZ');
  t('o lápis reabre só aquela', !blocos[0].classList.contains('respZok') && blocos[1].classList.contains('respZok'));
  win.remResp(1);
  t('a lixeira tira a resposta', (cfg().respostas || []).length === 1);
  t('e nada fica aberto pela posição errada', Object.keys(win.ZP.respAberta || {}).length === 0);

  grupo('Resposta vazia nunca fica escondida');
  cfg().respostas.push({ chaves: '', resposta: '' });
  win.ZP.respAberta = {};
  win.telaZap();
  blocos = doc.querySelectorAll('.respZ');
  t('linha em branco aparece aberta, para ser preenchida',
    blocos.length === 2 && !blocos[1].classList.contains('respZok'));

  grupo('Sem erro de console');
  t('nenhum erro de página', erros.length === 0, erros.join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A resposta salva do robô vira bloco fechado');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

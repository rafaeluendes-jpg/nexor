/* ==========================================================
   JOIA — A ÁRVORE POR UNIDADE E O LOGIN QUE "JÁ EXISTE"

   Rodar:  node testes/usuarios-arvore-e-login-repetido.js
   ou:     npm run test:usrarvore   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 25/09/2026)
   1. *"Se eu criei o Ricardo Soares dentro da Jolô Gelato Matriz, não
      deveria aparecer tudo solto. Jolô Gelato, setinha, clicou,
      aparecem as pessoas criadas ali. Santa Fé, a mesma coisa."*
   2. *"Estou tentando criar o Railan e fala que já existe. Mas se você
      ver a foto, não tem nenhum login Railan aí."* — estava lá,
      desligado, e a árvore esconde desligado.
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
  console.log('\nCarregando o sistema para o guardião da árvore de usuários…');
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
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  if (!$('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  win.salvar = () => {};
  win.lojaAtualId = () => 'suc_matriz';
  win.DB.sucursais = [
    { id: 'suc_matriz', nome: 'Matriz', matriz: true, ativa: true },
    { id: 'suc_sf', nome: 'Santa Fé', ativa: true },
    { id: 'suc_jl', nome: 'Jales', ativa: true }];
  const mestre = { id: 'usr_mestre', nome: 'Jolo Gelato', login: 'jolo@jologelato.com.br',
    ativo: true, tudo: true, sucursais: [] };
  const ricardo = { id: 'u_ric', nome: 'Ricardo Soares', login: 'ricardo@jologelato.com.br',
    ativo: true, sucursais: [], permissoes: { 'pdv/pdv': true } };
  const sf = { id: 'u_sf', nome: 'Santa Fé', login: 'santafe@jologelato.com.br',
    ativo: true, sucursais: ['suc_sf'], permissoes: { 'pdv/pdv': true } };
  const caixa = { id: 'u_cx', nome: 'Operador Caixa', login: 'caixa@jologelato.com.br',
    ativo: true, sucursais: ['suc_sf'], permissoes: { 'pdv/pdv': true } };
  const jales = { id: 'u_jl', nome: 'Jales', login: 'jales@jologelato.com.br',
    ativo: true, sucursais: ['suc_jl'], permissoes: { 'pdv/pdv': true } };
  const raylan = { id: 'u_ray', nome: 'Raylan', login: 'raylan@jologelato.com.br',
    ativo: false, sucursais: [], permissoes: {} };
  win.DB.usuarios = [mestre, ricardo, sf, caixa, jales, raylan];
  win.usuarioLogado = () => mestre;
  win.US.sel = null; win.US.busca = ''; win.US.abertas = {};

  grupo('Cada unidade é uma pasta');
  win.telaUsuarios();
  const pastas = () => Array.from(doc.querySelectorAll('.usrSub > .usrPastaH'))
    .map(b => (b.querySelector('.usrN b') || {}).textContent || '');
  t('a matriz e as duas unidades viram pastas', pastas().join('|') === 'Matriz|Jales|Santa Fé', pastas().join('|'));
  const dentroDe = nome => {
    const h = Array.from(doc.querySelectorAll('.usrSub > .usrPastaH'))
      .find(b => ((b.querySelector('.usrN b') || {}).textContent || '') === nome);
    return Array.from((h.parentNode.querySelector('.usrFilhos') || {}).children || [])
      .map(e => (e.querySelector('.usrN b') || {}).textContent || '');
  };
  t('quem foi criado na matriz aparece na matriz',
    dentroDe('Matriz').join(',') === 'Jolo Gelato,Ricardo Soares', dentroDe('Matriz').join(','));
  t('Santa Fé mostra os dois acessos dela',
    dentroDe('Santa Fé').join(',') === 'Santa Fé,Operador Caixa', dentroDe('Santa Fé').join(','));
  t('e Jales o dela', dentroDe('Jales').join(',') === 'Jales');
  t('ninguém aparece duas vezes',
    doc.querySelectorAll('.usrFilhos .usrIt').length === 5,
    String(doc.querySelectorAll('.usrFilhos .usrIt').length));
  t('a pasta da unidade conta os acessos',
    /2 acessos/.test(doc.querySelector('.usrSub .usrN span').textContent));

  grupo('Clicar na pessoa abre para editar');
  const alvo = Array.from(doc.querySelectorAll('.usrFilhos .usrIt'))
    .find(b => /Operador Caixa/.test(b.textContent));
  alvo.click(); await esp(60);
  t('a pessoa fica selecionada', win.US.sel === 'u_cx');
  t('e o painel mostra o cadastro dela', /Operador Caixa/.test($('content').innerHTML));

  grupo('Procurando, tudo abre');
  win.US.busca = 'caixa'; win.telaUsuarios();
  t('as pastas com resultado vêm abertas',
    Array.from(doc.querySelectorAll('.usrSub')).every(p => p.classList.contains('ab')));
  win.US.busca = '';

  grupo('O login que existe desligado');
  win.US.abertas = {}; win.telaUsuarios();
  t('o desligado não polui a árvore', !/Raylan/.test($('content').innerHTML));
  t('mas a tela avisa que existe 1 desligado', /mostrar 1 desligado/.test($('content').innerHTML));
  let perguntou = null, msg = '';
  win.confirmar = async (op) => { perguntou = op; return true; };
  win.toast = m => { msg = m; };
  win.novoUsuario(); await esp(60);
  $('uNome').value = 'Raylan Soares';
  $('uLogin').value = 'raylan@jologelato.com.br';
  $('uSenha').value = 'jolo26ray';
  $('mdOk').click(); await esp(200);
  t('não diz apenas "já existe"', !!perguntou && /desligado/i.test(perguntou.titulo + perguntou.texto),
    perguntou && perguntou.titulo);
  t('mostra de quem é o login', !!perguntou && /Raylan/.test(JSON.stringify(perguntou.linhas)));
  t('reativa em vez de criar um segundo', raylan.ativo === true &&
    win.DB.usuarios.filter(u => u.login === 'raylan@jologelato.com.br').length === 1);
  t('e diz o que fazer em seguida', /reativado/i.test(msg), msg);
  t('o reativado aparece na árvore', /Raylan/.test($('content').innerHTML));

  grupo('Login repetido de alguém ATIVO continua barrado');
  perguntou = null; msg = '';
  win.novoUsuario(); await esp(60);
  $('uNome').value = 'Outro Ricardo';
  $('uLogin').value = 'ricardo@jologelato.com.br';
  $('uSenha').value = 'jolo26ric';
  $('mdOk').click(); await esp(120);
  t('não oferece reativar quem está ativo', perguntou === null);
  t('avisa que já existe', /Já existe um usuário/.test(msg), msg);
  t('e não criou um segundo',
    win.DB.usuarios.filter(u => u.login === 'ricardo@jologelato.com.br').length === 1);

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Árvore por unidade e login repetido');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

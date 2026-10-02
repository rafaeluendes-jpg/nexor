/* ==========================================================
   JOIA — A LIBERAÇÃO DA LOJA NÃO SE DESCONFIGURA SOZINHA (02/10/2026)

   Rodar:  node testes/liberacao-so-muda-quem-viu.js
   ou:     npm run test:libvista   (entra na bateria e no portão)

   Rafael: "o bloco de produção sempre estava liberado… Santa Fé estava
   fazendo a produção todo dia… alguma atualização escondeu a parte da
   produção dos sabores. Qualquer atualização feita não pode desconfigurar."

   O que o histórico mostrou (audit_log, 01/10 14h53): a liberação de 45
   fichas mudou e, no mesmo minuto, dois aparelhos com a lista antiga
   subiram a cópia deles por cima. E a pasta "Produzido" ficou só da
   matriz, escondendo os sabores da produção de Santa Fé.

   Este guardião prende:
     1. a lei está no banco: só troca a liberação quem viu a de hoje
        (20261002_liberacao_so_muda_quem_viu.sql), nas fichas e nas pastas;
     2. o aparelho diz qual liberação viu, e isso não é "alteração";
     3. aparelho atrasado: a nuvem manteve a liberação salva — o aparelho
        adota a dela e baixa de novo, sem insistir;
     4. esconder algo de uma loja só com o aviso de qual loja e quantos
        itens, e só com o "sim"; ampliar não pergunta nada.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261002_liberacao_so_muda_quem_viu.sql');
const L = '6001c62e-26f3-4d81-8b6c-fa367c14146c';
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
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}
function nuvemFalsa(w) {
  w.__posts = []; w.__resposta = null;
  w.eval(`
    api = async function(caminho, metodo, corpo){
      if(metodo==='POST' && Array.isArray(corpo)){
        window.__posts.push({tab:caminho.split('?')[0], linhas:JSON.parse(JSON.stringify(corpo))});
        return corpo.map(function(o,i){
          var r=window.__resposta?window.__resposta(caminho.split('?')[0],o):null;
          var b=Object.assign({id:_ids[o.ref_local]||((o.ref_local||('x'+i))+'-uuid')}, o);
          delete b.sucursais_vista;   /* o banco não guarda o recibo */
          return r||b;
        });
      }
      return [];
    };
    apiPaginado = async function(){ return []; };
    tokenAtual = async function(){ return 'tk'; };
    tokenValido = async function(){ return 'tk'; };
    marcarVersaoAtual = async function(){};
    backupDoDia = function(){}; sinalDoAparelho = function(){}; agendarSync = function(){};
  `);
  Object.assign(w.NUVEM, { ligada: true, cli: null, baixou: true, loja: L, plataforma: false });
}
function ids(w) {
  w.eval('_ids={}; Object.keys(DB._uuid).forEach(function(c){Object.keys(DB._uuid[c]).forEach(function(r){_ids[r]=DB._uuid[c][r]})});');
}
const espera = (ms) => new Promise(r => setTimeout(r, ms));

(async function () {
  grupo('1. A lei está no banco');
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('a migration existe', !!sql);
  t('coluna sucursais_vista nas fichas e nas pastas',
    /alter table public\.fichas_tecnicas add column if not exists sucursais_vista jsonb/.test(sql) &&
    /alter table public\.ficha_grupos\s+add column if not exists sucursais_vista jsonb/.test(sql));
  t('gatilho de UPDATE nas fichas', /create trigger ab_sucursais_vista before update on public\.fichas_tecnicas/.test(sql));
  t('gatilho de UPDATE nas pastas', /create trigger ab_sucursais_vista before update on public\.ficha_grupos/.test(sql));
  t('quem não viu a liberação de hoje não a troca — e o resto da linha grava',
    /old\.sucursais is distinct from vista/.test(sql) && /new\.sucursais := old\.sucursais;/.test(sql) && !/return old;/.test(sql));
  t('o recibo não fica gravado', /new\.sucursais_vista := null;/.test(sql));
  t('aparelho sem recibo (versão antiga) pode ampliar, nunca esconder',
    /if vista is null then/.test(sql) && /not \(coalesce\(new\.sucursais,'\[\]'::jsonb\) @> old\.sucursais\)/.test(sql));
  t('não é gatilho de INSERT (apagaria o recibo do upsert)', !/before insert/.test(sql));
  t('a pasta passa a ter registro de auditoria', /create trigger tg_auditar after insert or delete or update on public\.ficha_grupos/.test(sql));

  console.log('\nCarregando o sistema…');
  let w;
  try { w = await carregar(); } catch (e) { console.log('   FALHA não carregou: ' + e.message); process.exit(1); }
  const DB = w.DB;
  nuvemFalsa(w);

  grupo('2. O aparelho diz qual liberação viu');
  const MAPA = w.eval('MAPA');
  const Ef = MAPA.find(e => e.col === 'fichas'), Eg = MAPA.find(e => e.col === 'fichaCats');
  t('fichas e pastas estão sob a lei da liberação', !!(Ef && Ef.sucVista && Eg && Eg.sucVista));
  const fonteDown = String(w._baixarDaNuvem);
  t('o download guarda a liberação que desceu, nas fichas e nas pastas',
    (fonteDown.match(/_sucVista:x\.sucursais\|\|\[\]/g) || []).length >= 2);
  DB.fichaCats = [{ id: 'fc_prod', nome: 'Produzido', sucursais: ['suc_sf'], _loja: L, _sucVista: ['suc_sf'] }];
  DB.fichas = [{ id: 'fi_mor', nome: 'MORANGO GELATO', categoriaId: 'fc_prod', unidade: 'kg', rendimento: 1, itens: [],
    sucursais: ['suc_sf'], estoqueAtual: 2, _loja: L, _sucVista: ['suc_sf'] }];
  DB._uuid = Object.assign(DB._uuid || {}, { fichaCats: { fc_prod: 'u-fc' }, fichas: { fi_mor: 'u-fi' } });
  DB._hash = {}; ids(w); w.anotarImpressoes();
  const h0 = DB._hash.fichas.fi_mor;
  DB.fichas[0]._sucVista = ['outra'];
  t('a liberação vista não entra na impressão da linha', w.impressaoDaLinha(Ef, DB.fichas[0], 0) === h0);
  DB.fichas[0]._sucVista = ['suc_sf'];
  DB.fichas[0].sucursais = [];                     /* a matriz tira de Santa Fé, vendo a de hoje */
  w.NUVEM.sujo = true; DB._sujo = true;
  await w.sincronizar();
  const pf = w.__posts.filter(p => p.tab === 'fichas_tecnicas');
  t('a alteração sobe com a liberação que este aparelho viu', pf.length === 1 &&
    JSON.stringify(pf[0].linhas[0].sucursais_vista) === '["suc_sf"]' && JSON.stringify(pf[0].linhas[0].sucursais) === '[]',
    JSON.stringify(pf.map(p => p.linhas)));
  t('aceita: a liberação vista passa a ser a nova', JSON.stringify(DB.fichas[0]._sucVista) === '[]', JSON.stringify(DB.fichas[0]._sucVista));

  grupo('3. Aparelho atrasado não devolve a liberação antiga');
  w.__posts.length = 0;
  /* este aparelho viu ['suc_sf'] e ainda tem essa lista; outro aparelho já
     mudou na nuvem. Aqui só o estoque mudou — mas a linha sobe inteira. */
  DB.fichas[0].sucursais = ['suc_sf']; DB.fichas[0]._sucVista = ['suc_sf']; DB.fichas[0].estoqueAtual = 5;
  w.__resposta = (tab, o) => tab === 'fichas_tecnicas'
    ? Object.assign({ id: 'u-fi' }, o, { sucursais: ['suc_sf', 'suc_ja'], sucursais_vista: undefined }) : null;
  let rebaixou = 0; const baixarReal = w.baixarDaNuvem; w.baixarDaNuvem = async () => { rebaixou++; return true; };
  w.NUVEM.sujo = true; DB._sujo = true;
  await w.sincronizar();
  await espera(700);
  t('a linha subiu (o estoque precisa subir)', w.__posts.filter(p => p.tab === 'fichas_tecnicas').length === 1);
  t('o aparelho adota a liberação que a nuvem manteve', JSON.stringify(DB.fichas[0]._sucVista) === '["suc_sf","suc_ja"]',
    JSON.stringify(DB.fichas[0]._sucVista));
  t('e baixa de novo na hora, para a tela mostrar a que vale', rebaixou >= 1, rebaixou);
  t('não insiste: a linha deixa de contar como "não enviada"', w.temMudancaNaoEnviada('fichas', DB.fichas[0], 0) === false);
  w.__resposta = null; w.baixarDaNuvem = baixarReal;
  t('a comparação "a nuvem aceitou?" ignora o recibo', /k==='sucursais_vista'/.test(String(w.linhaAceitaPelaNuvem)));

  grupo('4. Esconder de uma loja só com o aviso e o "sim"');
  const doc = w.document;
  w.sucAtivas = () => [{ id: 'suc_m', nome: 'Matriz', matriz: true }, { id: 'suc_sf', nome: 'Santa Fé' }, { id: 'suc_ja', nome: 'Jales' }];
  w.ehSucMatriz = (id) => id === 'suc_m';
  w.telaLiberacao = () => {}; w.salvar = () => {}; w.sincronizar = async () => {};
  w.eval("LB.col='insumos';");
  const item = { id: 'in_x', nome: 'Pistache', sucursais: ['suc_sf'] };
  async function salvarComo(modo, resposta) {
    w.abrirEscolhaUnidades([item], 'Pistache');
    w.lbModoTroca(modo);
    const ok = doc.getElementById('mdOk');
    const p = ok.onclick();
    await espera(30);
    const cf = doc.getElementById('cfOv');
    const txt = cf ? cf.textContent : '';
    if (cf && resposta !== undefined) cf.querySelector('[data-cf="' + (resposta ? 1 : 0) + '"]').click();
    await p; await espera(30);
    w.fecharModal();
    return { perguntou: !!cf, txt };
  }
  let r = await salvarComo('matriz', false);
  t('"Só a matriz" num item que Santa Fé vê: pergunta antes', r.perguntou);
  t('o aviso diz qual loja e quantos itens', /Santa Fé/.test(r.txt) && /1 item\(ns\) deixam de aparecer/.test(r.txt), r.txt);
  t('"Voltar": nada muda', JSON.stringify(item.sucursais) === '["suc_sf"]', JSON.stringify(item.sucursais));
  r = await salvarComo('matriz', true);
  t('"Esconder": grava', JSON.stringify(item.sucursais) === '[]', JSON.stringify(item.sucursais));
  r = await salvarComo('todas');
  t('ampliar (todas as lojas) não pergunta nada', !r.perguntou && JSON.stringify(item.sucursais) === '["*"]', JSON.stringify(item.sucursais));
  const ab = String(w.abrirEscolhaUnidades);
  t('a pergunta mora na janela de quem enxerga, com o tipo "perigo"', /tipo:'perigo'/.test(ab) && /liberadoNa\(x,s\.id\)&&!liberadoNa\(\{sucursais:novo\},s\.id\)/.test(ab));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A liberação da loja não se desconfigura sozinha');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

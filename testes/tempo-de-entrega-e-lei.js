/* ==========================================================
   O TEMPO DE ENTREGA DIGITADO NO PDV É LEI (05/10/2026)

   Rodar:  node testes/tempo-de-entrega-e-lei.js
   ou:     npm run test:tempolei   (entra na bateria e no portão)

   Rafael: "Quando a gente muda o tempo de entrega manual, ele tem que
   mudar no cardápio e quando o cliente pergunta. Uma vez digitado, ele
   não muda mais. Está voltando automático e zerando."

   Prende:
     1. o campo do PDV mostra o tempo DA UNIDADE (o do cardápio dela), e
        não o da empresa, que é um só para a rede inteira;
     2. digitar grava no cardápio da unidade, só o campo digitado, com o
        carimbo da hora, e manda para a nuvem com o carimbo;
     3. vazio ou zero não é aceito: o campo volta ao tempo salvo;
     4. "salvo" só depois que a nuvem devolveu o tempo novo;
     5. o carimbo sobe e desce com o cardápio; a tela de configuração do
        cardápio também carimba quando o tempo muda;
     6. no banco, sem carimbo mais novo o tempo não troca, e vazio não
        apaga.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { corpoDaFuncao } = require('./extrair.js');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261005_tempo_digitado_e_lei.sql');
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
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const src = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
    }
  });
  await esp(900);
  const w = dom.window, doc = w.document, $ = id => doc.getElementById(id);
  if (!$('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  let avisos = [], painel = [];
  w.toast = m => avisos.push(String(m));
  w.painelErro = (m, d) => painel.push(m + ' | ' + d);
  w.salvar = () => {};
  w.lojaAtualId = () => 'suc_sf';
  w.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true }, { id: 'suc_jl', nome: 'Jales', ativa: true }];
  w.DB.cardapio = { suc_sf: { ativo: true, tempoEntrega: '50 min', tempoRetirada: '20 min' },
    suc_jl: { ativo: true, tempoEntrega: '40 a 60 min', tempoRetirada: '15 min' } };
  /* a empresa (rede inteira) com o tempo de outra loja: é o que fazia voltar */
  Object.assign(w.cfg(), { tempoEntrega: 30, tempoRetirada: 10 });
  w.DB.caixas = [];
  w.DB.categorias = [{ id: 'c1', nome: 'Gelatos', ativo: true }];

  grupo('1. O campo mostra o tempo da unidade');
  w.PDV.aba = 'venda'; w.telaPDV();
  t('Entrega mostra 50 (Santa Fé), não 30 (o da rede)', $('tEnt').value === '50', $('tEnt').value);
  t('Retirada mostra 20', $('tRet').value === '20', $('tRet').value);
  t('"40 a 60 min" vira 40 no campo', w.minutosDoTempo('40 a 60 min') === 40);

  grupo('2. Digitar grava na unidade, com carimbo, e confere na nuvem');
  let chamada = null;
  w.NUVEM.ligada = true;
  w.sucursalNaNuvem = () => '11111111-1111-1111-1111-111111111111';
  w.lojaLigada = () => true;
  w.api = async (cam, met, corpo, extra) => { chamada = { cam, met, corpo, extra };
    return [{ tempo_entrega: corpo.tempo_entrega, tempo_retirada: corpo.tempo_retirada }]; };
  avisos = [];
  $('tEnt').value = '45'; await w.mudarTempoPDV('entrega', $('tEnt')); await esp(10);
  const cd = w.DB.cardapio.suc_sf;
  t('o cardápio da unidade passou a 45 min', cd.tempoEntrega === '45 min');
  t('a retirada não foi tocada', cd.tempoRetirada === '20 min');
  t('o cardápio de Jales não foi tocado', w.DB.cardapio.suc_jl.tempoEntrega === '40 a 60 min');
  t('a hora da digitação ficou carimbada', !!cd.temposEm && !isNaN(Date.parse(cd.temposEm)));
  t('a nuvem recebe o tempo e o carimbo', chamada && chamada.met === 'PATCH' && chamada.corpo.tempo_entrega === '45 min' &&
    chamada.corpo.tempos_em === cd.temposEm && chamada.extra && chamada.extra.Prefer === 'return=representation');
  t('"salvo" só depois que a nuvem devolveu o 45', /Entrega: 45 min — salvo e valendo no cardápio e no WhatsApp/.test(avisos.join('|')));
  w.api = async () => [{ tempo_entrega: '50 min', tempo_retirada: '20 min' }];
  painel = []; avisos = [];
  $('tEnt').value = '35'; await w.mudarTempoPDV('entrega', $('tEnt')); await esp(10);
  t('se a nuvem não ficou com o novo, avisa em vez de dizer "salvo"', painel.length === 1 && !/salvo e valendo/.test(avisos.join('|')));

  grupo('3. Vazio ou zero não é aceito');
  let chamou = false; w.api = async () => { chamou = true; return []; };
  cd.tempoEntrega = '45 min';
  $('tEnt').value = ''; avisos = []; await w.mudarTempoPDV('entrega', $('tEnt'));
  t('vazio: não grava e o campo volta para 45', !chamou && cd.tempoEntrega === '45 min' && $('tEnt').value === '45' &&
    /não pode ficar vazio nem zero/.test(avisos.join('|')));
  $('tEnt').value = '0'; await w.mudarTempoPDV('entrega', $('tEnt'));
  t('zero: idem', !chamou && cd.tempoEntrega === '45 min');

  grupo('4. Ligar/desligar a loja não mexe no tempo');
  chamada = null; w.api = async (cam, met, corpo) => { chamada = { corpo }; return [{}]; };
  await w.aplicarTempos();
  t('o interruptor manda só o ativo', chamada && !('tempo_entrega' in chamada.corpo) && !('tempos_em' in chamada.corpo));

  grupo('5. O carimbo sobe e desce');
  const EC = w.eval('MAPA').find(e => e.col === 'cardapioL');
  t('sobe com o cardápio', EC.campos(Object.assign({ sucId: 'suc_sf' }, cd)).tempos_em === cd.temposEm);
  t('e desce nas duas descidas do cardápio', (src.match(/temposEm:x\.tempos_em\|\|''/g) || []).length === 2);
  t('a tela do cardápio também carimba quando o tempo muda',
    /c\.temposEm=new Date\(\)\.toISOString\(\);   \/\* digitado: vale \*\//.test(corpoDaFuncao('salvarCardapio', src)));

  grupo('6. No banco');
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('sem carimbo mais novo, o tempo não troca', /if new\.tempos_em is null\s+or \(old\.tempos_em is not null and new\.tempos_em <= old\.tempos_em\) then/.test(sql) &&
    /new\.tempo_entrega := old\.tempo_entrega;/.test(sql));
  t('vazio nunca apaga', /coalesce\(new\.tempo_entrega, ''\) = '' and coalesce\(old\.tempo_entrega, ''\) <> ''/.test(sql));
  t('a trava está ligada antes de gravar', /create trigger ab_tempo_digitado_e_lei before update on public\.cardapio_config/.test(sql));

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

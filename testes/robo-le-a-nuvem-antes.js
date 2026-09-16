/* ==========================================================
   JOIA — A TELA DO ROBÔ LÊ A NUVEM ANTES DE MOSTRAR E DE SALVAR

   Rodar:  node testes/robo-le-a-nuvem-antes.js
   ou:     npm run test:robole   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Santa Fé, 15/09/2026 21:50)
   A configuração do robô (nome, saudação, regras) vivia só na nuvem e o
   aparelho nunca a baixava. Abrir a tela num aparelho sem ela mostrava a
   cópia local vazia ("Nina") e a troca de aba salvava isso por cima da
   nuvem: a Carla virou Nina, sem regras, e o cliente recebeu "Aqui é a
   Nina". Agora a tela só aparece depois de trazer a nuvem, e o salvar só
   sobe o que passou por essa leitura.
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
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}
const espera = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  console.log('\nCarregando o sistema para o guardião do robô que lê a nuvem…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.salvar = () => {}; win.logNuvem = () => {};
  win.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true }];
  win.DB.lojaAtual = 'suc_sf'; win.lojaAtualId = () => 'suc_sf'; win.lojaAtual = () => 'suc_sf';
  win.podeTrocarUnidade = () => false;
  win.DB.zap = {}; win.DB.cardapio = { suc_sf: { ativo: true } };
  win.NUVEM.ligada = true; win.NUVEM.loja = 'l1'; win.NUVEM.plataforma = false;
  win.ZP.suc = 'suc_sf';
  const carla = { id: 'x1', ref_local: 'wz_suc_sf', sucursal_id: 'suc_sf', robo_ativo: true, ia_nome: 'Carla', ia_tom: 'acolhedor',
    ia_regras: 'Somos uma gelateria artesanal em Santa Fé do Sul.', ia_apresenta: true, ia_ativa: true,
    saudacao: 'Olá! Aqui é a Carla, da Jolô Gelato SFS.', respostas: [{ chaves: 'franquia', resposta: 'Fale com o Ricardo.' }],
    msg_aceito: 'Olá {nome}!', msg_preparo: 'preparando', msg_saiu: 'saiu', msg_entregue: 'entregue', pede_avaliacao: true };
  const nina = { id: 'x2', ref_local: 'wz_suc_sf', sucursal_id: 'uuid-x', robo_ativo: true, ia_nome: 'Nina', saudacao: null, ia_regras: null, respostas: [] };
  let naNuvem = [nina, carla];
  const gets = [];
  win.api = async (caminho, metodo) => { if (!metodo || metodo === 'GET') { gets.push(caminho); return naNuvem; } return [{}]; };
  const gravados = [];
  const gravarCfgZapReal = win.gravarCfgZap;   /* a de verdade, antes do dublê */
  win.gravarCfgZap = async (suc, campos) => { gravados.push({ suc, campos }); return true; };
  win.lojaConectada = async () => null; win.linkCardapio = () => 'https://joiagest.com.br/santafedosul';

  grupo('As peças existem');
  ['baixarCfgZap', 'cfgZapDaNuvem', 'telaZap', 'salvarZap'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  grupo('Abrir a tela traz a nuvem primeiro: a Carla aparece, não a Nina de fábrica');
  win.telaZap();
  t('enquanto busca, a tela diz que está trazendo a nuvem', /Trazendo a configuração da nuvem/.test(doc.getElementById('content').innerHTML));
  await espera(80);
  t('consultou a nuvem pela unidade', gets.some(g => /whatsapp_config\?ref_local=eq\.wz_suc_sf/.test(g)), gets.join(' | '));
  t('a cópia local passou a ser a Carla (a linha mais completa venceu a repetida)', win.DB.zap.suc_sf.iaNome === 'Carla' && /Aqui é a Carla/.test(win.DB.zap.suc_sf.saudacao), JSON.stringify(win.DB.zap.suc_sf).slice(0, 120));
  t('regras e respostas prontas vieram junto', /gelateria/.test(win.DB.zap.suc_sf.iaRegras) && win.DB.zap.suc_sf.respostas.length === 1);
  t('as mensagens de fase e a avaliação vieram', win.DB.zap.suc_sf.msgAceito === 'Olá {nome}!' && win.DB.zap.suc_sf.avisosAtivos === true && win.DB.zap.suc_sf.pedeAvaliacao === true);
  t('a tela foi montada de verdade (botão Salvar)', /salvarZap\(\)/.test(doc.getElementById('content').innerHTML));

  grupo('Salvar sobe a Carla, nunca a Nina');
  await win.salvarZap(true);
  const ult = gravados[gravados.length - 1];
  t('subiu ia_nome = Carla', !!ult && ult.campos.ia_nome === 'Carla', ult && JSON.stringify(ult.campos).slice(0, 100));
  t('subiu a saudação e as regras', !!ult && /Carla/.test(ult.campos.saudacao) && /gelateria/.test(ult.campos.ia_regras));

  grupo('Sem ter lido a nuvem, o salvar recusa (não sobe cópia local)');
  win.ZP._baixou = {}; gravados.length = 0; toasts.length = 0;
  await win.salvarZap();
  t('nada foi gravado na nuvem', gravados.length === 0);
  t('avisa que ainda está trazendo', toasts.some(x => /trazendo a configuração/i.test(x)), toasts.join(' | '));

  grupo('Mapeamento: mensagens de fase todas vazias = avisos desligados');
  const c2 = win.cfgZapDaNuvem({ robo_ativo: false, ia_nome: 'Bia', msg_aceito: null, msg_preparo: null, msg_saiu: null, msg_entregue: null, pede_avaliacao: false });
  t('robô desligado, nome Bia, avisos desligados', c2.ativo === false && c2.iaNome === 'Bia' && c2.avisosAtivos === false);
  t('sem linha na nuvem: baixarCfgZap devolve false e não inventa', (async () => { naNuvem = []; const r = await win.baixarCfgZap('suc_sf'); naNuvem = [nina, carla]; return r === false; })() instanceof Promise);
  naNuvem = []; t('…confirmado', (await win.baixarCfgZap('suc_sf')) === false); naNuvem = [nina, carla];

  grupo('gravarCfgZap nunca cria uma segunda linha para a mesma unidade');
  const chamadas = [];
  win.api = async (caminho, metodo, corpo) => { chamadas.push({ caminho, metodo, corpo }); return (metodo === 'PATCH') ? [] : [{}]; };
  win.sucursalNaNuvem = () => 'f0de0748-0000-0000-0000-000000000001';
  await gravarCfgZapReal('suc_sf', { robo_ativo: true });
  const patches = chamadas.filter(c => c.metodo === 'PATCH').map(c => c.caminho);
  const posts = chamadas.filter(c => c.metodo === 'POST');
  t('procura pela referência e depois pelo uuid, nunca pela referência como sucursal_id',
    patches.some(p => /ref_local=eq\.wz_suc_sf/.test(p)) && patches.some(p => /sucursal_id=eq\.f0de0748-0000/.test(p)) && !patches.some(p => /sucursal_id=eq\.suc_sf/.test(p)), patches.join(' | '));
  t('cria a linha com o uuid da unidade e a referência wz_', posts.length === 1 && posts[0].corpo[0].sucursal_id === 'f0de0748-0000-0000-0000-000000000001' && posts[0].corpo[0].ref_local === 'wz_suc_sf', JSON.stringify(posts[0] && posts[0].corpo));

  grupo('A religada da nuvem também traz a configuração (mensagens de fase usam a cópia local)');
  const html = fs.readFileSync(ARQ, 'utf8');
  const religar = html.slice(html.indexOf('async function religarNuvem('), html.indexOf('async function religarNuvem(') + 6000);
  t('religarNuvem chama baixarCfgZap', /baixarCfgZap\(lojaAtualId\(\)\)/.test(religar));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A tela do robô lê a nuvem antes');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

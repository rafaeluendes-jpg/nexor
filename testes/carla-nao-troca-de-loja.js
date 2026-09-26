/* ==========================================================
   JOIA — A CARLA DE UMA LOJA NUNCA FALA PELA OUTRA

   Rodar:  node testes/carla-nao-troca-de-loja.js
   ou:     npm test   (entra na bateria e no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 26/09/2026)
   "Uma loja aberta, igual o Jolô Santa Fé está fazendo venda, e falar
   Jolô Alphaville. Quantas vezes a gente vai bater nessa tecla de não
   misturar a loja?"

   O cliente escreveu para o WhatsApp de Santa Fé do Sul e recebeu "Oi!
   Aqui é a Carla, da Jolo Alphaville" — com o link do cardápio de Santa
   Fé logo abaixo. Conferido no banco: a configuração do robô de Santa Fé
   estava gravada com `nome_loja = 'Jolo Alphaville'`.

   Quem gravou isso foi esta tela. Ao salvar, ela mandava a configuração
   para DUAS unidades — a da tela e a que estivesse conectada no robô — e
   carimbava as duas com o nome da unidade da TELA. Quem salvou a partir
   de Alphaville escreveu Alphaville dentro de Santa Fé.

   Este guardião prende as quatro portas por onde uma loja virava outra:

     1. salvar grava SÓ na unidade da tela;
     2. o nome que sobe é o da própria unidade, nunca o de outra;
     3. unidade sem configuração usa o padrão de fábrica, nunca a
        configuração da vizinha;
     4. a mensagem do cliente sai pela unidade DO PEDIDO — não existe
        mais escolher "a loja que está conectada".
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

(async function () {
  console.log('\nCarregando o sistema para o guardião da loja que não se mistura…');
  const vc = new VirtualConsole();
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window, doc = win.document;
  if (!doc.getElementById('content')) {
    const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d);
  }
  win.salvar = () => {};
  win.toast = () => {};

  /* duas unidades de verdade da rede, com os nomes que o Rafael vê */
  win.DB.sucursais = [
    { id: 'suc_alpha', nome: 'Jolo Alphaville', ativa: true, matriz: true },
    { id: 'suc_sf', nome: 'Jolo Santa Fe do Sul', ativa: true }
  ];
  win.DB.cardapio = {
    suc_alpha: {},                                  /* sem título próprio */
    suc_sf: { titulo: 'Jolô Gelato SFS' }           /* o nome público dela */
  };
  win.lojaAtualId = () => 'suc_sf';
  win.NUVEM.ligada = true; win.NUVEM.loja = 'loja-1';
  win.NUVEM.url = 'https://x.supabase.co'; win.NUVEM.chave = 'k'; win.NUVEM.token = 't';

  /* ---------- 1 e 2. o salvar da tela ---------- */
  grupo('Salvar a configuração do robô estando em Alphaville');

  /* o banco de mentira: guarda tudo o que a tela mandou */
  const gravou = [];
  win.api = async function (caminho, metodo, corpo) {
    if (String(caminho).indexOf('whatsapp_config') === 0) {
      gravou.push({ caminho: String(caminho), metodo: metodo || 'GET', corpo: corpo });
      if (metodo === 'PATCH') return [{ id: 'linha' }];       /* a linha existe */
      return [];
    }
    return [];
  };
  /* o robô de mentira diz que quem está conectada é SANTA FÉ — era esta
     resposta que a tela usava para gravar na loja errada */
  const pedidosAoRobo = [];
  win.zapApi = async function (caminho, metodo, corpo) {
    pedidosAoRobo.push({ caminho: String(caminho), corpo: corpo });
    if (String(caminho).indexOf('/diagnostico') === 0)
      return { ok: true, sessoes: [{ loja: 'suc_sf', estado: 'conectado' }] };
    return { ok: true, para: '5517999999999' };
  };

  win.baseZap();
  win.ZP = win.ZP || {};
  win.ZP.suc = 'suc_alpha';                       /* a tela está em Alphaville */
  win.ZP._baixou = { suc_alpha: true, suc_sf: true };
  await win.salvarZap(true);

  const alvos = gravou.map(g => g.caminho);
  const paraSF = alvos.filter(c => c.indexOf('wz_suc_sf') >= 0 || c.indexOf('suc_sf') >= 0);
  t('gravou a configuração de Alphaville', alvos.some(c => c.indexOf('suc_alpha') >= 0), alvos.join(' | '));
  t('NÃO gravou nada na unidade de Santa Fé', paraSF.length === 0, paraSF.join(' | '));

  const corpos = gravou.filter(g => g.corpo).map(g => g.corpo);
  const nomes = corpos.map(c => (Array.isArray(c) ? c[0] : c)).map(c => c && c.nome_loja).filter(Boolean);
  t('o nome que subiu é o da unidade da tela', nomes.every(n => n === 'Jolo Alphaville'), nomes.join(' | '));
  t('nenhum nome de outra loja subiu junto',
    !nomes.some(n => /santa\s*fe|sfs/i.test(String(n))), nomes.join(' | '));

  /* ---------- 2. de onde sai o nome público ---------- */
  grupo('O nome público de cada unidade');
  t('Santa Fé usa o título do cardápio DELA',
    win.nomePublicoDaUnidade('suc_sf') === 'Jolô Gelato SFS', win.nomePublicoDaUnidade('suc_sf'));
  t('sem título próprio, vale o nome cadastrado DELA',
    win.nomePublicoDaUnidade('suc_alpha') === 'Jolo Alphaville', win.nomePublicoDaUnidade('suc_alpha'));
  t('o título de uma nunca vaza para a outra',
    win.nomePublicoDaUnidade('suc_alpha') !== win.nomePublicoDaUnidade('suc_sf'));

  /* ---------- 3. configuração de uma não serve para a outra ---------- */
  grupo('Unidade sem configuração própria');
  win.DB.zap = {
    suc_alpha: { ativo: true, iaNome: 'Carla', saudacao: 'Oi! Aqui é a Carla, da Jolo Alphaville' }
  };
  const cSemDela = win.cfgZapDe('suc_jales');      /* unidade que não tem linha */
  t('não devolve a configuração da vizinha',
    !cSemDela || !/alphaville/i.test(String(cSemDela.saudacao || '')), JSON.stringify(cSemDela && cSemDela.saudacao));
  t('devolve o padrão de fábrica, que funciona',
    !!(cSemDela && cSemDela.msgAceito && cSemDela.ativo !== false));
  t('a unidade que TEM configuração continua com a dela',
    /alphaville/i.test(String((win.cfgZapDe('suc_alpha') || {}).saudacao || '')));

  /* ---------- 4. por onde sai a mensagem do cliente ---------- */
  grupo('A mensagem do cliente sai pelo WhatsApp da loja dele');
  win.DB.clientes = [{ id: 'cli1', nome: 'Ana', tel: '17998887777' }];
  win.DB.zap = {
    suc_alpha: { ativo: true, msgPreparo: 'preparando' },
    suc_sf: { ativo: true, msgPreparo: 'preparando' }
  };
  pedidosAoRobo.length = 0;
  const ped = { id: 'p1', numero: 77, clienteId: 'cli1', total: 30, tipo: 'entrega',
    sucursalId: 'suc_alpha', canal: 'cardapio', itens: [] };
  await win.avisarCliente(ped, 'preparo');
  const envios = pedidosAoRobo.filter(p => p.caminho.indexOf('/enviar') >= 0);
  t('mandou pela unidade do pedido', envios.length === 1 && envios[0].corpo.loja === 'suc_alpha',
    JSON.stringify(envios.map(e => e.corpo && e.corpo.loja)));
  t('não perguntou "quem está conectado" para escolher a loja',
    pedidosAoRobo.every(p => p.caminho.indexOf('/diagnostico') < 0));

  /* ---------- a porta velha não pode voltar ---------- */
  grupo('A escolha por "loja conectada" não existe mais');
  t('lojaConectada() foi removida do sistema', typeof win.lojaConectada === 'undefined');
  const fonte = fs.readFileSync(ARQ, 'utf8');
  t('nenhum envio escolhe a loja pelo diagnóstico do robô',
    !/await\s+lojaConectada\(\)/.test(fonte));

  console.log('\n──────────────────────────────');
  console.log(R.falhou ? `REPROVADO — ${R.falhou} de ${R.total}`
    : `TUDO CERTO — ${R.ok} de ${R.total}`);
  console.log('──────────────────────────────\n');
  process.exit(R.falhou ? 1 : 0);
})().catch(e => { console.error('ERRO NO GUARDIÃO:', e); process.exit(1); });

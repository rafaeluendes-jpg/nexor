/* ==========================================================
   JOIA — BANCO E TAXA CADASTRADOS SÓ SAEM QUANDO ALGUÉM APAGA
   NINGUÉM GRAVA POR CIMA DE UMA VERSÃO QUE NÃO VIU (29/09/2026)

   Rodar:  node testes/versao-vista-bancos-taxas.js
   ou:     npm run test:versaovista   (entra na bateria e no portão)

   Rafael: "Se eu cadastrar outro banco, ou outras taxas, isso não vai ser
   apagado nunca, até eu mesmo apagar manualmente?"

   A lei de fábrica (lei-fabrica-no-banco.js) só barrava a volta EXATA ao
   valor de fábrica. A auditoria de 29/09 achou caminhos em que um aparelho
   sobe a SUA cópia antiga de qualquer banco ou taxa por cima do que está
   salvo. A lei agora é de versão, e mora no banco
   (20260929_versao_vista.sql): cada aparelho diz qual versão viu por
   último; se a nuvem tem uma mais nova, a gravação é recusada.

   Este guardião prende:
     1. a lei está no banco (gatilho de UPDATE nas duas tabelas);
     2. o aparelho manda a versão que viu (versao_vista), e ela não entra
        na impressão da linha;
     3. gravação recusada: o aparelho não insiste e adota a nuvem;
        aceita: guarda a versão nova que a nuvem devolveu;
     4. vínculo não resolvido de OUTRA tabela não apaga a impressão das
        contas (era o que fazia subir a cópia velha em 29/09 16:47);
     5. alteração ainda não enviada não é declarada "enviada" pelo download;
     6. a nuvem sem conta de destino não é "religada" à conta antiga;
     7. dois bancos (ou duas formas) de mesmo nome não se fundem sozinhos;
     8. a janela da forma não apaga a conta que a unidade não enxerga, e o
        Salvar grava no registro vivo, conferindo na nuvem.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20260929_versao_vista.sql');
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
/* nuvem falsa: guarda cada POST; a resposta é o que o teste mandar */
function nuvemFalsa(w) {
  w.__posts = []; w.__resposta = null;
  w.eval(`
    api = async function(caminho, metodo, corpo){
      if(metodo==='POST' && Array.isArray(corpo)){
        window.__posts.push({tab:caminho.split('?')[0], linhas:JSON.parse(JSON.stringify(corpo))});
        return corpo.map(function(o,i){
          var r=window.__resposta?window.__resposta(caminho.split('?')[0],o):null;
          return r||Object.assign({id:_ids[o.ref_local]||((o.ref_local||('x'+i))+'-uuid'),alterado_em:'2026-09-29T20:00:00.000001+00:00'}, o);
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

(async function () {
  grupo('1. A lei está no banco');
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('a migration existe', !!sql);
  t('coluna versao_vista nas duas tabelas',
    /alter table public\.contas_capital\s+add column if not exists versao_vista timestamptz/.test(sql) &&
    /alter table public\.formas_pagamento add column if not exists versao_vista timestamptz/.test(sql));
  t('gatilho de UPDATE em contas_capital', /create trigger ab_versao_vista before update on public\.contas_capital/.test(sql));
  t('gatilho de UPDATE em formas_pagamento', /create trigger ab_versao_vista before update on public\.formas_pagamento/.test(sql));
  t('recusa quem não viu a versão atual e mantém a linha (return old)',
    /vista is null or vista < old\.alterado_em/.test(sql) && /return old;/.test(sql));
  t('o recibo não fica gravado (versao_vista := null)', /new\.versao_vista := null;/.test(sql));
  t('não é gatilho de INSERT (esvaziar no INSERT apagaria o recibo do upsert)', !/before insert/.test(sql));

  console.log('\nCarregando o sistema…');
  let w;
  try { w = await carregar(); } catch (e) { console.log('   FALHA não carregou: ' + e.message); process.exit(1); }
  const DB = w.DB;
  nuvemFalsa(w);

  grupo('2. O aparelho diz qual versão viu');
  const MAPA = w.eval('MAPA');
  const Ec = MAPA.find(e => e.col === 'contas'), Ef = MAPA.find(e => e.col === 'formasPag');
  t('contas e formas estão sob a lei de versão', !!(Ec && Ec.versao && Ef && Ef.versao));
  const T0 = '2026-09-29T16:00:00.123456+00:00';
  DB.contas = [{ id: 'ct_banco', nome: 'Itaú — conta corrente', tipo: 'Banco', banco: 'itau', agencia: '0614', numero: '339968',
    saldoInicial: 0, sucursais: [], _loja: L, _alt: T0 }];
  DB.formasPag = [{ id: 'fp_elo', nome: 'Crédito Elo', tipo: 'credito', bandeira: 'Elo', taxaPct: 2.5, taxaFixa: 0, dias: 1,
    contaId: 'ct_banco', ativa: true, online: false, ordem: 5, sucursais: ['*'], _loja: L, _alt: T0 }];
  DB._uuid = { contas: { ct_banco: 'u-ct' }, formasPag: { fp_elo: 'u-fp' } };
  DB._hash = {}; ids(w); w.anotarImpressoes();
  const h0 = DB._hash.contas.ct_banco;
  DB.contas[0]._alt = '2026-09-29T17:00:00+00:00';
  t('a versão vista não entra na impressão da linha (trocar a versão não é "alteração")',
    w.impressaoDaLinha(Ec, DB.contas[0], 0) === h0);
  DB.contas[0]._alt = T0;
  DB.contas[0].agencia = '0615';                 /* o dono corrige a agência */
  w.NUVEM.sujo = true; DB._sujo = true;
  await w.sincronizar();
  const pc = w.__posts.filter(p => p.tab === 'contas_capital');
  t('a alteração sobe com versao_vista = a versão que desceu', pc.length === 1 && pc[0].linhas[0].versao_vista === T0,
    JSON.stringify(pc.map(p => p.linhas)));
  t('aceita: o aparelho guarda a versão nova que a nuvem devolveu', DB.contas[0]._alt === '2026-09-29T20:00:00.000001+00:00', DB.contas[0]._alt);

  grupo('3. Recusada: o aparelho não insiste e adota a nuvem');
  w.__posts.length = 0;
  DB.formasPag[0].taxaPct = 3.1; DB.formasPag[0].dias = 30;   /* cópia velha deste aparelho */
  const NUV = { id: 'u-fp', ref_local: 'fp_elo', nome: 'Crédito Elo', tipo: 'credito', bandeira: 'Elo', taxa_pct: 2.5, taxa_fixa: 0,
    dias_recebimento: 1, conta_id: 'u-ct', ativa: true, online: false, ordem: 5, sucursais: ['*'], alterado_em: '2026-09-29T18:00:00+00:00' };
  w.__resposta = (tab, o) => tab === 'formas_pagamento' ? Object.assign({}, NUV) : null;
  let rebaixou = 0; const baixarReal = w.baixarDaNuvem; w.baixarDaNuvem = async () => { rebaixou++; return true; };
  w.NUVEM.sujo = true; DB._sujo = true;
  await w.sincronizar();
  await new Promise(r => setTimeout(r, 700));
  t('subiu uma vez com a versão antiga', w.__posts.filter(p => p.tab === 'formas_pagamento').length === 1);
  t('a versão guardada NÃO avança (continua a antiga)', DB.formasPag[0]._alt === T0, DB.formasPag[0]._alt);
  t('a linha deixa de contar como "não enviada" — o próximo download adota a nuvem',
    w.temMudancaNaoEnviada('formasPag', DB.formasPag[0], 0) === false);
  t('e esse download é pedido na hora', rebaixou >= 1, rebaixou);
  w.__posts.length = 0; w.NUVEM.sujo = true; DB._sujo = true;
  await w.sincronizar();
  t('não insiste: o envio seguinte não sobe a cópia velha de novo', w.__posts.filter(p => p.tab === 'formas_pagamento').length === 0);
  w.__resposta = null; w.baixarDaNuvem = baixarReal;

  grupo('4. Vínculo perdido de OUTRA tabela não apaga a impressão das contas (29/09 16:47)');
  w.__posts.length = 0;
  DB.fichaCats = [{ id: 'fc_prod', nome: 'Produzido', destinoId: 'ef21f7aa-f297-4bf3-b270-e9dc68afde40', sucursais: [], _loja: L }];
  DB._uuid.fichaCats = { fc_prod: 'u-fc' }; ids(w);
  w.anotarImpressoes();
  for (let k = 0; k < 2; k++) { w.NUVEM.sujo = true; DB._sujo = true; await w.sincronizar(); }
  t('dois envios sem mudança: nenhuma conta sobe', w.__posts.filter(p => p.tab === 'contas_capital').length === 0,
    JSON.stringify(w.__posts.filter(p => p.tab === 'contas_capital')));
  t('nenhuma forma sobe', w.__posts.filter(p => p.tab === 'formas_pagamento').length === 0);
  t('a impressão das contas continua guardada', !!(DB._hash.contas && DB._hash.contas.ct_banco));

  grupo('5. Alteração ainda não enviada não é declarada "enviada" pelo download');
  const html = fs.readFileSync(ARQ, 'utf8');
  t('o download marca a linha que manteve por ter alteração não enviada',
    /if\(temMudancaNaoEnviada\(col,x,i\)\)\{ meus\[x\.id\]=x; x\._manteveLocal=true; return; \}/.test(html));
  t('e, no fim do download, agenda o envio dela em vez de cancelá-lo',
    /_pendentesMantidos>0\)\{\s*NUVEM\.sujo=true; DB\._sujo=true;[\s\S]{0,260}agendarSync\(\);/.test(html));
  DB.formasPag = [{ id: 'fp_elo', nome: 'Crédito Elo', tipo: 'credito', bandeira: 'Elo', taxaPct: 2.5, taxaFixa: 0, dias: 1,
    contaId: 'ct_banco', ativa: true, online: false, ordem: 5, sucursais: ['*'], _loja: L, _alt: NUV.alterado_em }];
  w.anotarImpressoes();
  DB.formasPag[0].taxaPct = 2.2;                 /* o dono salvou 2,20% — o envio ainda não saiu */
  DB.formasPag[0]._manteveLocal = true;          /* o download chegou antes e manteve a linha */
  w.anotarImpressoes();
  t('e depois do download a alteração continua "não enviada"', w.temMudancaNaoEnviada('formasPag', DB.formasPag[0], 0) === true);
  w.__posts.length = 0; w.NUVEM.sujo = true; DB._sujo = true;
  await w.sincronizar();
  const f5 = w.__posts.filter(p => p.tab === 'formas_pagamento');
  t('o envio seguinte sobe os 2,20%', f5.length === 1 && f5[0].linhas[0].taxa_pct === 2.2, JSON.stringify(f5.map(p => p.linhas)));

  grupo('6. A nuvem sem conta de destino não é "religada" à conta antiga');
  const fonteDown = String(w._baixarDaNuvem);
  t('a rede de proteção 3 não religa a conta das formas quando a nuvem leu as contas',
    /formasPag/.test(fonteDown) && /contaId/.test(fonteDown) && /contas_capital/.test(fonteDown) &&
    /k==='formasPag'&&c==='contaId'/.test(fonteDown));

  grupo('7. Dois bancos (ou duas formas) de mesmo nome não se fundem sozinhos');
  w.__posts.length = 0;
  DB.contas = [
    { id: 'ct_banco', nome: 'Itaú', tipo: 'Banco', banco: 'itau', agencia: '0614', numero: '1', sucursais: [], _loja: L, _alt: T0 },
    { id: 'ct_itau2', nome: 'Itaú', tipo: 'Banco', banco: 'itau', agencia: '0700', numero: '2', sucursais: [], _loja: L }];
  DB.formasPag = [{ id: 'fp_elo', nome: 'Crédito Elo', tipo: 'credito', taxaPct: 2.5, dias: 1, contaId: 'ct_itau2', ativa: true,
    sucursais: ['*'], _loja: L, _alt: T0 }];
  w.NUVEM.sujo = true; DB._sujo = true;
  await w.sincronizar();
  t('os dois "Itaú" continuam', DB.contas.length === 2, JSON.stringify(DB.contas.map(c => c.id)));
  t('a forma continua ligada ao segundo Itaú', DB.formasPag[0].contaId === 'ct_itau2', DB.formasPag[0].contaId);

  grupo('8. Janela da forma: não apaga a conta que a unidade não vê, e grava no registro vivo');
  DB.contas = [{ id: 'ct_caixa', nome: 'Caixa da loja', tipo: 'Caixa', fixa: 'caixa', sucursais: ['*'], _loja: L }];
  DB.formasPag = [{ id: 'fp_elo', nome: 'Crédito Elo', tipo: 'credito', bandeira: 'Elo', taxaPct: 2.5, taxaFixa: 0, dias: 1,
    contaId: 'ct_banco', ativa: true, online: false, ordem: 5, sucursais: ['*'], _loja: L, _alt: T0 }];
  const doc = w.document;
  let conferiu = null; w.conferirConfigNaNuvem = async (col, id) => { conferiu = col + ':' + id; return true; };
  w.telaFormasPag = () => {}; w.syncFormas = () => {}; w.salvar = () => {};
  w.modalForma('fp_elo');
  const marcado = doc.querySelector('input[name=fpC]:checked');
  t('a conta de destino que esta unidade não enxerga continua marcada', !!marcado && marcado.value === 'ct_banco', marcado && marcado.value);
  /* chega um download com a janela aberta: DB.formasPag passa a ter OUTRO objeto */
  DB.formasPag = [Object.assign({}, DB.formasPag[0])];
  doc.getElementById('fpTx').value = '2.3';
  const ok = doc.getElementById('mdOk'); if (ok && ok.onclick) await ok.onclick();
  t('o Salvar grava no registro vivo (não no que ficou solto)', DB.formasPag[0].taxaPct === 2.3, DB.formasPag[0].taxaPct);
  t('a conta de destino não foi apagada', DB.formasPag[0].contaId === 'ct_banco', DB.formasPag[0].contaId);
  t('e o salvar confere na nuvem', conferiu === 'formasPag:fp_elo', conferiu);

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Banco e taxa só saem quando alguém apaga');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

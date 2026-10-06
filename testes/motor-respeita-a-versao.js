/* ==========================================================
   JOIA — O MOTOR RESPEITA A VERSÃO EM TODA TABELA (Missão integridade, 06/10/2026)

   Rodar:  node testes/motor-respeita-a-versao.js
   ou:     npm run test:motorversao   (entra na bateria e no portão)

   A outra metade da lei de versão: o banco julga (testes/lei-de-versao-
   em-todas.js), e o aparelho tem de apresentar o recibo, ouvir a recusa e
   não fazer estrago por conta própria. Este guardião roda o motor de
   verdade (o index.html, no jsdom) contra uma nuvem falsa e prende:

     1. TODA tabela do MAPA sobe com versao_vista (a versão que desceu) e
        versao_aparelho — sem lista de tabelas, sem condição;
     2. o download guarda a versão de cada linha e de cada filho, em toda
        tabela; e a alteração que ficou no aparelho só ganha o recibo se
        nasceu da versão que está na nuvem;
     3. recusa (a linha volta com versao_vista = alterado_em): o aparelho
        não avança a versão, não manda os filhos dela, anexa o que queria
        ao conflito e baixa a nuvem;
     4. aceita: guarda a versão nova, e os filhos sobem com o recibo deles;
     5. vínculo não resolvido não sobe nulo por cima do salvo, e campo que
        a linha não manda não vira nulo por causa da vizinha de lote;
     6. exclusão vai pelo banco com a versão vista (apagar_vistos); sem
        saber até quando viu, não apaga — e a ordem fica guardada;
     7. as rotinas que mudavam dado sozinhas pararam: a renumeração
        automática de códigos saiu; o espelho do saldo da unidade não gera
        envio; o login de loja não sobe o cadastro da rede;
     8. desfazer pela tela (pago, conciliado, lote…) sobe com o motivo —
        é o que o banco exige para deixar um estado de mão única voltar.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const L = '6001c62e-26f3-4d81-8b6c-fa367c14146c';
const T0 = '2026-10-06T05:00:00.123456+00:00';
const T1 = '2026-10-06T06:00:00.000001+00:00';
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
async function carregar() {
  const vc = new VirtualConsole();
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
/* nuvem falsa: guarda cada chamada; a resposta de cada POST é o que o teste mandar */
function nuvemFalsa(w) {
  w.__posts = []; w.__rpc = []; w.__resposta = null; w.__del = [];
  w.eval(`
    api = async function(caminho, metodo, corpo){
      var tab=caminho.split('?')[0];
      if(metodo==='POST' && /^rpc\\//.test(tab)){
        window.__rpc.push({fn:tab.slice(4), corpo:JSON.parse(JSON.stringify(corpo||{}))});
        if(tab==='rpc/apagar_vistos')return {apagados:(corpo.p_refs||[])};
        return 1;
      }
      if(metodo==='DELETE'){ window.__del.push(caminho); return []; }
      if(metodo==='POST' && Array.isArray(corpo)){
        window.__posts.push({tab:tab, caminho:caminho, linhas:JSON.parse(JSON.stringify(corpo))});
        return corpo.map(function(o,i){
          var r=window.__resposta?window.__resposta(tab,o):null;
          return r||Object.assign({id:_ids[o.ref_local]||((o.ref_local||('x'+i))+'-uuid'),alterado_em:'${T1}',versao_vista:null}, o, {versao_vista:null});
        });
      }
      return [];
    };
    apiPaginado = async function(){ return []; };
    tokenAtual = async function(){ return 'tk'; };
    tokenValido = async function(){ return 'tk'; };
    marcarVersaoAtual = async function(){};
    montarMapaVinculos = async function(){};
    backupDoDia = function(){}; sinalDoAparelho = function(){}; agendarSync = function(){};
  `);
  Object.assign(w.NUVEM, { ligada: true, cli: null, baixou: true, loja: L, plataforma: false });
}
function ids(w) {
  w.eval('_ids={}; Object.keys(DB._uuid||{}).forEach(function(c){Object.keys(DB._uuid[c]).forEach(function(r){_ids[r]=DB._uuid[c][r]})});');
}
async function enviar(w) { w.NUVEM.sujo = true; w.DB._sujo = true; await w.sincronizar(); }

(async function () {
  console.log('Carregando o sistema…');
  let w;
  try { w = await carregar(); } catch (e) { console.log('   FALHA não carregou: ' + e.message); process.exit(1); }
  const DB = w.DB;
  nuvemFalsa(w);
  const MAPA = w.eval('MAPA');
  const src = fs.readFileSync(ARQ, 'utf8');
  /* `volta` mora dentro do download: extrai a de verdade do index.html e roda
     no mesmo window (MAPA, DB, _ids, temMudancaNaoEnviada são os do sistema) */
  const { corpoDaFuncao } = require('./extrair.js');
  w.volta = w.eval('(function(){' + ['guardarIds', '_ANT', 'volta'].map(n => corpoDaFuncao(n, src)).join('\n') +
    '\nreturn volta;})()');

  grupo('1. Toda tabela do MAPA sobe com o recibo e o aparelho');
  t('o recibo vai sem condição de tabela', /\n\s*o\.versao_vista=x\._alt\|\|null;\s*\n\s*o\.versao_aparelho=idDoAparelho\(\);/.test(src)
    && !/if\(E2\.versao\)o\.versao_vista=/.test(src));
  /* uma linha em cada coleção do MAPA, com a versão T0 */
  DB._uuid = {}; DB._hash = {};
  MAPA.forEach(E => {
    if (E.col === 'cardapioL' || E.col === 'clientesNexor' || E.soGestor) return;
    const x = { id: 'r_' + E.col, nome: 'Linha ' + E.col, _loja: L, _alt: T0, sucursalId: 'suc_loja' };
    (E.filhos || []).forEach(F => { x[F.lista] = [{ id: 'f_' + E.col + '_' + F.lista, nome: 'filho', qtd: 1, valor: 1, _alt: T0 }]; });
    DB[E.col] = [x];
  });
  await enviar(w);
  const porTab = {};
  w.__posts.forEach(p => { (porTab[p.tab] = porTab[p.tab] || []).push(...p.linhas); });
  const pais = MAPA.filter(E => porTab[E.tab]).map(E => E.tab);
  t('as tabelas do MAPA subiram (pelo menos 40)', pais.length >= 40, pais.length);
  const semRecibo = pais.filter(tab => !porTab[tab].every(o => (o.ref_local || '').indexOf('r_') !== 0 ||
    (o.versao_vista === T0 && typeof o.versao_aparelho === 'string' && o.versao_aparelho.length > 4)));
  t('todas sobem com versao_vista = a versão que desceu e o aparelho', semRecibo.length === 0, semRecibo.join(', '));
  const filhosTabs = [].concat(...MAPA.map(E => (E.filhos || []).map(F => F.tab))).filter(tb => porTab[tb]);
  t('os filhos sobem com o recibo deles', filhosTabs.length > 3 &&
    filhosTabs.every(tb => porTab[tb].every(o => o.versao_vista === T0 && o.versao_aparelho)), filhosTabs.join(','));

  grupo('2. O download guarda a versão de cada linha e de cada filho');
  const Ef = MAPA.find(e => e.col === 'fichas');
  const crus = [{ id: 'u1', ref_local: 'fi_x', nome: 'X', alterado_em: T1,
    ficha_itens: [{ id: 'ui1', ref_local: 'it_1', quantidade: 2, alterado_em: '2026-10-06T06:30:00+00:00' }] }];
  const voltou = w.volta(crus, function (x) {
    return { id: x.ref_local, nome: x.nome, itens: (x.ficha_itens || []).map(i => ({ id: i.ref_local, qtd: Number(i.quantidade) })) };
  }, [], 'fichas');
  t('a linha guarda a versão que desceu (_alt)', voltou[0]._alt === T1, voltou[0]._alt);
  t('o filho também (casado pelo ref_local)', voltou[0].itens[0]._alt === '2026-10-06T06:30:00+00:00', voltou[0].itens[0]._alt);
  /* alteração pendente aqui, sem recibo: ganha a versão SÓ se a base é a da nuvem */
  DB.fichas = [{ id: 'fi_x', nome: 'X', itens: [], _loja: L }];
  DB._uuid.fichas = { fi_x: 'u1' }; DB._hash = DB._hash || {};
  DB._hash.fichas = { fi_x: w.impressaoDaLinha(Ef, { id: 'fi_x', nome: 'X', itens: [{ id: 'it_1', qtd: 2 }], _loja: L }, 0) };
  DB.fichas[0].nome = 'X editada';                     /* alterada aqui, ainda não enviada */
  const v2 = w.volta(crus, function (x) {
    return { id: x.ref_local, nome: x.nome, itens: (x.ficha_itens || []).map(i => ({ id: i.ref_local, qtd: Number(i.quantidade) })), _loja: L };
  }, DB.fichas, 'fichas');
  t('a alteração pendente fica no aparelho', v2[0].nome === 'X editada');
  t('…e ganha o recibo da nuvem, porque nasceu da versão que está lá', v2[0]._alt === T1, v2[0]._alt);
  DB.fichas = [{ id: 'fi_x', nome: 'X editada', itens: [], _loja: L }];
  DB._hash.fichas = { fi_x: 'impressao-de-outra-versao' };
  const v3 = w.volta(crus, function (x) { return { id: x.ref_local, nome: x.nome, itens: [], _loja: L }; }, DB.fichas, 'fichas');
  t('se a nuvem mudou desde a base, fica SEM recibo (a matriz decide)', v3[0]._alt == null, v3[0]._alt);

  grupo('3. Recusada: não avança, não manda os filhos, anexa o pedido ao conflito');
  w.__posts.length = 0; w.__rpc.length = 0;
  Object.keys(DB).forEach(k => { if (MAPA.some(E => E.col === k)) DB[k] = []; });
  DB._uuid = { fichas: { fi_r: 'u-fr' } }; DB._hash = {}; ids(w);
  DB.fichas = [{ id: 'fi_r', nome: 'Receita', _loja: L, _alt: T0, itens: [{ id: 'it_r1', insumoId: '', qtd: 3, _alt: T0 }] }];
  w.__resposta = (tab, o) => tab === 'fichas_tecnicas'
    ? Object.assign({}, o, { id: 'u-fr', nome: 'Receita da nuvem', alterado_em: T1, versao_vista: T1 }) : null;
  let rebaixou = 0; const baixarReal = w.baixarDaNuvem; w.baixarDaNuvem = async () => { rebaixou++; return true; };
  await enviar(w);
  await new Promise(r => setTimeout(r, 700));
  t('a versão guardada NÃO avança', DB.fichas[0]._alt === T0, DB.fichas[0]._alt);
  t('os ingredientes da ficha recusada NÃO sobem', !w.__posts.some(p => p.tab === 'ficha_itens'),
    JSON.stringify(w.__posts.map(p => p.tab)));
  const anexo = w.__rpc.find(r => r.fn === 'anexar_filhos_ao_conflito');
  t('o que o aparelho queria para os ingredientes vai junto do conflito',
    !!(anexo && anexo.corpo.p_ref_local === 'fi_r' && anexo.corpo.p_filhos && anexo.corpo.p_filhos.tabela === 'ficha_itens'
      && anexo.corpo.p_filhos.itens.length === 1), JSON.stringify(anexo && anexo.corpo));
  t('e baixa a nuvem na hora, para a tela mostrar o que vale', rebaixou >= 1, rebaixou);
  t('não insiste: a linha deixa de contar como "não enviada"', w.temMudancaNaoEnviada('fichas', DB.fichas[0], 0) === false);
  w.__resposta = null; w.baixarDaNuvem = baixarReal;

  grupo('4. Aceita: guarda a versão nova, e os filhos sobem com o recibo deles');
  w.__posts.length = 0;
  DB.fichas[0].nome = 'Receita nova'; DB.fichas[0].itens[0].qtd = 4;
  await enviar(w);
  t('a versão guardada avança para a da nuvem', DB.fichas[0]._alt === T1, DB.fichas[0]._alt);
  const pi = w.__posts.filter(p => p.tab === 'ficha_itens');
  t('o ingrediente sobe com o recibo dele', pi.length === 1 && pi[0].linhas[0].versao_vista === T0, JSON.stringify(pi.map(p => p.linhas)));
  t('…e guarda a versão nova que voltou', DB.fichas[0].itens[0]._alt === T1, DB.fichas[0].itens[0]._alt);

  grupo('5. Vínculo não resolvido não sobe vazio; campo omitido não vira nulo');
  w.__posts.length = 0;
  DB._uuid = { lancFin: {} }; ids(w); w.eval("_ids['cat_ok']='u-cat'; _ids['ct_ok']='u-ct';");
  DB.lancFin = [
    { id: 'lf_a', tipo: 'despesa', descricao: 'A', valor: 10, categoriaId: 'cat_sumiu', contaId: 'ct_ok', _loja: L, _alt: T0, _novoAqui: true },
    { id: 'lf_b', tipo: 'despesa', descricao: 'B', valor: 20, categoriaId: 'cat_ok', contaId: 'ct_ok', _loja: L, _alt: T0, _novoAqui: true,
      loteRef: 'lt_1', loteNum: '7' }];
  w.eval("montarMapaVinculos = async function(){ _ids['cat_ok']='u-cat'; _ids['ct_ok']='u-ct'; };");
  await enviar(w);
  const pl = [].concat(...w.__posts.filter(p => p.tab === 'lancamentos_financeiros').map(p => p.linhas));
  const la = pl.find(o => o.ref_local === 'lf_a'), lb = pl.find(o => o.ref_local === 'lf_b');
  t('a categoria não resolvida NÃO sobe (nem como nulo): o banco mantém a salva',
    !!la && !('subcategoria_id' in la), la && JSON.stringify(la.subcategoria_id));
  t('a resolvida sobe normalmente', !!lb && lb.subcategoria_id === 'u-cat', lb && lb.subcategoria_id);
  t('o lote da vizinha não vira lote nulo na linha que não está em lote', !!la && !('lote_ref' in la),
    la && JSON.stringify(la.lote_ref));
  t('linhas com campos diferentes sobem em lotes separados',
    w.__posts.filter(p => p.tab === 'lancamentos_financeiros').length === 2);
  t('fk() e fkSub() continuam devolvendo nulo para quem pergunta', w.fkSub('nao_existe') === null && w.fk('x', 'nao_existe') === null);

  grupo('6. Exclusão vai pelo banco, com a versão vista');
  w.__rpc.length = 0; w.__del.length = 0;
  DB.lancFin = []; DB._apagados = { lancFin: { lf_velho: true } };
  w.NUVEM._vistaTab = {};
  await enviar(w);
  t('sem saber até quando viu, não apaga', !w.__rpc.some(r => r.fn === 'apagar_vistos') && w.__del.length === 0);
  t('…e a ordem de apagar fica guardada', DB._apagados.lancFin && DB._apagados.lancFin.lf_velho === true);
  w.anotarVistaDaTabela('lancamentos_financeiros', [{ alterado_em: T0 }, { alterado_em: T1 }]);
  t('o download anota até quando viu cada tabela (a mais nova)', w.NUVEM._vistaTab.lancamentos_financeiros === T1);
  await enviar(w);
  const ap = w.__rpc.find(r => r.fn === 'apagar_vistos');
  t('a exclusão vai por apagar_vistos com a versão vista', !!(ap && ap.corpo.p_tabela === 'lancamentos_financeiros' &&
    ap.corpo.p_vista === T1 && ap.corpo.p_refs[0] === 'lf_velho'), JSON.stringify(ap && ap.corpo));
  t('nenhum DELETE direto', w.__del.length === 0, w.__del.join(' | '));
  t('a ordem foi entregue e sai da fila do aparelho', !DB._apagados.lancFin.lf_velho);
  t('o motor não tem mais DELETE direto (nem o corte dos ingredientes, nem o vínculo)',
    !/qDel='ficha_itens\?ficha_id=eq\./.test(src) && !/await apagar\(V\.tab,V\.pai,pid\)/.test(src));
  /* nenhuma tela apaga direto numa tabela da lei: a lista vem do MAPA */
  const { tabelasDoMapa } = require('../ferramentas/tabelas-do-mapa.js');
  const daLei = tabelasDoMapa(src).todas;
  const diretos = [];
  for (const m of src.matchAll(/api\(\s*'([a-z_]+)\?[^;]{0,400}?'DELETE'/g)) if (daLei.includes(m[1])) diretos.push(m[1]);
  t('nenhuma tela manda DELETE direto numa tabela do MAPA', diretos.length === 0, diretos.join(', '));

  /* a versão de cada linha: o que este aparelho mesmo gravou depois do download */
  w.__rpc.length = 0;
  const T2 = '2026-10-06T07:00:00.000001+00:00';
  w.NUVEM._vistaTab = { lancamentos_financeiros: T1 };
  w.lembrarVersao('lancFin', 'lf_meu', T2);
  DB._apagados = { lancFin: { lf_meu: true, lf_outro: true } };
  await enviar(w);
  const porVista = w.__rpc.filter(r => r.fn === 'apagar_vistos').map(r => r.corpo.p_vista + ':' + r.corpo.p_refs.join(','));
  t('a linha que este aparelho gravou depois do download apaga pela versão DELA (não é recusada à toa)',
    porVista.includes(T2 + ':lf_meu') && porVista.includes(T1 + ':lf_outro'), porVista.join(' | '));
  /* a exclusão pela tela: só tira daqui se a nuvem apagou */
  w.__rpc.length = 0;
  w.NUVEM._vistaTab = {}; w.NUVEM._altVisto = {};
  w.eval(`window.__apiAntes=api; window.__naNuvem=true; window.__rpcApaga=true;
    api=async function(c,m,corpo){
      if(!m&&/^insumos\\?/.test(c))return window.__naNuvem?[{id:'u-x'}]:[];
      if(m==='POST'&&c==='rpc/apagar_vistos'&&!window.__rpcApaga){window.__rpc.push({fn:'apagar_vistos',corpo:corpo});return {apagados:[]};}
      return window.__apiAntes(c,m,corpo);
    };`);
  t('pela tela, sem versão conhecida e a linha na nuvem: não apaga (adiada)',
    (await w.excluirNaNuvemComVersao('insumos', 'insumos', 'ins_1')) === 'adiada');
  w.NUVEM._vistaTab = { insumos: T1 };
  t('com a versão, a nuvem apaga: ok', (await w.excluirNaNuvemComVersao('insumos', 'insumos', 'ins_1')) === 'ok');
  w.__rpcApaga = false;
  t('a nuvem não apagou e a linha continua lá: recusada (a tela não tira daqui)',
    (await w.excluirNaNuvemComVersao('insumos', 'insumos', 'ins_1')) === 'recusada');
  w.__naNuvem = false;
  t('a linha nunca foi para a nuvem: ok (só sai daqui)', (await w.excluirNaNuvemComVersao('insumos', 'insumos', 'ins_1')) === 'ok');
  w.eval('api=window.__apiAntes');

  grupo('7. As rotinas que mudavam dado sozinhas pararam');
  t('a renumeração automática dos códigos saiu (renumerar só pelo botão)',
    !/\n\s*arrumarCodigos\(\);/.test(src) && /function pedirRenumerar\(\)/.test(src));
  w.usuarioLogado = () => ({ login: 'rafael@x', nome: 'Rafael', tudo: true, sucursais: [] });
  DB.insumos = [{ id: 'ins_1', nome: 'Leite', unidade: 'kg', estoqueAtual: 5, custo: 2, _loja: L, _alt: T0 }];
  DB._uuid = { insumos: { ins_1: 'u-i1' } }; DB._hash = {}; ids(w);
  w.anotarImpressoes();
  DB.estoqueUn = [{ id: w.chaveEst(w.lojaAtualId(), 'ins_1'), sucursalId: w.lojaAtualId(), itemId: 'ins_1', estoque: 99, custoMedio: 7.5, _loja: L }];
  w.espelharEstoque();
  t('o espelho mostra o saldo da unidade aberta', DB.insumos[0].estoqueAtual === 99 && DB.insumos[0].custo === 7.5,
    DB.insumos[0].estoqueAtual + '/' + DB.insumos[0].custo);
  t('…mas não vira "alteração não enviada" (não sobe para a rede)',
    w.temMudancaNaoEnviada('insumos', DB.insumos[0], 0) === false);
  DB.insumos[0].nome = 'Leite integral';                /* edição de verdade, pela matriz */
  t('edição de verdade continua contando', w.temMudancaNaoEnviada('insumos', DB.insumos[0], 0) === true);
  /* login de loja: o cadastro da rede não sobe */
  w.__posts.length = 0;
  DB.sucursais = [{ id: 'suc_loja', nome: 'Loja', matriz: false, _loja: L }, { id: 'suc_matriz', nome: 'Matriz', matriz: true, _loja: L }];
  w.usuarioLogado = () => ({ login: 'santafe@x', nome: 'Santa Fé', sucursais: ['suc_loja'] });
  DB.insumos[0].codigo = '129'; DB.insumos[0]._novoAqui = true;
  await enviar(w);
  t('login de loja não sobe insumo', !w.__posts.some(p => p.tab === 'insumos'), JSON.stringify(w.__posts.map(p => p.tab)));
  t('…e o que mudou aqui é descartado (o download traz o da matriz)',
    w.temMudancaNaoEnviada('insumos', DB.insumos[0], 0) === false && !DB.insumos[0]._novoAqui);
  w.__posts.length = 0;
  w.usuarioLogado = () => ({ login: 'rafael@x', nome: 'Rafael', tudo: true, sucursais: [] });
  DB.insumos[0].nome = 'Leite desnatado';
  await enviar(w);
  t('a matriz continua subindo o cadastro', w.__posts.some(p => p.tab === 'insumos'));
  w.usuarioLogado = () => null;
  w.__posts.length = 0;
  DB.insumos[0].nome = 'Leite semi';
  await enviar(w);
  t('sem usuário identificado, o motor segue como sempre (não corta a matriz por engano)', w.__posts.some(p => p.tab === 'insumos'));

  grupo('8. Desfazer pela tela leva o motivo (fase 3)');
  w.usuarioLogado = () => ({ login: 'rafael@x', nome: 'Rafael', tudo: true, sucursais: [] });
  w.__posts.length = 0;
  DB._uuid = { lancFin: { lf_d: 'u-lfd', lf_n: 'u-lfn' } }; DB._hash = {}; ids(w);
  DB.lancFin = [
    { id: 'lf_d', tipo: 'despesa', descricao: 'Desfeito', valor: 5, pago: true, _loja: L, _alt: T0 },
    { id: 'lf_n', tipo: 'despesa', descricao: 'Normal', valor: 6, pago: false, _loja: L, _alt: T0 }];
  w.anotarImpressoes();
  w.marcarDesfazer(DB.lancFin[0], 'Desmarcou pago: marquei por engano');
  DB.lancFin[0].pago = false; DB.lancFin[1].descricao = 'Normal editado';
  await enviar(w);
  const pd = [].concat(...w.__posts.filter(p => p.tab === 'lancamentos_financeiros').map(p => p.linhas));
  const ld = pd.find(o => o.ref_local === 'lf_d'), ln = pd.find(o => o.ref_local === 'lf_n');
  t('a linha desfeita sobe com o motivo, quem e quando', !!ld && /^Desmarcou pago: marquei por engano — Rafael, 20\d\d-/.test(ld.desfazer_motivo || ''),
    ld && ld.desfazer_motivo);
  t('a linha que não foi desfeita não leva motivo nenhum', !!ln && !('desfazer_motivo' in ln), ln && JSON.stringify(ln.desfazer_motivo));
  t('aceito, o motivo sai do aparelho (o próximo envio não repete o desfazer)', DB.lancFin[0]._desfazer === undefined);

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · o motor respeita a versão em toda tabela');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  process.exit(R.falhou ? 1 : 0);
})().catch(e => { console.error('ERRO', e && e.stack || e); process.exit(1); });

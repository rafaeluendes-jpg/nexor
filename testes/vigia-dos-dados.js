/* ==========================================================
   JOIA — O VIGIA OLHA OS DADOS (Missão integridade, fase 4 — 06/10/2026)

   Rodar:  node testes/vigia-dos-dados.js
   ou:     npm run test:vigiadados   (entra na bateria e no portão)

   No BANCO DE CÓPIA (fotografia da produção + migrations novas), cada
   detector do vigia é provado com o caso que ele existe para pegar:

     1. estado de mão única que voltou sem desfazer → acusado; com o
        motivo da tela → não;
     2. campo que voltou ao valor anterior → acusado; saldo e custo, que
        sobem e descem por natureza → não;
     3. login de loja mexendo no insumo e na liberação → acusado;
     4. muitas linhas no mesmo minuto pelo mesmo aparelho → acusado;
     5. exclusão em massa → acusada;
     6. tudo vai para a Central de Erros como "precisa de você", sem
        repetir na rodada seguinte;
     7. "devolver como estava": só a matriz, só se a linha não mudou de
        novo, volta o "antes", fica na auditoria com o motivo — e a
        própria devolução não é acusada como volta; a linha excluída
        volta inteira;
     8. a fotografia antes/depois de uma publicação aponta o que mudou;
     9. na Central de Erros, o achado tem o botão "Devolver como estava",
        que chama o banco com o registro da auditoria e o motivo.
   ========================================================== */
const { abrir, semear, migracoesNovas, fabrica } = require('../ferramentas/banco-de-copia/abrir');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const espera = () => new Promise(r => setTimeout(r, 3));

(async () => {
  const db = await abrir({ migrations: migracoesNovas() });
  const S = await semear(db);
  const { criar } = await fabrica(db, S);
  const M = S.u.matriz, G = S.u.gerente;
  const alt = async (tab, id) => (await db.q(`select alterado_em from ${tab} where id=$1`, [id]))[0].alterado_em;
  const grava = async (u, tab, id, sets, args) => {
    await espera();
    const v = await alt(tab, id);
    return db.como(u, q => q(`update ${tab} set ${sets}, versao_vista=$1 where id=$2`, [v, id].concat(args || [])));
  };
  const achados = async () => db.q(`select * from vigia_dos_dados(now() - interval '1 hour')`);
  const doTipo = (lista, tipo, id) => lista.filter(x => x.tipo === tipo && (!id || x.registro_id === id));

  grupo('1. Estado de mão única que voltou');
  const lf = await criar('lancamentos_financeiros', { pago: true });
  await grava(M, 'lancamentos_financeiros', lf, `pago=false`);
  let a = await achados();
  t('pago → não pago sem desfazer é acusado', doTipo(a, 'mao_unica', lf).length === 1, JSON.stringify(doTipo(a, 'mao_unica')));
  t('…com o quê, de onde e quando', /pago true → false/.test((doTipo(a, 'mao_unica', lf)[0] || {}).resumo || ''),
    (doTipo(a, 'mao_unica', lf)[0] || {}).resumo);
  const lf2 = await criar('lancamentos_financeiros', { pago: true });
  await grava(M, 'lancamentos_financeiros', lf2, `pago=false, desfazer_motivo=$3`, ['Desmarcou pago: engano — Rafael, ' + Date.now()]);
  a = await achados();
  t('desfazer pela tela, com motivo, não é acusado', !doTipo(a, 'mao_unica', lf2).length && !doTipo(a, 'voltou', lf2).length);

  grupo('2. Campo que voltou ao valor anterior');
  const ins = await criar('insumos', { nome: 'Leite', custo: 2 });
  await grava(M, 'insumos', ins, `nome='Leite integral'`);
  await grava(M, 'insumos', ins, `nome='Leite'`);
  a = await achados();
  t('nome que vai e volta é acusado', doTipo(a, 'voltou', ins).length === 1, JSON.stringify(doTipo(a, 'voltou')));
  const ins2 = await criar('insumos', { nome: 'Açúcar', custo: 3 });
  await grava(M, 'insumos', ins2, `custo=4`);
  await grava(M, 'insumos', ins2, `custo=3`);
  a = await achados();
  t('custo que sobe e desce não é acusado', !doTipo(a, 'voltou', ins2).length);

  grupo('3. Login de loja no cadastro da rede e na liberação');
  const ins3 = await criar('insumos', { nome: 'Cacau' });
  await grava(G, 'insumos', ins3, `nome='Cacau da loja'`);
  const pr = await criar('produtos', { nome: 'Pote', sucursais: '["suc_loja","suc_matriz"]' });
  await grava(G, 'produtos', pr, `sucursais='["suc_loja"]'::jsonb`);
  a = await achados();
  t('insumo mudado por login de loja é acusado', doTipo(a, 'loja', ins3).length === 1);
  t('liberação mudada por login de loja é acusada', doTipo(a, 'loja', pr).length === 1, JSON.stringify(doTipo(a, 'loja')));
  t('…e diz quem foi', /santafe@exemplo\.com/.test((doTipo(a, 'loja', ins3)[0] || {}).resumo || ''));

  grupo('4. Rajada: muitas linhas no mesmo minuto pelo mesmo aparelho');
  const ops = [];
  for (let i = 0; i < 32; i++) ops.push(await criar('turnos', { nome: 'T' + i }));
  await espera();
  await db.como(M, q => q(`update turnos set nome = nome || '!', versao_vista = now() + interval '1 day', versao_aparelho='ap_rajada' where id = any($1)`, [ops]));
  a = await achados();
  const raj = a.filter(x => x.tipo === 'rajada' && x.tabela === 'turnos');
  t('32 linhas no mesmo minuto pelo mesmo aparelho são acusadas', raj.length >= 1 && raj[0].aparelho === 'ap_rajada', JSON.stringify(raj));

  grupo('5. Exclusão em massa');
  await db.como(M, q => q(`delete from turnos where id = any($1)`, [ops.slice(0, 12)]));
  a = await achados();
  t('12 exclusões em minutos são acusadas', a.some(x => x.tipo === 'exclusao' && x.tabela === 'turnos'),
    JSON.stringify(a.filter(x => x.tipo === 'exclusao')));

  grupo('6. Tudo vai para a Central de Erros, sem repetir');
  const n1 = (await db.q(`select vigia_registrar_dados(now() - interval '1 hour') n`))[0].n;
  const n2 = (await db.q(`select vigia_registrar_dados(now() - interval '1 hour') n`))[0].n;
  const ce = await db.q(`select tipo, status, detalhe from erros_sistema where tipo='dado'`);
  t('os achados entram na caixinha', n1 >= 6 && ce.length === n1, n1 + ' / ' + ce.length);
  t('como "precisa de você"', ce.every(x => x.status === 'precisa_voce'));
  t('a rodada seguinte não repete', n2 === 0, n2);
  t('cada um leva o registro da auditoria (para devolver)', ce.every(x => x.detalhe && x.detalhe.audit_id));
  const aGer = (await db.como(G, q => q(`select count(*)::int n from erros_sistema`)))[0].n;
  t('a loja não vê a caixinha', aGer === 0, aGer);

  grupo('7. Devolver como estava');
  const audLoja = (await db.q(`select id from audit_log where tabela='insumos' and registro_id=$1 and operacao='UPDATE'
     order by id desc limit 1`, [ins3]))[0].id;
  let barrou = false;
  try { await db.como(G, q => q(`select devolver_como_estava($1, 'teste')`, [audLoja])); }
  catch (e) { barrou = /matriz/.test(e.message); }
  t('a loja não devolve (só a matriz)', barrou);
  let semMotivo = false;
  try { await db.como(M, q => q(`select devolver_como_estava($1, '  ')`, [audLoja])); } catch (e) { semMotivo = /motivo/.test(e.message); }
  t('sem motivo, não devolve', semMotivo);
  await espera();
  await db.como(M, q => q(`select devolver_como_estava($1, 'a loja não edita o cadastro da rede')`, [audLoja]));
  const vIns3 = (await db.q(`select nome, desfazer_motivo from insumos where id=$1`, [ins3]))[0];
  t('a matriz devolve: o nome volta a ser o de antes', vIns3.nome === 'Cacau', vIns3.nome);
  t('…e o motivo fica na linha (e na auditoria)', /Devolvido como estava pela matriz .*: a loja não edita/.test(vIns3.desfazer_motivo || ''),
    vIns3.desfazer_motivo);
  const audDev = (await db.q(`select aparelho, usuario_email from audit_log where tabela='insumos' and registro_id=$1 order by id desc limit 1`, [ins3]))[0];
  t('a auditoria diz que foi a matriz', audDev.aparelho === 'devolvido pela matriz' && audDev.usuario_email === M.email, JSON.stringify(audDev));
  a = await achados();
  t('a devolução não é acusada como volta', !a.some(x => x.registro_id === ins3 && x.tipo === 'voltou'));
  /* a linha mudou de novo depois do achado: não devolve às cegas */
  const audVolta = (await db.q(`select id from audit_log where tabela='insumos' and registro_id=$1 and operacao='UPDATE'
     order by id desc limit 1 offset 0`, [ins]))[0].id;
  await grava(M, 'insumos', ins, `nome='Leite B'`);
  let mudou = false;
  try { await db.como(M, q => q(`select devolver_como_estava($1, 'x')`, [audVolta])); } catch (e) { mudou = /mudou de novo/.test(e.message); }
  t('se a linha mudou de novo depois, não devolve às cegas', mudou);
  /* exclusão: a linha volta inteira */
  const audDel = (await db.q(`select id from audit_log where tabela='turnos' and operacao='DELETE' and registro_id=$1`, [ops[0]]))[0].id;
  await db.como(M, q => q(`select devolver_como_estava($1, 'excluído em massa por engano')`, [audDel]));
  t('a linha excluída volta inteira', (await db.q(`select nome from turnos where id=$1`, [ops[0]])).length === 1);
  let dup = false;
  try { await db.como(M, q => q(`select devolver_como_estava($1, 'de novo')`, [audDel])); } catch (e) { dup = /já existe/.test(e.message); }
  t('…e não volta duas vezes', dup);

  grupo('8. A fotografia antes e depois de uma publicação');
  const lfp = await criar('lancamentos_financeiros', { pago: true, valor: 100 });
  await db.q(`select fotografar_dados('V999.0.0','antes')`);
  await grava(M, 'lancamentos_financeiros', lfp, `valor=150`);
  await db.q(`select fotografar_dados('V999.0.0','depois')`);
  const dif = await db.q(`select * from fotografia_diferencas('V999.0.0')`);
  t('a conta paga que mudou aparece na diferença', dif.some(d => d.o === 'contas pagas'), JSON.stringify(dif));
  t('o que não mudou não aparece', !dif.some(d => d.o === 'fichas' || d.o === 'insumos'), JSON.stringify(dif.map(d => d.o)));
  let leFoto = true;
  try { await db.como(G, q => q(`select fotografar_dados('x','antes')`)); } catch (e) { leFoto = !/permission/i.test(e.message); }
  t('ninguém fotografa pela API (só o vigia, no servidor)', !leFoto);

  await db.fechar();

  grupo('9. Na Central de Erros, o botão "Devolver como estava"');
  {
    const { JSDOM, VirtualConsole } = require('jsdom');
    const fs = require('fs'), path = require('path');
    const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: new VirtualConsole(),
      beforeParse(win) {
        win.fetch = () => Promise.reject(new Error('offline no teste'));
        win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
        win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      }
    });
    await new Promise(r => setTimeout(r, 900));
    const w = dom.window;
    const chamadas = [];
    w.eval(`ehMatriz=function(){return true};
      confirmar=async function(){ window._cfCampo='a loja não edita o cadastro da rede'; return true; };
      sincronizar=async function(){};`);
    w.api = async (rota, metodo, corpo) => { chamadas.push({ rota, metodo, corpo }); return metodo === 'POST' ? { linhas: 1 } : []; };
    w.NUVEM.ligada = true;
    w.CE.lista = [
      { id: 'e1', tipo: 'dado', status: 'precisa_voce', mensagem: 'insumos ins_1: alterado por login de loja (santafe@)',
        ultimo_em: new Date().toISOString(), detalhe: { achado: 'loja', audit_id: 4242 } },
      { id: 'e2', tipo: 'dado', status: 'precisa_voce', mensagem: 'turnos: 32 linhas no mesmo minuto',
        ultimo_em: new Date().toISOString(), detalhe: { achado: 'rajada', audit_id: 77 } },
      { id: 'e3', tipo: 'fiscal', status: 'aberto', mensagem: 'cupom recusado', ultimo_em: new Date().toISOString() }];
    w.CE.filtro = 'todos';
    w.telaCentralErros();
    const html = w.document.getElementById('content').innerHTML;
    t('o achado de dado tem o botão "Devolver como estava"', /devolverComoEstava\('e1'\)/.test(html));
    t('rajada e erro de cupom não têm (não há um "antes" único para devolver)',
      !/devolverComoEstava\('e2'\)/.test(html) && !/devolverComoEstava\('e3'\)/.test(html));
    await w.devolverComoEstava('e1');
    const rpc = chamadas.find(c => c.rota === 'rpc/devolver_como_estava');
    t('devolve pelo banco, com o registro da auditoria e o motivo',
      !!rpc && rpc.corpo.p_audit_id === 4242 && rpc.corpo.p_motivo === 'a loja não edita o cadastro da rede', JSON.stringify(rpc));
    const pt = chamadas.find(c => c.metodo === 'PATCH' && /erros_sistema\?id=eq\.e1/.test(c.rota));
    t('e o achado vira "resolvido", dizendo quem devolveu e por quê',
      !!pt && pt.corpo.status === 'resolvido' && /Devolvido como estava por .*: a loja não edita/.test(pt.corpo.resolucao), JSON.stringify(pt));
    w.close();
  }

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · o vigia olha os dados');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  process.exit(R.falhou ? 1 : 0);
})().catch(e => { console.error('ERRO', e && e.stack || e); process.exit(1); });

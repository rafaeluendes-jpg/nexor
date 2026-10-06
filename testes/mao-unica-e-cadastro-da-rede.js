/* ==========================================================
   JOIA — O QUE ANDA PARA FRENTE NÃO VOLTA SOZINHO, E A LOJA NÃO GRAVA O
   CADASTRO DA REDE (Missão integridade, fase 3 — 06/10/2026)

   Rodar:  node testes/mao-unica-e-cadastro-da-rede.js
   ou:     npm run test:maounica   (entra na bateria e no portão)

   Roda no BANCO DE CÓPIA (ferramentas/banco-de-copia: PostgreSQL de
   verdade com a fotografia da produção e as migrations novas). As regras
   vêm do próprio banco (estados_mao_unica, cadastro_da_rede) — nenhuma
   lista escrita aqui. Prende:

     1. a migration deixa tudo em observação (aparelho antigo não perde
        nada) e nenhuma regra aponta para coluna que não existe;
     2. para CADA regra de mão única, valendo: a volta sem motivo não
        muda a coluna e vai para a fila; com o motivo da tela (desfazer)
        vale, e o motivo fica na linha e na auditoria; em observação,
        passa e fica anotada;
     3. cadastro da rede, valendo: login de loja não altera, não cria e
        não apaga — e o pedido vai para a fila; a matriz grava; em
        observação passa e fica anotado; o que não muda nada não enche a
        fila;
     4. a unidade vê na fila só os pedidos dela; ninguém escreve nas
        regras.
   ========================================================== */
const { abrir, semear, migracoesNovas, fabrica } = require('../ferramentas/banco-de-copia/abrir');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

(async () => {
  const db = await abrir({ migrations: migracoesNovas() });
  const S = await semear(db);
  const { criar, colsDe } = await fabrica(db, S);
  const tipo = (tab, col) => ((colsDe[tab] || []).find(c => c.c === col) || {}).d;
  const espera = () => new Promise(r => setTimeout(r, 3));

  grupo('1. Como a migration deixa');
  const regras = await db.q(`select * from estados_mao_unica order by tabela, coluna`);
  const cad = await db.q(`select * from cadastro_da_rede order by tabela`);
  t('há regras de mão única (lidas do banco)', regras.length >= 15, regras.length);
  t('todas nascem em observação (o aparelho antigo ainda desfaz sem motivo)', regras.every(r => r.modo === 'observar'));
  t('nenhuma regra aponta para coluna que não existe', regras.every(r => tipo(r.tabela, r.coluna)),
    regras.filter(r => !tipo(r.tabela, r.coluna)).map(r => r.tabela + '.' + r.coluna).join(', '));
  t('o cadastro da rede nasce em observação', cad.length >= 5 && cad.every(c => c.modo === 'observar'), cad.length);
  const gat = new Set((await db.q(`select c.relname||'.'||tg.tgname x from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
      where not tg.tgisinternal`)).map(r => r.x));
  t('cada tabela com regra tem o gatilho de mão única', [...new Set(regras.map(r => r.tabela))].every(tb => gat.has(tb + '.ac_mao_unica')));
  t('cada tabela do cadastro da rede tem o gatilho', cad.every(c => gat.has(c.tabela + '.aa_cadastro_da_rede')));
  const semMotivo = (await db.q(`select tabela from lei_de_versao l where not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name=l.tabela and column_name='desfazer_motivo')`)).map(r => r.tabela);
  t('toda tabela da lei aceita o motivo do desfazer', semMotivo.length === 0, semMotivo.join(', '));

  grupo('2. Cada estado de mão única, valendo');
  await db.q(`update estados_mao_unica set modo='recusar'`);
  /* a frente e a volta de cada regra, pelo tipo da coluna */
  function frenteVolta(r) {
    const d = tipo(r.tabela, r.coluna);
    if (r.regra === 'desmarca') return [true, false];
    if (r.regra === 'ordem') return [r.ordem[r.ordem.length - 1], r.ordem[0]];
    return [{ date: '2026-10-01', 'timestamp with time zone': '2026-10-01T12:00:00+00:00', text: 'feito' }[d] || 'feito', null];
  }
  const ler = async (tab, id, col) => (await db.q(`select ${col}::text v, desfazer_motivo m, alterado_em from ${tab} where id=$1`, [id]))[0];
  for (const r of regras) {
    const [frente, volta] = frenteVolta(r);
    const nome = r.tabela + '.' + r.coluna;
    let id;
    try { id = await criar(r.tabela, { [r.coluna]: frente }); }
    catch (e) { t(nome + ': cria a linha já adiante', false, e.message); continue; }
    const quem = S.u.matriz;
    let v0 = await ler(r.tabela, id, r.coluna);
    /* volta sem motivo, com o recibo de hoje (não é cópia velha: é a regra) */
    await espera();
    try {
      await db.como(quem, q => q(`update ${r.tabela} set ${r.coluna}=$1, versao_vista=$2 where id=$3`, [volta, v0.alterado_em, id]));
    } catch (e) { t(nome + ': a volta sem motivo não estoura erro', false, e.message); continue; }
    let v1 = await ler(r.tabela, id, r.coluna);
    t(nome + ': a volta sem motivo NÃO vale', v1.v === v0.v, v0.v + ' → ' + v1.v);
    const fila = (await db.q(`select situacao, queria from conflitos_sincronizacao where tabela=$1 and operacao='VOLTA'
        and registro_id=$2`, [r.tabela, id]))[0];
    t(nome + ': …e o pedido vai para a fila', !!fila && fila.situacao === 'aberto' && r.coluna in (fila.queria || {}),
      JSON.stringify(fila));
    /* desfazer pela tela: com motivo novo */
    await espera();
    const motivo = 'desfiz porque o banco estornou — Rafael, ' + new Date().toISOString();
    await db.como(quem, q => q(`update ${r.tabela} set ${r.coluna}=$1, versao_vista=$2, desfazer_motivo=$3 where id=$4`,
      [volta, v1.alterado_em, motivo, id]));
    const v2 = await ler(r.tabela, id, r.coluna);
    t(nome + ': com o motivo da tela, o desfazer vale', v2.v === (volta === null ? null : String(volta)), v2.v);
    const aud = (await db.q(`select depois->>'desfazer_motivo' m from audit_log where tabela=$1 and registro_id=$2
        and operacao='UPDATE' order by id desc limit 1`, [r.tabela, id]))[0];
    t(nome + ': …e o motivo fica na auditoria', aud && aud.m === motivo, aud && aud.m);
  }

  grupo('3. Em observação: passa, e fica anotado');
  {
    const r = regras.find(x => x.tabela === 'lancamentos_financeiros' && x.coluna === 'conciliado') || regras[0];
    await db.q(`update estados_mao_unica set modo='observar' where tabela=$1 and coluna=$2`, [r.tabela, r.coluna]);
    const [frente, volta] = frenteVolta(r);
    const id = await criar(r.tabela, { [r.coluna]: frente });
    const v0 = await ler(r.tabela, id, r.coluna);
    await espera();
    await db.como(S.u.matriz, q => q(`update ${r.tabela} set ${r.coluna}=$1, versao_vista=$2 where id=$3`, [volta, v0.alterado_em, id]));
    const v1 = await ler(r.tabela, id, r.coluna);
    const fila = (await db.q(`select situacao from conflitos_sincronizacao where tabela=$1 and operacao='VOLTA' and registro_id=$2`,
      [r.tabela, id]))[0];
    t('em observação a volta passa (o aparelho antigo não perde nada)', v1.v === (volta === null ? null : String(volta)), v1.v);
    t('…e fica na fila como observada', !!fila && fila.situacao === 'observado', JSON.stringify(fila));
    /* gravação que não volta nada não vai para a fila */
    const n0 = (await db.q(`select count(*)::int n from conflitos_sincronizacao where operacao='VOLTA'`))[0].n;
    const id2 = await criar(r.tabela, { [r.coluna]: frente });
    const v3 = await ler(r.tabela, id2, r.coluna);
    await espera();
    await db.como(S.u.matriz, q => q(`update ${r.tabela} set ${r.coluna}=$1, versao_vista=$2 where id=$3`, [frente, v3.alterado_em, id2]));
    const n1 = (await db.q(`select count(*)::int n from conflitos_sincronizacao where operacao='VOLTA'`))[0].n;
    t('o que não volta nada não enche a fila', n1 === n0, n0 + ' → ' + n1);
  }

  grupo('4. O cadastro da rede, valendo: só a matriz grava');
  await db.q(`update cadastro_da_rede set modo='recusar'`);
  for (const c of cad) {
    const tab = c.tabela;
    const col = (colsDe[tab] || []).find(x => x.d === 'text' && !['ref_local', 'desfazer_motivo', 'versao_aparelho'].includes(x.c)
      && !/_id$|^id$|sucursal/.test(x.c));
    if (!col) { t(tab + ': tem uma coluna de texto para o teste', false); continue; }
    const id = await criar(tab);
    const v0 = (await db.q(`select ${col.c} v, alterado_em from ${tab} where id=$1`, [id]))[0];
    await espera();
    let erro = null;
    try {
      await db.como(S.u.gerente, q => q(`update ${tab} set ${col.c}='da loja', versao_vista=$1 where id=$2`, [v0.alterado_em, id]));
    } catch (e) { erro = e.message; }
    const v1 = (await db.q(`select ${col.c} v from ${tab} where id=$1`, [id]))[0];
    t(tab + ': login de loja não altera o cadastro da rede', v1.v === v0.v && !erro, (erro || '') + ' ' + v1.v);
    const fila = (await db.q(`select situacao, usuario_email from conflitos_sincronizacao where tabela=$1 and operacao='CADASTRO'
        and registro_id=$2`, [tab, id]))[0];
    t(tab + ': …e o pedido vai para a fila, com quem pediu', !!fila && fila.situacao === 'aberto' && fila.usuario_email === S.u.gerente.email,
      JSON.stringify(fila));
    let apagou = false;
    try { await db.como(S.u.gerente, q => q(`delete from ${tab} where id=$1`, [id])); } catch (e) { /* a regra de acesso também barra */ }
    apagou = !(await db.q(`select 1 from ${tab} where id=$1`, [id])).length;
    t(tab + ': login de loja não apaga', !apagou);
    await espera();
    const v2 = (await db.q(`select alterado_em from ${tab} where id=$1`, [id]))[0];
    await db.como(S.u.matriz, q => q(`update ${tab} set ${col.c}='da matriz', versao_vista=$1 where id=$2`, [v2.alterado_em, id]));
    const v3 = (await db.q(`select ${col.c} v from ${tab} where id=$1`, [id]))[0];
    t(tab + ': a matriz grava', v3.v === 'da matriz', v3.v);
  }
  {
    /* login de loja não cria cadastro da rede */
    let criou = false;
    try {
      await db.como(S.u.gerente, q => q(`insert into grupos_ingredientes (loja_id, ref_local, nome) values ($1,'gi_da_loja','Da loja')`, [S.loja]));
    } catch (e) { /* regra de acesso também pode barrar */ }
    criou = (await db.q(`select 1 from grupos_ingredientes where ref_local='gi_da_loja'`)).length > 0;
    t('login de loja não cria cadastro da rede', !criou);
  }
  {
    /* em observação: passa e fica anotado; sem mudança, não anota */
    await db.q(`update cadastro_da_rede set modo='observar' where tabela='insumos'`);
    const id = await criar('insumos');
    const v0 = (await db.q(`select nome, alterado_em from insumos where id=$1`, [id]))[0];
    await espera();
    await db.como(S.u.gerente, q => q(`update insumos set nome='Leite da loja', versao_vista=$1 where id=$2`, [v0.alterado_em, id]));
    const v1 = (await db.q(`select nome, alterado_em from insumos where id=$1`, [id]))[0];
    const fila = (await db.q(`select situacao, queria from conflitos_sincronizacao where tabela='insumos' and operacao='CADASTRO'
        and registro_id=$1`, [id]))[0];
    t('em observação o login de loja ainda grava (o aparelho antigo não trava)', v1.nome === 'Leite da loja', v1.nome);
    t('…e fica na fila como observado, só com o que mudou', !!fila && fila.situacao === 'observado' &&
      JSON.stringify(Object.keys(fila.queria || {})) === '["nome"]', JSON.stringify(fila));
    const n0 = (await db.q(`select count(*)::int n from conflitos_sincronizacao where operacao='CADASTRO'`))[0].n;
    await db.como(S.u.gerente, q => q(`update insumos set nome='Leite da loja', versao_vista=$1 where id=$2`, [v1.alterado_em, id]));
    const n1 = (await db.q(`select count(*)::int n from conflitos_sincronizacao where operacao='CADASTRO'`))[0].n;
    t('regravar o mesmo valor não enche a fila', n1 === n0, n0 + ' → ' + n1);
  }

  grupo('5. Quem vê e quem escreve');
  const gerenteVe = (await db.como(S.u.gerente, q => q(`select distinct usuario_email e from conflitos_sincronizacao`))).map(r => r.e);
  t('a unidade vê na fila só os pedidos dela', gerenteVe.length > 0 && gerenteVe.every(e => e === S.u.gerente.email), gerenteVe.join(','));
  let escreve = false;
  try { await db.como(S.u.matriz, q => q(`update estados_mao_unica set modo='observar'`)); escreve = true; }
  catch (e) { escreve = !/permission/i.test(e.message); }
  t('ninguém muda as regras pela API (nem a matriz)', !escreve);
  try { await db.como(S.u.gerente, q => q(`update cadastro_da_rede set modo='observar'`)); escreve = true; }
  catch (e) { escreve = !/permission/i.test(e.message); }
  t('…nem o cadastro da rede', !escreve);

  await db.fechar();
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · mão única e cadastro da rede');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  process.exit(R.falhou ? 1 : 0);
})().catch(e => { console.error('ERRO', e && e.stack || e); process.exit(1); });

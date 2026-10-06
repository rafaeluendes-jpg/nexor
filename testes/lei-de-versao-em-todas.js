/* ==========================================================
   JOIA — O BANCO É JUIZ EM TODAS AS TABELAS (Missão integridade, 06/10/2026)

   Rodar:  node testes/lei-de-versao-em-todas.js
   ou:     npm run test:leitodas   (entra na bateria e no portão)

   Rafael: "Guardião gerado a partir do MAPA: para CADA tabela, simula dois
   aparelhos — A grava, B com a cópia de antes tenta gravar por cima — e
   exige que vença o A. Rode primeiro num banco de cópia."

   Roda no BANCO DE CÓPIA (ferramentas/banco-de-copia): um PostgreSQL de
   verdade com a fotografia da produção — tabelas, chaves, gatilhos,
   funções e regras de acesso — e, por cima, as migrations novas. Nenhuma
   tabela é escrita à mão aqui: a lista sai do MAPA (tabelas-do-mapa.js),
   e as colunas, chaves e vínculos saem do próprio banco.

   Para CADA uma das 60 tabelas:
     1. está sob a lei (gatilhos de versão, de exclusão, auditoria e
        carimbo; colunas do recibo; e o modo na lei_de_versao);
     2. o aparelho A, que viu a versão de hoje, grava — e vale;
     3. o aparelho B, com a cópia de ANTES, tenta gravar por cima — e é
        recusado: o valor do A fica;
     4. a recusa volta marcada (o recibo: versao_vista = alterado_em);
     5. a recusa não é perda: o que o B queria está na fila de conflitos,
        com o aparelho dele;
     6. a gravação do A está na auditoria, com o "antes" e o aparelho;
     7. B não apaga a linha que mudou depois que ele a viu (a exclusão
        dele vai para a fila); com a versão de hoje, apaga.
   E no fim: a matriz decide um conflito (aplica o que o B queria) e a
   unidade não consegue — nem consegue escrever na fila por fora.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { abrir, semear, migracoesNovas } = require('../ferramentas/banco-de-copia/abrir');
const { tabelasDoMapa } = require('../ferramentas/tabelas-do-mapa');

const R = { total: 0, ok: 0, falhou: 0 };
const falhas = [];
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; if (process.env.VERBOSO) console.log('   ok   ' + nome); }
  else { R.falhou++; falhas.push(nome); console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

(async () => {
  const TAB = tabelasDoMapa();
  const db = await abrir({ migrations: migracoesNovas() });
  const S = await semear(db);
  const L = S.loja;

  /* o que o banco diz de cada tabela: colunas, obrigatórias, vínculos */
  const colsDe = {}, fkDe = {}, temCheck = {};
  for (const r of await db.q(`select table_name t, column_name c, data_type d, is_nullable n, column_default df
      from information_schema.columns where table_schema='public' order by ordinal_position`)) {
    (colsDe[r.t] = colsDe[r.t] || []).push(r);
  }
  for (const r of await db.q(`select c.conrelid::regclass::text t, a.attname col, c.confrelid::regclass::text alvo
      from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      where c.contype='f' and c.connamespace='public'::regnamespace`)) {
    (fkDe[r.t] = fkDe[r.t] || {})[r.col] = r.alvo.replace(/^public\./, '');
  }
  for (const r of await db.q(`select c.conrelid::regclass::text t, a.attname col from pg_constraint c
      join pg_attribute a on a.attrelid=c.conrelid and a.attnum = any(c.conkey)
      where c.contype='c' and c.connamespace='public'::regnamespace`)) {
    (temCheck[r.t] = temCheck[r.t] || {})[r.col] = true;
  }

  /* ---------- uma linha válida em qualquer tabela, com os pais que ela pede ---------- */
  let seq = 0;
  async function criar(tab, extra) {
    const cols = colsDe[tab] || [];
    const tem = c => cols.some(x => x.c === c);
    const v = Object.assign({}, extra || {});
    seq++;
    if (tem('loja_id') && v.loja_id === undefined) v.loja_id = L;
    if (tem('ref_local') && v.ref_local === undefined) v.ref_local = 'r_' + tab + '_' + seq;
    for (const c of cols) {
      if (v[c.c] !== undefined || c.c === 'id') continue;
      const alvo = (fkDe[tab] || {})[c.c];
      if (alvo && alvo !== tab && alvo !== 'lojas' && alvo !== 'empresas' && !/^auth\./.test(alvo)) {
        v[c.c] = await criar(alvo);               /* todo vínculo ganha um pai de verdade */
        continue;
      }
      if (c.n === 'YES' || c.df !== null) continue;
      if (alvo === 'lojas') { v[c.c] = L; continue; }
      if (alvo === 'empresas') { v[c.c] = S.empresa; continue; }
      v[c.c] = ({ text: 'x' + seq, 'character varying': 'x' + seq, numeric: 1, integer: seq,
        bigint: seq, boolean: false, date: '2026-01-01', jsonb: '{}', json: '{}',
        'timestamp with time zone': new Date().toISOString(), uuid: null })[c.d];
    }
    if (tab === 'pedido_pagamentos' && !v.forma_id) v.forma_id = await criar('formas_pagamento');
    const ks = Object.keys(v);
    const r = await db.q(`insert into public.${tab} (${ks.join(',')}) values (${ks.map((_, i) => '$' + (i + 1)).join(',')})
      returning ${tem('id') ? 'id' : 'loja_id as id'}`, ks.map(k => v[k]));
    return r[0].id;
  }

  /* quem grava: a matriz; se a regra da tabela pedir mais (plataforma), ela */
  async function comoQuemPode(fn) {
    let ult;
    for (const u of [S.u.matriz, S.u.plataforma]) {
      try { const r = await db.como(u, fn); if (r !== null) return { r, u }; }
      catch (e) { ult = e; }
    }
    throw ult || new Error('ninguém conseguiu gravar');
  }

  /* os valores dos dois aparelhos, pelo tipo da coluna */
  function valores(d, seqv) {
    return ({ text: ['A' + seqv, 'B' + seqv], 'character varying': ['A' + seqv, 'B' + seqv],
      numeric: [11, 22], integer: [11, 22], bigint: [11, 22], boolean: [true, false],
      jsonb: ['{"a":1}', '{"b":2}'], date: ['2026-03-03', '2026-04-04'] })[d] || null;
  }
  const ESTRUTURA = ['id', 'loja_id', 'ref_local', 'alterado_em', 'versao_vista', 'versao_aparelho',
    'sucursais_vista', 'criado_em'];

  /* como a migration deixa: a gravação recusa só nas quatro de antes, e a
     exclusão nasce em observação em todas (o aparelho antigo apaga direto) */
  const modos = await db.q(`select tabela, modo, modo_exclusao from lei_de_versao`);
  const recusamHoje = modos.filter(m => m.modo === 'recusar').map(m => m.tabela).sort();
  t('a migration deixa recusando a gravação só as quatro que já recusavam',
    recusamHoje.join(',') === 'baixas_pendentes,contas_capital,formas_pagamento,lancamentos_financeiros', recusamHoje.join(','));
  t('…e a exclusão em observação em todas (o aparelho de versão antiga não perde o que apaga)',
    modos.length >= 60 && modos.every(m => m.modo_exclusao === 'observar'));
  /* todas as tabelas sob a lei valendo (recusar), para provar a lei inteira */
  await db.q(`update lei_de_versao set modo='recusar', modo_exclusao='recusar'`);
  const sobALei = (await db.q(`select tabela from lei_de_versao`)).map(r => r.tabela);
  const gatilhos = {};
  for (const r of await db.q(`select c.relname t, string_agg(tg.tgname, ',') g from pg_trigger tg
      join pg_class c on c.oid=tg.tgrelid where not tg.tgisinternal group by 1`)) gatilhos[r.t] = r.g.split(',');

  grupo('As ' + TAB.todas.length + ' tabelas do MAPA (lidas do MAPA, não escritas aqui)');
  t('o MAPA tem as 60 tabelas que o motor grava', TAB.todas.length >= 60, TAB.todas.length);

  for (const tab of TAB.todas) {
    const cols = colsDe[tab] || [];
    const tem = c => cols.some(x => x.c === c);
    /* 1. está sob a lei */
    t(tab + ': está na lei_de_versao', sobALei.includes(tab));
    const g = gatilhos[tab] || [];
    t(tab + ': gatilhos da lei, da exclusão, da auditoria e do carimbo',
      ['ab_versao_vista', 'ab_exclusao_vista', 'tg_auditar', 'zz_carimbar_alteracao'].every(x => g.includes(x)), g.join(','));
    t(tab + ': colunas do recibo', ['alterado_em', 'versao_vista', 'versao_aparelho'].every(tem));

    /* a linha e a coluna que os dois aparelhos disputam */
    let id;
    try { id = await criar(tab); }
    catch (e) { t(tab + ': consigo criar a linha no banco de cópia', false, e.message); continue; }
    const chave = tem('id') ? { col: 'id', val: id } : { col: 'loja_id', val: L };
    const ler = async () => (await db.q(`select * from public.${tab} where ${chave.col}=$1`, [chave.val]))[0];
    const antes = await ler();
    const V0 = antes.alterado_em;
    const candidatas = cols.filter(c => !ESTRUTURA.includes(c.c) && !(fkDe[tab] || {})[c.c] &&
      !(temCheck[tab] || {})[c.c] && valores(c.d, 1));
    /* prefere o campo de texto livre; a primeira que um gatilho não "conserta" fica */
    candidatas.sort((a, b) => (/^(observacao|obs|nome|descricao)$/.test(b.c) ? 1 : 0) - (/^(observacao|obs|nome|descricao)$/.test(a.c) ? 1 : 0));
    /* o mesmo valor, escrito como o banco devolve (numeric vem como texto) */
    const norm = (v, d) => v === null || v === undefined ? '' :
      (/numeric|integer|bigint/.test(d) ? String(Number(v)) :
       (d === 'jsonb' ? JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v) :
        (d === 'date' ? new Date(v).toISOString().slice(0, 10) : String(v))));
    let col = null, VA, VB, quem = null, Vantes = V0;
    for (const c of candidatas) {
      let [a, b] = valores(c.d, seq);
      const atual = await ler();
      if (norm(atual[c.c], c.d) === norm(a, c.d)) { const x = a; a = b; b = x; }   /* A tem de MUDAR o valor */
      Vantes = atual.alterado_em;
      try {
        await new Promise(r => setTimeout(r, 3));
        const res = await comoQuemPode(q => q(`update public.${tab} set ${c.c}=$1, versao_vista=$2, versao_aparelho='A'
            where ${chave.col}=$3 returning ${c.c}::text v`, [a, Vantes, chave.val]).then(r => r.length ? r : null));
        const agora = await ler();
        if (norm(agora[c.c], c.d) === norm(a, c.d) && agora.alterado_em > Vantes) {
          col = c.c; VA = a; VB = b; quem = res.u; break;
        }
      } catch (e) { /* esta coluna não aceita esse valor (regra da tabela): tenta a próxima */ }
    }
    t(tab + ': o aparelho A (viu a versão de hoje) grava', !!col, 'nenhuma coluna gravável');
    if (!col) continue;
    const depoisA = await ler();
    t(tab + ': a gravação do A ganhou versão nova', depoisA.alterado_em > Vantes);

    /* 3. B, com a cópia de ANTES (a versão que A também viu), tenta gravar por cima */
    let volta = null;
    try {
      volta = (await db.como(quem, q => q(`update public.${tab} set ${col}=$1, versao_vista=$2, versao_aparelho='B'
          where ${chave.col}=$3 returning versao_vista, alterado_em`, [VB, Vantes, chave.val])))[0];
    } catch (e) { volta = { erro: e.message }; }
    const depoisB = await ler();
    const igual = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    t(tab + ': B (cópia velha) é recusado — fica o valor do A', igual(depoisB[col], depoisA[col]),
      JSON.stringify(depoisB[col]) + ' × ' + JSON.stringify(depoisA[col]));
    t(tab + ': a recusa volta marcada (versao_vista = alterado_em)',
      !!(volta && volta.versao_vista && +new Date(volta.versao_vista) === +new Date(volta.alterado_em)), JSON.stringify(volta));
    const conf = await db.q(`select * from conflitos_sincronizacao where tabela=$1 and operacao='UPDATE' order by id desc limit 1`, [tab]);
    t(tab + ': o que B queria está na fila de conflitos, com o aparelho dele',
      !!(conf[0] && conf[0].queria && conf[0].queria[col] !== undefined && conf[0].aparelho === 'B' && conf[0].situacao === 'aberto'),
      JSON.stringify(conf[0] && { q: conf[0].queria, a: conf[0].aparelho, s: conf[0].situacao }));
    const aud = await db.q(`select * from audit_log where tabela=$1 and operacao='UPDATE' order by id desc limit 1`, [tab]);
    t(tab + ': a gravação do A está na auditoria, com o antes e o aparelho',
      !!(aud[0] && aud[0].antes && aud[0].depois && aud[0].aparelho === 'A'), JSON.stringify(aud[0] && aud[0].aparelho));

    /* 7. exclusão com versão — onde a regra de acesso deixa alguém apagar
       (cancelamento e lote financeiro não se apagam por regra; a lei não
       muda isso) */
    const apagavel = (await db.q(`select 1 from pg_policies where schemaname='public' and tablename=$1
        and cmd in ('DELETE','ALL')`, [tab])).length > 0;
    if (tem('ref_local') && apagavel) {
      const ref = antes.ref_local;
      for (const u of [quem, S.u.plataforma]) {
        try { await db.como(u, q => q(`select apagar_vistos($1,$2,'B',array[$3]::text[],null,null,null,$4)`, [tab, Vantes, ref, L])); }
        catch (e) { /* recusa por regra de acesso também deixa a linha */ }
      }
      t(tab + ': B não apaga a linha que mudou depois que ele a viu', !!(await ler()));
      for (const u of [quem, S.u.plataforma]) {
        if (!(await ler())) break;
        try { await db.como(u, q => q(`select apagar_vistos($1,$2,'A',array[$3]::text[],null,null,null,$4)`,
          [tab, new Date().toISOString(), ref, L])); } catch (e) { /* tenta quem pode */ }
      }
      t(tab + ': com a versão de hoje, a exclusão vale', !(await ler()), 'a linha continua lá');
    }
  }

  grupo('A matriz decide; a unidade não');
  /* um conflito novo, de uma linha que continua viva */
  const iid = await criar('insumos');
  const I0 = (await db.q(`select alterado_em from insumos where id=$1`, [iid]))[0].alterado_em;
  await new Promise(r => setTimeout(r, 3));
  await db.como(S.u.matriz, q => q(`update insumos set descricao='do A', versao_vista=$1, versao_aparelho='A' where id=$2`, [I0, iid]));
  await db.como(S.u.matriz, q => q(`update insumos set descricao='do B', versao_vista=$1, versao_aparelho='B' where id=$2`, [I0, iid]));
  const umConf = (await db.q(`select id, tabela, queria from conflitos_sincronizacao where operacao='UPDATE' and situacao='aberto'
      and tabela='insumos' and registro_id=$1`, [iid]))[0];
  t('a recusa do B virou conflito aberto', !!umConf);
  let negado = false;
  try { await db.como(S.u.gerente, q => q(`select decidir_conflito($1,'aplicar','teste')`, [umConf.id])); }
  catch (e) { negado = /matriz/.test(e.message); }
  t('a unidade não decide conflito', negado);
  let semMotivo = false;
  try { await db.como(S.u.matriz, q => q(`select decidir_conflito($1,'aplicar','  ')`, [umConf.id])); }
  catch (e) { semMotivo = /motivo/.test(e.message); }
  t('decidir sem motivo não vale', semMotivo);
  if (umConf) {
    await db.como(S.u.matriz, q => q(`select decidir_conflito($1,'aplicar','o B estava certo')`, [umConf.id]));
    const c2 = (await db.q(`select situacao, decidido_por, motivo from conflitos_sincronizacao where id=$1`, [umConf.id]))[0];
    t('a matriz aplica o que o aparelho queria, com motivo e nome', c2.situacao === 'aplicado' &&
      c2.decidido_por === S.u.matriz.email && c2.motivo === 'o B estava certo', JSON.stringify(c2));
    const desc = (await db.q(`select descricao from insumos where id=$1`, [iid]))[0].descricao;
    t('o valor do B está na nuvem depois da decisão', desc === 'do B', desc);
    const a2 = (await db.q(`select aparelho, usuario_email from audit_log where tabela='insumos' order by id desc limit 1`))[0];
    t('a decisão está na auditoria, como decisão da matriz', a2 && a2.aparelho === 'decisão da matriz' &&
      a2.usuario_email === S.u.matriz.email, JSON.stringify(a2));
  }
  let fechado = false;
  try { await db.como(S.u.gerente, q => q(`select registrar_conflito('insumos','UPDATE','{}'::jsonb,null,null,null,null,'recusar')`)); }
  catch (e) { fechado = /permission/i.test(e.message); }
  t('ninguém escreve na fila por fora (registrar_conflito fechado)', fechado);
  /* o visitante sem login não chama as portas da lei, e ninguém escreve na fila direto */
  const semLogin = async sql => {
    await db.pg.exec('set role anon');
    try { await db.pg.query(sql); return false; } catch (e) { return /permission/i.test(e.message); }
    finally { await db.pg.exec('reset role'); }
  };
  t('o visitante (sem login) não anexa nada à fila',
    await semLogin(`select anexar_filhos_ao_conflito('insumos','x','{}'::jsonb,null)`));
  t('…nem apaga pela porta da versão', await semLogin(`select apagar_vistos('insumos', now(), null, array['x'])`));
  t('…nem decide conflito', await semLogin(`select decidir_conflito(1,'aplicar','x')`));
  let escreveDireto = true;
  try { await db.como(S.u.matriz, q => q(`delete from conflitos_sincronizacao`)); }
  catch (e) { escreveDireto = !/permission/i.test(e.message); }
  t('nem a matriz apaga a fila direto (só decide, com motivo)', !escreveDireto);
  let gerenteVe = (await db.como(S.u.gerente, q => q(`select count(*)::int n from conflitos_sincronizacao`)))[0].n;
  let matrizVe = (await db.como(S.u.matriz, q => q(`select count(*)::int n from conflitos_sincronizacao`)))[0].n;
  t('a matriz vê a fila; a unidade vê só os pedidos dela', matrizVe > 0 && gerenteVe === 0, matrizVe + ' × ' + gerenteVe);

  grupo('Modo observar: passa, mas anota o que a lei faria');
  await db.q(`update lei_de_versao set modo='observar' where tabela='turnos'`);
  const tid = await criar('turnos');
  const T0 = (await db.q(`select alterado_em from turnos where id=$1`, [tid]))[0].alterado_em;
  await new Promise(r => setTimeout(r, 3));
  await db.como(S.u.matriz, q => q(`update turnos set nome='Manhã', versao_vista=$1 where id=$2`, [T0, tid]));
  await db.como(S.u.matriz, q => q(`update turnos set nome='Tarde', versao_vista=$1, versao_aparelho='C' where id=$2`, [T0, tid]));
  await db.como(S.u.matriz, q => q(`update turnos set nome='Noite' where id=$1`, [tid]));
  const tn = (await db.q(`select nome from turnos where id=$1`, [tid]))[0].nome;
  const obs = await db.q(`select queria from conflitos_sincronizacao where tabela='turnos' and situacao='observado'`);
  t('em observação a cópia velha passa', tn === 'Noite');
  t('…e o que a lei recusaria fica anotado como observado', obs.some(o => o.queria && o.queria.nome === 'Tarde'));
  t('aparelho sem recibo, em observação, não enche a fila', !obs.some(o => o.queria && o.queria.nome === 'Noite'));
  /* a exclusão em observação: o aparelho de versão antiga apaga direto */
  await db.q(`update lei_de_versao set modo_exclusao='observar' where tabela='turnos'`);
  const filaAntes = (await db.q(`select count(*)::int n from conflitos_sincronizacao where tabela='turnos' and operacao='DELETE'`))[0].n;
  await db.como(S.u.matriz, q => q(`delete from turnos where id=$1`, [tid]));
  const sobrou = (await db.q(`select count(*)::int n from turnos where id=$1`, [tid]))[0].n;
  const filaDepois = (await db.q(`select count(*)::int n from conflitos_sincronizacao where tabela='turnos' and operacao='DELETE'`))[0].n;
  t('exclusão em observação: o DELETE direto do aparelho antigo vale', sobrou === 0);
  t('…e, sem dizer o que viu, não enche a fila', filaDepois === filaAntes, filaAntes + ' → ' + filaDepois);

  grupo('Gravação feita por outro gatilho já foi julgada');
  await db.q(`update lei_de_versao set modo='recusar', modo_exclusao='recusar' where tabela in ('pedidos','cancelamentos')`);
  const pedId = await criar('pedidos');
  const pedRef = (await db.q(`select ref_local from pedidos where id=$1`, [pedId]))[0].ref_local;
  await new Promise(r => setTimeout(r, 3));
  await db.como(S.u.matriz, q => q(`insert into cancelamentos (loja_id, ref_local, pedido_ref) values ($1, $2, $3)`,
    [L, 'canc_' + pedRef, pedRef]));
  const fase = (await db.q(`select fase from pedidos where id=$1`, [pedId]))[0].fase;
  t('cancelar a venda marca o pedido como cancelado (o gatilho do cancelamento não é recusado)', fase === 'cancelado', fase);
  t('…e isso não vira conflito', (await db.q(`select count(*)::int n from conflitos_sincronizacao
    where tabela='pedidos' and ref_local=$1`, [pedRef]))[0].n === 0);

  await db.fechar();
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · o banco é juiz em todas as tabelas');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  process.exit(R.falhou ? 1 : 0);
})().catch(e => { console.error('ERRO', e && e.stack || e); process.exit(1); });

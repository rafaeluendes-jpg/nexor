/* ==========================================================
   JOIA — O BANCO DE CÓPIA (Missão integridade, 06/10/2026)

   Regra 2 do CLAUDE.md: migration só vai para a produção depois de rodar
   num banco de cópia e fazer o que devia. Este é o banco de cópia: um
   PostgreSQL de verdade (PGlite, dentro do Node — roda aqui, no computador
   do Rafael e no GitHub, sem instalar nada), montado com a FOTOGRAFIA da
   produção — as 60 tabelas do MAPA, as chaves, os gatilhos, as funções e
   as regras de acesso, como estão no ar. Nenhum dado de cliente.

     const { abrir } = require('./ferramentas/banco-de-copia/abrir');
     const db = await abrir({ migrations: ['supabase/migrations/x.sql'] });
     await db.como(usuario, async q => q("update …"));   // entra como um login

   A fotografia é 1-tabelas … 4-gatilhos-e-regras, tirada do catálogo da
   produção (definição das tabelas, pg_get_functiondef, pg_get_triggerdef,
   pg_policies). Conferida em 06/10/2026: colunas e gatilhos das 65
   tabelas idênticos à produção por impressão (md5); funções iguais a
   menos de comentário. Quando a produção mudar, fotografe de novo — e a
   migration nova entra aqui pela pasta supabase/migrations (migracoesNovas).
   ========================================================== */
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const RAIZ = path.join(AQUI, '..', '..');
const FOTO = ['0-supabase.sql', '1-tabelas.sql', '2-restricoes.sql', '3-funcoes.sql', '4-gatilhos-e-regras.sql'];
/* a fotografia é da produção de 06/10/2026, antes das migrations deste dia:
   o que vem depois dela é o que se prova aqui antes de ir para o ar */
const FOTO_ATE = '20261005';
function migracoesNovas() {
  const dir = path.join(RAIZ, 'supabase', 'migrations');
  const lista = fs.readdirSync(dir).filter(f => /^\d{8}_.*\.sql$/.test(f) && f.slice(0, 8) > FOTO_ATE)
    .sort().map(f => path.join(dir, f));
  /* para provar uma migration ainda em rascunho, antes de ela entrar na pasta */
  (process.env.JOIA_MIGRACAO_EXTRA || '').split(',').filter(Boolean).forEach(f => lista.push(path.resolve(f)));
  return lista;
}

async function abrir(opc) {
  opc = opc || {};
  const { PGlite } = await import('@electric-sql/pglite');
  const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const pg = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
  /* como o pg_dump: função que cita outra ainda não criada não é erro */
  await pg.exec('set check_function_bodies = off');
  for (const f of FOTO) {
    try { await pg.exec(fs.readFileSync(path.join(AQUI, f), 'utf8')); }
    catch (e) { throw new Error('banco de cópia: ' + f + ' — ' + e.message); }
  }
  for (const m of (opc.migrations || [])) {
    const arq = path.isAbsolute(m) ? m : path.join(RAIZ, m);
    try { await pg.exec(fs.readFileSync(arq, 'utf8')); }
    catch (e) { throw new Error('migration ' + path.basename(arq) + ' — ' + e.message); }
  }

  const db = {
    pg,
    /* consulta como administrador do banco (o "servidor") */
    q: async (sql, args) => (await pg.query(sql, args || [])).rows,
    exec: (sql) => pg.exec(sql),
    /* consulta como um login do sistema: papel authenticated + o token dele */
    como: async (u, fn) => {
      const claims = JSON.stringify({ role: 'authenticated', sub: u.id, email: u.email,
        iat: Math.floor(Date.now() / 1000) });
      await pg.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
      await pg.exec('set role authenticated');
      try { return await fn((sql, args) => pg.query(sql, args || []).then(r => r.rows)); }
      finally {
        await pg.exec('reset role');
        await pg.query(`select set_config('request.jwt.claims', '', false)`);
      }
    },
    fechar: () => pg.close()
  };
  return db;
}

/* uma empresa com a matriz e uma loja, e três logins: o dono (admin da
   matriz), o gerente da loja e o operador da loja — como a Jolô */
async function semear(db) {
  const L = '6001c62e-26f3-4d81-8b6c-fa367c14146c';
  const E = '11111111-1111-4111-8111-111111111111';
  const u = {
    matriz:  { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'rafael@exemplo.com', cargo: 'admin',   suc: null },
    gerente: { id: 'aaaaaaaa-0000-4000-8000-000000000002', email: 'santafe@exemplo.com', cargo: 'gerente', suc: 'suc_loja' },
    operador:{ id: 'aaaaaaaa-0000-4000-8000-000000000003', email: 'caixa@exemplo.com',  cargo: 'operador', suc: 'suc_loja' },
    plataforma:{ id: 'aaaaaaaa-0000-4000-8000-000000000004', email: 'dono@exemplo.com', cargo: 'plataforma', suc: null }
  };
  await db.exec(`insert into empresas(id,nome) values ('${E}','Rede');
    insert into lojas(id,empresa_id,nome,matriz) values ('${L}','${E}','Rede',true);
    insert into sucursais(id,empresa_id,loja_id,nome,ref_local,matriz) values
      (gen_random_uuid(),'${E}','${L}','Matriz','suc_matriz',true),
      (gen_random_uuid(),'${E}','${L}','Loja','suc_loja',false);`);
  for (const k of Object.keys(u)) {
    const x = u[k];
    await db.q(`insert into auth.users(id,email) values ($1,$2)`, [x.id, x.email]);
    await db.q(`insert into perfis(id,loja_id,empresa_id,nome,cargo,sucursal_ref) values ($1,$2,$3,$4,$5,$6)`,
      [x.id, L, E, k, x.cargo, x.suc]);
    await db.q(`insert into usuarios_sistema(loja_id,ref_local,nome,login,ativo,tudo,sucursais)
      values ($1,$2,$3,$4,true,$5,$6)`, [L, 'u_' + k, k, x.email, !x.suc, JSON.stringify(x.suc ? [x.suc] : [])]);
  }
  return { loja: L, empresa: E, u };
}

/* uma linha válida em qualquer tabela, com os pais que ela pede — os
   guardiões do banco de cópia criam o que precisam sem lista de colunas */
async function fabrica(db, S) {
  const colsDe = {}, fkDe = {};
  for (const r of await db.q(`select table_name t, column_name c, data_type d, is_nullable n, column_default df
      from information_schema.columns where table_schema='public' order by ordinal_position`)) {
    (colsDe[r.t] = colsDe[r.t] || []).push(r);
  }
  for (const r of await db.q(`select c.conrelid::regclass::text t, a.attname col, c.confrelid::regclass::text alvo
      from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      where c.contype='f' and c.connamespace='public'::regnamespace`)) {
    (fkDe[r.t] = fkDe[r.t] || {})[r.col] = r.alvo.replace(/^public\./, '');
  }
  let seq = 0;
  async function criar(tab, extra) {
    const cols = colsDe[tab] || [];
    const tem = c => cols.some(x => x.c === c);
    const v = Object.assign({}, extra || {});
    seq++;
    if (tem('loja_id') && v.loja_id === undefined) v.loja_id = S.loja;
    if (tem('ref_local') && v.ref_local === undefined) v.ref_local = 'r_' + tab + '_' + seq;
    for (const c of cols) {
      if (v[c.c] !== undefined || c.c === 'id') continue;
      const alvo = (fkDe[tab] || {})[c.c];
      if (alvo && alvo !== tab && alvo !== 'lojas' && alvo !== 'empresas' && !/^auth\./.test(alvo)) {
        v[c.c] = await criar(alvo);
        continue;
      }
      if (c.n === 'YES' || c.df !== null) continue;
      if (alvo === 'lojas') { v[c.c] = S.loja; continue; }
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
  return { criar, colsDe, fkDe };
}

module.exports = { abrir, semear, migracoesNovas, fabrica, FOTO_ATE };

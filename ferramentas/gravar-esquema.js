/* ==========================================================
   JOIA — REGRAVAR A REFERÊNCIA DO BANCO (ferramentas/esquema-nuvem.json)

   O conferir-nuvem.js compara o que o código manda com o que o banco
   aceita, e a referência é a fotografia do banco em esquema-nuvem.json.
   Depois de cada migration ela tem de ser regravada — senão o portão
   confere contra o banco de ontem.

   Passos (Missão integridade, 06/10/2026):
     1. rode no banco a consulta CONSULTA abaixo (ela também está no fim
        do conferir-nuvem.js) e salve a resposta (o json) num arquivo;
     2. node ferramentas/gravar-esquema.js resposta.json

   A consulta traz, além das colunas e índices únicos, os GATILHOS de cada
   tabela e a lei de versão (lei_de_versao). É com eles que o portão
   reprova tabela do MAPA sem a lei de versão ou sem a auditoria.

   --banco-de-copia: em vez de um arquivo, lê o banco de cópia com as
   migrations novas aplicadas — é a referência PREVISTA, para rodar o
   portão antes de a migration ir para a produção. Depois de aplicar na
   produção, regrave com a resposta de lá: as duas têm de bater.
   ========================================================== */
const fs = require('fs');
const path = require('path');

const ESQ = path.join(__dirname, 'esquema-nuvem.json');
const CONSULTA = `select json_build_object(
  'colunas', (select json_agg(json_build_object('t',table_name,'c',column_name,'d',data_type)
               order by table_name, ordinal_position)
             from information_schema.columns where table_schema='public'),
  'unicos',  (select json_agg(json_build_object('t',t.relname,'cols',
               (select json_agg(a.attname order by k.ord)
                  from unnest(ix.indkey) with ordinality k(attnum,ord)
                  join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum)))
             from pg_index ix join pg_class t on t.oid=ix.indrelid
             join pg_namespace n on n.oid=t.relnamespace
             where n.nspname='public' and (ix.indisunique or ix.indisprimary)),
  'gatilhos', (select json_agg(json_build_object('t',c.relname,'g',tg.tgname) order by c.relname, tg.tgname)
             from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
             where c.relnamespace='public'::regnamespace and not tg.tgisinternal),
  'lei', (select json_agg(json_build_object('t',tabela,'modo',modo,'exclusao',modo_exclusao) order by tabela)
          from public.lei_de_versao)) as esquema`;

/* a resposta da consulta vira o formato do esquema-nuvem.json */
function montar(r, origem, base) {
  const tab = {};
  const pega = t => (tab[t] = tab[t] || { colunas: {}, unicos: [] });
  (r.colunas || []).forEach(x => { pega(x.t).colunas[x.c] = x.d; });
  (r.unicos || []).forEach(x => {
    const u = pega(x.t).unicos;
    const k = JSON.stringify(x.cols);
    if (!u.some(y => JSON.stringify(y) === k)) u.push(x.cols);
  });
  (r.gatilhos || []).forEach(x => { if (tab[x.t]) (tab[x.t].gatilhos = tab[x.t].gatilhos || []).push(x.g); });
  (r.lei || []).forEach(x => { if (tab[x.t]) tab[x.t].lei = { modo: x.modo, exclusao: x.exclusao }; });
  /* o banco de cópia só tem parte das tabelas: as outras ficam como estavam */
  if (base) Object.keys(base).forEach(t => { if (!tab[t]) tab[t] = base[t]; });
  const ord = {};
  Object.keys(tab).sort().forEach(t => { ord[t] = tab[t]; });
  return { gerado: new Date().toISOString().slice(0, 10), origem, projeto: 'cevghkndzpzvnzwifhnm', tabelas: ord };
}

async function doBancoDeCopia() {
  const { abrir, migracoesNovas } = require('./banco-de-copia/abrir');
  const db = await abrir({ migrations: migracoesNovas() });
  const r = (await db.q(CONSULTA))[0].esquema;
  await db.fechar();
  return r;
}

if (require.main === module) (async () => {
  const arg = process.argv[2];
  if (!arg) { console.log('uso: node ferramentas/gravar-esquema.js resposta.json | --banco-de-copia\n\n' + CONSULTA); process.exit(1); }
  const atual = fs.existsSync(ESQ) ? JSON.parse(fs.readFileSync(ESQ, 'utf8')).tabelas : {};
  let r, origem, base = null;
  if (arg === '--banco-de-copia') {
    r = await doBancoDeCopia();
    origem = 'PREVISTA: banco de cópia com as migrations novas (regravar com a produção depois de aplicar)';
    base = atual;
  } else {
    let j = JSON.parse(fs.readFileSync(arg, 'utf8'));
    if (Array.isArray(j)) j = j[0];
    r = j.esquema || j;
    origem = 'produção';
  }
  const novo = montar(r, origem, base);
  fs.writeFileSync(ESQ, JSON.stringify(novo, null, 1) + '\n');
  const n = Object.keys(novo.tabelas).length;
  const comLei = Object.values(novo.tabelas).filter(t => t.lei).length;
  console.log('esquema-nuvem.json regravado: ' + n + ' tabelas, ' + comLei + ' sob a lei de versão (' + origem + ')');
})().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { CONSULTA, montar };

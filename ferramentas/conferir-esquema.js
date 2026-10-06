/* ==========================================================
   JOIA — A REFERÊNCIA DO BANCO BATE COM A PRODUÇÃO? (06/10/2026)

   ferramentas/esquema-nuvem.json é a fotografia do banco que o portão
   usa. Depois de uma migration ela é regravada pelo banco de cópia
   (gravar-esquema.js --banco-de-copia) — a referência PREVISTA. Este
   script prova que a prevista é a de verdade sem copiar o banco inteiro
   para cá: ele imprime a consulta que tira a impressão (md5) da
   produção e a impressão da referência; as duas têm de ser iguais.

     node ferramentas/conferir-esquema.js          → impressões da referência
     node ferramentas/conferir-esquema.js --sql    → a consulta para a produção
   ========================================================== */
const path = require('path');
const crypto = require('crypto');
const esq = require(path.join(__dirname, 'esquema-nuvem.json')).tabelas;

const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const ord = a => a.slice().sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
const T = Object.keys(esq);
const cols = ord([].concat(...T.map(t => Object.keys(esq[t].colunas).map(c => t + '.' + c + ':' + esq[t].colunas[c]))));
const unis = ord([...new Set([].concat(...T.map(t => (esq[t].unicos || []).map(u => t + ':' + u.join('+')))))]);
const comGat = T.filter(t => esq[t].gatilhos);
const gats = ord([].concat(...comGat.map(t => esq[t].gatilhos.map(g => t + '.' + g))));
const lei = ord(T.filter(t => esq[t].lei).map(t => t + ':' + esq[t].lei.modo + ':' + esq[t].lei.exclusao));

const SQL = `select
 (select md5(string_agg(x, ',' order by x collate "C")) from (select table_name||'.'||column_name||':'||data_type x
    from information_schema.columns where table_schema='public') a) colunas,
 (select md5(string_agg(x, ',' order by x collate "C")) from (select distinct t.relname||':'||
    (select string_agg(a.attname, '+' order by k.ord) from unnest(ix.indkey) with ordinality k(attnum,ord)
      join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum) x
    from pg_index ix join pg_class t on t.oid=ix.indrelid where t.relnamespace='public'::regnamespace
     and (ix.indisunique or ix.indisprimary)) b) unicos,
 (select md5(string_agg(x, ',' order by x collate "C")) from (select c.relname||'.'||tg.tgname x from pg_trigger tg
    join pg_class c on c.oid=tg.tgrelid where c.relnamespace='public'::regnamespace and not tg.tgisinternal
    and c.relname = any(array[${comGat.map(t => "'" + t + "'").join(',')}])) g) gatilhos,
 (select md5(string_agg(tabela||':'||modo||':'||modo_exclusao, ',' order by tabela collate "C")) from public.lei_de_versao) lei`;

if (process.argv.includes('--sql')) { console.log(SQL); process.exit(0); }
console.log(JSON.stringify({ colunas: md5(cols.join(',')), unicos: md5(unis.join(',')),
  gatilhos: md5(gats.join(',')), lei: md5(lei.join(',')) }, null, 1));
console.log('(' + cols.length + ' colunas, ' + unis.length + ' índices únicos, ' + gats.length + ' gatilhos em ' +
  comGat.length + ' tabelas, ' + lei.length + ' tabelas sob a lei)');

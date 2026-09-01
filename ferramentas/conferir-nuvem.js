/* ==========================================================
   JOIA — CONFERIR O QUE O CODIGO MANDA CONTRA O QUE O BANCO ACEITA

   O Rafael, em 01/09/2026: "eu peco pra voce verificar, testar, e mesmo
   assim os codigos continuam vindo quebrado. A gente precisava dar um
   jeito de resolver isso de uma vez por todas."

   Ele tem razao, e da para nomear a causa. Os quatro defeitos daquele dia
   eram O MESMO defeito:

     pedido_base_itens?on_conflict=loja_id,ref_local  -> 400   (nao tem loja_id)
     cardapio_config?sucursal_id=eq.suc_mt1unhbx2xrb  -> 400   (a coluna e uuid)
     categorias?select=id,nome,ativo                  -> 400   (a coluna e `ativa`)
     contagens_estoque sem colunas para retroativa... -> perda silenciosa

   Em todos, o codigo mandou para o banco uma forma que o banco nao aceita.
   E NENHUM dos quatro aparece no `npm test`, no `varrer`, no `auditar` ou
   no `provar` — porque os quatro rodam com a nuvem desligada. Eles provam
   que a tela monta e que a conta fecha; nao provam que o banco aceita.
   Esse era o buraco. Este arquivo e a tampa dele.

   Ele compara, sem tocar em producao, tres coisas:

     1. cada campo que o MAPA manda existe como coluna na tabela;
     2. a chave do upsert (`on_conflict`) e um indice unico de verdade;
     3. cada chamada direta a nuvem cita tabela e coluna que existem.

   A referencia e `ferramentas/esquema-nuvem.json`, uma fotografia das 88
   tabelas de producao. Para atualiza-la depois de uma migration, rode a
   consulta que esta no fim deste arquivo e regrave o json.
   ========================================================== */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
/* os testes apontam para uma copia adulterada, para provar que a
   conferencia realmente pega cada defeito */
const ARQ = process.env.JOIA_ARQ || path.join(RAIZ, 'index.html');
const ESQ = path.join(__dirname, 'esquema-nuvem.json');

const esquema = JSON.parse(fs.readFileSync(ESQ, 'utf8')).tabelas;
const fonte = fs.readFileSync(ARQ, 'utf8');

let problemas = 0, conferidos = 0;
function erro(onde, msg, dica) {
  problemas++;
  console.log('\n  ✗ ' + onde + '\n    ' + msg + (dica ? '\n    → ' + dica : ''));
}
function ok(msg) { conferidos++; if (process.env.VERBOSO) console.log('   ok  ' + msg); }

function colunas(tab) { return esquema[tab] ? esquema[tab].colunas : null; }
function pareceCom(nome, tab) {
  const cs = Object.keys(colunas(tab) || {});
  const alvo = nome.toLowerCase();
  const perto = cs.filter(c => {
    const a = c.toLowerCase();
    return a.startsWith(alvo.slice(0, Math.max(3, alvo.length - 2))) ||
           alvo.startsWith(a.slice(0, Math.max(3, a.length - 2)));
  });
  return perto.length ? 'a tabela tem: ' + perto.join(', ') : '';
}

/* ----------------------------------------------------------
   1 e 2 — o MAPA

   O MAPA e a lista que diz, para cada colecao do aparelho, em que tabela
   ela mora e que campos sobem. Ele e lido do proprio `index.html` — o que
   esta publicado, nao o que esta no `src/`.
   ---------------------------------------------------------- */
function lerMAPA() {
  const i = fonte.indexOf('\nvar MAPA=[');
  if (i < 0) throw new Error('MAPA não encontrado no index.html');
  /* acha o `];` que fecha o array, contando colchetes fora de texto */
  let j = fonte.indexOf('[', i), nivel = 0, k = j, aspas = null, fim = -1;
  for (; k < fonte.length; k++) {
    const c = fonte[k], ant = fonte[k - 1];
    if (aspas) { if (c === aspas && ant !== '\\') aspas = null; continue; }
    if (c === '"' || c === "'") { aspas = c; continue; }
    if (c === '/' && fonte[k + 1] === '*') { k = fonte.indexOf('*/', k) + 1; continue; }
    if (c === '[') nivel++;
    else if (c === ']') { nivel--; if (!nivel) { fim = k; break; } }
  }
  if (fim < 0) throw new Error('não achei o fim do MAPA');
  const src = fonte.slice(j, fim + 1);
  /* os campos() usam ajudantes do sistema; aqui so os nomes das chaves
     interessam, entao cada ajudante devolve algo inofensivo */
  const stub = () => 'x';
  const amb = {
    n: v => (v === undefined || v === null ? null : Number(v) || 0),
    fk: stub, fkSub: stub, ordemDe: () => 0, dataParaNuvem: v => v || null,
    dataDoTexto: () => '2026-01-01', refIngInsumo: stub, refIngFicha: stub,
    normModo: stub, lojaAtualId: () => 'suc_x', liberadoNa: () => null,
    formaDoPagamento: () => ({}), caixaAberto: () => null,
    NUVEM: { loja: 'L' }, DB: {},
    /* `_ids` traduz ref_local -> uuid; aqui basta responder a tudo */
    _ids: new Proxy({}, { get: () => 'u', has: () => true })
  };
  return new Function('amb', 'with(amb){return ' + src + ';}')(amb);
}

/* um objeto que responde a qualquer campo, para que os `campos()` que tem
   `if` ou `||` entrem no ramo que gera a chave em vez de pular */
function cobaia() {
  return new Proxy({}, {
    get(_, p) {
      if (p === Symbol.toPrimitive || p === 'toJSON') return undefined;
      if (typeof p !== 'string') return undefined;
      if (/^(itens|filhos|pagamentos|opcoes|linhas|precos|movimentos)$/.test(p)) return [];
      if (/(^|[a-z])(data|em|Em)$/.test(p)) return '2026-01-01';
      if (/^(qtd|valor|total|preco|ordem|numero)/.test(p)) return 1;
      return 'x';
    },
    has() { return true; }
  });
}

/* ----------------------------------------------------------
   Quem decide a chave do upsert e o proprio sistema, nao uma copia dela
   escrita aqui. Uma copia envelheceria em silencio — que e exatamente o
   defeito que este arquivo existe para impedir. Entao `chaveConflito` e
   arrancada do index.html publicado e usada como esta la.
   ---------------------------------------------------------- */
function chaveDoLote(tab, linha) {
  const i = fonte.indexOf('function chaveConflito(');
  if (i < 0) throw new Error('chaveConflito não encontrada no index.html');
  let n = 0, k = fonte.indexOf('{', i), fim = -1;
  for (let j = k; j < fonte.length; j++) {
    if (fonte[j] === '{') n++;
    else if (fonte[j] === '}') { n--; if (!n) { fim = j; break; } }
  }
  if (!chaveDoLote._f) {
    const amb = { _quieto: () => {}, _TABS_SEM_LOJA: TABS_SEM_LOJA() };
    chaveDoLote._f = new Function('amb', 'with(amb){' +
      fonte.slice(i, fim + 1) + '\nreturn chaveConflito;}')(amb);
  }
  return String(chaveDoLote._f(tab, [linha])).split(',');
}
function TABS_SEM_LOJA() {
  const m = /_TABS_SEM_LOJA\s*=\s*(\[[^\]]*\])/.exec(fonte);
  try { return m ? JSON.parse(m[1].replace(/'/g, '"')) : []; } catch (e) { return []; }
}
function temIndiceUnico(tab, chave) {
  const us = (esquema[tab] || {}).unicos || [];
  const alvo = [...chave].sort().join(',');
  return us.some(u => [...u].sort().join(',') === alvo);
}

function conferirTabela(onde, tab, linha) {
  const cs = colunas(tab);
  if (!cs) { erro(onde, 'a tabela `' + tab + '` não existe no banco.'); return; }
  Object.keys(linha).forEach(c => {
    if (cs[c]) { ok(tab + '.' + c); return; }
    erro(onde, 'manda o campo `' + c + '`, que a tabela `' + tab +
      '` não tem. O banco recusa o lote inteiro com erro 400.', pareceCom(c, tab));
  });
  const chave = chaveDoLote(tab, linha);
  if (temIndiceUnico(tab, chave)) ok(tab + ' on_conflict=' + chave.join(','));
  else erro(onde, 'o upsert vai conflitar por `' + chave.join(',') +
    '`, e `' + tab + '` não tem índice único assim.',
    'índices únicos da tabela: ' +
      (((esquema[tab] || {}).unicos || []).map(u => u.join(',')).join(' | ') || 'nenhum'));
}

console.log('\n══ 1. O que o MAPA manda existe no banco?');
const MAPA = lerMAPA();
MAPA.forEach(E => {
  let linha;
  try { linha = E.campos(cobaia(), 0); }
  catch (e) { erro(E.col, 'não consegui montar a linha: ' + e.message); return; }
  linha.loja_id = 'L'; linha.ref_local = 'r';           /* o motor sempre põe os dois */
  conferirTabela(E.col + ' → ' + E.tab, E.tab, linha);

  (E.filhos || []).forEach(F => {
    let y;
    try { y = F.campos(cobaia(), 0); }
    catch (e) { erro(E.col + '.' + F.lista, 'não consegui montar a linha: ' + e.message); return; }
    y[F.pai] = 'p'; y.ref_local = 'r';                  /* o filho não leva loja_id */
    conferirTabela(E.col + '.' + F.lista + ' → ' + F.tab, F.tab, y);
  });
});

/* ----------------------------------------------------------
   3 — as chamadas diretas

   Fora do MAPA, o sistema fala com a nuvem em dezenas de lugares soltos:
   `api('cardapio_config?sucursal_id=eq.'+id)`. Nenhum teste olha para
   dentro dessa string. Aqui olha.
   ---------------------------------------------------------- */
console.log('\n══ 2. As chamadas diretas citam colunas que existem?');
const TABS = Object.keys(esquema).sort((a, b) => b.length - a.length);
const RE = new RegExp("(?:'|\"|`)(" + TABS.join('|') + ")\\?([^'\"`]*)", 'g');
const PARAM_LIVRE = /^(select|order|limit|offset|on_conflict|and|or|not)$/;
const vistos = new Set();

/* ----------------------------------------------------------
   O ROBO E O CARDAPIO FALAM COM O MESMO BANCO

   O quarto defeito de 01/09/2026 nao estava aqui: estava no robo do
   WhatsApp, que pedia `categorias?select=id,nome,ativo` — a coluna e
   `ativa`. O 400 voltava vazio e o cardapio inteiro da Carla sumia, sem
   erro nenhum na tela. Sao repositorios separados, mas o banco e um so,
   entao a conferencia atravessa: quando as pastas irmas estao ao lado,
   elas entram na mesma varredura.
   ---------------------------------------------------------- */
const FONTES = [{ nome: 'index.html', txt: fonte }];
(process.env.JOIA_IRMAOS
  ? process.env.JOIA_IRMAOS.split(',').map(x => [x, path.basename(x)])
  : [['../nexor-whatsapp/server.js', 'robô do WhatsApp'],
     ['../delivery/cardapio.js', 'cardápio digital']]).forEach(function (par) {
  const f = path.resolve(RAIZ, par[0]);
  if (fs.existsSync(f)) FONTES.push({ nome: par[1], txt: fs.readFileSync(f, 'utf8') });
});
if (FONTES.length > 1)
  console.log('   (também: ' + FONTES.slice(1).map(f => f.nome).join(', ') + ')');

FONTES.forEach(function (F0) {
const fonte = F0.txt;
const marca = F0.nome === 'index.html' ? '' : ' [' + F0.nome + ']';
RE.lastIndex = 0;
let m;
while ((m = RE.exec(fonte))) {
  const tab = m[1] + marca, qs = m[2];
  const tabReal = m[1];
  const cs = colunas(tabReal);
  qs.split('&').forEach(par => {
    if (!par || par.indexOf('=') < 0) return;
    const nome = par.slice(0, par.indexOf('='));
    const val = par.slice(par.indexOf('=') + 1);
    if (nome === 'select') {
      /* separa a lista de colunas, respeitando `tabela(*)` embutida */
      let d = 0, campo = '';
      const lista = [];
      for (const c of val) {
        if (c === '(') d++; if (c === ')') d--;
        if (c === ',' && !d) { lista.push(campo); campo = ''; } else campo += c;
      }
      lista.push(campo);
      lista.forEach(f => {
        f = f.trim();
        if (!f || f === '*' || f.indexOf('$') >= 0 || f.indexOf('+') >= 0) return;
        if (f.indexOf('(') > 0) {                        /* tabela embutida */
          const t2 = f.slice(0, f.indexOf('(')).replace(/.*:/, '');
          if (!esquema[t2] && !cs[t2])
            erro(tab, 'busca `' + t2 + '(...)` embutida, e não existe tabela nem coluna assim.');
          else ok(tab + ' ⊃ ' + t2);
          return;
        }
        const col = f.replace(/.*:/, '').replace(/[.!].*/, '');
        if (!cs[col]) erro(tab, 'pede a coluna `' + col + '` no select, e ela não existe.',
          pareceCom(col, tabReal));
        else ok(tab + '.' + col);
      });
      return;
    }
    if (PARAM_LIVRE.test(nome)) {
      if (nome === 'on_conflict') {
        const chave = val.split(',').map(s => s.trim()).filter(Boolean);
        if (chave.length && !chave.some(c => c.indexOf('$') >= 0)) {
          chave.forEach(c => { if (!cs[c])
            erro(tab, 'conflita por `' + c + '`, coluna que a tabela não tem.', pareceCom(c, tabReal)); });
          if (chave.every(c => cs[c]) && !temIndiceUnico(tabReal, chave))
            erro(tab, 'conflita por `' + val + '`, e não há índice único assim.',
              'índices: ' + (((esquema[tabReal] || {}).unicos || []).map(u => u.join(',')).join(' | ') || 'nenhum'));
        }
      }
      if (nome === 'order') {
        const col = val.split('.')[0];
        if (col && col.indexOf('$') < 0 && !cs[col])
          erro(tab, 'ordena por `' + col + '`, coluna que a tabela não tem.', pareceCom(col, tabReal));
      }
      return;
    }
    if (nome.indexOf('$') >= 0 || nome.indexOf('+') >= 0) return;
    if (!cs[nome]) {
      erro(tab, 'filtra por `' + nome + '`, coluna que a tabela não tem.', pareceCom(nome, tabReal));
      return;
    }
    ok(tab + '?' + nome);
    /* ------------------------------------------------------
       O DEFEITO DO INTERRUPTOR DA LOJA

       `cardapio_config?sucursal_id=eq.suc_mt1unhbx2xrb` → 400. A coluna e
       `uuid`; `suc_mt1unhbx2xrb` e o id local do aparelho. Postgres nao
       compara os dois. Quando o filtro cai numa coluna uuid, o valor tem
       de vir de uma traducao (…NaNuvem, …Uuid) ou ser um uuid escrito.
       ------------------------------------------------------ */
    if (cs[nome] === 'uuid') {
      const chave = tab + '?' + nome;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      const trecho = fonte.slice(m.index, m.index + 200).split('\n')[0];
      /* o id local do aparelho tem forma propria (`suc_...`, `pb_...`) e
         nasce nestes lugares. Um uuid de verdade — `NUVEM.loja`, o `id` de
         uma linha que veio da nuvem — passa, e e a imensa maioria. */
      const LOCAL = /lojaAtualId|sucursalAtual|_sucAtual|sucursalRef|'suc_|\"suc_/;
      if (LOCAL.test(trecho) && !/NaNuvem|Uuid|uuidDe/.test(trecho))
        erro(tab, 'filtra `' + nome + '` (coluna uuid) com o id local do ' +
          'aparelho. Postgres nao compara os dois: da 400.',
          trecho.trim().slice(0, 120));
    }
  });
}
});

/* ----------------------------------------------------------
   3 — o jeito do robo e do cardapio: `.from('categorias').select(...)`

   Mesmo banco, outra biblioteca. Aqui a coluna errada nao devolve erro na
   tela: devolve lista vazia. Foi assim que o cardapio inteiro da Carla
   sumiu sem ninguem ver nada quebrar.
   ---------------------------------------------------------- */
FONTES.slice(1).forEach(function (F0) {
  const txt = F0.txt, marca = ' [' + F0.nome + ']';
  const RF = /\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)/g;
  let f;
  while ((f = RF.exec(txt))) {
    const tab = f[1], cs = colunas(tab);
    /* a leitura para no proximo `.from(`: senao a consulta seguinte,
       de outra tabela, entra na conta desta e inventa erro */
    let depois = txt.slice(f.index + f[0].length, f.index + 900);
    const prox = depois.indexOf('.from(');
    if (prox > 0) depois = depois.slice(0, prox);
    if (!cs) { erro(tab + marca, 'a tabela `' + tab + '` não existe no banco.'); continue; }
    const sel = /\.select\(\s*['"`]([^'"`]*)['"`]/.exec(depois);
    if (sel) {
      let d = 0, campo = '';
      const lista = [];
      for (const c of sel[1]) {
        if (c === '(') d++; if (c === ')') d--;
        if (c === ',' && !d) { lista.push(campo); campo = ''; } else campo += c;
      }
      lista.push(campo);
      lista.forEach(function (c0) {
        const c1 = c0.trim();
        if (!c1 || c1 === '*') return;
        if (c1.indexOf('(') > 0) {
          const t2 = c1.slice(0, c1.indexOf('(')).replace(/.*:/, '');
          if (!esquema[t2] && !cs[t2])
            erro(tab + marca, 'busca `' + t2 + '(...)` embutida, e não existe.');
          else ok(tab + ' ⊃ ' + t2);
          return;
        }
        const c2 = c1.replace(/.*:/, '');
        if (!cs[c2]) erro(tab + marca, 'pede a coluna `' + c2 + '` no select, e ela ' +
          'não existe. A busca volta vazia, sem erro na tela.', pareceCom(c2, tab));
        else ok(tab + '.' + c2);
      });
    }
    const RE2 = /\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|order|contains)\(\s*['"`]([a-z_0-9]+)['"`]/g;
    let e2;
    while ((e2 = RE2.exec(depois))) {
      if (!cs[e2[2]]) erro(tab + marca, '`.' + e2[1] + "('" + e2[2] +
        "')` — coluna que a tabela não tem.", pareceCom(e2[2], tab));
      else ok(tab + '.' + e2[2]);
    }
    const oc = /onConflict\s*:\s*['"`]([^'"`]+)['"`]/.exec(depois);
    if (oc) {
      const chave = oc[1].split(',').map(x => x.trim()).filter(Boolean);
      chave.forEach(function (c) { if (!cs[c])
        erro(tab + marca, 'conflita por `' + c + '`, coluna que não existe.', pareceCom(c, tab)); });
      if (chave.every(c => cs[c]) && !temIndiceUnico(tab, chave))
        erro(tab + marca, 'conflita por `' + oc[1] + '`, e não há índice único assim.',
          'índices: ' + (((esquema[tab] || {}).unicos || []).map(u => u.join(',')).join(' | ') || 'nenhum'));
      else ok(tab + ' onConflict');
    }
  }
});

console.log('\n' + (problemas
  ? '✗ ' + problemas + ' problema(s) entre o código e o banco — NÃO publicar assim.\n'
  : '✓ ' + conferidos + ' campos, chaves e filtros conferidos contra as ' +
    Object.keys(esquema).length + ' tabelas de produção. Nada fora do lugar.\n'));
process.exit(problemas ? 1 : 0);

/* ==========================================================
   PARA REGRAVAR ferramentas/esquema-nuvem.json APOS UMA MIGRATION

   select json_build_object(
     'colunas', (select json_agg(json_build_object('t',table_name,'c',column_name,
                   'd',data_type,'n',is_nullable) order by table_name, ordinal_position)
                 from information_schema.columns where table_schema='public'),
     'unicos',  (select json_agg(json_build_object('t',t.relname,'cols',
                   (select json_agg(a.attname order by k.ord)
                      from unnest(ix.indkey) with ordinality k(attnum,ord)
                      join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum)))
                 from pg_index ix join pg_class t on t.oid=ix.indrelid
                 join pg_namespace n on n.oid=t.relnamespace
                 where n.nspname='public' and (ix.indisunique or ix.indisprimary)));
   ========================================================== */

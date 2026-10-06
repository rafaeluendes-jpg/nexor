/* ==========================================================
   JOIA — AS TABELAS DO MAPA, LIDAS DO PRÓPRIO MAPA (06/10/2026)

   Missão integridade: toda lista de tabelas sai do MAPA e do banco,
   nunca escrita à mão. Uma lista escrita à mão envelhece calada — foi
   assim com `_TABS_SEM_LOJA`, com o mapa de filhos do download e com a
   lista de versão do Dalu.

   O MAPA mora em src/js/03-armazenamento/01-inicio.js (var MAPA=[…]) e é
   lido do index.html — o que vai ao ar. Além das tabelas do MAPA (pais,
   filhos e vínculos), o motor grava direto `config_loja` e
   `config_operacao`: elas entram aqui pelo mesmo motivo, lidas do código
   (o `api('config_…?on_conflict=loja_id'` do envio, ou `enviarConfig('config_…'`).

     const { lerMAPA, tabelasDoMapa } = require('./tabelas-do-mapa');
   ========================================================== */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

function lerMAPA(fonte) {
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

/* as tabelas que o motor grava fora do MAPA, achadas no próprio código */
function diretasDoMotor(fonte) {
  const achadas = new Set();
  const re = /(?:api\('([a-z_]+)\?on_conflict=loja_id'|enviarConfig\('([a-z_]+)')/g;
  let m;
  while ((m = re.exec(fonte))) achadas.add(m[1] || m[2]);
  return Array.from(achadas).sort();
}

function tabelasDoMapa(fonte) {
  fonte = fonte || fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const MAPA = lerMAPA(fonte);
  const pais = [], filhos = [], vinculos = [];
  MAPA.forEach(E => {
    pais.push({ tab: E.tab, col: E.col });
    (E.filhos || []).forEach(F => filhos.push({ tab: F.tab, pai: E.tab, fk: F.pai, lista: F.lista }));
    if (E.vinculo) vinculos.push({ tab: E.vinculo.tab, pai: E.tab, fk: E.vinculo.pai });
  });
  const diretas = diretasDoMotor(fonte).filter(t => !pais.some(p => p.tab === t));
  const todas = Array.from(new Set(pais.map(p => p.tab).concat(filhos.map(f => f.tab),
    vinculos.map(v => v.tab), diretas)));
  return { MAPA, pais, filhos, vinculos, diretas, todas };
}

module.exports = { lerMAPA, tabelasDoMapa, diretasDoMotor };

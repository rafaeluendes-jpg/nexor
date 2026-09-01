/* ==========================================================
   JOIA — ENTRAR DE NOVO NÃO APAGA A CONFIGURAÇÃO DA LOJA

   Achado pela auditoria de configurações, 01/09/2026.

   O login tem, de propósito, dois caminhos: se quem entra é OUTRA pessoa
   ou outra unidade, o aparelho é limpo (foi assim que os dados da Jolô
   apareceram dentro da Rafaelos). Se é a MESMA pessoa da MESMA loja, o
   que está no aparelho é dela e continua valendo — está escrito assim no
   próprio código.

   Só que o caminho da mesma pessoa fazia:

     DB = _ant;      // restaura o que estava no aparelho
     semear();       // ← e joga tudo fora

   `semear()` não acrescenta: ela TROCA o DB inteiro por
   `{categorias:[],produtos:[],grupos:[],fichas:[]}`. Com as listas
   vazias, as sementes de fábrica repunham 1,99% no débito e 3,49% no
   crédito, sem conta — e o envio seguinte levava isso para a nuvem por
   cima do que o dono tinha configurado.

   Este teste roda os dois caminhos de verdade e confere campo a campo.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* o que a loja de Santa Fé tinha no aparelho, com a configuração do dono */
function aparelhoDaLoja() {
  return {
    _dono: 'loja-1', _donoUsuario: 'user-1', _donoSuc: 'suc_santafe',
    formasPag: [
      { id: 'fp_debito',  nome: 'Cartão débito',  taxaPct: 0.73, dias: 1, contaId: 'ct_banco' },
      { id: 'fp_credito', nome: 'Cartão crédito', taxaPct: 2.73, dias: 1, contaId: 'ct_banco' }],
    contas: [{ id: 'ct_banco', nome: 'Banco Itaú — conta corrente' }],
    motivosMov: [{ id: 'mv_sai', nome: 'Saída manual', tipo: 'saida' }],
    pedidos: [{ id: 'ped_1', total: 24 }],
    _hash: { formasPag: { fp_debito: 'h1' } },
    _uuid: { formasPag: { fp_debito: 'u1' } }
  };
}

/* o trecho do login que decide limpar ou manter, rodado de verdade */
function entrar(mesmoDono) {
  const bloco = (function () {
    const i = fonte.indexOf('  if(_mesmoDono){');
    const j = fonte.indexOf('NUVEM.baixou=false;', i);
    return fonte.slice(i, j + 'NUVEM.baixou=false;'.length);
  })();
  const amb = {
    _mesmoDono: mesmoDono, _ant: aparelhoDaLoja(),
    DB: {}, NUVEM: {}, apagados: [],
    localStorage: { removeItem: function (k) { amb.apagados.push(k); } },
    semear: function () { amb.DB = { categorias: [], produtos: [], grupos: [], fichas: [] }; },
    _quieto: () => {}, logNuvem: () => {},
    rp: { data: { loja_id: 'loja-1', sucursal_ref: 'suc_santafe' } },
    r: { data: { user: { id: 'user-1' } } }
  };
  const f = new Function('amb', 'with(amb){' + bloco + '\nreturn DB;}');
  const db = f(amb);
  return { DB: db, NUVEM: amb.NUVEM, apagados: amb.apagados };
}

console.log('\n── A mesma pessoa entrando de novo: nada se perde\n');
{
  const r = entrar(true);
  const fp = r.DB.formasPag || [];
  t('as formas de pagamento continuam lá', fp.length === 2, JSON.stringify(fp));
  t('com a taxa do débito que o dono gravou',
    (fp[0] || {}).taxaPct === 0.73, (fp[0] || {}).taxaPct);
  t('com a taxa do crédito que o dono gravou',
    (fp[1] || {}).taxaPct === 2.73, (fp[1] || {}).taxaPct);
  t('e com a conta em que o dinheiro cai',
    fp.every(f => f.contaId === 'ct_banco'));
  t('as contas continuam', (r.DB.contas || []).length === 1);
  t('os motivos continuam', (r.DB.motivosMov || []).length === 1);
  t('a venda que ainda não subiu continua', (r.DB.pedidos || []).length === 1);
  /* sem o registro do que já subiu, o envio seguinte acha que TUDO mudou
     e empurra a cópia local por cima da nuvem — foi o defeito da V227 */
  t('o registro do que já foi enviado continua',
    !!(r.DB._hash && r.DB._hash.formasPag && r.DB._hash.formasPag.fp_debito),
    JSON.stringify(r.DB._hash));
  t('e o registro dos identificadores da nuvem também',
    !!(r.DB._uuid && r.DB._uuid.formasPag && r.DB._uuid.formasPag.fp_debito));
  t('nada foi apagado do armazenamento', r.apagados.length === 0, JSON.stringify(r.apagados));
  t('o aparelho não se declara zerado', r.NUVEM.zerado === false);
  t('mas espera o download antes de escrever na nuvem', r.NUVEM.baixou === false);
}

console.log('\n── Outra pessoa entrando: o aparelho é limpo, como tem de ser\n');
{
  const r = entrar(false);
  t('as formas de pagamento da pessoa anterior somem',
    (r.DB.formasPag || []).length === 0, JSON.stringify(r.DB.formasPag));
  t('os pedidos da pessoa anterior somem', (r.DB.pedidos || []).length === 0);
  t('o armazenamento do aparelho é limpo',
    r.apagados.indexOf('nexor_dados') >= 0, JSON.stringify(r.apagados));
  t('o aparelho se declara zerado', r.NUVEM.zerado === true);
  t('e não escreve nada antes de baixar', r.NUVEM.baixou === false);
  t('as listas básicas ficam de pé, vazias',
    Array.isArray(r.DB.usuarios) && Array.isArray(r.DB.produtos) &&
    Array.isArray(r.DB.categorias) && Array.isArray(r.DB.fichas));
}

console.log('\n── E a semente de fábrica não tem como entrar por cima\n');
{
  const r = entrar(true);
  const semear = new Function('amb', 'with(amb){' + corpoDaFuncao('baseFormas', fonte) +
    '\nreturn baseFormas;}')({ DB: r.DB, syncFormas: () => {} });
  semear();
  t('as taxas do dono continuam depois de a semente rodar',
    r.DB.formasPag[0].taxaPct === 0.73 && r.DB.formasPag[1].taxaPct === 2.73,
    JSON.stringify(r.DB.formasPag.map(f => f.id + ':' + f.taxaPct)));
  t('e nenhuma forma de fábrica foi acrescentada',
    r.DB.formasPag.length === 2, r.DB.formasPag.length);
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

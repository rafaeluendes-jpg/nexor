/* ==========================================================
   JOIA — A CONTAGEM SOBE INTEIRA, NÃO PELA METADE

   O Rafael, em 01/09/2026: "isso não é pra ficar só no computador de
   quem fez, isso é pra subir na nuvem. Tudo que foi feito é pra subir na
   nuvem. Estou fazendo hoje com a data de ontem: esse estoque é o que
   finalizou o dia ontem, e aí vai ser descontado tudo que foi vendido ou
   usado hoje."

   Subiam a data, a hora, a unidade, a sobra, a perda, o resultado e o
   detalhe item a item. Ficavam de fora QUATRO coisas, porque a tabela
   não tinha coluna para elas:

     retroativa + lancadaEm — a marca de "contei hoje e lancei como
       ontem". Sem ela, em qualquer outro aparelho a contagem parecia ter
       sido feita no dia em que foi digitada — que é justamente o que ele
       não quer.
     movId  — o vínculo com o movimento que fez o ajuste.
     precos — quais custos a contagem corrigiu, de quanto para quanto.

   O dinheiro nunca se perdeu; o que se perdia era a explicação dele.
   As quatro colunas foram acrescentadas ao banco, sem tocar em nenhuma
   linha existente, e agora sobem e descem junto.
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

/* a contagem como `fecharContagem` a cria */
const CONTAGEM = {
  id: 'ct_abc', data: '2026-08-31', hora: '09:12',
  lancadaEm: '2026-09-01', retroativa: true, movId: 'mv_xyz',
  sucursalId: 'suc_sf', loja: 'suc_sf',
  perda: -3.5, ganho: 1, resultado: -2.5,
  itens: [{ nome: 'Copo P', sistema: 12, contado: 13, diferenca: 1 }],
  precos: [{ insumoId: 'in_copo', nome: 'Copo P', de: 0.5, para: 0.6 }]
};

console.log('\n── O que sobe\n');
{
  const i = fonte.indexOf("{col:'contagens',   tab:'contagens_estoque'");
  const bloco = fonte.slice(i, fonte.indexOf('},\n', i) + 3);
  const amb = {
    n: v => Number(v) || 0,
    dataParaNuvem: new Function(
      fonte.slice(fonte.indexOf('function dataParaNuvem'),
                  fonte.indexOf('function igualarChaves')) + '\nreturn dataParaNuvem;')()
  };
  const E = new Function('amb', 'with(amb){return ' + bloco.replace(/,\s*$/, '') + ';}')(amb);
  const o = E.campos(CONTAGEM, 0);
  t('a data contada sobe', o.data === '2026-08-31', o.data);
  t('a unidade sobe', o.sucursal_id === 'suc_sf', o.sucursal_id);
  t('a sobra, a perda e o resultado sobem',
    o.ganho === 1 && o.perda === -3.5 && o.resultado === -2.5);
  t('o detalhe item a item sobe', (o.itens || []).length === 1);
  t('a marca de RETROATIVA sobe', o.retroativa === true, o.retroativa);
  t('e o dia em que foi lançada também', o.lancada_em === '2026-09-01', o.lancada_em);
  t('o vínculo com o movimento do ajuste sobe', o.mov_ref === 'mv_xyz', o.mov_ref);
  t('e os custos corrigidos sobem', (o.precos || []).length === 1 &&
    o.precos[0].de === 0.5 && o.precos[0].para === 0.6, JSON.stringify(o.precos));

  /* contagem do próprio dia: não é retroativa, e isso também sobe */
  const hoje = Object.assign({}, CONTAGEM, { retroativa: false, lancadaEm: '2026-08-31' });
  const o2 = E.campos(hoje, 0);
  t('contagem do próprio dia sobe como não-retroativa', o2.retroativa === false);
  /* contagem antiga, gravada antes desta versão, não quebra o envio */
  const velha = { id: 'ct_old', data: '2026-07-10', hora: '08:00', perda: 0, ganho: 0, resultado: 0 };
  const o3 = E.campos(velha, 0);
  t('contagem antiga, sem esses campos, sobe sem quebrar',
    o3.retroativa === false && o3.lancada_em === null && o3.mov_ref === null &&
    Array.isArray(o3.precos), JSON.stringify(o3));
}


/* extrai o corpo do mapeador de descida, contando as chaves */
function mapeadorDaDescida() {
  const dl = fs.readFileSync(__dirname + '/../src/js/03-armazenamento/' +
    '02-medir-nunca-pode-quebrar-o-que-esta-sendo-me.js', 'utf8');
  const i = dl.indexOf('DB.contagens=volta(ct,function(x){return ');
  let j = dl.indexOf('{return ', i) + '{return '.length;
  /* o objeto devolvido começa aqui: equilibra as chaves */
  let n = 0, k = j;
  while (k < dl.length) {
    if (dl[k] === '{') n++;
    else if (dl[k] === '}') { n--; if (!n) { k++; break; } }
    k++;
  }
  return new Function('x', 'return ' + dl.slice(j, k) + ';');
}

console.log('\n── O que desce\n');
{
  const fn = mapeadorDaDescida();
  const linha = {
    ref_local: 'ct_abc', data: '2026-08-31', hora: '09:12', sucursal_id: 'suc_sf',
    perda: -3.5, ganho: 1, resultado: -2.5, itens: [{ nome: 'Copo P' }],
    retroativa: true, lancada_em: '2026-09-01', mov_ref: 'mv_xyz',
    precos: [{ insumoId: 'in_copo' }]
  };
  const c = fn(linha);
  t('volta como retroativa', c.retroativa === true);
  t('volta com o dia em que foi lançada', c.lancadaEm === '2026-09-01', c.lancadaEm);
  t('volta com o vínculo do ajuste', c.movId === 'mv_xyz', c.movId);
  t('volta com os custos corrigidos', (c.precos || []).length === 1);
  t('e continua voltando com o resto', c.data === '2026-08-31' && c.ganho === 1 &&
    (c.itens || []).length === 1 && c.sucursalId === 'suc_sf');

  /* a linha antiga do banco, sem as colunas novas, não quebra a volta */
  const antiga = fn({ ref_local: 'ct_old', data: '2026-07-10', hora: '08:00',
    sucursal_id: 'suc_sf', perda: 0, ganho: 0, resultado: 0 });
  t('linha antiga volta sem quebrar',
    antiga.retroativa === false && antiga.lancadaEm === '' &&
    antiga.movId === '' && Array.isArray(antiga.precos));
}

console.log('\n── A ida e a volta não mudam a contagem\n');
{
  const i = fonte.indexOf("{col:'contagens',   tab:'contagens_estoque'");
  const bloco = fonte.slice(i, fonte.indexOf('},\n', i) + 3);
  const amb = {
    n: v => Number(v) || 0,
    dataParaNuvem: new Function(
      fonte.slice(fonte.indexOf('function dataParaNuvem'),
                  fonte.indexOf('function igualarChaves')) + '\nreturn dataParaNuvem;')()
  };
  const E = new Function('amb', 'with(amb){return ' + bloco.replace(/,\s*$/, '') + ';}')(amb);
  const volta = mapeadorDaDescida();
  const subiu = E.campos(CONTAGEM, 0);
  subiu.ref_local = CONTAGEM.id;
  const desceu = volta(subiu);
  t('a marca de retroativa sobrevive à ida e à volta', desceu.retroativa === true);
  t('o dia do lançamento também', desceu.lancadaEm === '2026-09-01', desceu.lancadaEm);
  t('o vínculo do ajuste também', desceu.movId === 'mv_xyz');
  t('e a tela mostraria "lançada em 01/09/2026"',
    desceu.retroativa === true && !!desceu.lancadaEm);
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

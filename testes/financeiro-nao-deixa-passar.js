/* ==========================================================
   JOIA — O FINANCEIRO DEIXAVA PASSAR (V376)

   A RDS, item 17: *"nenhum lançamento confirmado poderá existir sem
   plano de contas"*, e a validação tem de valer na tela, no aparelho,
   no serviço, antes do pagamento, antes da conciliação e antes do
   fechamento.

   O Joia validava em UM lugar: o formulário de cadastro do lançamento.

   1. PAGAR NÃO PERGUNTAVA NADA. O joinha da lista, a baixa em lote e a
      confirmação com juros caem todos no mesmo callback — e ele só
      exigia conta e forma de pagamento. Dava para pagar, conciliar e
      fechar o mês com um lançamento que o DRE não enxerga, porque o DRE
      só enxerga quem tem `categoriaId`.

   2. RECEITA SEM CATEGORIA NINGUÉM VIA. A marca vermelha "Sem
      categoria" na lista só olhava DESPESA.

   3. "SALVO E CONFERIDO NA NUVEM" ERA DITO SEM CONFERIR NADA. A função
      montava a lista dos que TÊM categoria; se ela saía vazia, dava a
      mensagem de sucesso completa — justamente no caso em que o
      lançamento foi salvo sem plano de contas.

   4. DESCONCILIAR ERAM TRÊS LINHAS SEM PROTEÇÃO. Sem motivo, sem prazo,
      sem quem foi — e `dataConc=''` apagava o "antes".
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ==========================================================
   1. A MARCA DE "SEM CATEGORIA" VALE PARA OS DOIS LADOS
   ========================================================== */
console.log('\n── Receita sem categoria passa a aparecer\n');

const semCat = new Function('amb',
  'with(amb){' + corpoDaFuncao('categoriaValida', fonte) + '\n' +
  corpoDaFuncao('lancSemCategoria', fonte) + '\n return lancSemCategoria;}')(
  { DB: { catfin: [{ id: 'c1', itens: [{ id: 's1' }] }] }, tipoCat: () => null });

t('despesa sem categoria: aparece', semCat({ tipo: 'despesa' }) === true);
t('RECEITA sem categoria: aparece (não aparecia)', semCat({ tipo: 'receita' }) === true);
t('lançamento com subcategoria válida: não aparece',
  semCat({ tipo: 'receita', categoriaId: 's1' }) === false);
t('lançamento com categoria em texto: não aparece (é o caso dos automáticos)',
  semCat({ tipo: 'despesa', categoriaTxt: 'Frente de Caixa' }) === false);
t('TRANSFERÊNCIA entre contas fica de fora — não é receita nem despesa',
  semCat({ tipo: 'transferencia' }) === false);
t('e categoria que não existe no plano continua contando como sem categoria',
  semCat({ tipo: 'despesa', categoriaId: 'inventada' }) === true);
t('nulo não estoura', semCat(null) === false);

/* ==========================================================
   2. PAGAR EXIGE CLASSIFICAÇÃO
   ========================================================== */
console.log('\n── Pagar sem classificar deixa de ser possível\n');

const mp = semComentario(corpoDaFuncao('modalPagamento', fonte));
t('o pagamento confere a classificação', /lancSemCategoria\(l\)/.test(mp));
t('e recusa quando falta', /return false;/.test(mp) && /Classifique antes de pagar/.test(corpoDaFuncao('modalPagamento', fonte)));
t('a conferência vem ANTES de marcar pago',
  mp.indexOf('lancSemCategoria') < mp.indexOf('l.pago=true'));
t('depois de conferir conta e forma, que já existiam',
  mp.indexOf('Selecione a forma de pagamento') < mp.indexOf('lancSemCategoria'));
t('a mensagem diz QUAL lançamento, quando é um só',
  /semClas\[0\]\.descricao/.test(mp));
t('e diz quantos são, quando é baixa em lote',
  /semClas\.length\+' lançamentos estão sem categoria/.test(corpoDaFuncao('modalPagamento', fonte)));

/* ==========================================================
   3. A NUVEM NÃO DIZ "CONFERIDO" SEM CONFERIR
   ========================================================== */
console.log('\n── "Salvo e conferido" só quando houve o que conferir\n');

const cn = semComentario(corpoDaFuncao('conferirLancNaNuvem', fonte));
t('quando não há categoria a conferir, olha se é por falta de plano de contas',
  /var semCat=ids\.filter/.test(cn) && /lancSemCategoria\(l\)/.test(cn));
t('e avisa que assim não entra no DRE',
  /não entra no DRE/.test(corpoDaFuncao('conferirLancNaNuvem', fonte)));
t('a mensagem de sucesso só sai quando realmente está tudo certo',
  cn.indexOf('salvo e conferido na nuvem') > cn.indexOf('var semCat=ids.filter'));

/* ==========================================================
   4. DESCONCILIAR DEIXA RASTRO
   ========================================================== */
console.log('\n── Desconciliar passa a ter motivo, prazo e trilha\n');

const dc = semComentario(corpoDaFuncao('desconciliar', fonte));
t('recusa desconciliar o que não está conciliado', /if\(!l\.conciliado\)/.test(dc));
t('exige motivo escrito', /if\(!motivo\)\{toast\(/.test(dc));
t('e o motivo é pedido dentro do aviso, não num prompt do navegador',
  /campo:\{id:'dcMotivo'/.test(dc) && !/window\.prompt/.test(dc));
t('NÃO apaga mais o "antes": a data anterior fica guardada',
  /de:l\.dataConc\|\|''/.test(dc));
t('guarda quem desconciliou e quando', /por:\(quem&&quem\.nome\)/.test(dc) && /em:new Date\(\)/.test(dc));
t('e guarda em lista — desconciliar duas vezes não apaga a primeira',
  /l\.desconc=l\.desconc\|\|\[\]/.test(dc) && /l\.desconc\.push\(/.test(dc));
t('marca quando foi fora do prazo', /foraDoPrazo:fora/.test(dc));
t('o prazo padrão é de três dias', /var DIAS_DESCONCILIAR=3;/.test(fonte));
t('fora do prazo o aviso muda de tom', /tipo:fora\?'perigo':''/.test(dc));
t('e sobe para a nuvem', /if\(NUVEM\.ligada\)sincronizar\(\)/.test(dc));

/* a conta de dias, rodando de verdade */
(function () {
  /* o dia da loja e fixo no teste: a conta tem de ser de CALENDARIO, e
     nao pode mudar de resposta conforme a hora em que o teste roda */
  const amb = { hojeISO: () => '2026-09-30' };
  const f = (l) => new Function('amb', 'l',
    'with(amb){' + corpoDaFuncao('diasDesdeConciliacao', fonte) +
    '\n return diasDesdeConciliacao(l);}')(amb, l);
  t('conciliado hoje: zero dias', f({ dataConc: '2026-09-30' }) === 0, f({ dataConc: '2026-09-30' }));
  t('conciliado ontem: um dia', f({ dataConc: '2026-09-29' }) === 1, f({ dataConc: '2026-09-29' }));
  t('conciliado há cinco dias: cinco', f({ dataConc: '2026-09-25' }) === 5, f({ dataConc: '2026-09-25' }));
  t('atravessa a virada do mês', f({ dataConc: '2026-08-31' }) === 30, f({ dataConc: '2026-08-31' }));
  t('sem data de conciliação: não dá para dizer', f({ dataConc: '' }) === null);
  t('data inválida não estoura', f({ dataConc: 'ontem' }) === null);
})();

/* ==========================================================
   5. O CAMPO DENTRO DO AVISO
   ========================================================== */
console.log('\n── E o aviso do sistema passa a aceitar um motivo escrito\n');

const cf = semComentario(corpoDaFuncao('confirmar', fonte));
t('o aviso monta um campo quando pedem', /op\.campo\?/.test(cf));
t('o valor sai por window._cfCampo, como o checkbox já fazia',
  /window\._cfCampo=cmp\?String\(cmp\.value\|\|''\)\.trim\(\):''/.test(cf));
t('e o retorno continua sendo sim/não — nenhum chamador de hoje muda',
  /resolve\(v\)/.test(cf));
t('sem `campo`, nada muda no aviso de sempre', /op\.campo\?/.test(cf) && /:''\)\+/.test(cf));
t('e não usa window.prompt, que o navegador bloqueia em silêncio',
  !/window\.prompt/.test(cf));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o financeiro não deixa passar');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — O RELATÓRIO SOMAVA A REDE INTEIRA (V378)

   O aparelho baixa a REDE TODA: o corte do download é por loja, não por
   unidade. Quem separa é o relatório — e metade deles não separava.

   Quem abria Santa Fé via o consumo de insumos, as vendas por mesa e o
   fluxo de caixa somados com Jales, e nada na tela dizia isso. Um
   número maior do que a realidade da loja, com cara de número da loja.

   A matriz continua comparando a rede, por desenho: é para isso que ela
   olha o relatório.

   E o DRE ganhou a segunda parte desta mesma verdade: imposto,
   royalties, fundo de promoção e taxa de cartão **não são lançamentos**
   — são percentuais aplicados sobre o faturamento e sobre o cadastro da
   forma de pagamento. Na tabela apareciam com a mesma cara de uma linha
   lançada de verdade. Número estimado apresentado como real é a pior
   classe de erro: a que ninguém sabe que existe.
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
   1. A TRAVA, RODANDO DE VERDADE
   ========================================================== */
console.log('\n── A trava de unidade, para o que não é venda\n');

const daUn = (suc) => new Function('amb', 'x',
  'with(amb){' + corpoDaFuncao('daUnidadeAberta', fonte) + '\n return daUnidadeAberta(x);}')
  ({ lojaAtualId: () => suc, ehSucMatriz: s => s === 'suc_matriz' }, arguments[1]);

const f = (suc, x) => new Function('amb', 'x',
  'with(amb){' + corpoDaFuncao('daUnidadeAberta', fonte) + '\n return daUnidadeAberta(x);}')
  ({ lojaAtualId: () => suc, ehSucMatriz: s => s === 'suc_matriz' }, x);

t('o registro da própria unidade passa', f('suc_sf', { sucursalId: 'suc_sf' }) === true);
t('O DA OUTRA LOJA NÃO PASSA — era isto que somava Jales com Santa Fé',
  f('suc_sf', { sucursalId: 'suc_jales' }) === false);
t('a matriz continua vendo a rede inteira', f('suc_matriz', { sucursalId: 'suc_jales' }) === true);
t('registro antigo, sem unidade, é da loja aberta', f('suc_sf', {}) === true);
/* lançamento e movimento guardam a unidade com nomes diferentes */
t('reconhece o campo do lançamento financeiro (sucursalRef)',
  f('suc_sf', { sucursalRef: 'suc_jales' }) === false);
t('e o carimbo de origem (_suc)', f('suc_sf', { _suc: 'suc_jales' }) === false);
t('sem unidade aberta, não filtra nada — não é hora de esconder dado',
  f('', { sucursalId: 'suc_jales' }) === true);

/* ==========================================================
   2. OS TRÊS RELATÓRIOS QUE FALTAVAM
   ========================================================== */
console.log('\n── Itens Consumidos, Vendas por Mesa e Fluxo de Caixa\n');

t('Itens Consumidos separa a unidade',
  /daUnidadeAberta\(m\)/.test(semComentario(corpoDaFuncao('telaItensConsumidos', fonte))));
t('e ignora a movimentação de demonstração',
  /m\.demo\|\|!daUnidadeAberta\(m\)/.test(semComentario(corpoDaFuncao('telaItensConsumidos', fonte))));

const rm = semComentario(corpoDaFuncao('telaRelMesas', fonte));
t('Vendas por Mesa separa a unidade', /vendaDaUnidadeAberta\(p\)/.test(rm));
t('e passa a enxergar o histórico da nuvem, não só os 30 dias do aparelho',
  /fontePedidos\(\)/.test(rm) && !/\(DB\.pedidos\|\|\[\]\)/.test(rm));
t('e tira a venda de demonstração', /ehCancelado\(p\)\|\|p\.demo/.test(rm));

const em = semComentario(corpoDaFuncao('exportarMesas', fonte));
t('o CSV usa exatamente a mesma lista da tela',
  /fontePedidos\(\)/.test(em) && /vendaDaUnidadeAberta\(p\)/.test(em) && /p\.demo/.test(em));
t('E A MESMA DATA: a tela usava o dia da loja e o CSV cortava o texto cru',
  /dataBR\(diaLocal\(p\.data\)\)/.test(em));

t('Fluxo de Caixa separa a unidade',
  /daUnidadeAberta\(l\)/.test(semComentario(corpoDaFuncao('lancDoMes', fonte))));
t('e o DRE também, nos lançamentos financeiros',
  /if\(!daUnidadeAberta\(l\)\)return;/.test(semComentario(corpoDaFuncao('calcularDRE', fonte))));

/* ==========================================================
   3. O QUE É CALCULADO DIZ QUE É CALCULADO
   ========================================================== */
console.log('\n── Número estimado para de se passar por lançamento\n');

const dre = semComentario(corpoDaFuncao('calcularDRE', fonte));
t('o DRE marca imposto calculado', /calc\['03'\]=true/.test(dre));
t('royalties calculados', /calc\['04\.01'\]=true/.test(dre));
t('fundo de promoção calculado', /calc\['04\.02'\]=true/.test(dre));
t('e a taxa de cartão, que sai do cadastro e não do extrato', /calc\['05'\]=true/.test(dre));
t('a marca viaja junto com os números', /m\.calc=calc/.test(dre));
t('o galho do detalhe também diz "(calculado)"',
  /\(calculado\) Alíquota de/.test(corpoDaFuncao('calcularDRE', fonte)) &&
  /\(calculado\) Royalties de/.test(corpoDaFuncao('calcularDRE', fonte)));

const corpo = corpoDaFuncao('corpoDRE', fonte);
t('e a linha da tabela mostra a etiqueta', /m\.calc&&m\.calc\[r\.c\]/.test(corpo));
t('com a explicação de onde o número veio', /não veio de lançamento/.test(corpo));
t('usando a etiqueta que já existe no sistema', /class="grpTag"/.test(corpo));

/* a marca não pode nascer sozinha: ela depende de o valor ter sido
   realmente calculado naquele mês */
t('a marca do imposto só nasce quando há alíquota configurada',
  /if\(Number\(c\.aliqImposto\)>0&&!m\[k2\]\['03'\]\)\{[\s\S]{0,260}?calc\['03'\]=true/.test(dre));
t('e o cálculo só entra quando NINGUÉM lançou o valor de verdade no mês',
  /!m\[k2\]\['03'\]/.test(dre) && /!m\[k2\]\['04\.01'\]/.test(dre) && /!m\[k2\]\['04\.02'\]/.test(dre));
t('a taxa de cartão só é marcada quando houve taxa', /if\(v\)calc\['05'\]=true;/.test(dre));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o relatório separa a unidade');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

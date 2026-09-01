/* ==========================================================
   A CONTAGEM E DO FIM DAQUELE DIA

   A loja conta de manha, antes de abrir, o que sobrou da noite
   anterior. Se a contagem valer pelo dia de HOJE, ela esta errada assim
   que a primeira venda sair: "tinha 2 copos" vira mentira depois de
   vender os 2.

   O Rafael descreveu exatamente assim em 31/08/2026: "se eu colocar que
   tenho dois copinho no dia trinta e um, quer dizer que eu acabei meu
   dia com dois copos".

   A conta e em dois passos:
     1. a diferenca e achada contra o saldo DAQUELE DIA;
     2. a diferenca e aplicada ao estoque de HOJE.
   Assim o que a loja vendeu depois da data contada continua valendo.

   As funcoes sao as de VERDADE, tiradas do index.html.

   Rodar:  node testes/contagem-retroativa.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const nu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — a contagem com data\n');

const HOJE = '2026-09-01';
const ONTEM = '2026-08-31';

function motor(ctx) {
  const nomes = ['dataDaContagem', 'contagemRetroativa', 'sistemaNaContagem', 'saldoNaData'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  return new Function('ctx', `
    var DB=ctx.DB, CT2=ctx.CT2, _quieto=function(){};
    var hojeISO=ctx.hojeISO, lojaAtualId=ctx.lojaAtualId, saldoUn=ctx.saldoUn,
        itemEstoque=ctx.itemEstoque, convUnid=ctx.convUnid;
    ${codigo}
    return {${nomes.join(',')}};
  `)(ctx);
}

/* a loja: 2 copos no fim de 31/08, e no dia 01 vendeu 2 */
const COPO = { id: 'in_copo', nome: 'Copo P', unidade: 'un', estoqueAtual: 0 };
function mundo(CT2) {
  const DB = { movEst: [
    /* venda do dia 01: saiu 2 */
    { id: 'mv1', data: HOJE, sucursalId: 'suc_sf', origem: 'venda',
      linhas: [{ insumoId: 'in_copo', qtd: 2, unidade: 'un', direcao: 'saida' }] }
  ] };
  return motor({ DB: DB, CT2: CT2,
    hojeISO: () => HOJE, lojaAtualId: () => 'suc_sf',
    saldoUn: () => 0,                       /* hoje o sistema diz ZERO */
    itemEstoque: () => COPO,
    convUnid: (q) => q });
}

console.log('   cenário: o sistema diz 0 copos hoje; no dia 01 saíram 2 na venda\n');

let M = mundo({ data: ONTEM });
t('sem data escolhida, a contagem é de hoje',
  mundo({ data: '' }).dataDaContagem() === HOJE);
t('com a data de ontem, ela é retroativa', M.contagemRetroativa() === true);
t('e a de hoje não é', mundo({ data: HOJE }).contagemRetroativa() === false);
t('data no futuro cai para hoje — contagem do futuro não existe',
  mundo({ data: '2026-12-25' }).dataDaContagem() === HOJE);

/* o coração: o saldo com que a contagem compara */
t('O SALDO DE 31/08 É 2 — o sistema desfaz a venda do dia 01',
  M.sistemaNaContagem(COPO) === 2, M.sistemaNaContagem(COPO));
t('e o saldo de hoje continua sendo 0',
  mundo({ data: HOJE }).sistemaNaContagem(COPO) === 0);

/* o caso do Rafael: contou 2 no dia 31, e não sobrou nada hoje */
const contado = 2;
const sisNaData = M.sistemaNaContagem(COPO);
const diferenca = contado - sisNaData;
t('contando 2 em 31/08, a diferença é ZERO — o estoque estava certo',
  diferenca === 0, diferenca);
t('e o estoque de hoje continua zero, porque os 2 foram vendidos',
  0 + diferenca === 0);

/* agora com divergência de verdade: contou 5, o sistema achava 2 */
const dif2 = 5 - sisNaData;
t('contando 5 em 31/08, sobraram 3', dif2 === 3);
t('e o estoque de HOJE passa a ser 3, não 5 — a venda do dia 01 não some',
  0 + dif2 === 3);

/* item sem movimento nenhum depois da data: os dois saldos batem */
const semMov = motor({ DB: { movEst: [] }, CT2: { data: ONTEM },
  hojeISO: () => HOJE, lojaAtualId: () => 'suc_sf',
  saldoUn: () => 7, itemEstoque: () => COPO, convUnid: q => q });
t('item que não se moveu depois da data tem o mesmo saldo nos dois dias',
  semMov.sistemaNaContagem(COPO) === 7, semMov.sistemaNaContagem(COPO));

/* movimento de OUTRA unidade não pode entrar na conta desta */
const outraLoja = motor({ DB: { movEst: [
    { id: 'mv2', data: HOJE, sucursalId: 'suc_alpha', origem: 'venda',
      linhas: [{ insumoId: 'in_copo', qtd: 9, unidade: 'un', direcao: 'saida' }] }] },
  CT2: { data: ONTEM }, hojeISO: () => HOJE, lojaAtualId: () => 'suc_sf',
  saldoUn: () => 4, itemEstoque: () => COPO, convUnid: q => q });
t('venda de outra unidade não mexe no saldo desta',
  outraLoja.sistemaNaContagem(COPO) === 4, outraLoja.sistemaNaContagem(COPO));

/* entrada depois da data também é desfeita */
const comEntrada = motor({ DB: { movEst: [
    { id: 'mv3', data: HOJE, sucursalId: 'suc_sf', origem: 'compra',
      linhas: [{ insumoId: 'in_copo', qtd: 10, unidade: 'un', direcao: 'entrada' }] }] },
  CT2: { data: ONTEM }, hojeISO: () => HOJE, lojaAtualId: () => 'suc_sf',
  saldoUn: () => 12, itemEstoque: () => COPO, convUnid: q => q });
t('compra que chegou depois da data é desfeita no saldo daquele dia',
  comEntrada.sistemaNaContagem(COPO) === 2, comEntrada.sistemaNaContagem(COPO));

t('item nulo não quebra a folha', M.sistemaNaContagem(null) === 0);

console.log('\n── "Ontem" é o dia anterior DA LOJA\n');

/* ==========================================================
   A primeira versão do botão fazia `new Date()`, tirava um dia e
   cortava o `toISOString()`. Entre 21h e a meia-noite em Santa Fé do
   Sul já é o dia seguinte em Greenwich — então "ontem" devolvia HOJE, e
   a contagem que a loja faz depois de fechar (o caixa fecha 22:30)
   nasceria com a data errada, calada. A rolagem do relógio pegou isso
   na bateria, às 21h.
   ========================================================== */
const fOntem = new Function('ctx', `
  var hojeISO=ctx.hojeISO;
  ${corpoDaFuncao('diaAnteriorDaLoja', fonte)}
  return {diaAnteriorDaLoja:diaAnteriorDaLoja};
`);
t('ontem de 01/09 é 31/08',
  fOntem({ hojeISO: () => '2026-09-01' }).diaAnteriorDaLoja() === '2026-08-31',
  fOntem({ hojeISO: () => '2026-09-01' }).diaAnteriorDaLoja());
t('ontem de 01/01 é 31/12 do ano anterior',
  fOntem({ hojeISO: () => '2026-01-01' }).diaAnteriorDaLoja() === '2025-12-31');
t('ontem de 01/03 num ano bissexto é 29/02',
  fOntem({ hojeISO: () => '2028-03-01' }).diaAnteriorDaLoja() === '2028-02-29');
t('e nunca devolve o próprio dia de hoje',
  fOntem({ hojeISO: () => '2026-09-01' }).diaAnteriorDaLoja() !== '2026-09-01');
t('o botão usa o dia da loja, não o do meridiano',
  /function contagemDeOntem\(\)\{ mudarDataContagem\(diaAnteriorDaLoja\(\)\); \}/.test(nu));
t('e não sobrou toISOString no cálculo do dia anterior',
  !/setDate\(d\.getDate\(\)-1\);\s*mudarDataContagem\(d\.toISOString/.test(nu));

console.log('\n── Uma conta só, num lugar só\n');

t('a folha compara pela porta única', /var sis=sistemaNaContagem\(i\);/.test(nu));
t('o resumo do topo também', /var d=\(parseFloat\(c\)\|\|0\)-sistemaNaContagem\(i\)/.test(nu));
t('o rodapé também',
  (nu.match(/\(parseFloat\(c\)\|\|0\)-sistemaNaContagem\(i\)/g) || []).length >= 2);
t('"preencher com o sistema" usa o saldo daquela data',
  /CT2\.cont\[i\.id\]=String\(sistemaNaContagem\(i\)\)/.test(nu));
t('e o fechamento também', /var sis=sistemaNaContagem\(i\);\s*var conf=parseFloat\(c\)/.test(nu));
t('não sobrou nenhuma leitura direta do estoque na folha de contagem',
  !/var sis=Number\(i\.estoqueAtual\)\|\|0;/.test(nu));

console.log('\n── O ajuste leva a data da contagem\n');

t('o movimento nasce com a data contada, não com a de hoje',
  /var mov=\{id:uid\('mv'\),data:_dt,hora:agoraHM\(\),motivoId:'mv_cont'/.test(nu));
t('e a contagem também', /DB\.contagens\.push\(\{id:uid\('ct'\),data:_dt/.test(nu));
t('a contagem guarda o dia em que foi lançada', /lancadaEm:hojeISO\(\)/.test(nu));
t('e se ela é retroativa', /retroativa:_retro/.test(nu));
t('a pergunta antes de finalizar mostra a data',
  /Data da contagem: '\+dataBR\(_dt\)/.test(nu));
t('e explica que as vendas posteriores continuam valendo',
  /continua valendo/.test(fonte));

console.log('\n── A tela e os relatórios\n');

t('a folha tem o campo de data', /<input type="date" id="ctData"/.test(nu));
t('que não deixa escolher dia futuro', /max="'\+hojeISO\(\)\+'"/.test(nu));
t('tem o atalho de ontem, que é o caso do dia a dia',
  /onclick="contagemDeOntem\(\)"/.test(nu));
t('a coluna do sistema diz de que dia é o saldo',
  /'Qtd\. em '\+dataBR\(dataDaContagem\(\)\)/.test(nu));
t('o histórico marca a contagem lançada em outro dia',
  /lançada em '\+dataBR\(c\.lancadaEm\)/.test(nu));
t('o histórico continua separando sobra e perda',
  /Sobra no período/.test(fonte) && /Perda no período/.test(fonte));
t('e continua tendo o olhinho de cada uma',
  /verDivergencias\(\\'/.test(nu) || /verDivergencias\('/.test(nu));
t('o csv exportado abre com a data da contagem',
  /\['Contagem de',dataBR\(c\.data\)/.test(nu));
t('e traz item, sistema, conferido, diferença e valor',
  /\['Ingrediente','Unidade','No sistema','Conferido','Diferenca','Custo','Valor'\]/.test(nu));
t('a nova contagem começa no dia de hoje', /CT2\.data=hojeISO\(\);/.test(nu));
/* a asserção era pela linha literal e quebrou quando o rascunho entrou
   no meio dela; o que importa é o comportamento: data limpa e volta ao
   histórico, com o rascunho apagado junto */
t('e a data é limpa depois de finalizar',
  /CT2\.data='';/.test(nu) && /CT2\.aba='hist'/.test(nu));
t('e o rascunho da folha é apagado ao finalizar',
  /limparRascunhoContagem\(\)/.test(nu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

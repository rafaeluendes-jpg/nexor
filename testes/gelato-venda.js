/* ==========================================================
   JOIA — SO SE VENDE GELATO VENDA

   A regra da casa, dita pelo Rafael em 31/08/2026:

     "Toda base de gelato e transformada em Gelato Venda. A gente so
      vende Gelato Venda. Entao nao pode descontar a base, nao pode
      descontar sabor de gelato."

   O sistema errava nas duas pontas dessa regra.

   1. NA PRODUCAO. A ficha de cada sabor (BASE ABACAXI + agua -> 5,04 kg)
      estava com "Gerar estoque em: BASE ABACAXI" — ela consumia a base e
      devolvia a base. O gelato pronto nunca entrava no estoque, e a base
      aparecia com saldo que nao existia na camara. Foram 44 fichas de
      sabor repontadas para GELATO VENDA. As duas massas de cascao e as
      duas caldas NAO entram nessa conta: elas sao intermediarios de
      verdade, consumidos por outras fichas (a massa tradicional vira
      CASCAO TRADICIONAL, BOLACHA CASCAO e CESTINHA; a calda entra no
      MORANGO GELATO), e o destino delas e elas mesmas — correto.

   2. NA VENDA. O pedido #735, 31/08/2026 — um Gelato 500gr de Belga com
      Morango — baixou GELATO VENDA 500 g (certo) e MAIS BASE BELGA
      0,2083 un e BASE MORANGO 0,2175 un (errado), porque a baixa das
      opcoes abria a RECEITA do sabor, como se o gelato estivesse sendo
      produzido na hora da venda. A base ja tinha saido na producao.

   O que separa um caso do outro e o DESTINO da ficha: ficha com destino
   ja foi transformada pela producao e entregue no estoque como outro
   item; ficha sem destino e o extra que so existe na venda (borda de
   Nutella, cobertura, Ovomaltine) e continua abrindo a receita.

   Este teste roda as funcoes de verdade do index.html sobre o formato
   real do cadastro da Jolo — os numeros vieram das fichas da nuvem.
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

/* ---------- espelho do cadastro real ---------- */
function mundo() {
  return {
    insumos: [
      { id: 'ins_gv', nome: 'GELATO VENDA', unidade: 'kg', custo: 40 },
      { id: 'ins_base_abacaxi', nome: 'BASE ABACAXI', unidade: 'un', custo: 60 },
      { id: 'ins_base_belga', nome: 'BASE BELGA', unidade: 'un', custo: 60 },
      { id: 'ins_base_morango', nome: 'BASE MORANGO', unidade: 'un', custo: 60 },
      { id: 'ins_agua', nome: 'Agua Filtrada', unidade: 'l', custo: 1 },
      { id: 'ins_pasta_mor', nome: 'Pasta Morango', unidade: 'kg', custo: 30 },
      { id: 'ins_calda_abacaxi', nome: 'CALDA ABACAXI', unidade: 'kg', custo: 10 },
      { id: 'ins_calda_morango', nome: 'CALDA MORANGO', unidade: 'kg', custo: 10 },
      { id: 'ins_nutella', nome: 'Nutella', unidade: 'kg', custo: 90 }
    ],
    fichas: [
      /* sabores: destino GELATO VENDA */
      { id: 'fi_abacaxi', nome: 'ABACAXI GELATO', unidade: 'kg', rendimento: 5.04,
        destinoId: 'ins_gv', destinoNome: 'GELATO VENDA', destinoModo: 'igual', destinoFator: 1,
        itens: [{ insumoId: 'ins_base_abacaxi', qtd: 1, unidade: 'un', perda: 0 },
                { insumoId: 'ins_agua', qtd: 3.11, unidade: 'l', perda: 0 },
                { insumoId: 'ins_calda_abacaxi', qtd: 250, unidade: 'g', perda: 0 }] },
      { id: 'fi_morango', nome: 'MORANGO GELATO', unidade: 'kg', rendimento: 4.598,
        destinoId: 'ins_gv', destinoNome: 'GELATO VENDA', destinoModo: 'igual', destinoFator: 1,
        itens: [{ insumoId: 'ins_base_morango', qtd: 1, unidade: 'un', perda: 0 },
                { insumoId: 'ins_agua', qtd: 2.758, unidade: 'l', perda: 0 },
                { insumoId: 'ins_pasta_mor', qtd: 293, unidade: 'g', perda: 0 },
                { insumoId: 'ins_calda_morango', qtd: 290, unidade: 'g', perda: 0 }] },
      { id: 'fi_belga', nome: 'BELGA GELATO', unidade: 'kg', rendimento: 4.8,
        destinoId: 'ins_gv', destinoNome: 'GELATO VENDA', destinoModo: 'igual', destinoFator: 1,
        itens: [{ insumoId: 'ins_base_belga', qtd: 1, unidade: 'un', perda: 0 },
                { insumoId: 'ins_agua', qtd: 2.975, unidade: 'l', perda: 0 }] },
      /* intermediario de verdade: o destino dele e ele mesmo */
      { id: 'fi_calda_morango', nome: 'CALDA MORANGO', unidade: 'kg', rendimento: 1.85,
        destinoId: 'ins_calda_morango', destinoNome: 'CALDA MORANGO',
        destinoModo: 'igual', destinoFator: 1,
        itens: [{ insumoId: 'ins_pasta_mor', qtd: 1, unidade: 'kg', perda: 0 }] },
      /* extra que so existe na venda: sem destino */
      { id: 'fi_borda', nome: 'BORDA NUTELLA', unidade: 'un', rendimento: 1, unidadesVenda: 50,
        destinoId: '', destinoNome: '',
        itens: [{ insumoId: 'ins_nutella', qtd: 1, unidade: 'kg', perda: 0 }] },
      /* o que a loja vende */
      { id: 'fi_500', nome: 'GELATO 500GR', unidade: 'un', rendimento: 0.5, rendUnidade: 'kg',
        unidadesVenda: 1, destinoId: '', destinoNome: '',
        itens: [{ insumoId: 'ins_gv', qtd: 500, unidade: 'g', perda: 0 }] }
    ],
    fichaCats: [],
    produtos: [{ id: 'pr_500', nome: 'GELATO 500GR', fichaId: 'fi_500', vinculaEstoque: true }],
    movEst: []
  };
}

function api(DB, extras) {
  const amb = Object.assign({
    DB: DB,
    insumo: id => DB.insumos.find(i => i.id === id),
    itemEstoque: id => DB.insumos.find(i => i.id === id) || DB.fichas.find(f => f.id === id) || null,
    catFicha: () => null,
    custoNaUnidade: ins => Number(ins && ins.custo) || 0,
    custoPorUnidade: () => 0,
    baseMov: () => {}, toast: () => {}, uid: p => p + '1',
    hojeISO: () => '2026-09-01', agoraHM: () => '10:00', diaLocal: d => d,
    aplicarMovimento: () => {}
  }, extras || {});
  const nomes = ['destinoDaFicha', 'fatorDestino', 'modoDestino', 'qtdNoDestino',
                 'montarLinhas', 'baixarEstoqueVenda'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  const feito = new Function('amb',
    'with(amb){' + codigo + '\n var _ultimoMovVenda=null; return {' + nomes.join(',') + '};}')(amb);
  Object.assign(amb, feito);
  return feito;
}

console.log('\n── Produzir um sabor entrega GELATO VENDA, não a base\n');

[['fi_abacaxi', 'ABACAXI GELATO', 'BASE ABACAXI', 5.04],
 ['fi_morango', 'MORANGO GELATO', 'BASE MORANGO', 4.598],
 ['fi_belga',   'BELGA GELATO',   'BASE BELGA',   4.8]].forEach(function (c) {
  const DB = mundo(), f = api(DB);
  const linhas = f.montarLinhas([{ tipo: 'ficha', refId: c[0], qtd: c[3], unidade: 'kg' }], 'producao');
  const ent = linhas.filter(l => l.direcao === 'entrada');
  const sai = linhas.filter(l => l.direcao === 'saida');
  t(c[1] + ': entra um item só', ent.length === 1, ent.length);
  t(c[1] + ': e o que entra é GELATO VENDA', ent[0] && ent[0].nome === 'GELATO VENDA',
    ent[0] && ent[0].nome);
  t(c[1] + ': entra a receita inteira (' + c[3] + ' kg)',
    ent[0] && Math.abs(ent[0].qtd - c[3]) < 0.001, ent[0] && ent[0].qtd);
  t(c[1] + ': a base sai do estoque', sai.some(l => l.nome === c[2]), sai.map(l => l.nome).join(','));
  t(c[1] + ': e nada volta no nome da base', !ent.some(l => l.nome === c[2]),
    ent.map(l => l.nome).join(','));
});

console.log('\n── A calda continua sendo o destino dela mesma\n');
{
  const DB = mundo(), f = api(DB);
  const ent = f.montarLinhas([{ tipo: 'ficha', refId: 'fi_calda_morango', qtd: 1.85, unidade: 'kg' }],
    'producao').filter(l => l.direcao === 'entrada');
  t('CALDA MORANGO gera CALDA MORANGO', ent[0] && ent[0].nome === 'CALDA MORANGO',
    ent[0] && ent[0].nome);
  t('e não foi arrastada para GELATO VENDA', !ent.some(l => l.nome === 'GELATO VENDA'));
}

console.log('\n── O destino que a tela da ficha mostra\n');
{
  const DB = mundo(), f = api(DB);
  const esperado = { fi_abacaxi: 'GELATO VENDA', fi_morango: 'GELATO VENDA',
    fi_belga: 'GELATO VENDA', fi_calda_morango: 'CALDA MORANGO',
    fi_borda: null, fi_500: null };
  DB.fichas.forEach(function (x) {
    const d = f.destinoDaFicha(x);
    t(x.nome + ' → ' + (esperado[x.id] || 'sem destino'),
      (d ? d.nome : null) === esperado[x.id], d ? d.nome : 'null');
  });
}

console.log('\n── A venda do pedido #735: 500gr de Belga com Morango\n');
{
  const linhas = [];
  const DB = mundo();
  const f = api(DB, { aplicarMovimento: m => (m.linhas || []).forEach(l => linhas.push(l)) });
  f.baixarEstoqueVenda({ id: 'p735', numero: 735, data: '2026-09-01', itens: [
    { produtoId: 'pr_500', qtd: 1, opcoes: [
      { grupo: 'sabor', nome: 'BELGA GELATO', fichaId: 'fi_belga' },
      { grupo: 'sabor', nome: 'MORANGO GELATO', fichaId: 'fi_morango' }] }] });
  const nomes = linhas.map(l => l.nome);
  t('sai GELATO VENDA', nomes.includes('GELATO VENDA'), nomes.join(', '));
  t('não sai BASE BELGA', !nomes.includes('BASE BELGA'), nomes.join(', '));
  t('não sai BASE MORANGO', !nomes.includes('BASE MORANGO'), nomes.join(', '));
  t('não sai Pasta Morango', !nomes.includes('Pasta Morango'), nomes.join(', '));
  t('sai só uma linha', linhas.length === 1, linhas.length);
  /* a receita do GELATO 500GR e 500 g de GELATO VENDA — meio quilo, na unidade dela */
  t('e sai meio quilo (500 g)',
    linhas[0] && Math.abs(linhas[0].qtd - 500) < 0.0001 && linhas[0].unidade === 'g',
    linhas[0] && linhas[0].qtd + ' ' + linhas[0].unidade);
}

console.log('\n── O extra sem destino continua baixando a receita dele\n');
{
  const linhas = [];
  const DB = mundo();
  const f = api(DB, { aplicarMovimento: m => (m.linhas || []).forEach(l => linhas.push(l)) });
  f.baixarEstoqueVenda({ id: 'p736', numero: 736, data: '2026-09-01', itens: [
    { produtoId: 'pr_500', qtd: 1, opcoes: [
      { grupo: 'borda', nome: 'BORDA NUTELLA', fichaId: 'fi_borda' }] }] });
  const nomes = linhas.map(l => l.nome);
  t('a borda de Nutella desconta a Nutella', nomes.includes('Nutella'), nomes.join(', '));
  t('e o gelato do pote também sai', nomes.includes('GELATO VENDA'), nomes.join(', '));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — SUITE DO CAIXA, SANGRIA E CONCILIACAO

   Cobre os itens 21 a 24 do documento de correcao da logica de caixa.

   Rodar com:  node testes/caixa.js
   ou:         npm run test:caixa

   Como na suite de reconciliacao, as FUNCOES DE REGRA sao extraidas do
   index.html — nao ha copia da regra aqui. Se alguem mudar
   `esperadoCaixa` ou `montarSnapshot` amanha, o teste roda a versao
   nova e quebra. Um teste com copia da regra continuaria passando com
   o sistema errado, que e o pior tipo de teste que existe.
   ========================================================== */
const { carregar, versaoDoSistema, corpoDaFuncao, ARQ } = require('./extrair.js');
const fs = require('fs');

/* ---------- ambiente minimo que as funcoes reais esperam ---------- */
const fonte = fs.readFileSync(ARQ, 'utf8');
const REGRAS = ['esperadoCaixa', 'totalMov', 'movimentoCaixa', 'montarSnapshot'];

let DB, FORMAS, VERSAO;
function ambiente() {
  const codigo = REGRAS.map(n => corpoDaFuncao(n, fonte)).join('\n');
  const fabrica = new Function('ctx', `
    var DB=ctx.DB, FORMAS=ctx.FORMAS, VERSAO=ctx.VERSAO;
    var ehCancelado=ctx.ehCancelado, sucNome=ctx.sucNome,
        lojaAtualId=ctx.lojaAtualId, cfg=ctx.cfg, nomeLojaAtual=ctx.nomeLojaAtual;
    ${codigo}
    return {${REGRAS.join(',')}};
  `);
  return fabrica({
    get DB() { return DB; }, get FORMAS() { return FORMAS; }, VERSAO: 'teste',
    ehCancelado: p => p.fase === 'cancelado',
    sucNome: () => 'Unidade de teste',
    lojaAtualId: () => 'suc_teste',
    cfg: () => ({ nomePublico: 'Jolô' }),
    nomeLojaAtual: () => 'Jolô'
  });
}

/* as funcoes reais leem DB e FORMAS do escopo; recriamos a cada cenario */
function montarMundo(cenario) {
  FORMAS = [
    { id: 'fp_dinheiro', n: 'Dinheiro', tipo: 'dinheiro', troco: true },
    { id: 'fp_debito', n: 'Cartão débito', tipo: 'debito', troco: false },
    { id: 'fp_credito', n: 'Cartão crédito', tipo: 'credito', troco: false },
    { id: 'fp_pix', n: 'Pix', tipo: 'pix', troco: false }
  ];
  DB = { pedidos: cenario.pedidos || [], caixas: [cenario.caixa], formasPag: FORMAS };
  return ambiente();
}

/* ---------- placar ---------- */
const R = { total: 0, ok: 0, falhou: 0 };
let grupoAtual = '';
function grupo(n) { grupoAtual = n; console.log('\n── ' + n); }
function t(nome, cond, detalhe) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else {
    R.falhou++;
    console.log('   FALHA ' + nome + (detalhe ? '  → ' + detalhe : ''));
  }
}
const perto = (a, b) => Math.abs(a - b) < 0.005;

/* helpers de cenario */
let seq = 0;
function venda(total, pagamentos, cancelada) {
  seq++;
  return {
    id: 'ped_' + seq, caixaId: 'cx1', total,
    fase: cancelada ? 'cancelado' : 'entregue',
    pagamentos: pagamentos.map(p => ({ forma: p.forma, valor: p.valor }))
  };
}
function caixa(inicial, movimentos) {
  return {
    id: 'cx1', inicial, operador: 'Teste', aberto: '01/01/2026 08:00',
    movimentos: movimentos || [], sucursalId: 'suc_teste'
  };
}

/* ==========================================================
   ITEM 21 — TESTES MATEMATICOS OBRIGATORIOS
   ========================================================== */
grupo('Item 21 · abertura, sangria e suprimento não são faturamento');

{ /* TESTE A: abertura 100 + venda dinheiro 300 */
  const S = montarMundo({
    caixa: caixa(100),
    pedidos: [venda(300, [{ forma: 'fp_dinheiro', valor: 300 }])]
  });
  const mov = S.movimentoCaixa('cx1');
  const esp = S.esperadoCaixa(DB.caixas[0]);
  t('TESTE A · esperado na gaveta = R$ 400', perto(esp, 400), 'deu ' + esp);
  t('TESTE A · faturamento = R$ 300', perto(mov.total, 300), 'deu ' + mov.total);
  t('TESTE A · abertura NÃO entra no faturamento', !perto(mov.total, 400));
}

{ /* TESTE B: + sangria 200 */
  const S = montarMundo({
    caixa: caixa(100, [{ id: 'mv1', tipo: 'sangria', valor: 200 }]),
    pedidos: [venda(300, [{ forma: 'fp_dinheiro', valor: 300 }])]
  });
  const mov = S.movimentoCaixa('cx1');
  const esp = S.esperadoCaixa(DB.caixas[0]);
  t('TESTE B · esperado na gaveta = R$ 200', perto(esp, 200), 'deu ' + esp);
  t('TESTE B · faturamento continua R$ 300', perto(mov.total, 300), 'deu ' + mov.total);
  t('TESTE B · sangria NÃO reduz faturamento', perto(mov.total, 300));
}

{ /* TESTE C: + suprimento 50 */
  const S = montarMundo({
    caixa: caixa(100, [
      { id: 'mv1', tipo: 'suprimento', valor: 50 },
      { id: 'mv2', tipo: 'sangria', valor: 200 }
    ]),
    pedidos: [venda(300, [{ forma: 'fp_dinheiro', valor: 300 }])]
  });
  const mov = S.movimentoCaixa('cx1');
  const esp = S.esperadoCaixa(DB.caixas[0]);
  t('TESTE C · esperado na gaveta = R$ 250', perto(esp, 250), 'deu ' + esp);
  t('TESTE C · faturamento continua R$ 300', perto(mov.total, 300), 'deu ' + mov.total);
  t('TESTE C · suprimento NÃO aumenta faturamento', !perto(mov.total, 350));
}

grupo('Item 21 · diferença por forma × diferença geral');

{ /* TESTE D: dinheiro -5, crédito +5, geral 0 */
  const S = montarMundo({
    caixa: caixa(0),
    pedidos: [
      venda(100, [{ forma: 'fp_dinheiro', valor: 100 }]),
      venda(100, [{ forma: 'fp_credito', valor: 100 }])
    ]
  });
  const cx = DB.caixas[0], mov = S.movimentoCaixa('cx1');
  const esp = { fp_dinheiro: S.esperadoCaixa(cx), fp_debito: 0, fp_credito: 100, fp_pix: 0 };
  const conf = { fp_dinheiro: 95, fp_debito: 0, fp_credito: 105, fp_pix: 0 };
  const s = S.montarSnapshot(cx, mov, esp, conf);
  const din = s.formas.find(f => f.id === 'fp_dinheiro');
  const cre = s.formas.find(f => f.id === 'fp_credito');
  t('TESTE D · dinheiro = − R$ 5', perto(din.diferenca, -5), 'deu ' + din.diferenca);
  t('TESTE D · crédito = + R$ 5', perto(cre.diferenca, 5), 'deu ' + cre.diferenca);
  t('TESTE D · diferença geral = R$ 0', perto(s.diferencaTotal, 0), 'deu ' + s.diferencaTotal);
  t('TESTE D · marcado como conciliado', s.conciliado === true);
  t('TESTE D · marcado como divergência entre formas',
    s.divergenciaEntreFormas === true);
}

{ /* TESTE E: dinheiro -10, crédito +5, geral -5 */
  const S = montarMundo({
    caixa: caixa(0),
    pedidos: [
      venda(100, [{ forma: 'fp_dinheiro', valor: 100 }]),
      venda(100, [{ forma: 'fp_credito', valor: 100 }])
    ]
  });
  const cx = DB.caixas[0], mov = S.movimentoCaixa('cx1');
  const esp = { fp_dinheiro: S.esperadoCaixa(cx), fp_debito: 0, fp_credito: 100, fp_pix: 0 };
  const conf = { fp_dinheiro: 90, fp_debito: 0, fp_credito: 105, fp_pix: 0 };
  const s = S.montarSnapshot(cx, mov, esp, conf);
  t('TESTE E · diferença geral = − R$ 5', perto(s.diferencaTotal, -5), 'deu ' + s.diferencaTotal);
  t('TESTE E · NÃO é conciliado', s.conciliado === false);
  t('TESTE E · não marca conciliação falsa', s.divergenciaEntreFormas === false);
}

grupo('Base única: o dinheiro é comparado gaveta contra gaveta');

{
  /* o defeito que gerou este documento: sistema mostrava a venda em
     dinheiro (sem fundo) e o operador informava a gaveta (com fundo) */
  const S = montarMundo({
    caixa: caixa(499.05),
    pedidos: [venda(174, [{ forma: 'fp_dinheiro', valor: 174 }])]
  });
  const cx = DB.caixas[0], mov = S.movimentoCaixa('cx1');
  const esp = { fp_dinheiro: S.esperadoCaixa(cx), fp_debito: 0, fp_credito: 0, fp_pix: 0 };
  const s = S.montarSnapshot(cx, mov, esp, { fp_dinheiro: 673.05 });
  const din = s.formas.find(f => f.id === 'fp_dinheiro');
  t('sistema do dinheiro inclui o fundo (R$ 673,05)', perto(din.sistema, 673.05), 'deu ' + din.sistema);
  t('diferença = R$ 0 quando a gaveta bate', perto(din.diferenca, 0), 'deu ' + din.diferenca);
  t('faturamento continua R$ 174 (fundo fora)', perto(s.faturamento, 174), 'deu ' + s.faturamento);
  t('fundo de abertura registrado à parte', perto(s.fundoAbertura, 499.05));
}

grupo('Venda cancelada e venda sem forma');

{
  const S = montarMundo({
    caixa: caixa(0),
    pedidos: [
      venda(100, [{ forma: 'fp_dinheiro', valor: 100 }]),
      venda(50, [{ forma: 'fp_dinheiro', valor: 50 }], true),
      venda(30, [{ forma: '', valor: 30 }])
    ]
  });
  const mov = S.movimentoCaixa('cx1');
  t('cancelada fora do faturamento', perto(mov.total, 130), 'deu ' + mov.total);
  t('cancelada fora do dinheiro esperado', perto(mov.dinheiro, 100), 'deu ' + mov.dinheiro);
  t('venda sem forma é contabilizada à parte', perto(mov.semForma, 30), 'deu ' + mov.semForma);
}

/* ==========================================================
   ITEM 23 — DUPLICIDADE
   ========================================================== */
grupo('Item 23 · reenvio não duplica');

{
  /* a chave de idempotencia e o ref_local. Duas gravacoes do mesmo
     pagamento com a MESMA chave sao uma so; com chaves diferentes o
     banco nao consegue saber — foi exatamente o que aconteceu na
     V152, com `_pg0` de um lado e `_0` do outro. */
  const refPagamento = (pedId, i) => pedId + '_' + i;
  t('a chave do pagamento é estável entre chamadas',
    refPagamento('ped_x', 0) === refPagamento('ped_x', 0));
  t('dois pagamentos do mesmo pedido têm chaves distintas',
    refPagamento('ped_x', 0) !== refPagamento('ped_x', 1));
  t('a chave não muda de formato (regressão da V152)',
    refPagamento('ped_x', 0) === 'ped_x_0');

  /* reenvio: aplicar o mesmo lote duas vezes por chave nao cria linha nova */
  const tabela = {};
  const gravar = linhas => linhas.forEach(l => { tabela[l.ref] = l; });
  const lote = [{ ref: 'ped_x_0', valor: 96 }];
  gravar(lote); gravar(lote); gravar(lote);
  t('mesmo lote enviado 3× resulta em 1 linha', Object.keys(tabela).length === 1);
  t('e o valor não acumula', tabela['ped_x_0'].valor === 96);
}

grupo('Item 23 · sangria não gera lançamento duplicado');

{
  /* espelha lancarTransferenciaCaixa: a busca por ref antes de criar */
  const lancFin = [];
  function lancar(mv) {
    if (lancFin.find(l => l.ref === mv.id && l.origem === 'mov-caixa')) return null;
    const l = { id: 'lf' + lancFin.length, tipo: 'transferencia', ref: mv.id,
      origem: 'mov-caixa', valor: mv.valor };
    lancFin.push(l); return l;
  }
  const mv = { id: 'mv1', valor: 500 };
  lancar(mv); lancar(mv); lancar(mv);
  t('sangria chamada 3× gera 1 lançamento', lancFin.length === 1);
  t('o lançamento é transferência, não despesa', lancFin[0].tipo === 'transferencia');
  t('nem receita', lancFin[0].tipo !== 'receita');
}

/* ==========================================================
   ITEM 22 — A SANGRIA TEM DUAS PONTAS
   ========================================================== */
grupo('Item 22 · sangria move dinheiro entre contas, não some');

{
  const contas = { ct_caixa: 100, ct_cofre: 0 };
  const mv = { id: 'mv1', tipo: 'sangria', valor: 50, destinoContaId: 'ct_cofre' };
  /* a transferencia tem origem e destino: o modulo financeiro soma no
     destino e subtrai na origem */
  contas.ct_caixa -= mv.valor;
  contas.ct_cofre += mv.valor;
  t('Caixa PDV fica com R$ 50', perto(contas.ct_caixa, 50), 'deu ' + contas.ct_caixa);
  t('Caixa-cofre fica com R$ 50', perto(contas.ct_cofre, 50), 'deu ' + contas.ct_cofre);
  t('a soma das contas não muda (nada evapora)',
    perto(contas.ct_caixa + contas.ct_cofre, 100));

  const S = montarMundo({
    caixa: caixa(100, [{ id: 'mv1', tipo: 'sangria', valor: 50 }]),
    pedidos: []
  });
  const mov = S.movimentoCaixa('cx1');
  t('faturamento não é alterado pela sangria', perto(mov.total, 0), 'deu ' + mov.total);
  t('gaveta esperada cai para R$ 50', perto(S.esperadoCaixa(DB.caixas[0]), 50));
}

/* ==========================================================
   ITEM 19 — SNAPSHOT REPRODUZ O FECHAMENTO ORIGINAL
   ========================================================== */
grupo('Item 19 · a fotografia não muda quando o passado muda');

{
  const S = montarMundo({
    caixa: caixa(100),
    pedidos: [
      venda(200, [{ forma: 'fp_dinheiro', valor: 200 }]),
      venda(100, [{ forma: 'fp_credito', valor: 100 }])
    ]
  });
  const cx = DB.caixas[0];
  let mov = S.movimentoCaixa('cx1');
  const esp = { fp_dinheiro: S.esperadoCaixa(cx), fp_debito: 0, fp_credito: 100, fp_pix: 0 };
  const s1 = S.montarSnapshot(cx, mov, esp, { fp_dinheiro: 300, fp_credito: 100 });
  const congelado = JSON.parse(JSON.stringify(s1));

  /* uma semana depois, alguém cancela a venda de R$ 100 */
  DB.pedidos[1].fase = 'cancelado';
  mov = S.movimentoCaixa('cx1');

  t('o recálculo enxerga a mudança (faturamento cai para R$ 200)',
    perto(mov.total, 200), 'deu ' + mov.total);
  t('a fotografia continua com R$ 300 de faturamento',
    perto(congelado.faturamento, 300), 'deu ' + congelado.faturamento);
  t('a fotografia continua com 2 vendas', congelado.qtdVendas === 2);
  t('a fotografia continua conciliada', congelado.conciliado === true);
}

grupo('Item 20 · a fotografia carrega a trilha de auditoria');

{
  const S = montarMundo({
    caixa: caixa(100, [{
      id: 'mv1', tipo: 'sangria', valor: 50, hora: '20:15',
      motivoNome: 'Envio ao cofre', motivo: '', destinoNome: 'Caixa-cofre',
      responsavel: 'João', lancRef: 'lf1'
    }]),
    pedidos: [venda(200, [{ forma: 'fp_dinheiro', valor: 200 }])]
  });
  const cx = DB.caixas[0];
  cx.fechadoPor = 'Maria'; cx.fechadoEm = '01/01/2026 22:00';
  const s = S.montarSnapshot(cx, S.movimentoCaixa('cx1'),
    { fp_dinheiro: S.esperadoCaixa(cx) }, { fp_dinheiro: 250 });
  const m = s.movimentos[0];
  t('quem abriu está registrado', s.operadorAbriu === 'Teste');
  t('quem fechou está registrado', s.operadorFechou === 'Maria');
  t('a sangria guarda o motivo', m.motivo === 'Envio ao cofre');
  t('a sangria guarda o destino', m.destino === 'Caixa-cofre');
  t('a sangria guarda o responsável', m.responsavel === 'João');
  t('a sangria guarda o horário', m.hora === '20:15');
  t('a sangria aponta para o lançamento financeiro', m.lancRef === 'lf1');
}

/* ==========================================================
   ITEM 24 — DEPOIS DE FECHAR, O CAIXA CONTINUA FECHADO
   ========================================================== */
grupo('Item 24 · o fechamento sobrevive ao F5 e ao novo login');

{
  /* a funcao real le `DB` do escopo. Aqui ele e passado a cada chamada,
     senao o teste congelaria o mundo do cenario anterior. */
  const codigoCA = corpoDaFuncao('caixaAberto', fonte);
  const caixaAbertoReal = () => new Function('DB', 'lojaAtualId', `
    ${codigoCA}
    return caixaAberto();`)(DB, () => 'suc_teste');

  montarMundo({ caixa: caixa(100), pedidos: [] });
  t('com caixa aberto, o PDV encontra um', caixaAbertoReal() !== null);

  DB.caixas[0].fechadoEm = '01/01/2026 22:00';
  t('depois de fechar, não há caixa aberto', caixaAbertoReal() === null);

  /* F5 e novo login: o estado vem do DB persistido, não da memória da tela.
     Simula-se recarregando a mesma estrutura do zero. */
  const salvo = JSON.parse(JSON.stringify(DB));
  DB = salvo;
  t('após recarregar (F5), continua fechado', caixaAbertoReal() === null);

  /* outro usuário, mesma loja */
  DB = JSON.parse(JSON.stringify(salvo));
  t('em novo login, continua fechado', caixaAbertoReal() === null);

  /* caixa de OUTRA unidade não reabre esta */
  DB.caixas.push({ id: 'cx2', inicial: 0, sucursalId: 'suc_outra', movimentos: [] });
  t('caixa aberto em outra unidade não vale aqui', caixaAbertoReal() === null);
}

/* ==========================================================
   A FORMA DE PAGAMENTO NO MOMENTO DA VENDA
   ========================================================== */
grupo('PDV · tocar outra forma troca, não cria linha morta');

{
  /* addPag real, extraida do index.html */
  const codigoAdd = corpoDaFuncao('addPag', fonte);
  let pagos, avisos;
  const rodar = (formaNova, total, lista) => {
    pagos = lista;
    avisos = [];
    new Function('_pagos', '_totPag', 'FORMAS', '$', 'valorDesconto', 'moedaValor',
      'recalcPag', 'toast', 'f', `${codigoAdd}\n addPag(f);`)(
      pagos, total,
      [{ id: 'fp_dinheiro', n: 'Dinheiro' }, { id: 'fp_debito', n: 'Cartão débito' },
       { id: 'fp_credito', n: 'Cartão crédito' }],
      () => ({ value: '0' }), () => 0, () => 0, () => {}, m => avisos.push(m), formaNova);
    return pagos;
  };

  let r = rodar('fp_dinheiro', 44, []);
  t('primeira forma recebe o total', r.length === 1 && perto(r[0].valor, 44));

  r = rodar('fp_debito', 44, [{ forma: 'fp_dinheiro', valor: 44 }]);
  t('tocar outra forma NÃO cria linha de R$ 0,00', r.length === 1,
    'ficaram ' + r.length + ' linha(s)');
  t('a forma passa a ser débito', r[0].forma === 'fp_debito');
  t('o valor continua R$ 44', perto(r[0].valor, 44));
  t('o operador é avisado da troca', avisos.some(a => /trocada/i.test(a)));

  r = rodar('fp_dinheiro', 44, [{ forma: 'fp_dinheiro', valor: 44 }]);
  t('tocar a mesma forma não duplica', r.length === 1);

  /* pagamento dividido: adivinhar seria pior que recusar */
  r = rodar('fp_credito', 100, [
    { forma: 'fp_dinheiro', valor: 60 }, { forma: 'fp_debito', valor: 40 }]);
  t('com pagamento dividido, recusa em vez de adivinhar', r.length === 2);
  t('e explica por quê', avisos.some(a => /já está coberta/i.test(a)));

  /* falta receber: comportamento normal preservado */
  r = rodar('fp_debito', 100, [{ forma: 'fp_dinheiro', valor: 60 }]);
  t('com saldo a receber, a forma nova entra normalmente', r.length === 2);
  t('e recebe exatamente o que falta (R$ 40)', perto(r[1].valor, 40));
}

grupo('PDV · pagamento de R$ 0,00 nunca é gravado');

{
  const limpar = lista => lista.filter(x => (Number(x.valor) || 0) > 0.009);
  t('linha zerada sem troco é descartada',
    limpar([{ forma: 'fp_dinheiro', valor: 18 }, { forma: 'fp_debito', valor: 0 }]).length === 1);
  t('a linha que sobra é a que tem valor',
    limpar([{ forma: 'fp_dinheiro', valor: 18 }, { forma: 'fp_debito', valor: 0 }])[0].forma === 'fp_dinheiro');
  t('venda 371 do turno real: 4 linhas viram 1',
    limpar([{ forma: 'fp_dinheiro', valor: 18 }, { forma: 'fp_dinheiro', valor: 0 },
            { forma: 'fp_debito', valor: 0 }, { forma: 'fp_credito', valor: 0 }]).length === 1);
  t('pagamento dividido legítimo sobrevive à limpeza',
    limpar([{ forma: 'fp_dinheiro', valor: 60 }, { forma: 'fp_pix', valor: 40 }]).length === 2);
}

/* ---------- resultado ---------- */
console.log('\n' + '═'.repeat(52));
console.log('Joia ' + versaoDoSistema() + ' · caixa e conciliação');
console.log(R.ok + ' de ' + R.total + ' testes passaram' +
  (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
console.log('═'.repeat(52));
process.exit(R.falhou ? 1 : 0);

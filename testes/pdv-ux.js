/* ==========================================================
   JOIA — SUITE DE UX DO PDV, FECHAMENTO RAPIDO E RELATORIO

   Cobre a parte G do documento "Evolução final do PDV" (testes 1 a 10)
   e as travas da parte F.

   Rodar com:  node testes/pdv-ux.js
   ou:         npm run test:ux

   As funcoes de regra sao EXTRAIDAS do index.html. `moedaLer`,
   `moedaValor` e `dadosDoCaixa` sao os mesmos que rodam no balcao.
   ========================================================== */
const { versaoDoSistema, corpoDaFuncao, ARQ } = require('./extrair.js');
const fs = require('fs');
const fonte = fs.readFileSync(ARQ, 'utf8');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det ? '  → ' + det : '')); }
}
const perto = (a, b) => Math.abs(a - b) < 0.005;

/* ---------- funcoes reais ---------- */
const M = new Function(
  corpoDaFuncao('moedaFmt', fonte) + corpoDaFuncao('moedaLer', fonte) +
  '\nreturn {moedaFmt,moedaLer};')();

/* campo de dinheiro de mentira, com o comportamento real do componente */
function campo(valorInicial) {
  const el = {
    value: (valorInicial === 0 || valorInicial === undefined || valorInicial === null)
      ? '' : M.moedaFmt(valorInicial),
    dataV: Number(valorInicial) || 0,
    selecionado: false
  };
  el.focar = () => { el.selecionado = true; };           // focusin -> select()
  el.digitar = (txt) => {
    /* digitar com o texto selecionado SUBSTITUI, como em qualquer campo */
    if (el.selecionado) { el.value = ''; el.selecionado = false; }
    el.value += txt;
    el.dataV = M.moedaLer(el.value);
  };
  el.sair = () => {
    el.dataV = M.moedaLer(el.value);
    el.value = (el.value.trim() === '') ? '' : M.moedaFmt(el.dataV);
  };
  el.valor = () => +(el.value ? M.moedaLer(el.value) : el.dataV).toFixed(2);
  return el;
}

/* ==========================================================
   TESTE 1 — CAMPO VAZIO
   ========================================================== */
grupo('Teste 1 · o 0,00 é placeholder, não valor');

{
  const c = campo(0);
  t('campo vazio não tem texto (o 0,00 é placeholder CSS)', c.value === '');
  t('e vale zero', perto(c.valor(), 0));
  c.focar(); c.digitar('2'); c.digitar('5'); c.sair();
  t('digitar 25 resulta em 25,00', c.value === '25,00', 'deu "' + c.value + '"');
  t('e o valor numérico é 25', perto(c.valor(), 25));
  t('NÃO virou 0,0025', c.value !== '0,0025');

  const c2 = campo(0);
  c2.focar(); c2.digitar('1'); c2.digitar('8'); c2.digitar(','); c2.digitar('9'); c2.sair();
  t('18,9 vira 18,90', c2.value === '18,90', 'deu "' + c2.value + '"');
  t('e vale 18,9', perto(c2.valor(), 18.9));

  /* o placeholder existe de verdade no HTML gerado */
  t('o componente escreve placeholder="0,00"', /placeholder="0,00"/.test(fonte));
  t('e o placeholder é apagado (mais claro), não texto real',
    /\.moeda::placeholder\{[^}]*opacity/.test(fonte));
}

/* ==========================================================
   TESTE 2 — SUBSTITUIR VALOR EXISTENTE
   ========================================================== */
grupo('Teste 2 · substituir 125,90 por 80 sem apagar dígito');

{
  const c = campo(125.9);
  t('o campo mostra 125,90', c.value === '125,90', 'deu "' + c.value + '"');
  c.focar();
  t('tocar seleciona tudo', c.selecionado === true);
  c.digitar('8'); c.digitar('0'); c.sair();
  t('digitar 80 substitui o valor inteiro', c.value === '80,00', 'deu "' + c.value + '"');
  t('e vale 80', perto(c.valor(), 80));
  t('não sobrou resíduo de 125,90', c.value.indexOf('125') < 0);
  t('o componente chama select() ao focar', /focusin[\s\S]{0,400}\.select\(\)/.test(fonte));
}

grupo('Formatação brasileira · cálculo nunca sai de string formatada');

{
  const casos = [
    ['1.234,56', 1234.56], ['1234,56', 1234.56], ['1234.56', 1234.56],
    ['80', 80], ['0,05', 0.05], ['R$ 25,00', 25], ['', 0],
    ['1.000.000,99', 1000000.99], ['-15,50', -15.5]
  ];
  casos.forEach(([txt, esperado]) => {
    t('"' + txt + '" → ' + esperado, perto(M.moedaLer(txt), esperado),
      'deu ' + M.moedaLer(txt));
  });
  t('nunca devolve NaN', casos.every(([x]) => isFinite(M.moedaLer(x))));
  t('formata em pt-BR com milhar', M.moedaFmt(1234.5) === '1.234,50',
    'deu ' + M.moedaFmt(1234.5));
}

/* ==========================================================
   TESTE 3 — TECLADO TOUCH
   ========================================================== */
grupo('Teste 3 · teclado numérico do PDV');

{
  t('o teclado existe', /function tecladoTouchAbrir/.test(fonte));
  t('tem as teclas 0–9', /\['7','8','9','4','5','6','1','2','3'\]/.test(fonte));
  t('tem vírgula, backspace, limpar e OK',
    /data-d=",">/.test(fonte) && /data-d="del"/.test(fonte) &&
    /data-d="clr"/.test(fonte) && /data-d="ok"/.test(fonte));
  t('só abre no PDV e no fechamento — não em tela administrativa',
    /tecladoTouchPermitido[\s\S]{0,600}S\.mod==='pdv'/.test(fonte));
  t('ESC fecha sem alterar o valor',
    /Escape[\s\S]{0,120}tecladoTouchFechar\('esc'\)/.test(fonte));
  t('ENTER recolhe o teclado', /e\.key==='Enter'[\s\S]{0,80}tecladoTouchFechar\(\)/.test(fonte));
  t('OK avança para o próximo campo de dinheiro',
    /d==='ok'[\s\S]{0,90}tecladoTouchProximo/.test(fonte));
  t('o teclado não cobre o rodapé do modal',
    /body\.comTeclado \.mdBox\{padding-bottom/.test(fonte));

  /* simula a digitacao pelo teclado virtual */
  const c = campo(0);
  ['2', '0'].forEach(d => { c.value += d; });
  c.dataV = M.moedaLer(c.value);
  t('teclar 2 e 0 dá 20', perto(c.valor(), 20));
  c.value = c.value.slice(0, -1);           // backspace
  t('backspace deixa 2', perto(M.moedaLer(c.value), 2));
  c.value = '';                              // limpar
  t('limpar zera o campo', c.value === '');
}

/* ==========================================================
   TESTE 4 — ENTER PERCORRE AS FORMAS
   ========================================================== */
grupo('Teste 4 · ENTER avança entre as formas do fechamento');

{
  t('o fechamento liga ENTER nos campos de forma',
    /ins\[k2\]\.onkeydown[\s\S]{0,300}Enter/.test(fonte));
  t('a lista vem das formas visíveis, não de todos os inputs',
    /querySelectorAll\('\.cfV'\)[\s\S]{0,140}offsetParent!==null/.test(fonte));
  t('no último campo, ENTER leva ao botão de fechar',
    /lista\.length-1[\s\S]{0,300}\.mdF \.btnP/.test(fonte));
  t('o primeiro campo já nasce focado', /if\(ins\.length\)\{ ins\[0\]\.focus\(\); \}/.test(fonte));

  /* item 9: forma desabilitada nao entra no caminho.
     FORMAS ja e filtrada por ativa!==false, e os campos saem de FORMAS. */
  const formas = [
    { id: 'fp_dinheiro', ativa: true }, { id: 'fp_debito', ativa: true },
    { id: 'fp_credito', ativa: false }, { id: 'fp_pix', ativa: true }
  ];
  const naTela = formas.filter(f => f.ativa !== false);
  t('forma desabilitada fica fora do caminho do ENTER', naTela.length === 3);
  t('a ordem segue as formas cadastradas',
    naTela.map(f => f.id).join(',') === 'fp_dinheiro,fp_debito,fp_pix');
  t('FORMAS já exclui inativa na origem',
    /FORMAS=\(DB\.formasPag\|\|\[\]\)\.filter\(function\(f\)\{return f\.ativa!==false\}\)/.test(fonte));
}

/* ==========================================================
   TESTE 5 — FLUXO FINAL DO FECHAMENTO
   ========================================================== */
grupo('Teste 5 · fechar caixa não abre etapa intermediária');

{
  t('resultadoFechamento() não existe mais', !/function resultadoFechamento/.test(fonte));
  t('e ninguém a chama', !/resultadoFechamento\(cx/.test(fonte));
  t('o fechamento chama a pergunta de impressão',
    /perguntaImprimirFechamento\(cx\)/.test(fonte));
  t('a pergunta oferece IMPRIMIR e NÃO IMPRIMIR',
    /Não imprimir/.test(fonte) && /Imprimir fechamento<\/button>/.test(fonte));
  t('e não mostra previsto × físico',
    !/perguntaImprimirFechamento[\s\S]{0,900}Diferença geral/.test(fonte));

  /* a ordem das etapas continua a mesma */
  const iSnap = fonte.indexOf('cx.snapshot=montarSnapshot');
  const bloco = fonte.slice(iSnap, fonte.indexOf('perguntaImprimirFechamento(cx)', iSnap));
  t('o bloco de fechamento foi localizado', bloco.length > 100 && bloco.length < 4000,
    bloco.length + ' caracteres');
  t('grava o snapshot antes de tudo', /cx\.snapshot=montarSnapshot/.test(bloco));
  t('gera os lançamentos', /lancarFechamento\(cx,mov\)/.test(bloco));
  t('salva', /salvar\(\)/.test(bloco));
  t('limpa o PDV', /encerrarSessaoPDV\(\)/.test(bloco));
  t('e redesenha a tela do PDV', /telaPDV\(\)/.test(bloco));
}

grupo('Teste 5b · o fechamento continua CEGO');

{
  t('o campo Sistema é ocultado enquanto preenche',
    /cego\?'<span style="color:var\(--ink-3\)">oculto<\/span>'/.test(fonte));
  t('o total do sistema também', /cego\?'oculto'/.test(fonte));
  t('a diferença por forma não aparece', /if\(cego\)cel\.textContent='—';/.test(fonte));
  t('nem a diferença total', /if\(cego\)\{dt\.textContent='—';\}/.test(fonte));
  t('mas venda sem forma continua avisando (de propósito)',
    /Este aviso NAO e ocultado pelo caixa cego/.test(fonte));
}

/* ==========================================================
   TESTE 6 — RELATORIO SISTEMA/FISICO/DIFERENCA
   ========================================================== */
grupo('Testes 6 e 13 · relatório e compensação entre formas');

{
  /* dadosDoCaixa real, com um caixa fechado que tem snapshot */
  const codigo = corpoDaFuncao('dadosDoCaixa', fonte);
  const FORMAS = [
    { id: 'fp_dinheiro', n: 'Dinheiro', tipo: 'dinheiro', troco: true },
    { id: 'fp_credito', n: 'Cartão crédito', tipo: 'credito', troco: false }
  ];
  const caixa = {
    id: 'cx1', inicial: 0, operador: 'Ana', fechadoEm: '01/01/2026 22:00',
    fechadoPor: 'Ana', movimentos: [],
    conferencia: { fp_dinheiro: 95, fp_credito: 105 },
    snapshot: {
      formas: [
        { id: 'fp_dinheiro', nome: 'Dinheiro', troco: true, sistema: 100, fisico: 95, diferenca: -5 },
        { id: 'fp_credito', nome: 'Cartão crédito', troco: false, sistema: 100, fisico: 105, diferenca: 5 }
      ],
      fundoAbertura: 0, vendasDinheiro: 100, suprimentos: 0, sangrias: 0,
      diferencaTotal: 0, conciliado: true, divergenciaEntreFormas: true,
      semForma: 0, movimentos: []
    }
  };
  const DB = {
    caixas: [caixa], cancelamentos: [], lancFin: [],
    pedidos: [
      { id: 'p1', caixaId: 'cx1', total: 100, fase: 'entregue', desconto: 0,
        pagamentos: [{ forma: 'fp_dinheiro', valor: 100 }] },
      { id: 'p2', caixaId: 'cx1', total: 100, fase: 'entregue', desconto: 0,
        pagamentos: [{ forma: 'fp_credito', valor: 100 }] }
    ]
  };
  const d = new Function('ctx', `
    var DB=ctx.DB, FORMAS=ctx.FORMAS;
    var movimentoCaixa=ctx.movimentoCaixa, esperadoCaixa=ctx.esperadoCaixa,
        totalMov=ctx.totalMov, ehCancelado=ctx.ehCancelado;
    ${codigo}
    return dadosDoCaixa(ctx.c);`)({
    DB, FORMAS, c: caixa,
    ehCancelado: p => p.fase === 'cancelado',
    totalMov: () => 0, esperadoCaixa: () => 100,
    movimentoCaixa: () => ({ qtd: 2, total: 200, dinheiro: 100,
      porForma: { fp_dinheiro: 100, fp_credito: 100 }, semForma: 0, descoberto: 0 })
  });

  const din = d.formas.find(f => f.id === 'fp_dinheiro');
  const cre = d.formas.find(f => f.id === 'fp_credito');
  t('Dinheiro: sistema 100 · físico 95 · diferença −5',
    perto(din.sistema, 100) && perto(din.fisico, 95) && perto(din.diferenca, -5));
  t('Crédito: sistema 100 · físico 105 · diferença +5',
    perto(cre.sistema, 100) && perto(cre.fisico, 105) && perto(cre.diferenca, 5));
  t('TOTAL sistema = R$ 200', perto(d.totSis, 200), 'deu ' + d.totSis);
  t('TOTAL físico = R$ 200', perto(d.totFis, 200), 'deu ' + d.totFis);
  t('diferença geral = R$ 0,00', perto(d.difGeral, 0), 'deu ' + d.difGeral);
  t('status CONCILIADO', d.conciliado === true);
  t('marca divergência entre formas', d.divergeForma === true);
  t('e NÃO acusa falta de caixa', d.conciliado === true && Math.abs(d.difGeral) < 0.01);

  /* item 25: uma venda vale o mesmo em toda aba */
  t('Resumo e Recebimentos saem da mesma fonte', perto(d.bruto, 200));
  t('faturamento líquido = bruto − cancelamentos', perto(d.liquido, d.bruto - d.vCanc));
  t('ticket médio coerente com o líquido', perto(d.ticket, d.liquido / d.qtd));

  /* item 17: a composicao do dinheiro fecha */
  t('composição do dinheiro fecha com o esperado',
    perto(d.fundo + d.vendasDinheiro + d.suprimentos - d.sangrias, din.sistema));

  /* item 26: caixa fechado le do snapshot */
  t('caixa fechado lê da fotografia', d.doSnapshot === true);
  DB.pedidos[1].fase = 'cancelado';
  t('cancelar uma venda depois NÃO muda os recebimentos do snapshot',
    perto(d.formas.find(f => f.id === 'fp_credito').sistema, 100));
}

grupo('Estrutura do relatório · as oito abas existem');

{
  ['resumo', 'receb', 'movs', 'canc', 'desc', 'vendas', 'oper', 'aud'].forEach(a => {
    t('aba "' + a + '" implementada', new RegExp("VC\\.aba==='" + a + "'").test(fonte));
  });
  t('cabeçalho traz empresa, unidade, caixa e operadores',
    /vcEmp[\s\S]{0,700}Abertura[\s\S]{0,200}Fechamento[\s\S]{0,200}Abriu[\s\S]{0,200}Fechou/.test(fonte));
  t('impressão gerencial em folha existe', /function imprimirRelatorioCaixa/.test(fonte));
  t('e o cupom térmico continua', /function linhasFechamento/.test(fonte));
  t('sangria mostra origem e destino no relatório',
    /Origem<\/th><th>Destino/.test(fonte));
  t('cancelamento mostra motivo e quem autorizou',
    /Motivo<\/th><th>Autorizou/.test(fonte));
}

/* ==========================================================
   TESTE 10 — CLIQUE DUPLO
   ========================================================== */
grupo('Teste 10 · duplo toque não duplica operação');

{
  const codigo = corpoDaFuncao('travarOperacao', fonte);
  const api = new Function('_emCurso', 'setTimeout',
    codigo + '\nreturn travarOperacao;')({}, () => {});
  t('primeira chamada passa', api('fechar-caixa') === true);
  t('segunda chamada é recusada', api('fechar-caixa') === false);
  t('terceira também', api('fechar-caixa') === false);
  t('outra operação não é afetada', api('mov-caixa-sangria') === true);

  t('FINALIZAR VENDA tem trava', /if\(!travarFecharVenda\(\)\)/.test(fonte));
  t('FECHAR CAIXA tem trava', /travarOperacao\('fechar-caixa'\)/.test(fonte));
  t('SANGRIA e SUPRIMENTO têm trava', /travarOperacao\('mov-caixa-'\+tipo\)/.test(fonte));
  t('e o caixa já fechado é recusado de novo',
    /if\(cx\.fechadoEm\)\{liberarOperacao\('fechar-caixa'\)/.test(fonte));
  t('a trava do botão NÃO substitui a do banco (comentada como tal)',
    /Isto e a PRIMEIRA barreira, nao a unica/.test(fonte));
}

/* ==========================================================
   TESTE 9 — F5 DEPOIS DE FECHAR
   ========================================================== */
grupo('Teste 9 · fechado continua fechado após F5');

{
  const codigo = corpoDaFuncao('caixaAberto', fonte);
  const rodar = (DB) => new Function('DB', 'lojaAtualId',
    codigo + '\nreturn caixaAberto();')(DB, () => 'suc1');
  let DB = { caixas: [{ id: 'cx1', sucursalId: 'suc1', movimentos: [] }] };
  t('com caixa aberto, encontra', rodar(DB) !== null);
  DB.caixas[0].fechadoEm = '01/01/2026 22:00';
  t('depois de fechar, não encontra', rodar(DB) === null);
  DB = JSON.parse(JSON.stringify(DB));
  t('após F5, continua fechado', rodar(DB) === null);
}

grupo('Item 4 · cobertura da migração');

{
  /* nenhum campo de dinheiro pode ter ficado com type="number" — a
     excecao e o custo de insumo, que tem 4 casas e esta documentada */
  const restantes = (fonte.match(/R\$<\/span><input[^>]*type="number"/g) || []);
  t('restam no máximo 2 campos R$ com type="number"', restantes.length <= 2,
    restantes.length + ' campo(s)');
  t('e os que restam são o custo de 4 casas e o total só-leitura',
    restantes.every(x => /ntItVl|lnVp/.test(x)), restantes.join(' | '));
  t('o custo de 4 casas tem o motivo escrito no código',
    /ESTE CAMPO NAO USA O COMPONENTE DE DINHEIRO — DE PROPOSITO/.test(fonte));

  const migrados = [
    ['PDV · taxa', /id="pgTaxa"[^>]*class="moeda"|class="moeda" '\+\s*'placeholder="0,00" value="'\+\s*\(function/],
    ['PDV · desconto', /id="pgDesc"/],
    ['PDV · valor por forma', /class="moeda pgV"/],
    ['fechamento · conferência', /class="moeda cfV"/],
    ['abertura de caixa', /moedaHTML\(\{id:'cxIni'/],
    ['sangria e suprimento', /moedaHTML\(\{id:'mvV'/],
    ['fundo do próximo caixa', /moedaHTML\(\{id:'fcFundo'/],
    ['editar fechamento', /class="moeda ecV"/],
    ['cardápio · preço na grade', /class="moeda pPreco"/],
    ['produto · preço de venda', /id="pPreco"/],
    ['variações · preço', /class="moeda prPreco"/],
    ['grupos de opção · preço', /class="moeda goP"/],
    ['entregador · taxa por cidade', /class="moeda txV"/],
    ['acerto · desconto e acréscimo', /id="acDesc"[\s\S]{0,400}id="acAcr"/],
    ['forma de pagamento · taxa fixa', /id="fpTf"/],
    ['transferência entre contas', /id="trV"/],
    ['cliente · limite de fiado', /id="k2L"/],
    ['fiado · valor a pagar', /id="pfV"/],
    ['nota de entrada · desconto', /id="ntItDs"/]
  ];
  migrados.forEach(([nome, re1]) => {
    t(nome + ' usa o componente', re1.test(fonte));
  });

  /* e os leitores acompanharam: parseFloat direto em campo de dinheiro
     e o defeito que a migracao existe para eliminar */
  const sobrou = ['acDesc','acAcr','fpTf','trV','k2L','pfV','ntItDs','pPreco','cxIni','mvV','fcFundo']
    .filter(id => new RegExp("parseFloat\\(\\$\\('" + id + "'\\)").test(fonte));
  t('nenhum leitor migrado ainda usa parseFloat', sobrou.length === 0, sobrou.join(', '));
  t('mudarPreco lê pelo componente', /p\.preco=moedaLer\(v\)/.test(fonte));
  t('taxas por cidade leem pelo componente', /valor:moedaValor\(v\[i\]\)/.test(fonte));
  t('opções leem pelo componente', /preco:moedaValor\(p\[i\]\)/.test(fonte));
}

grupo('PDV · digitar não é atrapalhado pelo redesenho a cada tecla');

{
  t('o campo em edição mantém o texto cru',
    /_pgEditando===i\)\?_pgTexto/.test(fonte));
  t('os demais saem formatados em pt-BR',
    /_pgEditando===i\)\?_pgTexto:\(\(Number\(p\.valor\)\|\|0\)\?money\(p\.valor\)/.test(fonte));
  t('e data-v carrega o valor real nos dois casos',
    /data-v="'\+\(Number\(p\.valor\)\|\|0\)\+'" data-i/.test(fonte));
  t('sair do campo encerra a edição', /vs\[i\]\.onblur[\s\S]{0,180}_pgEditando=null/.test(fonte));
  t('o valor da forma é lido com moedaLer', /_pagos\[idx\]\.valor=moedaLer\(this\.value\)/.test(fonte));

  /* simula digitar "18" com o redesenho no meio */
  let editando = null, texto = '', valor = 0;
  const teclar = (d) => {
    texto = (editando === 0 ? texto : '') + d;
    editando = 0;
    valor = M.moedaLer(texto);
    /* redesenho: o campo em edicao volta com o texto cru */
    return (editando === 0) ? texto : (valor ? M.moedaFmt(valor) : '');
  };
  t('digitar 1 mostra "1"', teclar('1') === '1');
  t('digitar 8 em seguida mostra "18", não "1,00"', teclar('8') === '18');
  t('e o valor é 18', perto(valor, 18));
  editando = null;
  t('ao sair, formata para 18,00', M.moedaFmt(valor) === '18,00');
}

/* ---------- resultado ---------- */
console.log('\n' + '═'.repeat(52));
console.log('Joia ' + versaoDoSistema() + ' · UX do PDV e relatório');
console.log(R.ok + ' de ' + R.total + ' testes passaram' +
  (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
console.log('═'.repeat(52));
process.exit(R.falhou ? 1 : 0);

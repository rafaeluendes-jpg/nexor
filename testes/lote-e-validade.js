/* ==========================================================
   JOIA — LOTE E VALIDADE (V387, RDS 14)

   Até aqui não existia **nada**: nem marcação no item, nem campo na
   entrada, nem alerta. O que havia era uma data solta no cadastro do
   insumo, cuja dica na tela dizia "do lote em estoque" — prometendo um
   controle de lote que não existia. Com duas entradas, a segunda
   apagava a validade da primeira e ninguém via.

   Agora o item diz se controla lote e/ou validade; toda entrada de um
   item controlado grava um lote com número, validade, quantidade e a
   nota de origem; e a tela do Estoque Total avisa o que venceu e o que
   vence nos próximos dias.

   ---------- e o que NÃO existe, dito em voz alta ----------
   A BAIXA AUTOMÁTICA POR FEFO/PEPS NÃO EXISTE. Para consumir o lote
   mais próximo do vencimento, o SALDO teria de ser por lote — e hoje o
   saldo é uma linha por item e unidade, que é a base de tudo: venda,
   produção, transferência, contagem, CPV, DRE e a transação atômica da
   venda. Trocar isso é refazer o motor de estoque de um sistema que
   está em produção em seis lojas.

   Por isso o lote aqui INFORMA, e não consome. Este guardião tranca as
   duas coisas: o que passou a existir, e a honestidade sobre o resto.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

console.log('\n── O item diz se controla lote e validade\n');
const mi = semComentario(corpoDaFuncao('modalInsumo', fonte));
t('a tela tem a marcação de lote', /id="isCtLote"/.test(mi));
t('e a de validade', /id="isCtVal"/.test(mi));
t('a data antiga continua, renomeada para não prometer o que não é',
  /Validade \(referência\)/.test(corpoDaFuncao('modalInsumo', fonte)));
t('e a dica velha "Do lote em estoque" saiu',
  !/Do lote em estoque/.test(corpoDaFuncao('modalInsumo', fonte)));
const si = semComentario(corpoDaFuncao('salvarInsumo', fonte));
t('salvar guarda as duas marcações',
  /controlaLote:!!\(\$\('isCtLote'\)\|\|\{\}\)\.checked/.test(si) &&
  /controlaValidade:!!\(\$\('isCtVal'\)\|\|\{\}\)\.checked/.test(si));
t('e elas sobem para a nuvem',
  /controla_lote:!!x\.controlaLote/.test(fonte) && /controla_validade:!!x\.controlaValidade/.test(fonte));

console.log('\n── A entrada pede, e recusa sem resposta\n');
const ai = semComentario(corpoDaFuncao('addItemNota', fonte));
t('item que controla lote não entra sem lote',
  /_itemSel\.controlaLote&&!lote/.test(ai) && /informe o número do lote/.test(corpoDaFuncao('addItemNota', fonte)));
t('item que controla validade não entra sem data',
  /_itemSel\.controlaValidade&&!val/.test(ai) && /informe a data/.test(corpoDaFuncao('addItemNota', fonte)));
t('e a linha da nota leva os dois', /lote:lote/.test(ai) && /validade:val/.test(ai));
const dn = semComentario(corpoDaFuncao('desenhaNota', fonte));
t('os campos só aparecem para item controlado — a linha do resto não muda',
  /_itemSel&&_itemSel\.controlaLote/.test(dn) && /_itemSel&&_itemSel\.controlaValidade/.test(dn));

console.log('\n── O razão de lotes\n');
const ln = semComentario(corpoDaFuncao('lancarEstoqueDaNota', fonte));
t('a entrada grava o lote', /DB\.lotes\.push\(/.test(ln));
t('com item, quantidade e unidade',
  /itemRef:i2\.id/.test(ln) && /quantidade:Number\(it\.qtd\)/.test(ln) && /unidade:it\.unidade/.test(ln));
t('com a nota de origem e o documento',
  /origem:'nota-entrada'/.test(ln) && /origemRef:n\.id/.test(ln) && /documento:'NF '/.test(ln));
t('e a unidade da loja, para cada uma ver o que é dela', /sucursalId:n\.sucursalId\|\|lojaAtualId\(\)/.test(ln));
t('item sem lote nem validade não gera linha — não se enche a tabela à toa',
  /if\(it\.lote\|\|it\.validade\)\{/.test(ln));
t('e o razão sobe para a nuvem', /col:'lotes',\s*tab:'lotes_estoque'/.test(fonte.replace(/\s+/g, ' ')) ||
  /tab:'lotes_estoque'/.test(fonte));

console.log('\n── O aviso de vencimento, rodando de verdade\n');
function avisar(lotes, suc) {
  const hoje = '2026-09-30';
  const amb = {
    DB: { lotes: lotes }, lojaAtualId: () => suc, ehSucMatriz: x => x === 'suc_matriz',
    hojeISO: () => hoje, _quieto: () => {},
    DIAS_AVISO_VALIDADE: 7
  };
  return new Function('amb',
    'with(amb){' + corpoDaFuncao('lotesDaUnidade', fonte) + '\n' +
    corpoDaFuncao('lotesPorValidade', fonte) + '\n return lotesPorValidade();}')(amb);
}
const L = [
  { itemRef: 'a', itemNome: 'Leite', sucursalId: 'sucA', validade: '2026-09-20', quantidade: 5 },
  { itemRef: 'b', itemNome: 'Creme', sucursalId: 'sucA', validade: '2026-10-02', quantidade: 3 },
  { itemRef: 'c', itemNome: 'Base',  sucursalId: 'sucA', validade: '2026-12-01', quantidade: 9 },
  { itemRef: 'd', itemNome: 'Outro', sucursalId: 'sucB', validade: '2026-09-01', quantidade: 1 },
  { itemRef: 'e', itemNome: 'Sem data', sucursalId: 'sucA', quantidade: 1 }
];
(function () {
  const r = avisar(L, 'sucA');
  t('o que já venceu aparece', r.vencidos.length === 1 && r.vencidos[0].itemNome === 'Leite',
    JSON.stringify(r.vencidos.map(x => x.itemNome)));
  t('o que vence em até sete dias também',
    r.vencendo.length === 1 && r.vencendo[0].itemNome === 'Creme',
    JSON.stringify(r.vencendo.map(x => x.itemNome)));
  t('o que vence em dezembro não incomoda ninguém',
    !r.vencidos.concat(r.vencendo).some(x => x.itemNome === 'Base'));
  t('lote de OUTRA unidade fica de fora',
    !r.vencidos.concat(r.vencendo).some(x => x.itemNome === 'Outro'));
  t('e lote sem data não vira alarme falso',
    !r.vencidos.concat(r.vencendo).some(x => x.itemNome === 'Sem data'));

  const m = avisar(L, 'suc_matriz');
  t('a matriz vê a rede inteira', m.vencidos.length === 2, m.vencidos.length);
})();

t('o aviso aparece na tela do Estoque Total',
  /avisoValidade\(\)/.test(semComentario(corpoDaFuncao('telaEstoqueTotal', fonte))));
const av = corpoDaFuncao('avisoValidade', fonte);
t('sem nada vencendo, não aparece aviso nenhum',
  /if\(!r\.vencidos\.length&&!r\.vencendo\.length\)return '';/.test(semComentario(av)));
t('usa o aviso amarelo que já existe, sem inventar aparência', /class="imAviso"/.test(av));
t('mostra item, lote, quantidade e data', /lote /.test(av) && /vence '\+dataBR/.test(av));
t('e NÃO despeja cem linhas na tela', /slice\(0,6\)/.test(av));

console.log('\n── E diz o que ainda não faz\n');
t('o aviso avisa que o FEFO não existe',
  /ainda não baixa o lote mais antigo sozinho \(FEFO\)/.test(av));
const mig = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations',
  '20260930_lote_e_validade.sql'), 'utf8');
t('a migração explica por que o saldo não é por lote',
  /A BAIXA AUTOMATICA POR FEFO\/PEPS NAO EXISTE/.test(mig));
t('e diz o tamanho real do que faltaria: refazer o motor de estoque',
  /refazer o motor de estoque/.test(mig));
t('a tabela nasce com RLS ligada', /enable row level security/.test(mig));
t('com as quatro políticas — ler, gravar, atualizar e apagar',
  ['lote: leitura da rede', 'lote: grava com permissao',
   'lote: atualiza com permissao', 'lote: apaga so gestor'].every(p => mig.indexOf(p) >= 0));
t('e entra na trilha de auditoria como as outras tabelas de operação',
  /create trigger tg_auditar after insert or update or delete on public\.lotes_estoque/.test(mig));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · lote e validade');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

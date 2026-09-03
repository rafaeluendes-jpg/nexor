/* ==========================================================
   JOIA — O SALDO DE ESTOQUE NÃO ENTRA EM GUERRA ENTRE APARELHOS

   03/09/2026. `estoque_unidade` guarda o saldo absoluto por (loja,item).
   Dois aparelhos da mesma loja, com saldos diferentes, ficavam gravando um
   por cima do outro — no audit_log, um item foi regravado 121 vezes em
   48 h, o número oscilando (-278 ↔ -458 ↔ -999). Cada aparelho preservava
   o SEU saldo como "ainda não enviado" e reenviava para sempre; enquanto
   há coisa para subir, o aparelho pausa os downloads e a tela mostra
   "aparelho atrasado", com a fila que nunca esvazia.

   Como dois saldos absolutos não se somam, a `volta` passou a resolver o
   conflito de forma DETERMINISTA: vence a escrita mais recente
   (`atualizadoEm`); o aparelho mais velho ADOTA o da nuvem em vez de
   reenviar o antigo. Os dois convergem, a guerra acaba.

   Rodar:  node testes/estoque-nao-guerra.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* a `volta` REAL, com o resto neutralizado. temMudancaNaoEnviada é forçada
   a dizer SIM (linha mudou) — assim o teste prova que, para o estoque, a
   regra do carimbo VENCE o velho "preserva o local". */
const volta = new Function('ctx', `
  var _quieto=function(){}, logNuvem=function(){}, _ids={},
      registrarSumico=function(){}, guardarIds=function(){};
  function temMudancaNaoEnviada(){ return true; }
  ${corpoDaFuncao('volta', fonte)}
  return volta;
`)({});

const mapa = function (x) {
  return { id: x.ref_local, sucursalId: x.sucursal_id, itemId: x.item_ref,
    estoque: Number(x.estoque) || 0, atualizadoEm: x.atualizado_em };
};

console.log('\n── O aparelho mais VELHO adota o saldo da nuvem (guerra acaba)\n');
{
  const local = [{ id: 's1|i1', estoque: -278, atualizadoEm: '2026-09-02T20:00:00.000Z' }];
  const nuvem = [{ ref_local: 's1|i1', estoque: -458, atualizado_em: '2026-09-02T22:00:00.000Z' }];
  const r = volta(nuvem, mapa, local, 'estoqueUn');
  const row = r.find(x => x.id === 's1|i1');
  t('saldo local mais VELHO cede para o da nuvem (mais novo)',
    row && row.estoque === -458, row && row.estoque);
}

console.log('\n── O aparelho mais NOVO mantém o seu (e vai subir)\n');
{
  const local = [{ id: 's1|i1', estoque: -278, atualizadoEm: '2026-09-02T23:30:00.000Z' }];
  const nuvem = [{ ref_local: 's1|i1', estoque: -458, atualizado_em: '2026-09-02T22:00:00.000Z' }];
  const r = volta(nuvem, mapa, local, 'estoqueUn');
  const row = r.find(x => x.id === 's1|i1');
  t('saldo local mais NOVO permanece, para subir por cima do velho',
    row && row.estoque === -278, row && row.estoque);
}

console.log('\n── Empate no carimbo: a nuvem vence (converge, não fica em loop)\n');
{
  const ts = '2026-09-02T22:00:00.000Z';
  const local = [{ id: 's1|i1', estoque: -278, atualizadoEm: ts }];
  const nuvem = [{ ref_local: 's1|i1', estoque: -458, atualizado_em: ts }];
  const r = volta(nuvem, mapa, local, 'estoqueUn');
  const row = r.find(x => x.id === 's1|i1');
  t('carimbo igual ⇒ adota a nuvem (não reenvia o local de novo)',
    row && row.estoque === -458, row && row.estoque);
}

console.log('\n── Saldo que só existe no aparelho continua subindo (nada se perde)\n');
{
  const local = [{ id: 's1|novo', estoque: 40, atualizadoEm: '2026-09-02T22:00:00.000Z', _novoAqui: true }];
  const nuvem = [{ ref_local: 's1|outro', estoque: 10, atualizado_em: '2026-09-02T21:00:00.000Z' }];
  const r = volta(nuvem, mapa, local, 'estoqueUn');
  t('registro de estoque novo (que a nuvem não tem) é preservado para subir',
    !!r.find(x => x.id === 's1|novo' && x.estoque === 40));
}

console.log('\n── Fora do estoque, a regra antiga (preserva o não enviado) continua\n');
{
  /* uma coleção qualquer com pendência real continua sendo preservada —
     a mudança é SÓ para estoqueUn */
  const local = [{ id: 'c1', valor: 99 }];
  const nuvem = [{ ref_local: 'c1', valor: 1 }];
  const r = volta(nuvem, function (x) { return { id: x.ref_local, valor: x.valor }; }, local, 'qualquer');
  const row = r.find(x => x.id === 'c1');
  t('coleção comum com mudança não enviada mantém o local',
    row && row.valor === 99, row && row.valor);
}

console.log('\n── A trava está no código\n');
t('a volta resolve estoqueUn pelo carimbo mais recente',
  /_ehEstoque\s*=\s*\(col==='estoqueUn'\)/.test(codigoNu) &&
  /_maisNovoQue\(x\.atualizadoEm,nv\.atualizadoEm\)/.test(codigoNu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — O VÍNCULO DE ESTOQUE DO PRODUTO SOBREVIVE AO DOWNLOAD

   03/09/2026. Em Santa Fé, "várias vendas no PDV e só uma baixa de
   estoque". Medido no banco: 34 pedidos no dia, 8 baixas. O MESMO
   produto (Cascão 1 Bola) baixava em 6 pedidos e não baixava em 4 —
   prova de que o vínculo existe num aparelho e não existe no outro.

   Causa: produtos.ficha_id / insumo_id estavam VAZIOS na nuvem para
   TODOS os produtos. A descida recalcula p.fichaId a partir desse valor,
   então cada download zerava o vínculo e a venda parava de baixar.

   Correção (mesma regra da opção, no mesmo arquivo): quando a nuvem não
   traz o vínculo, mantém-se o que o aparelho já sabia, desde que a ficha
   (ou o insumo) ainda exista aqui. O envio seguinte re-popula a nuvem.
   Desvincular pela tela continua valendo: sem vínculo local, nada é
   inventado.

   Rodar:  node testes/venda-baixa-mantem-vinculo.js
   ========================================================== */
const fs = require('fs');
const { ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* a MESMA regra que a descida aplica, isolada para provar cada caso.
   `nuvem` é o valor de ficha_id/insumo_id que veio do banco (uuid ou vazio);
   `antes` é o vínculo que o aparelho já tinha; `temFicha`/`temInsumo` dizem
   o que ainda existe localmente. */
function resolver(nuvem, antes, temFicha, temInsumo) {
  var mapaFi = { 'uuid-ficha-A': 'fic_a' }, mapaIns = { 'uuid-ins-B': 'ins_b' };
  var p = { fichaId: mapaFi[nuvem.ficha_id] || '', insumoId: mapaIns[nuvem.insumo_id] || '' };
  if (!p.fichaId && !p.insumoId && antes) {
    if (antes.f && temFicha[antes.f]) p.fichaId = antes.f;
    else if (antes.i && temInsumo[antes.i]) p.insumoId = antes.i;
  }
  return p;
}

console.log('\n── A nuvem tem o vínculo: usa o da nuvem\n');
{
  const p = resolver({ ficha_id: 'uuid-ficha-A' }, { f: 'fic_velha' }, { fic_a: 1, fic_velha: 1 }, {});
  t('produto liga na ficha que a nuvem traz', p.fichaId === 'fic_a', p.fichaId);
}

console.log('\n── A nuvem veio VAZIA: mantém o vínculo do aparelho\n');
{
  const p = resolver({}, { f: 'fic_a' }, { fic_a: 1 }, {});
  t('ficha_id vazio na nuvem NÃO zera o vínculo local (a venda volta a baixar)',
    p.fichaId === 'fic_a', p.fichaId);
  const q = resolver({}, { i: 'ins_b' }, {}, { ins_b: 1 });
  t('o mesmo vale para o vínculo por insumo', q.insumoId === 'ins_b', q.insumoId);
}

console.log('\n── Mantém só o que ainda existe aqui (não ressuscita ficha apagada)\n');
{
  const p = resolver({}, { f: 'fic_sumiu' }, { fic_a: 1 }, {});
  t('vínculo para ficha que não existe mais fica vazio', p.fichaId === '' && p.insumoId === '');
}

console.log('\n── Desvincular pela tela continua funcionando\n');
{
  const p = resolver({}, null, { fic_a: 1 }, { ins_b: 1 });
  t('sem vínculo local, nada é inventado', p.fichaId === '' && p.insumoId === '');
}

console.log('\n── A trava está no código (descida de produtos)\n');
{
  t('captura o vínculo anterior do aparelho antes de baixar',
    /_vincAntes\[p\.id\]\s*=\s*\{f:p\.fichaId\|\|'',i:p\.insumoId\|\|''\}/.test(fonte));
  t('só preserva ficha/insumo que ainda existe localmente',
    /if\(ant\.f&&_temFicha\[ant\.f\]\)/.test(fonte) &&
    /else if\(ant\.i&&_temInsumo\[ant\.i\]\)/.test(fonte));
  t('avisa quando preservou o vínculo do aparelho',
    /vínculo de estoque preservado do aparelho/.test(fonte));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

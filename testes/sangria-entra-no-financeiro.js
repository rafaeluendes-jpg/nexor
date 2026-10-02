/* ==========================================================
   A SANGRIA ENTRA NO FINANCEIRO PELO LOGIN DA LOJA (02/10/2026)

   Santa Fé, 01/10 às 23:01: sangria de R$ 350,00 para o Itaú. Saiu da
   gaveta, mas o lançamento de transferência foi recusado pelo banco —
   gravar no financeiro exigia a permissão do módulo Financeiro, que o
   login do caixa não tem. Não chegou ao Itaú nem à conciliação, e o
   saldo do Caixa da loja ficou sem o desconto.

   Rafael: "todos os logins têm permissão de fazer sangria".
   A migration 20261002_sangria_entra_no_financeiro.sql libera o que o
   caixa gera — origem 'mov-caixa', tipo 'transferencia', pagamento a
   partir de 01/10/2026, da própria unidade.

   Prende o lado do PDV: se o lançamento da sangria mudar de origem, de
   tipo ou deixar de levar a data e a unidade, o banco volta a recusar
   em silêncio. Este guardião acende antes.

   Rodar:  node testes/sangria-entra-no-financeiro.js
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
console.log('\n── Sistema ' + versaoDoSistema() + ' — a sangria entra no financeiro\n');

const mig = path.join(__dirname, '..', 'supabase/migrations/20261002_sangria_entra_no_financeiro.sql');
const sql = fs.existsSync(mig) ? fs.readFileSync(mig, 'utf8') : '';
t('a regra do banco está guardada', !!sql);
t('ela libera o que o caixa gera, e só isso',
  /origem = 'mov-caixa' and tipo = 'transferencia'/.test(sql) && /pagamento >= date '2026-10-01'/.test(sql) &&
  /sucursal_id = \(select public\.minha_sucursal_ref\(\)\)/.test(sql));

const DB = { lancFin: [] };
const mk = new Function('DB', 'contaDaGaveta', 'hojeISO', 'uid', 'contaNome', 'categoriaDoEvento',
  corpoDaFuncao('lancarTransferenciaCaixa', fonte) + '\nreturn lancarTransferenciaCaixa;');
const f = mk(DB, () => ({ id: 'cx_gaveta' }), () => '2026-10-02', (p) => p + '_1', (id) => id, () => '');
const l = f({ id: 'cx1' }, { id: 'mv1', valor: 350, destinoContaId: 'itau', motivoNome: 'Envio ao cofre' }, 'sangria');
t('o PDV gera a sangria com a origem e o tipo que o banco aceita', l && l.origem === 'mov-caixa' && l.tipo === 'transferencia', JSON.stringify(l));
t('sai do caixa e entra na conta de destino', l.contaId === 'cx_gaveta' && l.contaDestinoId === 'itau');
t('já paga, com a data do dia — é ela que a conciliação e o saldo leem', l.pago === true && l.pagamento === '2026-10-02');
t('a mesma sangria nunca vira dois lançamentos', f({ id: 'cx1' }, { id: 'mv1', valor: 350, destinoContaId: 'itau' }, 'sangria') === l && DB.lancFin.length === 1);
t('o lançamento sobe com a unidade do aparelho', /sucursal_id:x\.sucursalRef\|\|lojaAtualId\(\)\|\|null/.test(fonte));
const cb = fs.readFileSync(path.join(__dirname, '..', 'src/js/07-roteador/15-conciliacao-bancaria.js'), 'utf8');
t('a conciliação mostra a transferência na conta de destino', /l\.contaDestinoId!==CB\.conta/.test(cb) && /l\.tipo==='transferencia'/.test(cb));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

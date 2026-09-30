/* ==========================================================
   JOIA — A NOTA PAGA SUMIA COM UM CLIQUE (V380)

   A RDS, item 19.2, manda desfazer uma compra concluída na ordem
   inversa: tirar a conciliação, desfazer o pagamento, desfazer o contas
   a pagar, reverter a entrada de estoque, anular a compra.

   O Joia tinha o PRIMEIRO degrau — nota com lançamento conciliado não
   era excluída — e pulava o segundo.

   Uma nota **paga**, não conciliada, sumia com um clique: o dinheiro já
   tinha saído da conta, o lançamento ia junto com ela, e não sobrava
   contrapartida nenhuma. O saldo do banco passava a não bater, e nada
   na tela explicava por quê.

   E a trilha de auditoria registrava o DELETE com o antes inteiro, quem
   apagou e quando — mas nunca POR QUÊ.
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
const ex = semComentario(corpoDaFuncao('excluirNota', fonte));

console.log('\n── O ciclo inverso começa pelo pagamento\n');

t('nota com lançamento conciliado continua barrada', /l\.conciliado/.test(ex));
t('NOTA PAGA PASSA A SER BARRADA TAMBÉM', /l\.ref===n\.id&&l\.pago/.test(ex));
t('a conciliação é conferida antes do pagamento — é a ordem da RDS',
  ex.indexOf('l.conciliado') < ex.indexOf('l.ref===n.id&&l.pago'));
t('e as duas travas vêm antes de qualquer pergunta na tela',
  ex.indexOf('l.ref===n.id&&l.pago') < ex.indexOf('await confirmar'));
t('a mensagem diz o valor, para a pessoa reconhecer o lançamento',
  /money\(pagos\[0\]\.valor\)/.test(ex));
t('e explica a consequência, não só proíbe',
  /o dinheiro sai da conta e some o registro/.test(corpoDaFuncao('excluirNota', fonte)));
t('com mais de um, diz quantos são', /pagos\.length>1/.test(ex));

console.log('\n── Por que a nota foi excluída\n');

t('exige um motivo escrito', /if\(!motivo\)\{toast\(/.test(ex));
t('pedido dentro do aviso, não num prompt do navegador',
  /campo:\{id:'exMotivo'/.test(ex) && !/window\.prompt/.test(ex));
t('grava quem excluiu', /n\.excluidoPor=/.test(ex) && /n\.excluidoPorId=/.test(ex));
t('quando', /n\.excluidoEm=new Date\(\)/.test(ex));
t('e por quê', /n\.excluidoMotivo=motivo/.test(ex));
t('grava ANTES de excluir — senão o motivo morre junto com a nota',
  ex.indexOf('n.excluidoMotivo=motivo') < ex.indexOf('DB.notas=DB.notas.filter'));
t('e manda para a nuvem antes de apagar, para a trilha receber o motivo',
  /await sincronizar\(\)/.test(ex) &&
  ex.indexOf('await sincronizar()') < ex.indexOf('DB.notas=DB.notas.filter'));
t('a tela mostra quem está excluindo, antes de confirmar',
  /Quem está excluindo/.test(corpoDaFuncao('excluirNota', fonte)));

console.log('\n── E o motivo chega ao banco de verdade\n');

/* de nada adianta gravar no aparelho se o campo não sobe: a trilha de
   auditoria é do banco, e só vê o que chega lá */
t('o mapa de sincronização manda excluida_motivo',
  /excluida_motivo:x\.excluidoMotivo\|\|null/.test(fonte));
t('manda também quem e quando',
  /excluida_em:x\.excluidoEm\|\|null/.test(fonte) && /excluida_por:x\.excluidoPor\|\|null/.test(fonte));

const mig = fs.readFileSync(__dirname + '/../supabase/migrations/20260930_nota_excluida_com_motivo.sql', 'utf8');
t('e a migração cria as três colunas', /excluida_em/.test(mig) && /excluida_por/.test(mig) && /excluida_motivo/.test(mig));
t('todas opcionais — nota que já existe não é afetada', !/not null/.test(mig));
t('e a migração é idempotente', /add column if not exists/.test(mig));

const esq = JSON.parse(fs.readFileSync(__dirname + '/../ferramentas/esquema-nuvem.json', 'utf8'));
const cols = ((esq.tabelas || {}).notas_entrada || {}).colunas || {};
t('a referência do banco já conhece as colunas novas',
  !!cols.excluida_em && !!cols.excluida_por && !!cols.excluida_motivo,
  Object.keys(cols).filter(c => c.indexOf('excluida') === 0).join(','));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · a nota paga não some com um clique');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — O PAGAMENTO NÃO TINHA ESTADO (V383, RDS 9)

   A RDS pede máquina de estados independente para venda, pagamento e
   documento fiscal.

   No Joia o fiscal tem onze estados e é a parte mais madura do sistema.
   A venda tem um campo de fase. E o pagamento não tinha **nada**:
   `{forma, valor, recebido, equipamento}`.

   Consequência prática: cancelar uma venda deixava o pagamento intacto,
   do mesmo jeito que deixava o cupom fiscal autorizado (corrigido na
   V373). Não havia como perguntar "quais pagamentos foram estornados",
   porque a resposta não existia em lugar nenhum.

   ---------- os estados que EXISTEM de verdade ----------
   `recebido`  — o operador conferiu o dinheiro, a maquininha ou o Pix e
                 fechou a venda. É o estado de nascimento.
   `estornado` — a venda foi cancelada; o pagamento deixou de valer.

   ---------- e o que NÃO dá para ter ----------
   A tabela da RDS tem "pagamento não aprovado" e "estorno pendente".
   Elas dependem de o sistema FALAR com a maquininha (TEF), e o Joia não
   fala. Inventar esses estados seria criar campo que nunca muda de
   valor — o pior tipo de mentira num relatório de auditoria: a que
   parece controle.
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

console.log('\n── O pagamento nasce com estado\n');
const fv = semComentario(corpoDaFuncao('finalizarVenda', fonte));
t('todo pagamento nasce "recebido"', /if\(!x\.situacao\)x\.situacao='recebido';/.test(fv));
t('com a hora em que foi recebido', /if\(!x\.recebidoEm\)x\.recebidoEm=new Date\(\)/.test(fv));
t('e não sobrescreve o que já veio com estado', /if\(!x\.situacao\)/.test(fv));

console.log('\n── Cancelar a venda estorna o pagamento\n');
const rev = semComentario(corpoDaFuncao('reverterEfeitosDaVenda', fonte));
t('marca o pagamento como estornado', /g\.situacao='estornado'/.test(rev));
t('com quando e por quem', /g\.estornadoEm=new Date\(\)/.test(rev) && /g\.estornadoPor=/.test(rev));
t('e ligado ao cancelamento que o causou', /g\.cancelamentoId=reg\.id/.test(rev));
t('não estorna duas vezes', /g\.situacao==='estornado'\)return;/.test(rev));
t('e conta quantos foram, no registro do cancelamento', /desf\.pagamentos\+\+/.test(rev));

/* roda a reversão de verdade */
(function () {
  const f = (DB, p, reg) => new Function('amb', 'p', 'reg',
    'with(amb){' + corpoDaFuncao('reverterEfeitosDaVenda', fonte) +
    '\n return reverterEfeitosDaVenda(p,reg);}')(
    { DB: DB, uid: x => x + '1', hojeISO: () => '2026-09-30',
      usuarioLogado: () => ({ id: 'u1', nome: 'Maria' }) }, p, reg);
  const DB = { clientes: [], fiadoMov: [], cupomUsos: [], movEst: [] };
  const p = { id: 'pd1', numero: 5, total: 30,
    pagamentos: [{ forma: 'fp_din', valor: 20 }, { forma: 'fp_pix', valor: 10 }] };
  const reg = { id: 'cn1' };
  const d = f(DB, p, reg);
  t('os dois pagamentos ficam estornados',
    p.pagamentos.every(g => g.situacao === 'estornado'),
    JSON.stringify(p.pagamentos.map(g => g.situacao)));
  t('com quem estornou', p.pagamentos[0].estornadoPor === 'Maria');
  t('e o registro diz quantos foram', d.pagamentos === 2, d.pagamentos);

  /* chamar de novo não pode contar de novo */
  const reg2 = { id: 'cn1' };
  const d2 = f(DB, p, reg2);
  t('CHAMAR DE NOVO NÃO ESTORNA DE NOVO', d2.pagamentos === 0, d2.pagamentos);
})();

console.log('\n── Voltar a venda devolve o pagamento\n');
const rep = semComentario(corpoDaFuncao('reporEfeitosDaVenda', fonte));
t('o pagamento volta a valer', /g\.situacao='recebido'/.test(rep));
t('e as marcas do estorno saem', /delete g\.estornadoEm/.test(rep) && /delete g\.estornadoPor/.test(rep));
t('só os pagamentos DAQUELE cancelamento', /g\.cancelamentoId!==reg\.id/.test(rep));

(function () {
  const p = { id: 'pd1', pagamentos: [
    { forma: 'a', valor: 5, situacao: 'estornado', estornadoEm: 'x', estornadoPor: 'Maria', cancelamentoId: 'cn1' },
    { forma: 'b', valor: 5, situacao: 'estornado', estornadoEm: 'x', estornadoPor: 'Ana', cancelamentoId: 'OUTRO' }] };
  new Function('amb', 'p', 'reg',
    'with(amb){' + corpoDaFuncao('reporEfeitosDaVenda', fonte) +
    '\n return reporEfeitosDaVenda(p,reg);}')(
    { DB: { clientes: [], fiadoMov: [] } }, p, { id: 'cn1', revertido: { fiado: 0, compras: 0, gasto: 0 } });
  t('o pagamento daquele cancelamento volta', p.pagamentos[0].situacao === 'recebido');
  t('e o de outro cancelamento não é tocado', p.pagamentos[1].situacao === 'estornado');
})();

console.log('\n── E o estado chega ao banco\n');
t('o estado sobe junto com o pagamento', /situacao:o\.situacao\|\|'recebido'/.test(fonte));
t('com quando e quem estornou',
  /estornado_em:o\.estornadoEm\|\|null/.test(fonte) && /estornado_por:o\.estornadoPor\|\|null/.test(fonte));

const mig = fs.readFileSync(__dirname + '/../supabase/migrations/20260930_pagamento_tem_estado.sql', 'utf8');
t('a migração cria as três colunas',
  /situacao/.test(mig) && /estornado_em/.test(mig) && /estornado_por/.test(mig));
t('pagamento que já existe nasce "recebido" — que é o que ele sempre foi',
  /default 'recebido'/.test(mig));
t('e é idempotente', /add column if not exists/.test(mig));

const esq = JSON.parse(fs.readFileSync(__dirname + '/../ferramentas/esquema-nuvem.json', 'utf8'));
const cols = ((esq.tabelas || {}).pedido_pagamentos || {}).colunas || {};
t('a referência do banco já conhece as colunas', !!cols.situacao && !!cols.estornado_em);

console.log('\n── E a API diz o que NÃO dá para ter\n');
const api = fs.readFileSync(__dirname + '/../supabase/functions/joia-api/index.ts', 'utf8');
t('a API assume que não existe "pagamento não aprovado"',
  /pagamento_nao_aprovado/.test(api) && /NÃO existe `não aprovado`/.test(api));
t('e explica: depende de falar com a maquininha, e o Joia não fala',
  /TEF/.test(api) && /o Joia não fala/.test(api));
t('diz também que não há retorno de adquirente', /retorno_de_adquirente/.test(api));
t('e a versão da API subiu', /const API_VERSAO = "2\.4"/.test(api));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o pagamento tem estado');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

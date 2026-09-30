/* ==========================================================
   JOIA — O CUSTO MÉDIO PERDIA A MEMÓRIA (V384, RDS 11 e 15)

   1. O ÚLTIMO CUSTO MÉDIO COM SALDO.
      Quando o saldo de um item chega a zero, o Joia zera o custo médio
      — e está certo: custo médio é o preço do que está lá dentro, e sem
      nada dentro ele é zero. A regra 11.2 da RDS confirma isso e
      acrescenta a metade que faltava: *"preservar o último custo médio
      conhecido"*.

      Sem ela, um item que zerou perde a única referência de quanto
      custava, e o sistema cai em `custoUltima` — o preço da última
      COMPRA, que é outra coisa. Numa rede em que cada unidade compra
      pelo seu preço, é a coisa errada.

   2. `modoCusto='manual'` NÃO FAZIA NADA.
      O fechamento da contagem gravava isso, e `normModo()` convertia de
      volta para 'media' na leitura seguinte. A contagem achava que
      tinha fixado o custo e o sistema descartava a intenção, em
      silêncio. O valor ficava; o rastro de quem mudou, quando e de
      quanto para quanto, não existia.

   3. DE QUEM FOI A COMPRA.
      A RDS pede, junto do preço da última compra, a data, o FORNECEDOR
      e o DOCUMENTO. Havia data e id da nota; faltavam os dois que
      alguém usa para conferir um preço que parece errado.
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

console.log('\n── Zerar o custo não apaga a memória dele\n');

function mundo() {
  const DB = { estoqueUn: [], insumos: [{ id: 'in1', nome: 'Massa', unidade: 'kg',
    controlaEstoque: true, estoqueAtual: 0, custo: 0 }] };
  const amb = {
    DB: DB, lojaAtualId: () => 'sucA',
    itemEstoque: id => DB.insumos.find(i => i.id === id) || null,
    convUnid: q => q, custoMedioPond: () => 0, normModo: m => m || 'media',
    repararDestinos: () => {}, recalcCustoProducao: () => {},
    usuarioLogado: () => ({ id: 'u1', nome: 'Maria' }),
    baseEstUn: () => (DB.estoqueUn = DB.estoqueUn || []),
    chaveEst: (suc, item) => suc + '|' + item
  };
  const rodar = new Function('amb', 'mov',
    'with(amb){' +
    corpoDaFuncao('regEstoque', fonte) + '\n' + corpoDaFuncao('saldoUn', fonte) + '\n' +
    corpoDaFuncao('custoMedioUn', fonte) + '\n' + corpoDaFuncao('setSaldoUn', fonte) + '\n' +
    corpoDaFuncao('setCustoUn', fonte) + '\n' + corpoDaFuncao('ajustaEstoque', fonte) + '\n' +
    corpoDaFuncao('aplicarMovimento', fonte) + '\n aplicarMovimento(mov); return mov;}');
  return { DB, amb, rodar };
}

(function () {
  const { DB, amb, rodar } = mundo();
  rodar(amb, { id: 'm1', sucursalId: 'sucA', linhas: [
    { insumoId: 'in1', unidade: 'kg', qtd: 10, custo: 7, direcao: 'entrada' }] });
  const reg = DB.estoqueUn.find(r => r.itemId === 'in1');
  t('entrou 10 kg a R$ 7,00: o custo médio é 7', reg.custoMedio === 7, reg.custoMedio);
  t('e ainda não há memória a guardar', reg.ultimoCustoMedioComSaldo === undefined);

  rodar(amb, { id: 'm2', sucursalId: 'sucA', linhas: [
    { insumoId: 'in1', unidade: 'kg', qtd: 10, custo: 7, direcao: 'saida' }] });
  t('saiu tudo: o saldo é zero', reg.estoque === 0, reg.estoque);
  t('o custo médio é zerado — sem nada dentro, não há custo', reg.custoMedio === 0, reg.custoMedio);
  t('MAS O ÚLTIMO CUSTO MÉDIO COM SALDO FICA GUARDADO',
    reg.ultimoCustoMedioComSaldo === 7, reg.ultimoCustoMedioComSaldo);

  /* a regra 11.2: a primeira entrada depois do zero manda, sem ponderar */
  rodar(amb, { id: 'm3', sucursalId: 'sucA', linhas: [
    { insumoId: 'in1', unidade: 'kg', qtd: 5, custo: 12, direcao: 'entrada' }] });
  t('a primeira entrada depois do zero define o custo, sem ponderar com o histórico',
    reg.custoMedio === 12, reg.custoMedio);
  t('e a memória do custo anterior continua lá, para comparação',
    reg.ultimoCustoMedioComSaldo === 7, reg.ultimoCustoMedioComSaldo);

  /* zerar de novo atualiza a memória */
  rodar(amb, { id: 'm4', sucursalId: 'sucA', linhas: [
    { insumoId: 'in1', unidade: 'kg', qtd: 5, custo: 12, direcao: 'saida' }] });
  t('zerar de novo guarda o custo mais recente, não o antigo',
    reg.ultimoCustoMedioComSaldo === 12, reg.ultimoCustoMedioComSaldo);
})();

t('e a memória sobe para a nuvem',
  /ultimo_custo_medio_com_saldo:\(x\.ultimoCustoMedioComSaldo==null\?null:n\(x\.ultimoCustoMedioComSaldo\)\)/.test(fonte));

console.log('\n── O custo mexido a mão deixa rastro\n');
const fc = semComentario(corpoDaFuncao('fecharContagem', fonte));
t('guarda de quanto era antes', /custoAjustadoDe=Number\(p2\.item\.custo\)/.test(fc));
t('guarda de quando e de quem', /custoAjustadoEm=new Date\(\)/.test(fc) && /custoAjustadoPor=/.test(fc));
t('e por qual caminho', /custoAjustadoOrigem='contagem de estoque'/.test(fc));
t('o "de" é lido ANTES de o custo ser trocado — senão guardaria o valor novo',
  fc.indexOf('custoAjustadoDe') < fc.indexOf('p2.item.custo=p2.para'));
t('e o `modoCusto="manual"`, que era descartado na leitura, saiu',
  !/modoCusto='manual'/.test(fc));
t('o rastro sobe para a nuvem',
  /custo_ajustado_em:x\.custoAjustadoEm\|\|null/.test(fonte) &&
  /custo_ajustado_de:\(x\.custoAjustadoDe==null\?null:n\(x\.custoAjustadoDe\)\)/.test(fonte));

console.log('\n── A compra diz de quem foi\n');
const ln = semComentario(corpoDaFuncao('lancarEstoqueDaNota', fonte));
t('a compra guarda o fornecedor', /fornecedor:n\.fornecedorNome\|\|''/.test(ln));
t('e o identificador dele', /fornecedorId:n\.fornecedorId\|\|''/.test(ln));
t('e o número da nota, que é o documento', /notaNumero:n\.numero\|\|''/.test(ln));
t('sem perder a data, a quantidade e o preço que já estavam lá',
  /data:n\.data/.test(ln) && /qtd:it\.qtd/.test(ln) && /valor:\+\(it\.total\/it\.qtd\)/.test(ln));

console.log('\n── E a migração é aditiva\n');
const mig = fs.readFileSync(__dirname + '/../supabase/migrations/20260930_custo_com_memoria.sql', 'utf8');
t('cria a memória do custo médio', /ultimo_custo_medio_com_saldo/.test(mig));
t('e as quatro colunas do rastro',
  ['custo_ajustado_em', 'custo_ajustado_por', 'custo_ajustado_de', 'custo_ajustado_origem']
    .every(c => new RegExp(c).test(mig)));
t('todas opcionais', !/not null/.test(mig));
t('e idempotente', /add column if not exists/.test(mig));

const esq = JSON.parse(fs.readFileSync(__dirname + '/../ferramentas/esquema-nuvem.json', 'utf8'));
t('a referência do banco já as conhece',
  !!esq.tabelas.estoque_unidade.colunas.ultimo_custo_medio_com_saldo &&
  !!esq.tabelas.insumos.colunas.custo_ajustado_de);

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o custo médio com memória');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

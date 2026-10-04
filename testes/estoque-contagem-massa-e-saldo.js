/* ==========================================================
   ESTOQUE: O DIA COMEÇA NA CONTAGEM, A MASSA APARECE, O SALDO SOBE
   (04/10/2026)

   Rodar:  node testes/estoque-contagem-massa-e-saldo.js
   ou:     npm run test:estcontagem   (entra na bateria e no portão)

   Rafael:
     · "Se eu finalizei meu dia 30 com 50 canudos, eu comecei meu dia 1 com
       50. A partir das vendas do dia 1 para frente, desconta desses 50."
       O relatório mostrava 52, porque partia do saldo de hoje desfazendo
       os movimentos, e o saldo de hoje estava descolado.
     · "Rodou a massa de cascão na produção, vira cascão. Mas a massa não
       aparece saindo na Movimentação de Mercadoria."
     · "Na Movimentação de Estoque, digito massa, escolho, e some o
       TRADICIONAL — fica só MASSA."
   E a causa do saldo descolado: o aparelho da produção marcava os saldos
   como "sem empresa" e não os enviava; e a nuvem aceitava cópia antiga de
   saldo por cima da mais nova.

   Prende:
     1. o saldo do relatório parte da última contagem e soma os movimentos
        depois dela (retroativa = fim do dia; no meio do dia = da hora);
     2. a ordem de produção registra a massa produzida e transformada no
        destino, sem mudar o saldo da massa, e o consumo não a soma;
     3. escolher na lista de itens não é desfeito pelo texto digitado;
     4. saldo de uma unidade desta empresa não fica retido como "sem dono";
     5. a nuvem recusa saldo mais antigo que o salvo.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261004_saldo_antigo_nao_grava_por_cima.sql');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const erros = [];
(async function () {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, DB = w.DB;
  const SUC = 'suc_sf';
  w.lojaAtualId = () => SUC;
  DB.insumos = [{ id: 'ins_can', nome: 'Canudo', unidade: 'un', controlaEstoque: true }];
  DB.estoqueUn = [{ id: SUC + '|ins_can', sucursalId: SUC, itemId: 'ins_can', estoque: 7, custoMedio: 0.04 }];
  const venda = (data, hora, n) => ({ id: 'mv' + data + hora, data, hora, origem: 'venda', sucursalId: SUC,
    linhas: [{ insumoId: 'ins_can', nome: 'Canudo', unidade: 'un', qtd: n, direcao: 'saida' }] });
  DB.movEst = [
    venda('2026-09-30', '14:49', 7),
    { id: 'mvct', data: '2026-09-30', hora: '10:32', origem: 'contagem', sucursalId: SUC,
      linhas: [{ insumoId: 'ins_can', nome: 'Canudo', unidade: 'un', qtd: 253, direcao: 'entrada' }] },
    venda('2026-10-01', '21:10', 3), venda('2026-10-02', '15:05', 42)];
  DB.contagens = [{ id: 'ct30', data: '2026-09-30', hora: '10:32', sucursalId: SUC, retroativa: true,
    itens: [{ insumoId: 'ins_can', nome: 'Canudo', unidade: 'un', sistema: -203, conferido: 50 }] }];

  grupo('1. O dia começa com o que foi contado');
  t('fim do dia 30 = os 50 contados (contagem do fim do dia)', w.mmSaldoFimDia('ins_can', '2026-09-30', SUC) === 50,
    w.mmSaldoFimDia('ins_can', '2026-09-30', SUC));
  t('fim do dia 1 = 50 − 3 vendas do dia 1', w.mmSaldoFimDia('ins_can', '2026-10-01', SUC) === 47,
    w.mmSaldoFimDia('ins_can', '2026-10-01', SUC));
  t('não depende do saldo de hoje (7, descolado): fim do dia 2 = 5', w.mmSaldoFimDia('ins_can', '2026-10-02', SUC) === 5,
    w.mmSaldoFimDia('ins_can', '2026-10-02', SUC));
  DB.contagens.push({ id: 'ct02', data: '2026-10-02', hora: '12:00', sucursalId: SUC, retroativa: false,
    itens: [{ insumoId: 'ins_can', unidade: 'un', conferido: 40 }] });
  t('contagem no meio do dia vale a partir da hora dela', w.mmSaldoFimDia('ins_can', '2026-10-02', SUC) === -2,
    w.mmSaldoFimDia('ins_can', '2026-10-02', SUC));
  DB.contagens.pop();
  DB.contagens = [];
  t('item sem contagem segue o caminho antigo', w.mmSaldoFimDia('ins_can', '2026-10-02', SUC) === w.saldoNaData('ins_can', '2026-10-02', SUC));
  const src = fs.readFileSync(ARQ, 'utf8');
  t('a linha do dia e o "saldo no início do dia" usam a contagem',
    /var saldoFim=mmSaldoFimDia\(g\.id,g\.data\);/.test(src) && /var saldo=mmSaldoFimDia\(g\.id, ini\.toISOString\(\)\.slice\(0,10\)\);/.test(src));

  grupo('2. A massa aparece: produzida e transformada no destino');
  DB.insumos.push({ id: 'ins_casc', nome: 'CASCAO TRADICIONAL', unidade: 'un', controlaEstoque: true });
  DB.fichas = [{ id: 'fi_massa', nome: 'MASSA CASCAO TRADICIONAL', unidade: 'g', rendimento: 1, itens: [],
    destinoId: 'ins_casc', destinoModo: 'receita', destinoFator: 40 }];
  const linhas = [{ insumoId: 'ins_ovo', direcao: 'saida', qtd: 4 },
    { insumoId: 'ins_casc', direcao: 'entrada', qtd: 40, origem: 'producao:fi_massa' }];
  w.registrarMassaNaOP(linhas, [{ tipo: 'ficha', refId: 'fi_massa', qtd: 1250, unidade: 'g' }]);
  const ent = linhas.find(l => l.insumoId === 'fi_massa' && l.direcao === 'entrada');
  const sai = linhas.find(l => l.insumoId === 'fi_massa' && l.direcao === 'saida');
  t('entra a massa produzida e sai a mesma quantidade', !!ent && !!sai && ent.qtd === 1250 && sai.qtd === 1250, JSON.stringify(linhas));
  t('as duas vêm antes da entrada do cascão', linhas.indexOf(sai) < linhas.findIndex(l => l.origem === 'producao:fi_massa'));
  t('marcadas como trânsito, dizendo em que se transformou', ent.transito && sai.transito && sai.destinoNome === 'CASCAO TRADICIONAL');
  t('o relatório escreve "produzida" e "transformada em CASCAO TRADICIONAL"',
    w.mmRotulo({ origem: 'producao' }, ent) === 'Produzida na ordem de produção' &&
    w.mmRotulo({ origem: 'producao' }, sai) === 'Transformada em CASCAO TRADICIONAL');
  t('a ordem de produção chama o registro da massa', /var linhas=montarLinhas\(itensMov,'producao'\);\s*registrarMassaNaOP\(linhas,itensMov\);/.test(src));
  t('"Itens consumidos" não soma a massa (os ingredientes já foram somados)', /if\(l\.transito\)return;/.test(require('./extrair.js').corpoDaFuncao('telaItensConsumidos', src)));
  const semDest = [{ insumoId: 'x', direcao: 'saida', qtd: 1 }];
  DB.fichas.push({ id: 'fi_sem', nome: 'SEM DESTINO', unidade: 'g', rendimento: 1, itens: [], destinoId: '__nenhum' });
  w.registrarMassaNaOP(semDest, [{ tipo: 'ficha', refId: 'fi_sem', qtd: 10, unidade: 'g' }]);
  t('ficha sem destino não ganha linha nenhuma', semDest.length === 1);

  grupo('3. Escolher na lista não é desfeito pelo texto digitado');
  t('a saída do campo lê o campo redesenhado, não o texto de antes',
    /setTimeout\(function\(\)\{ var cur=document\.getElementById\('mvBusca'\);\s*_aplicaBuscaMov\(cur\?cur\.value:v,true\); \},180\);/.test(src));

  grupo('4. Saldo de uma unidade desta empresa não fica retido');
  t('a linha com unidade desta empresa é adotada antes de virar "sem dono"',
    /if\(_sx&&_sucDaEmpresa\[_sx\]\)\{ x\._loja=l; x\._suc=x\._suc\|\|_sx; delete x\._tenantDesconhecido; \}/.test(src));
  t('linha sem unidade continua retida', /if\(!x\._loja\)\{\s*if\(x\._tenantDesconhecido!==true\)/.test(src));

  grupo('5. A nuvem recusa saldo mais antigo que o salvo');
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('gatilho de UPDATE em estoque_unidade', /create trigger ab_saldo_mais_novo_vence before update on public\.estoque_unidade/.test(sql));
  t('recusa o que mudou antes do salvo, e o que chega sem data',
    /new\.atualizado_em is null or new\.atualizado_em < old\.atualizado_em/.test(sql) && /return old;/.test(sql));

  grupo('6. Movimentação de Estoque: a produção de uma ficha, inteira');
  const opAntiga = { id: 'mvop', data: '2026-10-03', hora: '18:05', origem: 'producao', sucursalId: SUC, identificacao: 'OP 0041',
    linhas: [{ insumoId: 'ins_ovo', nome: 'Ovo', unidade: 'un', qtd: 4, direcao: 'saida', fichaId: 'fi_massa', origem: 'ficha:fi_massa', fichaNome: 'MASSA CASCAO TRADICIONAL' },
      { insumoId: 'ins_casc', nome: 'CASCAO TRADICIONAL', unidade: 'un', qtd: 80, direcao: 'entrada', origem: 'producao:fi_massa', fichaNome: 'MASSA CASCAO TRADICIONAL' }] };
  DB.fichas[0].rendimento = 1250; DB.fichas[0].rendUnidade = 'g';
  const ls = w.linhasComMassa(opAntiga);
  const mE = ls.find(l => l.origem === 'massa:fi_massa'), mS = ls.find(l => l.origem === 'transformacao:fi_massa');
  t('produção antiga: a massa é deduzida do que entrou no destino (80 cascões = 2 receitas = 2.500 g)',
    mE && mS && mE.qtd === 2500 && mS.qtd === 2500 && mS.destinoNome === 'CASCAO TRADICIONAL', JSON.stringify(ls));
  t('a linha deduzida não vai para o registro gravado', opAntiga.linhas.length === 2);
  w.MV.motivoId = '__prod:fi_massa';
  t('"Produção — MASSA" mostra os ingredientes, a massa e o cascão',
    ls.every(l => w.movCasaLinhaProd(l)) && !w.movCasaLinhaProd({ insumoId: 'ins_x', origem: 'ficha:fi_outra', fichaId: 'fi_outra' }));
  t('e só movimentos de produção', w.movCasaMotivo(opAntiga) && !w.movCasaMotivo({ origem: 'venda' }));
  DB.movEst.push(opAntiga);
  t('a ficha produzida vira uma escolha no filtro', /Produção — MASSA CASCAO TRADICIONAL/.test(w.opcoesProducaoMov()));
  w.MV.motivoId = '';
  t('os dois relatórios usam as linhas com a massa', (src.match(/linhasComMassa\(m\)\.forEach/g) || []).length === 3);

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

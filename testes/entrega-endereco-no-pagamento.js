/* ==========================================================
   ENTREGAR PARA: NOME, TELEFONE E ENDEREÇO NO PAGAMENTO (04/10/2026)

   Rodar:  node testes/entrega-endereco-no-pagamento.js
   ou:     npm run test:entregaend   (entra na bateria e no portão)

   Rafael: "pedido por telefone — na tela de pagamento não aparece o
   endereço. Quero o nome em cima, o telefone e o endereço embaixo; o do
   cadastro e um + para adicionar outro (casa do pai, da mãe), e poder
   excluir. E tudo isso na impressão."

   Prende:
     · a lista traz o endereço do cadastro primeiro e os outros depois;
     · o endereço novo é guardado no cliente e já vem escolhido;
     · excluir tira da lista e devolve a escolha ao cadastro;
     · o pedido leva o endereço escolhido e o telefone, e o papel imprime;
     · a lista sobe para a nuvem só quando o aparelho a conhece, e o banco
       não deixa nulo apagar a que está salva.
   O fluxo no Chromium (fotos no computador e no celular) foi feito com a
   tela de pagamento de verdade.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261004_cliente_outros_enderecos.sql');
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
  const w = dom.window, DB = w.DB, doc = w.document;
  const src = fs.readFileSync(ARQ, 'utf8');
  w.salvar = () => {}; w.toast = () => {}; w.confirmar = async () => true;
  const cli = { id: 'cli_ray', nome: 'Raylan Souza', tel: '(17) 99123-4567', rua: 'Rua Sete', numero: '1450',
    bairro: 'Centro', cidade: 'Santa fe do sul', ref: 'Portão verde',
    enderecos: [{ id: 'end_mae', apelido: 'Casa da mãe', rua: 'Av. Navarro', numero: '88', bairro: 'Jardim', cidade: 'Santa fe do sul' }] };
  DB.clientes = [cli];
  w.PDV.cliente = cli; w.PDV.tipo = 'entrega';

  grupo('1. A lista de endereços');
  const l = w.enderecosDoCliente(cli);
  t('o do cadastro vem primeiro, os outros depois', l.length === 2 && l[0].id === 'cad' && l[0].cadastro && l[1].id === 'end_mae');
  t('cliente sem endereço nenhum: lista vazia', w.enderecosDoCliente({ nome: 'X' }).length === 0);
  const h = w.blocoEntregaPara();
  t('o bloco mostra nome, telefone e os dois endereços', /Raylan Souza/.test(h) && /\(17\) 99123-4567/.test(h) &&
    /Rua Sete, 1450/.test(h) && /Av\. Navarro, 88/.test(h) && /Casa da mãe/.test(h));
  t('só o endereço extra tem o botão de excluir', (h.match(/pgExcluirEnd\(/g) || []).length === 1);
  t('e há o "+ Novo endereço"', /\+ Novo endereço/.test(h));
  t('o pagamento da entrega mostra o bloco em cima do Resumo',
    /\(PDV\.tipo==='entrega'&&PDV\.cliente\?blocoEntregaPara\(\):''\)\+\s*'<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Resumo<\/h3>'/.test(src));

  grupo('2. Novo endereço e excluir');
  const box = doc.createElement('div'); box.innerHTML = h; doc.body.appendChild(box);
  doc.getElementById('neRua').value = 'Rua do Sítio'; doc.getElementById('neNum').value = '10';
  doc.getElementById('neBai').value = 'Zona Rural'; doc.getElementById('neApe').value = 'Casa do pai';
  w.pgSalvarEnd();
  t('o novo endereço fica guardado no cliente', cli.enderecos.length === 2 && cli.enderecos[1].apelido === 'Casa do pai');
  t('e já vem escolhido para este pedido', w.eval('_endVenda') && w.eval('_endVenda.apelido') === 'Casa do pai');
  const antes = cli.enderecos.length;
  doc.getElementById('neRua').value = ''; w.pgSalvarEnd();
  t('sem rua, número e bairro não salva', cli.enderecos.length === antes);
  await w.pgExcluirEnd(cli.enderecos[1].id);
  t('excluir tira da lista', cli.enderecos.length === 1 && cli.enderecos[0].id === 'end_mae');
  t('e a escolha volta para o endereço do cadastro', w.eval('_endVenda.id') === 'cad');
  t('o endereço do cadastro não se exclui por aqui', /\(e\.cadastro\?'':'<button type="button" class="pgEndX"/.test(src));

  grupo('3. O pedido e o papel');
  t('o pedido leva o endereço escolhido, o bairro e o telefone',
    /endereco:\(PDV\.tipo==='entrega'&&_endVenda\)\?\{rua:_endVenda\.rua/.test(src) &&
    /clienteFone:\(PDV\.tipo==='entrega'&&PDV\.cliente&&PDV\.cliente\.tel\)\?PDV\.cliente\.tel:undefined/.test(src));
  const ped = { id: 'p1', tipo: 'entrega', clienteId: 'cli_ray', clienteNome: 'Raylan Souza', clienteFone: '(17) 99123-4567',
    endereco: { rua: 'Av. Navarro', numero: '88', bairro: 'Jardim', referencia: 'ao lado da padaria' }, bairro: 'Jardim',
    itens: [], total: 10, pagamentos: [], data: '2026-10-04T18:00:00Z', hora: '15:00' };
  const d = w.dadosImp(ped);
  t('o papel sai com nome, telefone, endereço da entrega e bairro',
    d.cliente === 'Raylan Souza' && d.fone_cliente === '(17) 99123-4567' &&
    d.end_entrega === 'Av. Navarro, 88 - ao lado da padaria' && /Jardim/.test(d.bairro), JSON.stringify(d));

  grupo('4. A lista na nuvem');
  const E2 = w.eval('MAPA').find(e => e.col === 'clientes');
  t('sobe a lista quando o aparelho a conhece', JSON.stringify(E2.campos(cli).enderecos) === JSON.stringify(cli.enderecos));
  t('aparelho que não conhece a lista não manda nada', E2.campos({ nome: 'X' }).enderecos === undefined);
  t('a lista desce da nuvem', /enderecos:Array\.isArray\(x\.enderecos\)\?x\.enderecos:\[\]/.test(src));
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('no banco, nulo nunca apaga a lista salva',
    /add column if not exists enderecos jsonb/.test(sql) && /if new\.enderecos is null then\s*new\.enderecos := old\.enderecos;/.test(sql) &&
    /create trigger ab_enderecos_nulo_nao_apaga before update on public\.clientes/.test(sql));

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

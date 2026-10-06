/* ==========================================================
   JOIA — O FATURAMENTO DO MÊS INTEIRO (28/09/2026)

   Rodar:  node testes/faturamento-inteiro.js
   ou:     npm run test:fatinteiro   (entra na bateria e no portão)

   POR QUE ESTE ARQUIVO EXISTE
   Rafael, 28/09/2026: "no app Joia Gest o faturamento do mês é
   71.957,99; na Gestão e Dashboard do Joia dá 42.076,99. Toda venda tem
   que ser registrada em qualquer relatório de faturamento."

   O servidor da nuvem devolve no máximo 1.000 linhas por consulta, calado.
   O aparelho pedia `limit=3000` de pedidos e recebia 1.000 — as vendas de
   12/09 em diante. As 1.000 somavam exatamente R$ 42.076,99. Cupons
   fiscais e movimentações de estoque estavam cortados igual.

   Este guardião dubla a nuvem COM o corte de 1.000 (como ela é) e prova:
     1. quem pede 3.000 recebe tudo o que existe (2.032), sem repetir;
     2. a ordem ganha o desempate por id, e as páginas andam de 1.000;
     3. tabela pequena continua numa leitura só, com a mesma consulta;
     4. consulta sem limite também não perde nada acima de 1.000;
     5. se a leitura em páginas falhar, fica o que já tinha vindo;
     6. o download de pedidos que bate no próprio limite avisa os
        relatórios, que passam a buscar na nuvem o que falta.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* uma nuvem de mentira que se comporta como a de verdade:
   filtra, ordena (com mais de uma coluna), pula (offset) e CORTA EM 1.000 */
function nuvemFalsa(tabelas, registro) {
  return async function (caminho) {
    registro.push(caminho);
    const [tab, qs] = String(caminho).split('?');
    const p = new URLSearchParams(qs || '');
    let linhas = (tabelas[tab] || []).slice();
    const ord = p.get('order');
    if (ord) {
      const regras = ord.split(',').map(s => { const [c, d] = s.split('.'); return { c, d: d || 'asc' }; });
      linhas.sort((a, b) => {
        for (const r of regras) {
          const x = a[r.c], y = b[r.c];
          if (x === y) continue;
          const v = x < y ? -1 : 1;
          return r.d === 'desc' ? -v : v;
        }
        return 0;
      });
    }
    const off = Number(p.get('offset') || 0);
    const lim = p.get('limit') ? Number(p.get('limit')) : Infinity;
    return linhas.slice(off, off + Math.min(lim, 1000));
  };
}

(async function () {
  console.log('\nCarregando o sistema para o guardião do faturamento inteiro…');
  const vc = new VirtualConsole();
  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window;

  /* 2.032 vendas de 29/08 a 28/09, várias com o MESMO criado_em (empate de
     ordem — é onde página mal feita repete ou pula venda) */
  const pedidos = [];
  let soma = 0;
  for (let i = 0; i < 2032; i++) {
    const dia = new Date(Date.UTC(2026, 7, 29 + Math.floor(i / 66), 15));
    const iso = dia.toISOString();
    const total = 10 + (i % 37);
    soma += total;
    pedidos.push({ id: 'u' + String(i).padStart(5, '0'), ref_local: 'ped_' + i,
      criado_em: iso.slice(0, 13) + ':00:00Z', data_venda: iso, total });
  }
  const clientes = [];
  for (let i = 0; i < 1500; i++) clientes.push({ id: 'c' + String(i).padStart(5, '0'), nome: 'Cliente ' + i });
  const pequenas = [{ id: 'm1', nome: 'Dinheiro' }, { id: 'm2', nome: 'Pix' }];

  grupo('A porta existe e é a que o download usa');
  t('apiPaginado() existe', typeof win.apiPaginado === 'function');
  const fonteBaixar = String(win.baixarTab);
  t('o download (baixarTab) lê pela porta paginada', /apiPaginado\(url\)/.test(fonteBaixar));
  t('o mapa de vínculos (5.000 ids) também', /apiPaginado\(tab\+/.test(String(win.montarMapaVinculos)));

  grupo('1. Pedir 3.000 traz as 2.032 que existem — o caso de Santa Fé');
  let reg = [];
  win.api = nuvemFalsa({ pedidos, formas_pagamento: pequenas, clientes }, reg);
  const url = 'pedidos?loja_id=eq.L&data_venda=gte.2026-08-29&select=*&order=criado_em.desc&limit=3000';
  const todos = await win.apiPaginado(url);
  t('chegaram as 2.032 vendas (antes: 1.000)', todos.length === 2032, todos.length);
  const ids = new Set(todos.map(x => x.id));
  t('nenhuma venda repetida', ids.size === todos.length, ids.size);
  const somaVeio = todos.reduce((a, x) => a + x.total, 0);
  t('a soma do aparelho é a soma da nuvem', somaVeio === soma, somaVeio + ' × ' + soma);

  grupo('2. As páginas: desempate por id, de 1.000 em 1.000');
  const pags = reg.filter(u => /offset=/.test(u));
  t('leu em 3 páginas', pags.length === 3, pags.length);
  t('a ordem ganhou o desempate por id', pags.every(u => /order=criado_em\.desc,id\.desc/.test(u)), pags[0]);
  t('offsets 0, 1000, 2000', pags.map(u => /offset=(\d+)/.exec(u)[1]).join(',') === '0,1000,2000');
  t('o limite original (3000) não vai junto', pags.every(u => !/limit=3000/.test(u)));

  grupo('3. Tabela pequena: a mesma leitura de sempre, uma vez só');
  reg.length = 0;
  const peq = await win.apiPaginado('formas_pagamento?loja_id=eq.L&select=*&order=ordem&limit=3000');
  t('veio a tabela inteira', peq.length === 2);
  t('uma leitura só, sem paginar', reg.length === 1 && !/offset=/.test(reg[0]), reg.join(' | '));
  reg.length = 0;
  const peq2 = await win.apiPaginado('formas_pagamento?loja_id=eq.L&select=*');
  t('sem limite e pequena: também uma leitura só', peq2.length === 2 && reg.length === 1);

  grupo('4. Sem limite, mais de 1.000: não perde ninguém');
  reg.length = 0;
  const cli = await win.apiPaginado('clientes?loja_id=eq.L&select=*');
  t('os 1.500 clientes chegaram (antes: 1.000)', cli.length === 1500, cli.length);
  t('ordenou por id para paginar', reg.filter(u => /offset=/.test(u)).every(u => /order=id\.asc/.test(u)));

  grupo('5. Página que falha não piora nada');
  let n = 0;
  win.api = async (c) => { n++; if (n > 1) throw new Error('500 no banco'); return pedidos.slice(0, 1000); };
  const parcial = await win.apiPaginado(url);
  t('ficou com a primeira leitura (1.000), sem estourar', Array.isArray(parcial) && parcial.length === 1000);

  grupo('6. Pedidos acima do próprio limite: os relatórios vão à nuvem');
  /* as vendas terminam HOJE e começam 26 dias antes (06/10/2026): com
     datas fixas em setembro, o dia coberto pelo download caiu para fora
     da janela de 30 dias com a simples passagem do tempo, e este caso
     passou a falhar sem nenhuma mudança no código */
  const muitos = [];
  const hoje0 = new Date(); const ini0 = Date.UTC(hoje0.getUTCFullYear(), hoje0.getUTCMonth(), hoje0.getUTCDate() - 26);
  for (let i = 0; i < 3500; i++) {
    const d = new Date(ini0 + Math.floor(i / 130) * 86400000 + 15 * 3600000).toISOString();
    muitos.push({ id: 'v' + String(i).padStart(5, '0'), criado_em: d, data_venda: d, total: 1 });
  }
  reg = [];
  win.api = nuvemFalsa({ pedidos: muitos }, reg);
  win.PED_COBERTO_DESDE = '';
  const r6 = await win.baixarTab('pedidos', 'pedidos?loja_id=eq.L&select=*&order=criado_em.desc&limit=3000');
  t('veio até o limite pedido (3.000)', r6.length === 3000, r6.length);
  t('o download ficou marcado como cortado', win.eval('_CORTADAS.pedidos') === true);
  const maisAntiga = r6.map(x => x.data_venda.slice(0, 10)).sort()[0];
  const esperado = new Date(Date.UTC(+maisAntiga.slice(0, 4), +maisAntiga.slice(5, 7) - 1, +maisAntiga.slice(8, 10) + 1)).toISOString().slice(0, 10);
  const coberto = win.eval('PED_COBERTO_DESDE');
  t('o aparelho sabe de que dia em diante tem tudo', coberto === esperado, coberto + ' × ' + esperado);
  t('os relatórios buscam na nuvem antes desse dia (inicioJanelaLocal)',
    win.inicioJanelaLocal() === coberto, win.inicioJanelaLocal());
  reg = [];
  win.api = nuvemFalsa({ pedidos: muitos.slice(0, 800) }, reg);
  await win.baixarTab('pedidos', 'pedidos?loja_id=eq.L&select=*&order=criado_em.desc&limit=3000');
  t('download inteiro de novo: a marca sai', win.eval('PED_COBERTO_DESDE') === '');
  const jan = new Date(); jan.setDate(jan.getDate() - win.DIAS_JANELA_PEDIDOS);
  t('e a janela volta a ser a de sempre (30 dias)', win.inicioJanelaLocal() === jan.toISOString().slice(0, 10));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · faturamento do mês inteiro');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  process.exit(R.falhou ? 1 : 0);
})();

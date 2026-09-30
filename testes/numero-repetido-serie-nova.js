/* ==========================================================
   JOIA — NÚMERO QUE A RECEITA JÁ TEM: SÉRIE NOVA E REENVIO NA HORA
   (V392, 30/09/2026)

   Rodar:  node testes/numero-repetido-serie-nova.js
   ou:     npm run test:numrepetido   (entra na bateria e no portão)

   Santa Fé, do cupom 22 em diante: "Rejeição: Duplicidade de NF-e com
   diferença na Chave de Acesso". A SEFAZ já tinha a série 1, números 22
   em diante, do sistema antigo (12/2025). Toda venda era recusada e o
   cupom nunca saía no papel. Rafael: "resolva essa questão da recusa da
   Receita e para de repetir número da nota".

   Prende: a recusa por número repetido passa a loja para a série
   seguinte (no servidor, só com a recusa conferida na Spedy) e a MESMA
   venda é emitida de novo na hora, como outra nota; recusa de outra
   natureza não entra nesse caminho; três tentativas no máximo; o cupom
   que ficou para trás volta sozinho.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const EDGE = path.join(__dirname, '..', 'supabase', 'functions', 'joia-fiscal', 'index.ts');
const R = { total: 0, ok: 0 };
function t(n, c, d) { R.total++; if (c) { R.ok++; console.log('   ok   ' + n); } else console.log('   FALHA ' + n + (d !== undefined ? '  → ' + d : '')); }

(async function () {
  console.log('\n── 1. O servidor só troca de série com a recusa conferida');
  const ts = fs.readFileSync(EDGE, 'utf8');
  const bloco = (ts.split('if (acao === "numero_repetido")')[1] || '').split('if (acao === "reemitir")')[0];
  t('a ação existe', !!bloco);
  t('lê a nota na Spedy e exige recusa por duplicidade', /\/consumer-invoices\/\$\{encodeURIComponent\(id\)\}/.test(bloco) &&
    /g\.d\?\.status !== "rejected" \|\| !\/duplicidade\/i\.test\(msg\)/.test(bloco));
  t('não aceita série nem número do navegador', !/corpo\.serie|corpo\.numero/.test(bloco));
  t('sobe uma série só uma vez por série (duas vendas juntas não pulam duas)', /if \(serieAgora <= serieNota\)/.test(bloco) && /serie = serieNota \+ 1;/.test(bloco));
  t('grava a série nova na Spedy e na configuração da loja', /aplicarNaSpedy\(\{ \.\.\.u, serie \}/.test(bloco) && /fiscal_unidades"\)\.update\(\{ serie/.test(bloco));
  t('deixa rastro', /registrar\(ref, "numero_repetido", "ok"/.test(bloco));

  const vc = new VirtualConsole(); const erros = [];
  vc.on('jsdomError', e => erros.push(e && e.message));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('offline')); w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      w.scrollTo = () => {}; w.print = () => {}; w.alert = () => {}; w.confirm = () => true; w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) }; } });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window;

  console.log('\n── 2. A venda recusada por número repetido sai de novo, na hora');
  t('a nota do reenvio é OUTRA na Spedy (sufixo no identificador)',
    /integrationId:String\(ped\.id\)\+\(\(cupom&&cupom\.reenvio\)\?'-r'\+cupom\.reenvio:''\)/.test(String(w.montarNfce)));
  w.NUVEM.ligada = true; w.NUVEM.token = 'tk'; w.salvar = () => {}; w.sincronizar = () => {}; w.fsChip = () => {};
  let impressos = 0; w.fsDepoisDeEmitir = (c) => { if (c.status === 'autorizado') impressos++; };
  w.acompanharCupom = async () => {};
  w.DB.pedidos = [{ id: 'pd_1', sucursalId: 'suc_sf', data: w.hojeISO(), itens: [] }];
  w.montarNfce = (ped, c) => ({ nota: { integrationId: 'pd_1' + (c.reenvio ? '-r' + c.reenvio : ''), items: [1] } });
  const chamadas = []; let serie = 1, numero = 22;
  w.fiscalChamar = async (acao, d) => {
    chamadas.push(acao + (d.nota ? ':' + d.nota.integrationId : d.id ? ':' + d.id : ''));
    if (acao === 'emitir') {
      const n = numero++;
      if (serie === 1) return { ok: true, d: { nota: { spedyId: 'sp' + n, status: 'rejeitado', numero: n, serie,
        motivo: 'Rejeição: Duplicidade de NF-e com diferença na Chave de Acesso [chNFe:3525125005849800011165001000000022]' } } };
      return { ok: true, d: { nota: { spedyId: 'sp' + n, status: 'autorizado', numero: n, serie, chave: '35260950058498', protocolo: '1352' } } };
    }
    if (acao === 'numero_repetido') { serie++; return { ok: true, d: { ok: true, serie } }; }
    return { ok: false, d: {} };
  };
  const cup = { id: 'cf_1', pedidoId: 'pd_1', sucursalId: 'suc_sf', status: 'pendente', querEmitir: true, data: w.hojeISO(), hora: w.agoraHM() };
  w.DB.cuponsFiscais = [cup]; if (typeof w.baseCuponsFiscais === 'function') w.baseCuponsFiscais();
  const lista = w.baseCuponsFiscais(); if (lista.indexOf(cup) < 0) lista.push(cup);
  await w.emitirCupom('cf_1');
  const c = w.baseCuponsFiscais().find(x => x.id === 'cf_1');
  t('primeira emissão recusada por número repetido → pede série nova → emite de novo',
    JSON.stringify(chamadas) === JSON.stringify(['emitir:pd_1', 'numero_repetido:sp22', 'emitir:pd_1-r1']), JSON.stringify(chamadas));
  t('o cupom sai autorizado, na série nova', c.status === 'autorizado' && c.serie === 2, c.status + ' série ' + c.serie);
  t('e vai para o papel', impressos === 1, impressos);
  t('a recusa fica registrada no cupom', (c.recusadas || []).length === 1 && c.recusadas[0].numero === 22);

  console.log('\n── 3. Recusa de outra natureza não entra nesse caminho');
  chamadas.length = 0;
  const outra = { id: 'cf_2', pedidoId: 'pd_1', sucursalId: 'suc_sf', status: 'rejeitado', spedyId: 'sp99', motivo: 'Rejeição: NCM inexistente' };
  t('NCM errado não troca de série', w.ehNumeroRepetido(outra) === false && (await w.fsNumeroRepetido(outra)) === false && chamadas.length === 0);

  console.log('\n── 3b. Cupom que voltou da nuvem sem o identificador da Spedy');
  chamadas.length = 0; serie = 1;
  w.fiscalChamar = async (acao, d) => {
    chamadas.push(acao + (d.integrationId ? ':' + d.integrationId : d.id ? ':' + d.id : ''));
    if (acao === 'consultar') return { ok: true, d: { nota: { spedyId: 'spAntigo', status: 'rejeitado', motivo: 'Rejeição: Duplicidade de NF-e' } } };
    if (acao === 'numero_repetido') return { ok: true, d: { ok: true, serie: 2 } };
    if (acao === 'emitir') return { ok: true, d: { nota: { spedyId: 'spNovo', status: 'autorizado', numero: 40, serie: 2 } } };
    return { ok: false, d: {} };
  };
  const semId = { id: 'cf_9', pedidoId: 'pd_1', sucursalId: 'suc_sf', status: 'rejeitado', spedyId: '',
    motivo: 'Rejeição: Duplicidade de NF-e com diferença na Chave de Acesso', tentativas: 1, data: w.hojeISO(), hora: w.agoraHM() };
  w.baseCuponsFiscais().push(semId);
  t('sem o identificador ainda conta como número repetido', w.ehNumeroRepetido(semId) === true);
  t('busca a nota pela venda, troca a série e reenvia', (await w.fsNumeroRepetido(semId)) === true &&
    JSON.stringify(chamadas) === JSON.stringify(['consultar:pd_1', 'numero_repetido:spAntigo']), JSON.stringify(chamadas));
  await w.emitirCupom('cf_9');
  t('e o cupom sai autorizado', semId.status === 'autorizado', semId.status);

  console.log('\n── 4. No máximo três tentativas');
  serie = 1; chamadas.length = 0;
  w.fiscalChamar = async (acao) => { chamadas.push(acao);
    if (acao === 'emitir') return { ok: true, d: { nota: { spedyId: 'sx' + chamadas.length, status: 'rejeitado', numero: 1, serie: 1, motivo: 'Duplicidade de NF-e' } } };
    return { ok: true, d: { ok: true, serie: 2 } }; };
  const teimoso = { id: 'cf_3', pedidoId: 'pd_1', sucursalId: 'suc_sf', status: 'pendente', data: w.hojeISO(), hora: w.agoraHM() };
  w.baseCuponsFiscais().push(teimoso);
  await w.emitirCupom('cf_3');
  t('para depois de três trocas e deixa a recusa à vista', chamadas.filter(x => x === 'numero_repetido').length === 3 &&
    chamadas.filter(x => x === 'emitir').length === 4 && teimoso.status === 'rejeitado', JSON.stringify(chamadas));

  console.log('\n── 5. O que ficou para trás volta sozinho');
  t('fiscalReprocessar inclui o recusado por número repetido', /!ehNumeroRepetido\(c\)\)return false;/.test(String(w.fiscalReprocessar)) &&
    /else if\(ehNumeroRepetido\(c\)\)\{\s*if\(await fsNumeroRepetido\(c\)\)\{await emitirCupom\(c\.id\);n\+\+;\}/.test(String(w.fiscalReprocessar)));
  t('a consulta acha a nota do reenvio pelo identificador novo', /integrationId:c\.integ\|\|c\.pedidoId/.test(String(w.acompanharCupom === undefined ? '' : w.fiscalReprocessar)));

  t('nenhum erro de runtime', erros.length === 0, erros.join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram');
  try { w.close(); } catch (e) {}
  process.exit(R.ok === R.total ? 0 : 1);
})();

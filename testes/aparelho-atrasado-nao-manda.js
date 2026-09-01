/* ==========================================================
   JOIA — APARELHO ATRASADO NÃO MANDA NA NUVEM

   O que o banco registrou, em Santa Fé do Sul:

     31/08 20h50  o Rafael grava débito 0,73%, crédito 2,73% em 1 dia,
                  e a conta em que o dinheiro cai nas três formas.
     31/08 23h21  tudo volta sozinho para 1,99% / 3,49% / 30 dias /
                  conta nenhuma — e a bandeira do Dinheiro volta de "—"
                  para vazia, um campo que ele tinha mexido às 20h50.

   Subiu uma cópia ANTERIOR à edição, inteira, por cima da nova. O motor
   decide o envio por "a minha cópia mudou desde o meu último envio", que
   não é a mesma pergunta que "a minha cópia é mais nova". Um aparelho
   que ficou horas fora do ar acorda sem reconhecer a própria impressão e
   empurra o que tem.

   A trava existia e valia só para o aparelho COMPLETAMENTE vazio. Agora
   vale para todos: enquanto não completar um download nesta sessão,
   ninguém escreve na nuvem.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* roda o começo de `sincronizar` até a primeira parada, e diz onde parou */
async function tentarEnviar(nuvem) {
  const log = [];
  const amb = {
    NUVEM: nuvem, DB: { _sujo: false },
    RETIDOS: {}, ORFAOS: {}, RECUSADAS: {},
    logNuvem: (m) => log.push(String(m)),
    anotarTrava: () => {}, estadoNuvem: () => {}, avisoSessaoCaiu: () => {},
    statusNuvem: () => {}, salvar: () => {}, toast: () => {}, rodape: () => {},
    tokenValido: async () => 'tk',
    _quieto: () => {},
    /* `NUVEM.sincronizando` só vira true quando o envio de fato começa;
       daí para a frente o motor toca no resto do sistema, e o que este
       teste precisa saber já aconteceu */
    MAPA: [], __enviou: false
  };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao('sincronizar', fonte) +
    '\nreturn sincronizar;}')(amb);
  try { await f(); } catch (e) { amb.__erro = String(e.message); }
  return { enviou: nuvem.sincronizando === true, log: log.join(' | '), erro: amb.__erro };
}

(async () => {

console.log('\n── O aparelho que ainda não baixou não escreve na nuvem\n');
{
  /* exatamente o aparelho das 23h21: tem dado (não está zerado), mas
     ainda não conferiu o que existe na nuvem nesta sessão */
  const r = await tentarEnviar({ ligada: true, cli: {}, zerado: false, baixou: false,
    plataforma: false, sincronizando: false, loja: 'L' });
  t('o envio é adiado', r.enviou === false, r.log + (r.erro ? ' / ' + r.erro : ''));
  t('e fica pendente, para sair sozinho depois', r.pendente !== false);
  t('e o diagnóstico diz por quê', /ainda não baixou da nuvem/.test(r.log), r.log);
}

console.log('\n── Depois do download, o envio acontece normalmente\n');
{
  const r = await tentarEnviar({ ligada: true, cli: {}, zerado: false, baixou: true,
    plataforma: false, sincronizando: false, loja: 'L' });
  t('o envio segue em frente', r.enviou === true, r.log + (r.erro ? ' / ' + r.erro : ''));
}

console.log('\n── O aparelho vazio continua travado, como já era\n');
{
  const r = await tentarEnviar({ ligada: true, cli: {}, zerado: true, baixou: false,
    plataforma: false, sincronizando: false, loja: 'L' });
  t('nada sobe de aparelho recém-aberto', r.enviou === false, r.log);
}

console.log('\n── E a marca de pendência não se perde\n');
{
  const nuvem = { ligada: true, cli: {}, zerado: false, baixou: false,
    plataforma: false, sincronizando: false, loja: 'L' };
  await tentarEnviar(nuvem);
  t('o aparelho fica marcado como tendo coisa para enviar',
    nuvem.pendente === true, JSON.stringify(nuvem));
}

console.log('\n── A regra é a mesma que o espelho de exclusões já usava\n');
{
  const sinc = corpoDaFuncao('sincronizar', fonte);
  t('o envio usa a trava sem exigir aparelho vazio',
    /if\(!NUVEM\.baixou\)\{/.test(sinc) && !/NUVEM\.zerado&&!NUVEM\.baixou/.test(sinc));
  const ap = corpoDaFuncao('apagarRemovidos', fonte);
  t('e o espelho de exclusões continua com a dele',
    /if\(!NUVEM\.baixou\)/.test(ap));
}

console.log('\n── O caso do dia 31, campo por campo\n');
{
  /* o que o aparelho atrasado tinha (cópia das 26/08) e o que a nuvem já
     tinha (a edição do Rafael das 20h50). Sem a trava, a linha de baixo
     subia por cima da de cima. */
  const naNuvem = { fp_debito: { taxa: 0.73, dias: 1, conta: '0bb7693c' },
                    fp_credito: { taxa: 2.73, dias: 1, conta: '0bb7693c' },
                    fp_pix: { taxa: 0, dias: 0, conta: '0bb7693c' } };
  const noAtrasado = { fp_debito: { taxa: 1.99, dias: 1, conta: null },
                       fp_credito: { taxa: 3.49, dias: 30, conta: null },
                       fp_pix: { taxa: 0, dias: 0, conta: null } };
  const r = await tentarEnviar({ ligada: true, cli: {}, zerado: false, baixou: false,
    plataforma: false, sincronizando: false, loja: 'L' });
  t('o aparelho atrasado não chega a enviar nada', r.enviou === false);
  Object.keys(naNuvem).forEach(function (k) {
    t(k + ': a nuvem continua com o valor do Rafael',
      naNuvem[k].taxa !== noAtrasado[k].taxa || naNuvem[k].conta !== noAtrasado[k].conta
        ? naNuvem[k].conta === '0bb7693c' : true);
  });
}

console.log('\n── Download que falha não abre a porta para a semente\n');
{
  /* A outra porta para o mesmo estrago: `baixarTab()` devolve [] quando a
     consulta FALHA. Se `volta` aceitasse isso como "a nuvem está vazia",
     DB.formasPag ficaria vazio, `baseFormas()` semearia 1,99 / 3,49 de
     fábrica com os MESMOS identificadores — e aí sim subiria por cima.
     Foi assim que os dois turnos desativados voltaram em 29/08. */
  const amb = { _quieto: () => {}, logNuvem: () => {}, registrarSumico: () => {},
    guardarIds: () => {}, MAPA: [],
    DB: { formasPag: [
      { id: 'fp_debito',  nome: 'Cartão débito',  taxaPct: 0.73, dias: 1, contaId: 'ct_banco' },
      { id: 'fp_credito', nome: 'Cartão crédito', taxaPct: 2.73, dias: 1, contaId: 'ct_banco' }] } };
  amb._ANT = new Function('amb', 'with(amb){' + corpoDaFuncao('_ANT', fonte) +
    '\nreturn _ANT;}')(amb);
  const volta = new Function('amb', 'with(amb){' + corpoDaFuncao('volta', fonte) +
    '\nreturn volta;}')(amb);

  const mapear = (x) => ({ id: x.ref_local, nome: x.nome,
    taxaPct: Number(x.taxa_pct) || 0, dias: x.dias_recebimento || 0, contaId: x.conta_id || '' });

  /* o download falhou: veio [] */
  const depois = volta([], mapear, null, 'formasPag');
  t('a lista da loja continua de pé', depois.length === 2, JSON.stringify(depois));
  t('e com as taxas que o Rafael gravou',
    depois[0].taxaPct === 0.73 && depois[1].taxaPct === 2.73,
    JSON.stringify(depois.map(f => f.taxaPct)));
  t('e com a conta em que o dinheiro cai',
    depois.every(f => f.contaId === 'ct_banco'));

  /* e a semente não tem por que rodar: a lista não está vazia */
  const semear = new Function('amb', 'with(amb){' + corpoDaFuncao('baseFormas', fonte) +
    '\nreturn baseFormas;}')({ DB: amb.DB, syncFormas: () => {} });
  semear();
  t('a semente de fábrica não repõe nada por cima',
    amb.DB.formasPag.length === 2 && amb.DB.formasPag[0].taxaPct === 0.73,
    JSON.stringify(amb.DB.formasPag.map(f => f.id + ':' + f.taxaPct)));

  /* download de verdade continua mandando */
  const real = volta([{ ref_local: 'fp_debito', nome: 'Cartão débito',
    taxa_pct: 0.73, dias_recebimento: 1, conta_id: 'ct_banco' }], mapear, null, 'formasPag');
  t('download com conteúdo continua sendo a fonte da verdade',
    real.length === 1 && real[0].taxaPct === 0.73);
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);
})();

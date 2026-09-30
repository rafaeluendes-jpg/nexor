/* ==========================================================
   JOIA — A CONTA DO BANCO "SUMIA" DA TELA (V389)

   Rafael, 30/09/2026: *"já foi criada nessa conta de Santa Fé umas 10
   vezes a conta Itaú. E novamente a conta Itaú, que estava vinculada a
   todos os recebimentos de crédito, débito e PIX, novamente sumiu."*

   Conferido no banco antes de mexer em uma linha: **a conta nunca foi
   apagada**. "Itaú — conta corrente", agência 0614, conta 339968, está
   lá — e as três formas de pagamento (crédito 2,73%/1 dia, débito
   0,73%/1 dia e Pix) continuam apontando para ela.

   O que sumia era da TELA.

   `baseFin` tinha a trava certa desde 28/09: não semear enquanto o
   download não chegou, nem quando a nuvem já conhece a coleção. Só que
   ela estava escrita LÁ — e `baseCat`, que roda logo depois na mesma
   tela, tinha a sua própria versão, mais fraca: "se não tem a conta
   Caixa, cria a conta Caixa".

   Num aparelho recém-atualizado, antes do download: `baseFin`
   corretamente não semeava nada, e `baseCat` semeava Caixa e Cofre. A
   tela abria com DUAS contas, dizia "2 conta(s)", e o Itaú não estava
   lá. Quem olha conclui que a conta sumiu — e cadastra de novo. Dez
   vezes.

   Duas cópias da mesma regra divergem no primeiro caso de borda. Agora
   é uma só, e este guardião existe para que continue sendo.
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

console.log('\n── A regra de semear mora num lugar só\n');
const ps = new Function('amb',
  'with(amb){' + corpoDaFuncao('esperandoDownload', fonte) + '\n' +
  corpoDaFuncao('nuvemJaConhece', fonte) + '\n' +
  corpoDaFuncao('podeSemear', fonte) + '\n return podeSemear;}');

const caso = (nuvem, baixou, uuids) => ps({
  NUVEM: { ligada: nuvem, baixou: baixou },
  DB: { _uuid: uuids ? { contas: uuids } : {} }
})('contas');

t('nuvem ligada e download ainda NÃO chegou: não semeia',
  caso(true, false, null) === false);
t('download chegou e a nuvem não conhece conta nenhuma: pode semear',
  caso(true, true, null) === true);
t('A NUVEM JÁ CONHECE AS CONTAS: NÃO SEMEIA — era aqui que o Itaú sumia',
  caso(true, true, { ct_banco: 'uuid' }) === false);
t('sem nuvem (primeiro uso, sem internet): pode semear',
  caso(false, false, null) === true);
t('e um erro ao perguntar não trava o sistema — na dúvida, deixa passar',
  (function () {
    const f = new Function('amb',
      'with(amb){' + corpoDaFuncao('esperandoDownload', fonte) + '\n return esperandoDownload();}');
    return f({ get NUVEM() { throw new Error('x'); } }) === false;
  })());

console.log('\n── E as duas telas perguntam a ela\n');
const bc = semComentario(corpoDaFuncao('baseCat', fonte));
t('baseCat não semeia antes do download (era o defeito)',
  /if\(!podeSemear\('contas'\)\)return;/.test(bc));
t('a conferência vem ANTES de criar Caixa e Cofre',
  bc.indexOf("podeSemear('contas')") < bc.indexOf("id:'ct_caixa'"));
const bf = semComentario(corpoDaFuncao('baseFin', fonte));
t('baseFin usa a MESMA função, não uma cópia da regra',
  /podeSemear\('contas'\)/.test(bf));
t('e a cópia antiga da regra saiu de baseFin',
  !/_jaNaNuvem/.test(bf) && !/_esperaDownload/.test(bf));

/* roda baseCat de verdade, no cenário exato da loja */
console.log('\n── O cenário da loja, rodando de verdade\n');
(function () {
  function mundo(nuvem, baixou, uuids) {
    const DB = { contas: [], catfin: [], _uuid: uuids ? { contas: uuids } : {} };
    const amb = {
      DB: DB, NUVEM: { ligada: nuvem, baixou: baixou },
      baseFin: () => {}, baseCat: null
    };
    const f = new Function('amb',
      'with(amb){' + corpoDaFuncao('esperandoDownload', fonte) + '\n' +
      corpoDaFuncao('nuvemJaConhece', fonte) + '\n' +
      corpoDaFuncao('podeSemear', fonte) + '\n' +
      corpoDaFuncao('baseCat', fonte) + '\n baseCat(); return DB.contas;}');
    return f(amb);
  }
  t('APARELHO ESPERANDO O DOWNLOAD: a lista NÃO é preenchida com as fixas',
    mundo(true, false, null).length === 0, JSON.stringify(mundo(true, false, null)));
  t('nuvem já conhece as contas: também não',
    mundo(true, true, { ct_banco: 'u' }).length === 0);
  t('primeiro uso de verdade (sem nuvem): Caixa e Cofre nascem',
    mundo(false, false, null).length === 2,
    JSON.stringify(mundo(false, false, null).map(c => c.id)));
  t('e nascem marcadas como semente, que nunca vence a nuvem',
    mundo(false, false, null).every(c => c._semente === true));
})();

console.log('\n── E a tela avisa, em vez de parecer completa\n');
const av = corpoDaFuncao('avisoContasIncompleto', fonte);
t('o aviso só aparece enquanto o download não chegou',
  /if\(!esperandoDownload\(\)\)return '';/.test(semComentario(av)));
t('ele diz que pode faltar conta', /pode faltar conta/.test(av));
t('e pede para NÃO cadastrar de novo — foi o que aconteceu dez vezes',
  /Não cadastre de novo/.test(av));
t('dizendo que a conta e as formas de pagamento estão guardadas',
  /voltam\s*'\+\s*'sozinhas|voltam sozinhas/.test(av.replace(/\s+/g, ' ')) ||
  /estão guardadas/.test(av));
t('o aviso entra na tela de Contas Bancárias',
  /avisoContasIncompleto\(\)/.test(semComentario(corpoDaFuncao('telaContas', fonte))));
t('usando a faixa amarela que já existe', /class="imAviso"/.test(av));

console.log('\n── E o portão passa a reprovar semente desprotegida\n');
const aud = fs.readFileSync(__dirname + '/../ferramentas/auditar-configuracoes.js', 'utf8');
t('a auditoria procura todo item marcado como semente', /_semente\\s\*:\\s\*true|_semente/.test(aud));
t('e exige podeSemear em volta dele', /podeSemear/.test(aud));
t('a única exceção é declarada pelo nome, com a prova da mitigação',
  /SEMENTE_COM_MITIGACAO/.test(aud) && /baseSuc/.test(aud) && /soSemente/.test(aud));
t('e o motivo está escrito: a tela precisa de uma unidade para desenhar',
  /precisa\s*\n?\s*de uma unidade|PRECISA de uma unidade/.test(aud));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · a conta do banco não some da tela');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

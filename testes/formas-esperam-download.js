/* ==========================================================
   JOIA — APARELHO NOVO NÃO GRAVA TAXA DE FÁBRICA ANTES DE BAIXAR

   24/09/2026. Reversão de Santa Fé em 02/09, 03/09 e 09/09: débito 0,73%
   → 1,99%, crédito 2,73% → 3,49%, e Pix, débito e crédito sem conta de
   destino — sempre gravado pelo aparelho da própria loja.

   A porta que sobrou: `baseFormas()` decidia "a loja é nova?" olhando só
   o que ESTE aparelho já tinha visto (`_uuid`). Aparelho novo, navegador
   limpo ou troca de login = `_uuid` vazio, mesmo com a loja configurada na
   nuvem. A semente gravava a fábrica com os MESMOS ids (fp_debito...), a
   linha nascia "nova aqui", o download a preservava como alteração não
   enviada, e o envio seguinte regravava a fábrica por cima.

   Regra: com a nuvem ligada, a lista gravada só recebe fábrica DEPOIS que
   o download terminou e a loja realmente não tem forma nenhuma. Até lá o
   caixa usa a lista de exibição, que não é gravada nem sobe.

   Rodar:  node testes/formas-esperam-download.js
   ou:     npm run test:formas-download
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* as funções REAIS de dentro do index.html */
function montar(DB, NUVEM) {
  return new Function('DB', 'NUVEM', `
    var FORMAS=[];
    ${corpoDaFuncao('formaDaTroco', fonte)}
    ${corpoDaFuncao('_formasFabrica', fonte)}
    ${corpoDaFuncao('syncFormas', fonte)}
    ${corpoDaFuncao('baseFormas', fonte)}
    return { rodar: function(){ baseFormas(); return FORMAS; } };
  `)(DB, NUVEM);
}

console.log('\n── Aparelho novo, nuvem ligada, download ainda não terminou\n');
{
  const DB = { formasPag: [], _uuid: {} };
  const NUVEM = { ligada: true, baixou: false };
  const FORMAS = montar(DB, NUVEM).rodar();
  t('a lista gravada NÃO recebe a fábrica', DB.formasPag.length === 0,
    JSON.stringify(DB.formasPag.map(f => f.id + ':' + f.taxaPct)));
  t('nenhuma taxa 1,99 / 3,49 fica pronta para subir',
    !DB.formasPag.some(f => f.taxaPct === 1.99 || f.taxaPct === 3.49));
  t('mas o caixa continua com as 5 formas na tela', FORMAS.length === 5, FORMAS.length);
  t('e o Dinheiro dá troco', !!(FORMAS.find(f => f.id === 'fp_dinheiro') || {}).troco);
}

console.log('\n── Depois do download: a loja configurada chega e manda\n');
{
  const DB = { formasPag: [], _uuid: {} };
  const NUVEM = { ligada: true, baixou: false };
  const m = montar(DB, NUVEM);
  m.rodar();                                   /* tela abriu antes do download */
  DB.formasPag = [                              /* o download trouxe o real */
    { id: 'fp_debito', nome: 'Cartão débito', tipo: 'debito', taxaPct: 0.73, dias: 1, contaId: 'ct_banco', ativa: true, ordem: 1 },
    { id: 'fp_credito', nome: 'Cartão crédito', tipo: 'credito', taxaPct: 2.73, dias: 1, contaId: 'ct_banco', ativa: true, ordem: 2 }];
  DB._uuid = { formasPag: { fp_debito: 'u1', fp_credito: 'u2' } };
  NUVEM.baixou = true;
  const FORMAS = m.rodar();
  t('as taxas da loja continuam 0,73 / 2,73',
    DB.formasPag[0].taxaPct === 0.73 && DB.formasPag[1].taxaPct === 2.73);
  t('com a conta de destino', DB.formasPag.every(f => f.contaId === 'ct_banco'));
  t('e a tela mostra as formas da loja', FORMAS.length === 2, FORMAS.length);
}

console.log('\n── Loja realmente nova: depois do download vazio, semeia\n');
{
  const DB = { formasPag: [], _uuid: {} };
  const NUVEM = { ligada: true, baixou: true };
  montar(DB, NUVEM).rodar();
  t('a loja nova ganha as 5 formas de fábrica', DB.formasPag.length === 5, DB.formasPag.length);
}

console.log('\n── Sem nuvem (uso local): semeia como sempre\n');
{
  const DB = { formasPag: [], _uuid: {} };
  montar(DB, { ligada: false, baixou: false }).rodar();
  t('sem nuvem, a lista gravada recebe as 5 formas', DB.formasPag.length === 5, DB.formasPag.length);
}

console.log('\n── A regra está no código publicado\n');
{
  const corpo = corpoDaFuncao('baseFormas', fonte);
  t('baseFormas espera o download quando a nuvem está ligada',
    /NUVEM\.ligada&&!NUVEM\.baixou/.test(corpo));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

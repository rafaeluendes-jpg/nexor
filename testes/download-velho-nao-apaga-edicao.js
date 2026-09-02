/* ==========================================================
   JOIA — DOWNLOAD VELHO NÃO APAGA A EDIÇÃO RECÉM-SALVA

   O Rafael, 02/09/2026, no MESMO computador: editou os valores das bases,
   salvou, e "voltou tudo velho". A edição subiu certo para a nuvem (o
   histórico do banco provou), mas a tela mostrava o valor antigo.

   A causa é uma corrida, no próprio código:

     1. um download parte e busca a nuvem VELHA (valor 0);
     2. a pessoa salva — a nuvem vira NOVA (105), e a impressão local passa
        a bater com o que subiu;
     3. o download velho CHEGA e joga o 0 por cima. A proteção "manter o que
        ainda não subiu" não dispara, porque o que ela editou JÁ subiu.

   O conserto: o download guarda a hora em que começou; se um envio foi
   confirmado DEPOIS dessa hora, esse download está velho e não manda por
   cima do que está no aparelho. O próximo download limpo reconcilia.
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

const MAPA = [{ col: 'basesCat', tab: 'bases_catalogo',
  campos: function (x) { return { nome: x.nome, qtd_caixa: Number(x.qtdCaixa) || 0,
    valor_unit: Number(x.valorUnit) || 0, ficha_ref: x.fichaRef || null,
    ativo: x.ativo !== false, ordem: x.ordem || 0 }; } }];

function montar(nuvem) {
  const amb = { MAPA, _quieto: () => {}, logNuvem: () => {}, registrarSumico: () => {},
    guardarIds: () => {}, hashTexto: (t) => 'H:' + t, NUVEM: nuvem, DB: { _hash: {}, _uuid: {} } };
  amb.impressaoDaLinha = new Function('amb', 'with(amb){' + corpoDaFuncao('impressaoDaLinha', fonte) + '\nreturn impressaoDaLinha;}')(amb);
  amb.temMudancaNaoEnviada = new Function('amb', 'with(amb){' + corpoDaFuncao('temMudancaNaoEnviada', fonte) + '\nreturn temMudancaNaoEnviada;}')(amb);
  amb._ANT = new Function('amb', 'with(amb){' + corpoDaFuncao('_ANT', fonte) + '\nreturn _ANT;}')(amb);
  amb.volta = new Function('amb', 'with(amb){' + corpoDaFuncao('volta', fonte) + '\nreturn volta;}')(amb);
  return amb;
}
const mapaVindo = (x) => ({ id: x.ref_local, nome: x.nome, qtdCaixa: Number(x.qtd_caixa) || 1,
  valorUnit: Number(x.valor_unit) || 0, fichaRef: x.ficha_ref || '', ativo: x.ativo !== false, ordem: x.ordem || 0 });

function cenario(nuvem) {
  const amb = montar(nuvem);
  const E = MAPA[0];
  const local = [{ id: 'bc_kop', _loja: 'L', nome: 'BASE KOPENHAGEM', qtdCaixa: 1, valorUnit: 0, fichaRef: '', ativo: true, ordem: 0 }];
  amb.DB.basesCat = local; amb.DB._uuid.basesCat = { bc_kop: 'u1' };
  amb.DB._hash.basesCat = { bc_kop: amb.impressaoDaLinha(E, local[0], 0) };   /* baixou o valor 0 */
  /* o Rafael edita e salva: 0 -> 105, ficha ligada; o envio confirma (hash re-gravado) */
  local[0].valorUnit = 105; local[0].fichaRef = 'fi_kop';
  amb.DB._hash.basesCat['bc_kop'] = amb.impressaoDaLinha(E, local[0], 0);
  /* o download velho (valor 0) chega */
  const cloudVelho = [{ ref_local: 'bc_kop', nome: 'BASE KOPENHAGEM', qtd_caixa: 1, valor_unit: 0, ficha_ref: null, ativo: true, ordem: 0 }];
  return amb.volta(cloudVelho, mapaVindo, amb.DB.basesCat, 'basesCat');
}

console.log('\n── A corrida: download começou antes do envio\n');
{
  const r = cenario({ loja: 'L', _baixaIniciou: 1000, _enviouEm: 2000 });
  t('a edição do Rafael é mantida (105, não volta a 0)', r[0].valorUnit === 105, r[0].valorUnit);
  t('e a ficha ligada continua ligada', r[0].fichaRef === 'fi_kop', r[0].fichaRef);
}

console.log('\n── Download legítimo (começou DEPOIS do envio) continua mandando\n');
{
  /* aqui a nuvem é a fonte da verdade: o download é mais novo que o meu
     último envio, então uma mudança de OUTRO aparelho tem de entrar */
  const amb = montar({ loja: 'L', _enviouEm: 1000, _baixaIniciou: 2000 });
  const E = MAPA[0];
  const local = [{ id: 'bc_kop', _loja: 'L', nome: 'BASE KOPENHAGEM', qtdCaixa: 1, valorUnit: 105, fichaRef: 'fi_kop', ativo: true, ordem: 0 }];
  amb.DB.basesCat = local; amb.DB._uuid.basesCat = { bc_kop: 'u1' };
  amb.DB._hash.basesCat = { bc_kop: amb.impressaoDaLinha(E, local[0], 0) };   /* limpo, sem edição pendente */
  const cloudNovo = [{ ref_local: 'bc_kop', nome: 'BASE KOPENHAGEM', qtd_caixa: 1, valor_unit: 120, ficha_ref: 'fi_kop', ativo: true, ordem: 0 }];
  const r = amb.volta(cloudNovo, mapaVindo, amb.DB.basesCat, 'basesCat');
  t('mudança de outro aparelho entra (120)', r[0].valorUnit === 120, r[0].valorUnit);
}

console.log('\n── Sem corrida (nunca enviei nada) a nuvem manda, como sempre\n');
{
  const amb = montar({ loja: 'L' });   /* _enviouEm e _baixaIniciou ausentes */
  const E = MAPA[0];
  const local = [{ id: 'bc_kop', _loja: 'L', nome: 'BASE KOPENHAGEM', qtdCaixa: 1, valorUnit: 0, fichaRef: '', ativo: true, ordem: 0 }];
  amb.DB.basesCat = local; amb.DB._uuid.basesCat = { bc_kop: 'u1' };
  amb.DB._hash.basesCat = { bc_kop: amb.impressaoDaLinha(E, local[0], 0) };
  const cloud = [{ ref_local: 'bc_kop', nome: 'BASE KOPENHAGEM', qtd_caixa: 1, valor_unit: 90, ficha_ref: 'fi_kop', ativo: true, ordem: 0 }];
  const r = amb.volta(cloud, mapaVindo, amb.DB.basesCat, 'basesCat');
  t('a nuvem entra normalmente (90)', r[0].valorUnit === 90, r[0].valorUnit);
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

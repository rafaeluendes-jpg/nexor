/* ==========================================================
   JOIA — O CUPOM DEMORAVA 30 SEGUNDOS PARA SAIR (V388)

   Rafael, 30/09/2026: *"bateu a venda, já tem que imprimir. E tá
   demorando coisa de 30 segundos para poder imprimir a via fiscal. Não
   pode, porque senão enrola na fila."*

   A demora NÃO era da SEFAZ. Medindo os dezoito cupons de produção de
   29/09: a autorização já estava carimbada **antes** de a linha chegar
   à nuvem, em todos. A SEFAZ responde em segundos.

   A demora era nossa. A emissão devolve a nota "em processamento"; quem
   descobre a autorização é `acompanharCupom` — e ela esperava **2 s
   antes da primeira pergunta**, depois 3, 5, 8, 13. Em tempo corrido:
   2 s, 5 s, 10 s, 18 s, 31 s. Com a SEFAZ respondendo em 1 a 3 s, a
   primeira pergunta perdia por pouco e a segunda só vinha aos 5 s.

   E a ficha da cozinha — que sai no mesmo papel, depois do cupom, como
   ele pediu em 29/09 — tinha uma rede de segurança de 25 s. Era esse o
   tempo que a cozinha ficava sem papel.
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

/* a escala de espera, tirada do código de verdade */
const esperas = (function () {
  const c = corpoDaFuncao('acompanharCupom', fonte);
  const m = /esperas=esperas\|\|\[([0-9,\s]+)\]/.exec(c);
  return m ? m[1].split(',').map(x => parseInt(x.trim(), 10)) : [];
})();
const corrido = esperas.reduce((a, x) => (a.push((a[a.length - 1] || 0) + x), a), []);

console.log('\n── A pergunta chega cedo\n');
t('a escala existe e foi lida do código', esperas.length > 0, JSON.stringify(esperas));
t('a PRIMEIRA pergunta cabe em meio segundo (era 2 s)',
  esperas[0] <= 500, esperas[0] + ' ms');
t('nos primeiros 3 segundos há pelo menos quatro perguntas',
  corrido.filter(x => x <= 3000).length >= 4,
  corrido.filter(x => x <= 3000).length + ' pergunta(s)');
t('e nos primeiros 5 segundos, pelo menos cinco',
  corrido.filter(x => x <= 5000).length >= 5,
  corrido.filter(x => x <= 5000).length);

console.log('\n── Sem perder a cobertura longa\n');
t('a escala cobre ao menos 45 segundos, como antes',
  corrido[corrido.length - 1] >= 45000, corrido[corrido.length - 1] + ' ms');
t('e vai espaçando: a última espera é maior que a primeira',
  esperas[esperas.length - 1] > esperas[0] * 5);
t('nenhuma espera é zero — bater sem pausa viraria laço',
  esperas.every(x => x >= 200), JSON.stringify(esperas.filter(x => x < 200)));
t('a escala é crescente, sem sobressalto',
  esperas.every((x, i) => i === 0 || x >= esperas[i - 1]), JSON.stringify(esperas));

console.log('\n── E a consulta para assim que o cupom sai\n');
const ac = corpoDaFuncao('acompanharCupom', fonte);
t('sai do laço quando o cupom deixa de estar "enviando"',
  /if\(!c\|\|c\.status!=='enviando'\)return c;/.test(ac));
t('e imprime na hora em que a nota chega',
  /fsDepoisDeEmitir\(c\);return c;/.test(ac));
t('continua consultando pelo GET, nunca pelo check-status',
  /fiscalChamar\('consultar'/.test(ac));

console.log('\n── A cozinha não espera meio minuto\n');
t('a rede de segurança da via virou uma constante com nome',
  /var MS_ESPERA_VIA=(\d+);/.test(fonte));
const msVia = parseInt((/var MS_ESPERA_VIA=(\d+);/.exec(fonte) || [])[1], 10);
t('e ela é de no máximo 10 segundos (era 25)', msVia <= 10000, msVia + ' ms');
t('a espera usa a constante, não um número solto no meio do código',
  /\},MS_ESPERA_VIA\);/.test(corpoDaFuncao('_fsViaEspera', fonte)));
t('a via continua saindo sozinha se o cupom não vier',
  /imprimirVia\(ped\)/.test(corpoDaFuncao('_fsViaEspera', fonte)));
t('e se o cupom já a levou junto, a espera é desarmada',
  /if\(c&&c\.impressoEm\)return;/.test(corpoDaFuncao('_fsViaEspera', fonte)) &&
  /clearTimeout/.test(corpoDaFuncao('_fsViaJaSaiu', fonte)));
t('a regra do Rafael continua de pé: fiscal primeiro, cozinha depois',
  /fsViaSaiComOCupom\(ped\)\)_fsViaEspera\(ped\)/.test(
    corpoDaFuncao('finalizarVenda', fonte).replace(/\s+/g, '')) ||
  /fsViaSaiComOCupom/.test(corpoDaFuncao('finalizarVenda', fonte)));

/* a conta que importa para o balcão */
console.log('\n── A conta que o caixa sente\n');
(function () {
  /* com a SEFAZ respondendo em 1,5 s, quando o papel sai? */
  const respostaSefaz = 1500;
  const saiu = corrido.find(x => x >= respostaSefaz);
  t('SEFAZ em 1,5 s: o papel sai em até 2 segundos (antes: 5)',
    saiu <= 2000, saiu + ' ms');
  const saiu3 = corrido.find(x => x >= 3000);
  t('SEFAZ em 3 s: sai em até 4 segundos (antes: 10)', saiu3 <= 4000, saiu3 + ' ms');
  const saiu8 = corrido.find(x => x >= 8000);
  t('e mesmo com a SEFAZ em 8 s, sai em até 11 (antes: 18)', saiu8 <= 11000, saiu8 + ' ms');
})();

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o cupom sai rápido');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

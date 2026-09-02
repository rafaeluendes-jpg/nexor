/* ==========================================================
   JOIA — A CENTRAL DE BASES NÃO TREME AO EDITAR

   O Rafael, 02/09/2026, ligando a ficha técnica a cada base: "a hora que
   clico a tela fica tremendo e a seleção some sozinha".

   `mudarBase` redesenhava a TELA INTEIRA a cada dígito e a cada escolha
   de ficha. Redesenhar destrói o próprio <select> que está sendo usado —
   o tremor, e a escolha parecia voltar porque o elemento era recriado no
   meio do clique. Agora `mudarBase` atualiza só o que muda, sem redesenho.
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

const mb = corpoDaFuncao('mudarBase', fonte);

t('editar uma base NÃO redesenha a tela inteira',
  !/telaBasesValores\(\)/.test(mb), 'ainda chama telaBasesValores');
t('o valor da caixa da linha é atualizado no lugar',
  /tr\[data-bid="' \+ id \+ '"\] \.bsVlr/.test(mb));
t('a dica "sem baixa" da base é atualizada no lugar',
  /\.bsDica\[data-bid="' \+ id \+ '"\]/.test(mb));
t('o botão de salvar é trocado sem redesenhar a tabela',
  /getElementById\('bsSalvar'\)/.test(mb));
t('e o dado é gravado (fica sujo para salvar)', /BS\.sujo = true/.test(mb));

/* a linha e a área do botão precisam existir com esses marcadores no HTML */
const tela = corpoDaFuncao('telaBasesValores', fonte);
t('cada linha tem o marcador data-bid', /<tr data-bid="' \+ b\.id \+ '">/.test(tela));
t('a área do botão salvar tem id próprio', /id="bsSalvar"/.test(tela));
t('a dica de "sem baixa" tem o marcador da base', /class="bsDica" data-bid="' \+ b\.id \+ '"/.test(tela));

/* salvar realmente sincroniza — as unidades veem a tabela nova */
const sb = corpoDaFuncao('salvarBases', fonte);
t('salvar o catálogo dispara a sincronização', /salvar\(\)/.test(sb));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

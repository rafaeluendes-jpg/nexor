/* ==========================================================
   JOIA — O CAIXA CEGO E REGRA, NAO PREFERENCIA

   Quem fecha o caixa conta a gaveta sem ver o que o sistema espera.
   Conferencia com o gabarito na frente nao e conferencia: quem confere
   ajusta o que conta ao numero que esta vendo, sem ma intencao, so por
   vies — e a diferenca de caixa deixa de existir no papel e passa a
   existir so na gaveta.

   Ate a V202 isso era um valor guardado, que a nuvem podia desligar e
   que `toggleCego()` invertia — so que `toggleCego` nunca foi chamada
   por ninguem, entao a tela de configuracao que o comentario descrevia
   nunca existiu. Na V203 virou regra.

   O numero continua inteiro nos RELATORIOS, que sao a tela do dono.
   Cegar o dono junto seria trocar um problema por outro.
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome); }
}

/* roda o cfg() de verdade, com o DB que o teste montar */
function comConfig(config) {
  const DB = { config: config };
  const fabrica = new Function('DB', corpoDaFuncao('cfg', fonte) + '\n return cfg();');
  return fabrica(DB);
}

console.log('\n── O caixa cego não pode ser desligado\n');

t('config vazia nasce cega',              comConfig({}).caixaCego === true);
t('config sem a chave vira cega',         comConfig({ lojaAberta: true }).caixaCego === true);
t('config com false NAO desliga',         comConfig({ caixaCego: false }).caixaCego === true);
t('config com true segue cega',           comConfig({ caixaCego: true }).caixaCego === true);
t('nem string vazia desliga',             comConfig({ caixaCego: '' }).caixaCego === true);
t('nem zero desliga',                     comConfig({ caixaCego: 0 }).caixaCego === true);

console.log('\n── E não existe mais interruptor\n');

t('toggleCego não existe mais',           !/function toggleCego\s*\(/.test(fonte));
t('nada no sistema inverte caixaCego',    !/caixaCego\s*=\s*!/.test(fonte));

console.log('\n── A nuvem não desliga o cego de uma unidade\n');

t('o download não escreve caixaCego',     !/c3\.caixaCego\s*=/.test(fonte));
t('o envio continua gravando o campo',    /caixa_cego\s*:/.test(fonte));

console.log('\n── Mas o dono continua vendo o número\n');

/* o cego vive no PDV e no fechamento; relatorio e a tela do dono */
const fecha = corpoDaFuncao('fecharCaixa', fonte);
t('o fechamento respeita o cego',         /cfg\(\)\.caixaCego/.test(fecha));
const painel = corpoDaFuncao('painelCaixa', fonte);
t('o painel do operador respeita o cego', /cfg\(\)\.caixaCego/.test(painel));
t('o esperado continua sendo calculado',  /function esperadoCaixa\s*\(/.test(fonte));

console.log('\n' + '═'.repeat(52));
console.log('Joia ' + versaoDoSistema() + ' · caixa cego');
console.log((testes - falhas) + ' de ' + testes + ' testes passaram');
console.log('═'.repeat(52) + '\n');
process.exit(falhas ? 1 : 0);

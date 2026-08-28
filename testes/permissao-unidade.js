/* ==========================================================
   JOIA — SUITE DA SEPARACAO POR UNIDADE

   A separacao entre sucursais NAO existe no banco: a RLS trabalha por
   LOJA, e todas as sucursais de uma loja pertencem a mesma. Entao a
   unica trava que existe e a do sistema — e ela nao estava travando.

   `podeSucursal` e `sucursaisDoUsuario` foram escritas exatamente para
   isso e nunca haviam sido chamadas por ninguem: estavam na lista das
   42 funcoes orfas do MAPA.md. O menu do topo listava `lojasCad()`, que
   e a lista inteira, e `trocarLoja` nao conferia o destino.

   Esta suite guarda as duas pontas:
     - o COMPORTAMENTO de podeSucursal, rodando a funcao de verdade;
     - a LIGACAO, porque foi exatamente ela que faltou. Uma funcao certa
       que ninguem chama nao protege nada — foi o defeito da V191, que a
       V192 teve de consertar.
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

/* roda a funcao de verdade, com o usuario que o teste quiser */
function comUsuario(u) {
  const fabrica = new Function('usuarioLogado',
    corpoDaFuncao('podeSucursal', fonte) + '\n return podeSucursal;');
  return fabrica(() => u);
}

console.log('\n── podeSucursal: quem opera em qual unidade\n');

t("sem ninguem logado nao barra (a tela ja exige login)", comUsuario(null)("suc_a") === true);
t('mestre opera em qualquer unidade',          comUsuario({ mestre: true })('suc_z') === true);
t('acesso total opera em qualquer unidade',    comUsuario({ tudo: true })('suc_z') === true);
t('sem lista de unidades = sem restricao',     comUsuario({ sucursais: [] })('suc_z') === true);
t('lista ausente tambem e sem restricao',      comUsuario({})('suc_z') === true);
t('com lista, a unidade da lista passa',       comUsuario({ sucursais: ['suc_a', 'suc_b'] })('suc_a') === true);
t('com lista, a segunda tambem passa',         comUsuario({ sucursais: ['suc_a', 'suc_b'] })('suc_b') === true);
t('com lista, unidade de FORA e barrada',      comUsuario({ sucursais: ['suc_a', 'suc_b'] })('suc_c') === false);
t('unidade vazia nao vira passe-livre',        comUsuario({ sucursais: ['suc_a'] })('') === false);

console.log('\n── A ligacao: funcao certa que ninguem chama nao protege nada\n');

const trocar = corpoDaFuncao('trocarLoja', fonte);
t('trocarLoja confere a unidade de destino',   /podeSucursal\s*\(/.test(trocar));
t('e para antes de trocar quando barra',       trocar.indexOf('podeSucursal') < trocar.indexOf('DB.lojaAtual=id'));

const menu = corpoDaFuncao('toggleSuc', fonte);
t('o menu lista so as unidades do usuario',    /sucursaisDoUsuario\s*\(/.test(menu));
t('o menu nao lista mais a rede inteira',      !/lojasCad\(\)\.map/.test(menu));

/* a trava do menu sozinha nao basta: da para chamar trocarLoja pelo console */
t('as duas travas existem, nao so a do menu',
  /podeSucursal\s*\(/.test(trocar) && /sucursaisDoUsuario\s*\(/.test(menu));

/* o diagnostico de liberacao quebrada tambem era funcao orfa */
const diag = corpoDaFuncao('telaDiagnosticoSistema', fonte);
t('o Diagnostico mostra a liberacao por unidade', /pintaLiberacoes\s*\(/.test(diag));
t('e pintaLiberacoes usa o teste que ja existia',
  /liberacoesQuebradas\s*\(/.test(corpoDaFuncao('pintaLiberacoes', fonte)));

console.log('\n' + '═'.repeat(52));
console.log('Joia ' + versaoDoSistema() + ' · separação por unidade');
console.log((testes - falhas) + ' de ' + testes + ' testes passaram');
console.log('═'.repeat(52) + '\n');
process.exit(falhas ? 1 : 0);

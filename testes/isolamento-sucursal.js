/* ==========================================================
   JOIA — O USUÁRIO DE UMA LOJA NÃO VÊ SELETOR DE SUCURSAL

   03/09/2026. Logado em Santa Fé, a Ficha Técnica mostrava o seletor de
   Sucursais e deixava abrir a de Alphaville. O seletor de sucursal só pode
   existir para quem tem visão multiunidade (matriz/dono, ou usuário com mais
   de uma unidade). O usuário de uma loja fica preso à própria.

   Regra única: vejoVariasUnidades(). Esta suíte prova a regra e que as telas
   que tinham seletor passaram a escondê-lo / usar sucursaisDoUsuario().

   Rodar:  node testes/isolamento-sucursal.js
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

const TODAS = [
  { id: 's_santafe', nome: 'Jolo Santa Fe do Sul', ativa: true },
  { id: 's_jales', nome: 'Jolô Jales', ativa: true },
  { id: 's_alpha', nome: 'Jolo Alphaville', ativa: true },
  { id: 's_matriz', nome: 'Matriz', ativa: true }
];
function veVarias(usuario) {
  return new Function('ctx', `
    var usuarioLogado=function(){return ctx.u;}, baseSuc=function(){};
    var sucAtivas=function(){return ctx.todas;};
    ${corpoDaFuncao('sucursaisDoUsuario', fonte)}
    ${corpoDaFuncao('vejoVariasUnidades', fonte)}
    return vejoVariasUnidades();
  `)({ u: usuario, todas: TODAS });
}

console.log('\n── Quem NÃO vê o seletor (fica preso à própria loja)\n');
{
  t('gerente de uma unidade → NÃO vê seletor',
    veVarias({ nome: 'Santa Fé', sucursais: ['s_santafe'] }) === false);
}

console.log('\n── Quem VÊ o seletor (visão multiunidade)\n');
{
  t('matriz/dono (mestre) → vê', veVarias({ nome: 'Dono', mestre: true }) === true);
  t('acesso total (tudo) → vê', veVarias({ nome: 'Admin', tudo: true }) === true);
  t('usuário com sucursais vazias (matriz) → vê', veVarias({ nome: 'M', sucursais: [] }) === true);
  t('usuário com DUAS unidades → vê',
    veVarias({ nome: 'Regional', sucursais: ['s_santafe', 's_jales'] }) === true);
}

console.log('\n── As travas estão no código\n');
{
  const comp = corpoDaFuncao('vejoVariasUnidades', fonte);
  t('vejoVariasUnidades existe', /return sucursaisDoUsuario\(\)\.length>1/.test(comp) || comp.length > 0);
  t('a Ficha Técnica esconde o seletor de sucursal para usuário de loja',
    /\(vejoVariasUnidades\(\)\s*\?'<div class="fmSuc">/.test(fonte));
  t('e o seletor da ficha usa sucursaisDoUsuario, não todas as lojas',
    !/fmSuc"><label>Sucursais<\/label><select onchange="FT\.loja=this\.value">'\+\s*\(DB\.lojasFin/.test(fonte));
  t('o seletor de loja do topo é fixo (sem troca) para usuário de unidade',
    /vejoVariasUnidades\(\)\s*\n?\s*\?'<button class="bandSuc" id="sucBtn">/.test(fonte) ||
    /bandSuc bandSucFix/.test(fonte));
  t('o filtro Sucursais dos relatórios usa sucursaisDoUsuario',
    /selMulti\(id,'Sucursais',\s*\n?\s*sucursaisDoUsuario\(\)/.test(fonte));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — O GERENTE DE UNIDADE NÃO VÊ AS OUTRAS LOJAS NA CONCILIAÇÃO

   03/09/2026. Logado como gerente de Santa Fé, a Conciliação Bancária
   listava Matriz, Jales e Alphaville no filtro Sucursal. Primeira camada
   (frontend): o filtro passou a usar `sucursaisDoUsuario()`, que devolve
   só a(s) unidade(s) do usuário; a matriz continua vendo todas.

   (O isolamento de verdade — o dado no banco — é o projeto de RLS por
   unidade descrito em JOIA_SEGURANCA_ISOLAMENTO_UNIDADES_03092026.md.)

   Rodar:  node testes/isolamento-conciliacao.js
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
  { id: 's_jales',   nome: 'Jolô Jales', ativa: true },
  { id: 's_alpha',   nome: 'Jolo Alphaville', ativa: true },
  { id: 's_matriz',  nome: 'Matriz', ativa: true }
];
function montar(usuario) {
  return new Function('ctx', `
    var usuarioLogado=function(){return ctx.u;}, baseSuc=function(){};
    var sucAtivas=function(){return ctx.todas;};
    ${corpoDaFuncao('sucursaisDoUsuario', fonte)}
    return sucursaisDoUsuario();
  `)({ u: usuario, todas: TODAS });
}

console.log('\n── O gerente de unidade vê SÓ a própria loja\n');
{
  const r = montar({ nome: 'Santa Fé', sucursais: ['s_santafe'] });
  t('gerente de Santa Fé vê só Santa Fé',
    r.length === 1 && r[0].id === 's_santafe',
    r.map(x => x.nome).join(', '));
  t('e não aparece Matriz, Jales nem Alphaville',
    !r.some(x => ['s_jales', 's_alpha', 's_matriz'].indexOf(x.id) >= 0));
}

console.log('\n── A matriz continua vendo todas as unidades\n');
{
  t('usuário "tudo" vê as 4', montar({ nome: 'Matriz', tudo: true }).length === 4);
  t('usuário "mestre" vê as 4', montar({ nome: 'Dono', mestre: true }).length === 4);
  t('usuário sem sucursais atribuídas vê as 4 (é matriz/admin)',
    montar({ nome: 'Admin', sucursais: [] }).length === 4);
}

console.log('\n── A trava está na Conciliação\n');
{
  const tc = corpoDaFuncao('telaConciliacao', fonte);
  t('o filtro Sucursal usa sucursaisDoUsuario()', /sucursaisDoUsuario\(\)\.map\(/.test(tc));
  t('e não lista mais DB.lojasFin (todas as lojas) no filtro',
    !/DB\.lojasFin\|\|\[\{id:'lj_matriz'/.test(tc));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

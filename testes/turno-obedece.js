/* ==========================================================
   O PDV TEM DE OBEDECER A TELA DE TURNOS

   29/08/2026. O dono desativou os dois turnos em Configuracao da Loja
   > Turnos — a tela mostrava os dois desmarcados, e a nuvem tambem
   (ativo = false nas duas linhas). Mesmo assim, na loja, a janela de
   ABRIR FRENTE DE CAIXA continuava exigindo escolher entre "Turno 1
   08:00 as 15:00" e "Turno 2 15:00 as 23:00".

   Esses dois nomes e esses dois horarios sao a SEMENTE do sistema. Nao
   era a tela que estava dessincronizada: era a lista que tinha sido
   apagada e semeada de novo, com os valores de fabrica, ativos.

   O caminho inteiro:

     1. `baixarTab()` devolve [] quando a leitura FALHA, e escreve no
        diagnostico "tabela pulada; dados locais mantidos".
     2. `volta()` so preserva o que esta no aparelho quando recebe a
        lista atual. Das 45 chamadas, 40 passavam `null` — entre elas a
        dos turnos. Sem a lista, a protecao era codigo morto e
        `DB.turnos` virava [].
     3. `baseTurnos()` ve a lista vazia e SEMEIA os dois turnos de
        fabrica, ativos.
     4. A marca que impede a semente (`_semeado`) so era gravada por
        quem semeou. Uma loja que recebeu os turnos prontos da nuvem
        nunca a tinha — entao semeava de novo, todas as vezes.

   Uma falha de leitura de dez segundos desfazia uma decisao do dono e
   ainda subia os turnos de fabrica para a nuvem, para todas as lojas.

   Rodar:  node testes/turno-obedece.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── 1. Download que falha não pode zerar o cadastro\n');

/* `volta` roda de verdade, com o MAPA e o DB de mentira à volta */
function motorVolta(DB, logs) {
  return new Function('ctx', `
    var DB=ctx.DB, MAPA=[], _quieto=function(){}, logNuvem=function(x){ctx.logs.push(x)};
    var guardarIds=function(){}, registrarSumico=function(){};
    var temMudancaNaoEnviada=function(){return false};
    ${corpoDaFuncao('_ANT', fonte)}
    ${corpoDaFuncao('volta', fonte)}
    return volta;
  `)({ DB, logs });
}

const DOIS = [{ id: 'tn_a', nome: 'Turno 1', ini: '08:00', fim: '15:00', ativo: false, ordem: 0 },
              { id: 'tn_b', nome: 'Turno 2', ini: '15:00', fim: '23:00', ativo: false, ordem: 1 }];

let DB = { turnos: DOIS.map(x => Object.assign({}, x)) };
let logs = [];
let r = motorVolta(DB, logs)([], x => x, null, 'turnos');
t('o download voltou vazio — mas o cadastro local continua lá',
  r.length === 2, r.length + ' turno(s)');
t('e continua DESATIVADO, como o dono deixou',
  r.every(x => x.ativo === false), JSON.stringify(r.map(x => x.ativo)));

/* a chamada que já passava a lista continua idêntica */
DB = { turnos: DOIS.map(x => Object.assign({}, x)) };
r = motorVolta(DB, [])([], x => x, DB.turnos, 'turnos');
t('quem já passava a lista atual não muda de comportamento', r.length === 2, r.length);

/* e download com conteúdo continua mandando */
DB = { turnos: DOIS.map(x => Object.assign({}, x)) };
r = motorVolta(DB, [])([{ id: 'tn_a', nome: 'Manhã', ativo: true }], x => x, null, 'turnos');
t('download COM conteúdo continua sendo a fonte da verdade',
  r.length === 1 && r[0].nome === 'Manhã', JSON.stringify(r));

console.log('\n── 2. A semente não ressuscita o que o dono desligou\n');

function motorSemente(DB) {
  return new Function('ctx', `
    var DB=ctx.DB, NUVEM={ligada:false};
    var uid=function(p){return p+'_'+(ctx.n++)};
    ${corpoDaFuncao('jaExistiu', fonte)}
    ${corpoDaFuncao('baseTurnos', fonte)}
    return {base:baseTurnos, ja:jaExistiu};
  `)({ DB, n: 0 });
}

/* loja que RECEBEU os turnos da nuvem: nunca semeou, logo nunca tinha a marca */
DB = { turnos: DOIS.map(x => Object.assign({}, x)) };
let M = motorSemente(DB);
M.base();
t('só de ver a lista cheia, o sistema anota que ela já existiu',
  DB._semeado && DB._semeado.turnos === true, JSON.stringify(DB._semeado));

DB.turnos = [];                     /* é o que a falha de leitura fazia */
M.base();
t('lista zerada NÃO faz a semente voltar', DB.turnos.length === 0, DB.turnos.length);
t('e não aparece "Turno 1" de fábrica nenhum',
  !DB.turnos.some(x => x.nome === 'Turno 1' && x.ativo !== false),
  JSON.stringify(DB.turnos.map(x => x.nome)));

/* empresa nova, que nunca teve turno: aí sim a semente nasce */
DB = { turnos: [] };
M = motorSemente(DB);
M.base();
t('empresa nova continua nascendo com os dois turnos', DB.turnos.length === 2, DB.turnos.length);
t('e eles nascem ativos', DB.turnos.every(x => x.ativo === true));
DB.turnos = [];
M.base();
t('mas a semente é uma vez só — apagar todos continua apagado',
  DB.turnos.length === 0, DB.turnos.length);

console.log('\n── 3. A abertura de caixa lê a tela de Turnos\n');

t('a janela de abrir caixa monta a lista com turnosAtivos()',
  /var tns=turnosAtivos\(\);/.test(codigoNu));
t('e turnosAtivos() é quem filtra o desativado',
  /function turnosAtivos\(\)\{[\s\S]{0,120}filter\(function\(t\)\{return t\.ativo!==false\}\)/
    .test(codigoNu));
t('o turno sugerido pelo relógio também sai só dos ativos',
  /function turnoDoRelogio\(\)\{\s*var ts=turnosAtivos\(\);/.test(codigoNu));
t('sem turno ativo, nenhum radio de turno é montado',
  /\(tns\.length\?/.test(codigoNu));
t('e o sistema não manda cadastrar turno quando eles existem e foram desligados',
  /:\(\(DB\.turnos\|\|\[\]\)\.length\s*\?''\s*:/.test(codigoNu));
t('a marca da semente é gravada por quem vê a lista, não só por quem semeia',
  /function jaExistiu\(col\)\{[\s\S]{0,220}DB\._semeado\[col\]=true/.test(codigoNu));
t('e as três sementes do sistema usam a mesma trava',
  (codigoNu.match(/if\(jaExistiu\('(turnos|motivosCanc|statusVenda)'\)\|\|/g) || []).length === 3,
  (codigoNu.match(/if\(jaExistiu\('\w+'\)\|\|/g) || []).join(' '));
t('volta() descobre sozinha a lista atual quando não recebe uma',
  /if\(!Array\.isArray\(atual\)&&col\)atual=_ANT\(col\);/.test(codigoNu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

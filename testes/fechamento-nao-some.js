/* ==========================================================
   O QUE FOI FEITO AQUI E AINDA NÃO SUBIU NÃO PODE SER APAGADO

   28/08/2026, 23h. Santa Fé do Sul fechou o caixa do dia e imprimiu o
   comprovante. Na manhã seguinte o sistema mostrava aquele mesmo caixa
   "aberto desde o dia anterior". As 57 vendas da noite estavam todas na
   nuvem — R$ 1.964,00, a última às 23:43. Só o fechamento não estava.

   O aparelho estava online: milhares de pedidos ao servidor durante toda
   a noite. Não foi rede, não foi sessão.

   A causa estava escrita como se fosse regra, dentro do `volta()`:

       "registro que existe nos dois lados continua vindo da nuvem,
        que é a fonte da verdade"

   Para um registro ALTERADO AQUI e ainda não enviado, isso é falso: a
   verdade é a daqui, que a nuvem ainda não conhece. O download rodava
   segundos depois do fechamento, trocava a linha pela versão da nuvem —
   onde o caixa seguia aberto — e o envio seguinte já não tinha o que
   enviar. Sem erro, sem aviso, sem nada na tela.

   Por isso nenhuma varredura pegou: não é tela nem botão. É uma corrida
   entre dois computadores, e só um teste como este a enxerga.

   Rodar:  node testes/fechamento-nao-some.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* o MAPA de mentira tem o formato do de verdade, com os campos do caixa
   que importam para esta história */
const MAPA = [{ col: 'caixas', tab: 'caixas', campos: function (x) {
  return { operador: x.operador || null, aberto_txt: x.aberto || null,
           fechado_txt: x.fechadoEm || null, vendas: Number(x.vendas) || 0 };
} }];

function motor(DB) {
  const nomes = ['hashTexto', 'impressaoDaLinha', 'temMudancaNaoEnviada'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  return new Function('ctx', `
    var DB=ctx.DB, MAPA=ctx.MAPA, _quieto=function(){};
    ${codigo}
    return {${nomes.join(',')},marcar:function(col,x,i){
      DB._hash[col]=DB._hash[col]||{};
      DB._hash[col][x.id]=impressaoDaLinha(MAPA[0],x,i||0);
    }};
  `)({ DB, MAPA });
}

console.log('\n── Sistema ' + versaoDoSistema() + ' — a pergunta que faltava\n');

const caixa = { id: 'cx_28', operador: 'Jolo Santa Fe do Sul',
                aberto: '28/08/2026 13:22', fechadoEm: '', vendas: 0, _loja: 'emp1' };
let DB = { caixas: [caixa], _hash: {}, _uuid: { caixas: { cx_28: 'uuid' } } };
let m = motor(DB);

m.marcar('caixas', caixa);
t('logo depois de a nuvem confirmar, não há alteração pendente',
  m.temMudancaNaoEnviada('caixas', caixa, 0) === false);

/* o fechamento das 23h */
caixa.fechadoEm = '28/08/2026 23:05';
caixa.vendas = 1964;
t('fechou o caixa: agora HÁ alteração pendente',
  m.temMudancaNaoEnviada('caixas', caixa, 0) === true);

m.marcar('caixas', caixa);
t('depois de a nuvem confirmar o fechamento, não há mais pendência',
  m.temMudancaNaoEnviada('caixas', caixa, 0) === false);

t('registro criado aqui e nunca enviado conta como pendente',
  m.temMudancaNaoEnviada('caixas', { id: 'novo', _novoAqui: true }, 0) === true);
t('registro sem impressão guardada conta como pendente',
  m.temMudancaNaoEnviada('caixas', { id: 'sem_hash', aberto: 'x' }, 0) === true);
t('linha sem identificador não quebra',
  m.temMudancaNaoEnviada('caixas', {}, 0) === false);
t('coleção fora do MAPA não quebra',
  m.temMudancaNaoEnviada('nao_existe', caixa, 0) === false);

console.log('\n── O download não passa mais por cima do fechamento\n');

/* reproduz a noite: fecha o caixa aqui, e a nuvem manda a versão aberta */
const fechado = { id: 'cx_28', operador: 'Jolo Santa Fe do Sul',
                  aberto: '28/08/2026 13:22', fechadoEm: '28/08/2026 23:05',
                  vendas: 1964, _loja: 'emp1' };
const aberto  = { id: 'cx_28', operador: 'Jolo Santa Fe do Sul',
                  aberto: '28/08/2026 13:22', fechadoEm: '', vendas: 0, _loja: 'emp1' };
DB = { caixas: [fechado], _hash: {}, _uuid: { caixas: { cx_28: 'uuid' } } };
m = motor(DB);
/* a nuvem confirmou o caixa ABERTO; o fechamento é posterior e não subiu */
m.marcar('caixas', aberto);

const volta = new Function('ctx', `
  var DB=ctx.DB, MAPA=ctx.MAPA, _quieto=function(){}, logNuvem=function(x){ctx.logs.push(x)};
  var _ids={}, registrarSumico=function(){}, guardarIds=function(){};
  ${corpoDaFuncao('hashTexto', fonte)}
  ${corpoDaFuncao('impressaoDaLinha', fonte)}
  ${corpoDaFuncao('temMudancaNaoEnviada', fonte)}
  ${corpoDaFuncao('volta', fonte)}
  return volta;
`);
const logs = [];
const v = volta({ DB, MAPA, logs });
const resultado = v([aberto], x => x, DB.caixas, 'caixas');
const cx = resultado.find(x => x.id === 'cx_28');

t('o caixa continua FECHADO depois do download',
  cx && cx.fechadoEm === '28/08/2026 23:05', cx && cx.fechadoEm);
t('e as vendas do turno continuam lá', cx && cx.vendas === 1964, cx && cx.vendas);
t('e fica registrado no diagnóstico o que foi mantido',
  logs.some(x => /alteração ainda não enviada/.test(x)), logs.join(' | '));

/* sem alteração pendente, a nuvem continua mandando — como sempre foi */
DB = { caixas: [aberto], _hash: {}, _uuid: { caixas: { cx_28: 'uuid' } } };
m = motor(DB); m.marcar('caixas', aberto);
const v2 = volta({ DB, MAPA, logs: [] });
const daNuvem = { id: 'cx_28', operador: 'OUTRO', aberto: '28/08/2026 13:22',
                  fechadoEm: '28/08/2026 23:59', vendas: 99, _loja: 'emp1' };
const r2 = v2([daNuvem], x => x, DB.caixas, 'caixas');
t('quem não tem pendência continua vindo da nuvem',
  r2[0].operador === 'OUTRO' && r2[0].fechadoEm === '28/08/2026 23:59',
  JSON.stringify(r2[0]));

console.log('\n── O que ficou preso no código\n');

t('o download pergunta antes de substituir',
  /if\(temMudancaNaoEnviada\(col,x,i\)\)\{ meus\[x\.id\]=x/.test(codigoNu));
t('e mantém a versão daqui quando há pendência',
  /if\(x&&x\.id&&meus\[x\.id\]\)\{ _fic\+\+; return meus\[x\.id\]; \}/.test(codigoNu));
/* corrida corrigida em V287: download que começou antes do envio confirmado
   não manda por cima do que está no aparelho */
t('e um download que ficou velho não sobrescreve o que já subiu',
  /_baixaVelha/.test(codigoNu) && /_enviouEm > _NV._baixaIniciou|_enviouEm > NUVEM\._baixaIniciou/.test(codigoNu));
t('a impressão comparada é a do último envio CONFIRMADO',
  /var guardada=h\[x\.id\];[\s\S]{0,120}return impressaoDaLinha\(E,x,i\|\|0\)!==guardada/.test(codigoNu));
t('na dúvida, preserva o que está no aparelho',
  /catch\(e\)\{ _quieto\(e,'temMudancaNaoEnviada'\); return true; \}/.test(codigoNu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

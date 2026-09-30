/* ==========================================================
   JOIA — A TELA DE SINCRONIZAÇÃO DIZIA COISAS QUE NÃO ERAM (V374)

   A RDS pede, no item 3, que o sistema mostre com clareza: última
   sincronização, quantas operações pendentes, horário da pendência mais
   antiga, eventuais erros e o aparelho responsável.

   O Joia mostrava três dessas cinco — e das três, duas mentiam.

   1. "ÚLTIMO ENVIO: —", PARA SEMPRE.
      A tela lê `NUVEM.ultimoEnvio`. Varrendo o sistema inteiro só
      existiam LEITURAS desse campo: nada, em lugar nenhum, o escrevia.
      Existia uma variável de módulo com nome parecido (`_ultimoEnvio`),
      que é outra coisa. Quem abria a tela para saber se o dia tinha
      subido via um traço, sempre, mesmo com tudo em dia.

   2. "1 A ENVIAR", COM SETECENTAS PENDÊNCIAS.
      `pendentesDeEnvio` varria o mapa inteiro somando `n` — e devolvia
      `1`, jogando a conta fora na última linha. Numa loja que passou o
      dia offline, esse `1` é a diferença entre "faltou uma coisinha" e
      "o dia inteiro não subiu".

   3. A PENDÊNCIA MAIS ANTIGA NÃO APARECIA EM LUGAR NENHUM — embora o
      dado já fosse coletado (`_criadoEm`) e jogado fora.

   4. O APARELHO RESPONSÁVEL não era dito nem gravado em operação
      nenhuma.
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
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ==========================================================
   1. O ÚLTIMO ENVIO PASSA A EXISTIR
   ========================================================== */
console.log('\n── "Último envio" deixa de ser um traço eterno\n');

t('alguém finalmente escreve NUVEM.ultimoEnvio',
  /NUVEM\.ultimoEnvio\s*=/.test(fonte));
t('e escreve junto de NUVEM.ultima, no fim da sincronização',
  /NUVEM\.ultima=new Date\(\);[\s\S]{0,1200}?NUVEM\.ultimoEnvio=NUVEM\.ultima\.toLocaleString/.test(fonte));
t('a tela continua lendo o mesmo campo',
  /var ultimo=NUVEM\.ultimoEnvio\|\|'—'/.test(semComentario(corpoDaFuncao('telaSincronizacao', fonte))));

/* ==========================================================
   2. A CONTA DE PENDÊNCIAS É A DO MOTOR
   ========================================================== */
console.log('\n── O número de pendências passa a ser o número\n');

const pe = semComentario(corpoDaFuncao('pendentesDeEnvio', fonte));
t('usa a contagem do motor (contarPendencias), não uma conta paralela',
  /contarPendencias\(\)/.test(pe));
t('e não joga mais o resultado fora', !/return NUVEM\.sujo\|\|DB\._sujo\?1:0;\s*\/\* 1 =/.test(pe));

(function () {
  /* roda a função de verdade, com o motor devolvendo 700 */
  const f = n => new Function('amb',
    'with(amb){' + corpoDaFuncao('pendentesDeEnvio', fonte) + '\n return pendentesDeEnvio();}')
    ({ NUVEM: { ligada: true, sujo: false }, DB: { _sujo: false },
       contarPendencias: () => n, _quieto: () => {} });
  t('com 700 pendências, devolve 700 (devolvia 1)', f(700) === 700, f(700));
  t('com nenhuma e nada sujo, devolve 0', f(0) === 0, f(0));

  const g = new Function('amb',
    'with(amb){' + corpoDaFuncao('pendentesDeEnvio', fonte) + '\n return pendentesDeEnvio();}')
    ({ NUVEM: { ligada: true, sujo: true }, DB: { _sujo: false },
       contarPendencias: () => 0, _quieto: () => {} });
  t('mas a marca de "sujo" sozinha continua valendo como 1', g === 1, g);

  const h = new Function('amb',
    'with(amb){' + corpoDaFuncao('pendentesDeEnvio', fonte) + '\n return pendentesDeEnvio();}')
    ({ NUVEM: { ligada: false }, DB: {}, contarPendencias: () => 99, _quieto: () => {} });
  t('com a nuvem desligada não há pendência a mostrar', h === 0, h);

  /* se a contagem estourar, a tela não pode cair junto */
  const i = new Function('amb',
    'with(amb){' + corpoDaFuncao('pendentesDeEnvio', fonte) + '\n return pendentesDeEnvio();}')
    ({ NUVEM: { ligada: true, sujo: true }, DB: { _sujo: false },
       contarPendencias: () => { throw new Error('x'); }, _quieto: () => {} });
  t('e se a contagem falhar, cai no que já se sabia — sem estourar', i === 1, i);
})();

/* ==========================================================
   3. A PENDÊNCIA MAIS ANTIGA
   ========================================================== */
console.log('\n── Dez minutos e três dias param de parecer a mesma coisa\n');

(function () {
  const MAPA = [{ col: 'pedidos' }, { col: 'movEst' }];
  const DB = {
    _hash: {}, _uuid: {},
    pedidos: [{ id: 'p1', _loja: 'L', _criadoEm: '2026-09-28T10:00:00.000Z' },
              { id: 'p2', _loja: 'L', _criadoEm: '2026-09-25T08:00:00.000Z' },
              { id: 'p3', _loja: 'OUTRA', _criadoEm: '2026-01-01T00:00:00.000Z' }],
    movEst: [{ id: 'm1', _loja: 'L', _criadoEm: '2026-09-29T23:00:00.000Z' }]
  };
  const f = (precisa) => new Function('amb',
    'with(amb){' + corpoDaFuncao('pendenciaMaisAntiga', fonte) + '\n return pendenciaMaisAntiga();}')
    ({ MAPA: MAPA, DB: DB, NUVEM: { loja: 'L' }, precisaSubir: precisa, _quieto: () => {} });

  t('acha a mais antiga entre as que realmente faltam subir',
    f(() => true) === '2026-09-25T08:00:00.000Z', f(() => true));
  t('e ignora a linha de outra empresa',
    f(() => true) !== '2026-01-01T00:00:00.000Z');
  t('se nada falta subir, não há pendência antiga', f(() => false) === '');
  /* só o movimento pendente: a mais antiga é a dele */
  /* a assinatura real e precisaSubir(entradaDoMapa, registro, i, hash, uuid) */
  const soMov = (E2, r) => r.id === 'm1';
  t('olha todas as tabelas, não só a primeira',
    f(soMov) === '2026-09-29T23:00:00.000Z', f(soMov));
})();

(function () {
  const h = (q) => new Function('amb',
    'with(amb){' + corpoDaFuncao('hMaisAntiga', fonte) + '\n return hMaisAntiga();}')
    ({ pendenciaMaisAntiga: () => q, Date: Date });
  t('sem pendência, texto vazio', h('') === '');
  t('pendência de agora aparece em minutos',
    /há \d+ min/.test(h(new Date(Date.now() - 12 * 60000).toISOString())),
    h(new Date(Date.now() - 12 * 60000).toISOString()));
  t('pendência de horas aparece em horas',
    /há \d+ h/.test(h(new Date(Date.now() - 5 * 3600000).toISOString())));
  t('PENDÊNCIA DE DIAS APARECE EM DIAS — é o caso que importa',
    /há \d+ dia/.test(h(new Date(Date.now() - 3 * 86400000).toISOString())),
    h(new Date(Date.now() - 3 * 86400000).toISOString()));
  t('data inválida não estoura', h('não é data') === '');
})();

/* ==========================================================
   4. O APARELHO E A VERSÃO
   ========================================================== */
console.log('\n── Toda operação passa a dizer de qual aparelho veio\n');

const co = semComentario(corpoDaFuncao('carimbarOrigem', fonte));
t('carimba o aparelho de origem', /r\._ap=idDoAparelho\(\)/.test(co));
t('e a versão do aplicativo', /r\._ver=String\(VERSAO\)/.test(co));
t('são campos com "_": não sobem, não mexem na impressão digital, não forçam reenvio',
  /_ap/.test(co) && /_ver/.test(co) && !/campos:/.test(co));
t('e só carimba uma vez — não reescreve em toda gravação',
  /if\(!r\._ap\)/.test(co) && /if\(!r\._ver/.test(co));

const ts = semComentario(corpoDaFuncao('telaSincronizacao', fonte));
t('a tela mostra quantos registros esperam',
  /Esperando para subir/.test(ts) && /\+nPend\+/.test(ts));
t('mostra a pendência mais antiga', /Pendência mais antiga/.test(ts));
t('e mostra qual é este aparelho, com a versão', /Este aparelho/.test(ts));
t('o aviso do topo diz o número, não só "há alterações"',
  /nPend\+' registro\(s\) esperando para subir/.test(ts));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · a sincronização diz a verdade');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

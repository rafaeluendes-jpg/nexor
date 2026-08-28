/* ==========================================================
   JOIA — "SALVO" SO PODE SER DITO QUANDO CHEGOU

   O Rafael nao conseguia cadastrar produto. Toda vez que salvava, a tela
   abria "Produto ainda nao chegou a nuvem" — e, na ultima, SEM linha de
   motivo. Sem motivo quer dizer: nenhum erro, nenhuma recusa do banco,
   nenhum registro retido. Nada tinha dado errado.

   E nao tinha mesmo. O produto CHEGAVA na nuvem, poucos segundos depois.
   Quem desistia era a tela.

   `confirmarNaNuvem()` pedia a sincronizacao e olhava o mapa de
   identificadores. Mas `sincronizar()` comeca com uma guarda: se ja
   existe um envio em andamento, ela marca `pendente`, escreve "envio
   adiado" e RETORNA NA HORA — sem enviar nada. O `await` voltava em 1
   milissegundo, o mapa ainda nao tinha o registro, e a janela abria.

   Medido no navegador, antes da correcao:

       confirmarNaNuvem devolveu false em 1 ms
       janela: "Produto ainda nao chegou a nuvem"
       ...e o produto chegou na nuvem no envio seguinte

   Com fila grande isso era o estado NORMAL: o aparelho dele tinha 1.510
   alteracoes esperando, entao sempre havia envio em andamento e a janela
   aparecia em toda gravacao.

   Agora a tela espera o envio em andamento terminar antes de julgar.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function grupo(n) { console.log('\n── ' + n + '\n'); }
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

grupo('A guarda que fazia a tela desistir em 1 milissegundo');

const sinc = corpoDaFuncao('sincronizar', fonte);
t('sincronizar volta na hora quando já há envio em andamento',
  /if\(NUVEM\.sincronizando\)\{[\s\S]{0,120}NUVEM\.pendente=true;/.test(sinc));
t('e isso é de propósito — dois envios juntos se atrapalham',
  /envio adiado: já havia um em andamento/.test(sinc));

grupo('Então quem confirma tem de esperar, não só pedir');

const conf = corpoDaFuncao('confirmarNaNuvem', fonte);
t('pede a sincronização', /await sincronizar\(\)/.test(conf));
t('e ESPERA enquanto houver envio em andamento ou pendente',
  /while\(!subiu\(\)&&Date\.now\(\)<_ate&&\(NUVEM\.sincronizando\|\|NUVEM\.pendente\)\)/.test(conf));
t('com teto de tempo, para não prender a tela para sempre',
  /var _ate=Date\.now\(\)\+30000;/.test(conf));
t('olhando o mapa de tempos em tempos', /setTimeout\(r,400\)/.test(conf));

grupo('E o aviso passa a dizer a verdade');

t('fila grande não é falha: o texto diz que está subindo',
  /salvo — ainda subindo/.test(conf));
t('e diz para não fechar antes de a fila esvaziar',
  /Não feche o sistema até o rodapé parar de dizer/.test(conf));
t('o aviso duro fica só para quando o envio parou mesmo',
  conf.indexOf('ainda não chegou à nuvem') > conf.indexOf('ainda subindo'),
  'o aviso duro vem antes — pega o caso da fila grande por engano');

grupo('A decisão, rodada de verdade');

/* reproduz os três estados possíveis sem tocar na nuvem */
function decidir(cenario) {
  const NUVEM = { sincronizando: cenario.sincronizando, pendente: cenario.pendente,
                  ligada: true, erros: [] };
  const DB = { _uuid: { produtos: {} } };
  let janela = null;
  const relogio = { agora: 0 };
  const amb = {
    NUVEM: NUVEM, DB: DB, FALHAS: [],
    toast: () => {}, _quieto: () => {},
    auditarFila: () => ({ PERMISSAO: [], TENANT_DESCONHECIDO: [] }),
    E: x => x,
    sincronizar: async () => {
      /* a guarda de verdade: já há envio, volta na hora sem enviar */
      if (NUVEM.sincronizando) { NUVEM.pendente = true; return; }
      DB._uuid.produtos['prod1'] = 'uuid-1';
    },
    confirmar: async o => { janela = o.titulo; return true; },
    Date: { now: () => (relogio.agora += cenario.passo || 100) },
    setTimeout: (fn) => {
      /* a fila termina depois de N voltas */
      if (cenario.terminaEm !== undefined && --cenario.terminaEm <= 0) {
        NUVEM.sincronizando = false; NUVEM.pendente = false;
        DB._uuid.produtos['prod1'] = 'uuid-1';
      }
      fn(); return 1;
    },
    Promise: Promise
  };
  /* a função é assíncrona: entra como expressão, senão o `await` não vale */
  const f = new Function('amb',
    'with(amb){ var fn = ' + corpoDaFuncao('confirmarNaNuvem', fonte) +
    "; return fn('produtos','prod1','Produto');}");
  return f(amb).then(r => ({ devolveu: r, janela: janela }));
}

(async function () {
  /* 1. nuvem livre: sobe na hora e confirma, sem janela */
  const livre = await decidir({ sincronizando: false, pendente: false });
  t('nuvem livre: confirma e não abre janela',
    livre.devolveu === true && livre.janela === null, JSON.stringify(livre));

  /* 2. fila grande que TERMINA enquanto espera: confirma */
  const termina = await decidir({ sincronizando: true, pendente: false, terminaEm: 3 });
  t('fila que termina enquanto espera: confirma, sem janela',
    termina.devolveu === true && termina.janela === null, JSON.stringify(termina));

  /* 3. fila que não termina no tempo: avisa que está subindo, não que falhou */
  const demora = await decidir({ sincronizando: true, pendente: false, passo: 20000 });
  t('fila que passa do tempo: avisa que está subindo',
    demora.janela === 'Produto salvo — ainda subindo', JSON.stringify(demora));
  t('e NÃO diz que não chegou à nuvem',
    demora.janela !== 'Produto ainda não chegou à nuvem', demora.janela);

  console.log('\n════════════════════════════════════════════════════');
  console.log('Joia ' + versaoDoSistema() + ' · "salvo" só quando chegou');
  console.log(testes - falhas + ' de ' + testes + ' testes passaram');
  console.log('════════════════════════════════════════════════════\n');
  process.exit(falhas ? 1 : 0);
})();

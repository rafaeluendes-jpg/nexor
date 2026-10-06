/* ==========================================================
   APAGAR TEM DE APAGAR — E SO O QUE FOI MANDADO APAGAR

   29/08/2026. O Rafael duplicou dois produtos, apagou os dois pela
   tela, DUAS vezes. Sumiam da lista. Ele saia da tela, voltava, e os
   dois estavam la de novo. O botao "funcionava": nao dava erro, nao
   avisava nada, e a nuvem nunca era informada — o download seguinte
   ressuscitava os dois.

   A causa: o espelhamento cruzava DUAS memorias para decidir. `_snap`,
   a lista da ultima vez, e `_apagados`, a declaracao da tela. So ia
   para a nuvem o que estivesse nas duas. Quando discordavam, a ordem
   se perdia — e pior: o `_snap` era adotado como estava, entao aquele
   identificador nunca mais aparecia como "sumiu", e a exclusao morria
   ali, para sempre, com a declaracao intacta e inutil.

   Medido um estado por vez, no navegador: sem `_snap`, com `_snap` sem
   aquele produto, com o download cortado pelo limite, ou com o
   aparelho ainda sem ter baixado — nos QUATRO a exclusao era engolida.

   Agora quem manda e a declaracao: o que a tela declarou e ja nao esta
   na lista vai para a nuvem, tenha `_snap` ou nao.

   Estes testes prendem as duas metades — que apagar apaga, e que nada
   alem do declarado e apagado.

   Rodar:  node testes/exclusao-vale.js
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

/* o espelhamento roda de verdade; só o banco e o relógio são de mentira */
function motor(estado) {
  const chamadas = [], logs = [];
  const ctx = {
    DB: estado.DB, NUVEM: estado.NUVEM || viu(),
    cortadas: estado.cortadas || {}, matriz: estado.matriz !== false,
    podeEsvaziar: !!estado.podeEsvaziar, chamadas, logs
  };
  const fn = new Function('ctx', `
    var DB=ctx.DB, NUVEM=ctx.NUVEM, _CORTADAS=ctx.cortadas;
    var TABS_CADASTRO_REDE=['produtos','categorias'];
    var ehSucMatriz=function(){return ctx.matriz};
    var lojaAtualId=function(){return 'suc_x'};
    var podeEsvaziarAgora=function(){return ctx.podeEsvaziar};
    var logNuvem=function(m){ctx.logs.push(String(m))};
    var avisoSinc=function(m){ctx.logs.push('AVISO '+m)};
    var _quieto=function(){};
    var idDoAparelho=function(){return 'ap_teste'};
    /* (06/10/2026) a exclusão vai pelo banco, com a versão vista: apagar_vistos */
    var api=async function(url,metodo,corpo){
      if(url==='rpc/apagar_vistos'){
        ctx.chamadas.push('APAGAR '+corpo.p_tabela+' '+JSON.stringify(corpo.p_refs)+' vista='+corpo.p_vista);
        return {apagados:corpo.p_refs||[]};
      }
      ctx.chamadas.push((metodo||'GET')+' '+url); return [];
    };
    ${corpoDaFuncao('lembrarVersao', fonte)}
    ${corpoDaFuncao('versaoVistaDaLinha', fonte)}
    ${corpoDaFuncao('apagarComVersao', fonte)}
    ${corpoDaFuncao('apagarRemovidos', fonte)}
    return apagarRemovidos;
  `)(ctx);
  return { rodar: (ids) => fn('produtos', 'produtos', ids), chamadas, logs };
}
/* o aparelho sabe até quando viu a tabela (o download anota) */
const VISTA = '2026-10-06T05:00:00.000001+00:00';
const viu = () => ({ baixou: true, _vistaTab: { produtos: VISTA } });
const apagou = m => m.chamadas.some(c => c.indexOf('APAGAR ') === 0 || c.indexOf('DELETE') === 0);
const base = (extra) => Object.assign({
  _snap: { produtos: ['p1', 'p2', 'p3'] },
  _apagados: { produtos: { p2: true } }
}, extra || {});

console.log('\n── 1. Apagar apaga — em qualquer estado do aparelho\n');

(async () => {
  let m = motor({ DB: base() });
  await m.rodar(['p1', 'p3']);
  t('o caso normal continua funcionando', apagou(m), m.chamadas.join(' | '));
  t('e apaga exatamente o que foi declarado (pelo banco, com a versão vista)',
    m.chamadas.join('|') === 'APAGAR produtos ["p2"] vista=' + VISTA, m.chamadas.join(''));
  t('e nenhum DELETE direto', !m.chamadas.some(c => c.indexOf('DELETE') === 0), m.chamadas.join(' | '));

  m = motor({ DB: base({ _snap: {} }) });
  await m.rodar(['p1', 'p3']);
  t('SEM _snap nenhum, a ordem continua valendo', apagou(m));

  m = motor({ DB: base({ _snap: { produtos: ['p1', 'p3'] } }) });
  await m.rodar(['p1', 'p3']);
  t('com o _snap já sem aquele produto, também', apagou(m));

  m = motor({ DB: base(), cortadas: { produtos: true } });
  await m.rodar(['p1', 'p3']);
  t('com o download cortado pelo limite, também', apagou(m));

  /* aparelho que ainda não baixou não sabe o que viu: a ordem NÃO se
     perde — fica guardada e vale assim que o download disser até quando viu */
  const stNb = base(); const nb = { baixou: false };
  m = motor({ DB: stNb, NUVEM: nb });
  await m.rodar(['p1', 'p3']);
  t('no aparelho que ainda não baixou, a ordem fica guardada (não se perde)',
    !apagou(m) && stNb._apagados.produtos.p2 === true, JSON.stringify(stNb._apagados));
  nb.baixou = true; nb._vistaTab = { produtos: VISTA };
  m = motor({ DB: stNb, NUVEM: nb });
  await m.rodar(['p1', 'p3']);
  t('e no aparelho que ainda não baixou, também — vale depois do download', apagou(m));

  const st = base(); const m2 = motor({ DB: st });
  await m2.rodar(['p1', 'p3']);
  t('e sai do _apagados, para não repetir o pedido toda vez',
    !st._apagados.produtos.p2, JSON.stringify(st._apagados));

  console.log('\n── 2. E nada além do que foi mandado apagar\n');

  m = motor({ DB: { _snap: { produtos: ['p1', 'p2', 'p3'] }, _apagados: {} } });
  await m.rodar(['p1', 'p3']);
  t('sumir da lista SEM ter sido apagado não apaga da nuvem', !apagou(m),
    m.chamadas.join(' | '));
  t('e isso fica escrito no diagnóstico',
    m.logs.some(x => /sumiram da lista sem terem sido/.test(x)), m.logs.join(' | '));

  m = motor({ DB: base(), matriz: false });
  await m.rodar(['p1', 'p3']);
  t('a unidade não apaga cadastro da rede, nem declarado', !apagou(m));

  const muitos = {};
  for (let i = 0; i < 150; i++) muitos['x' + i] = true;
  m = motor({ DB: { _snap: { produtos: [] }, _apagados: { produtos: muitos } } });
  await m.rodar([]);
  t('150 exclusões de uma vez são barradas — isso não é gente apagando',
    !apagou(m), m.chamadas.join(' | '));
  t('e o aviso diz quantas eram',
    m.logs.some(x => /150 exclusões declaradas/.test(x)), m.logs.join(' | '));

  const st2 = { _snap: { produtos: [] }, _apagados: { produtos: muitos } };
  m = motor({ DB: st2 });
  await m.rodar([]);
  t('barrado não consome a declaração: nada se perde',
    Object.keys(st2._apagados.produtos).length === 150);

  m = motor({ DB: base(), podeEsvaziar: true });
  await m.rodar(['p1', 'p3']);
  t('com a liberação do dono, o volume passa', apagou(m));

  m = motor({ DB: base() });
  await m.rodar(['p1', 'p2', 'p3']);
  t('declarado mas AINDA na lista não é apagado — a tela mandou e desfez',
    !apagou(m), m.chamadas.join(' | '));

  console.log('\n── 3. O que ficou preso no código\n');

  t('a ordem não depende mais do _snap',
    /var deVerdade=Object\.keys\(declarados0\)\.filter/.test(codigoNu));
  t('e roda antes das travas de cópia incompleta',
    codigoNu.indexOf('deVerdade.length') < codigoNu.indexOf('var antes=DB._snap[chave]'));
  t('a unidade continua barrada no cadastro da rede',
    /TABS_CADASTRO_REDE\.indexOf\(tab\)>=0&&!ehSucMatriz\(lojaAtualId\(\)\)\)\{\s*return;/
      .test(codigoNu));
  t('e o botão da tela continua declarando a exclusão',
    /declararExclusao\('produtos',id\)/.test(codigoNu));

  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                             : '✓ ' + testes + ' testes passaram') + '\n');
  process.exit(falhas ? 1 : 0);
})();

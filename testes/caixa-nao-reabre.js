/* ==========================================================
   O CAIXA FECHADO NÃO PODE VOLTAR A FICAR ABERTO

   28/08/2026. A loja de Santa Fé do Sul fechou o caixa que estava
   aberto desde 27/08 e abriu o de hoje. Horas depois o caixa do dia 27
   estava aberto de novo na nuvem — sem venda, sem conferência, sem
   fotografia — e o relatório de Frente de Caixa não mostrava o dia 27,
   porque lá só entra caixa COM data de fechamento. As 48 vendas do dia
   estavam todas gravadas, mas sem turno fechado a que pertencer.

   Três defeitos, um em cima do outro:

   1. NO FIM DO DOWNLOAD ESTAVA `DB._hash={}`, com um comentário dizendo
      que ali se REGISTRAVA a impressão digital do que desceu. A linha
      apagava todas. Sem impressão, o envio seguinte considera que TODA
      linha mudou e regrava a cópia daquele aparelho por cima da nuvem.
      Um aparelho que baixou o caixa no dia 27, quando ele ainda estava
      aberto, desfez o fechamento feito em outro aparelho.

   2. FECHAR UM CAIXA FECHAVA O CAIXA DOS OUTROS. A linha que limpava
      caixas abertos não olhava a unidade. Em 27/08 às 13:39, o
      fechamento de Santa Fé fechou junto o caixa do Alphaville — está
      gravado no banco com o mesmo minuto, sem operador, sem conferência.

   3. `caixaAberto()` DEVOLVIA O PRIMEIRO DA LISTA. Com o caixa velho
      ainda aberto, o PDV passaria a tratá-lo como o caixa do dia, e as
      vendas de hoje iriam para o turno de ontem.

   Rodar:  node testes/caixa-nao-reabre.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
/* o código sem comentário: senão o próprio texto explicativo passa nos testes */
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── Sistema ' + versaoDoSistema() + ' — a impressão do que desceu da nuvem\n');

/* ambiente mínimo: as funções reais leem DB, MAPA e NUVEM do escopo */
function motor(ctx) {
  const nomes = ['hashTexto', 'impressaoDaLinha', 'anotarImpressoes'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  return new Function('ctx', `
    var DB=ctx.DB, MAPA=ctx.MAPA, NUVEM=ctx.NUVEM, _quieto=function(){};
    ${codigo}
    return {${nomes.join(',')}};
  `)(ctx);
}
/* um MAPA de mentira com o formato do de verdade */
const MAPA = [{ col: 'caixas', tab: 'caixas', campos: function (x) {
  return { operador: x.operador || null, aberto_txt: x.aberto || null,
           fechado_txt: x.fechadoEm || null, vendas: Number(x.vendas) || 0 };
} }];

function mundo(caixas, uuids) {
  const DB = { caixas: caixas, _hash: {}, _uuid: { caixas: uuids || {} } };
  return { DB: DB, MAPA: MAPA, NUVEM: { loja: 'emp1' }, motor: motor({ DB: DB, MAPA: MAPA, NUVEM: { loja: 'emp1' } }) };
}

const baixado = { id: 'cx_27', operador: 'Administrador', aberto: '27/08/2026 13:40',
                  fechadoEm: '', vendas: 0, _loja: 'emp1' };
let m = mundo([baixado], { cx_27: 'uuid-27' });
let n = m.motor.anotarImpressoes();
t('o registro que veio da nuvem ganha impressão', !!m.DB._hash.caixas.cx_27, JSON.stringify(m.DB._hash));
t('e a conta diz quantos foram anotados', n === 1, n);

/* o teste que importa: o aparelho parado NÃO reenvia a cópia velha */
const impressaoGuardada = m.DB._hash.caixas.cx_27;
const uuidConhecido = m.DB._uuid.caixas.cx_27;
const agora = m.motor.impressaoDaLinha(MAPA[0], baixado, 0);
/* é a mesma regra que o envio usa para decidir o que subir */
const vaiSubir = (impressaoGuardada !== agora) || !uuidConhecido;
t('aparelho parado não reenvia o caixa que baixou (era assim que o fechamento se perdia)',
  vaiSubir === false);

/* e o que mudou de verdade aqui continua subindo */
const fechadoAqui = Object.assign({}, baixado, { fechadoEm: '28/08/2026 13:20', vendas: 1902 });
const depois = m.motor.impressaoDaLinha(MAPA[0], fechadoAqui, 0);
t('fechar o caixa muda a impressão — o fechamento sobe',
  depois !== impressaoGuardada);

console.log('\n── O que ainda precisa subir não pode ganhar impressão\n');

m = mundo([{ id: 'cx_novo', aberto: '28/08/2026 13:22', _loja: 'emp1', _novoAqui: true }],
          { cx_novo: 'uuid-novo' });
m.motor.anotarImpressoes();
t('caixa criado aqui e ainda não confirmado fica sem impressão',
  !m.DB._hash.caixas.cx_novo);

m = mundo([{ id: 'cx_semuuid', aberto: '28/08/2026 13:22', _loja: 'emp1' }], {});
m.motor.anotarImpressoes();
t('registro que a nuvem não conhece fica sem impressão',
  !m.DB._hash.caixas.cx_semuuid);

m = mundo([{ id: 'cx_outra', aberto: '28/08/2026 13:22', _loja: 'emp2' }],
          { cx_outra: 'uuid-outra' });
m.motor.anotarImpressoes();
t('registro de outra empresa não entra na conta',
  !m.DB._hash.caixas.cx_outra);

/* o caso do ingrediente: o pai desceu da nuvem, mas com um filho que só
   existe aqui. Dizer "já está na nuvem" prenderia o filho para sempre. */
m = mundo([{ id: 'f1', aberto: '28/08/2026 10:00', _loja: 'emp1', _filhoPendente: true }],
          { f1: 'uuid-f1' });
m.motor.anotarImpressoes();
t('pai que recebeu de volta um filho não enviado fica sem impressão',
  !m.DB._hash.caixas.f1);
t('a volta da nuvem marca esse pai', /novo\._filhoPendente=true/.test(codigoNu));
t('e a marca cai quando a nuvem confirma o registro',
  /delete _o\._novoAqui;delete _o\._filhoPendente;/.test(codigoNu));

console.log('\n── A linha que apagava tudo saiu do download\n');

const zeradas = (codigoNu.match(/DB\._hash=\{\}/g) || []).length;
t('só existe UM lugar que zera as impressões: a saída/entrada de sessão',
  zeradas === 1, zeradas + ' ocorrência(s)');
t('e ele é o mesmo que zera os outros mapas do aparelho',
  /DB\._snap=\{\};DB\._hash=\{\};DB\._uuid=\{\}/.test(codigoNu));
t('a falha da anotação não volta a apagar tudo',
  !/catch\(e\)\{ _quieto\(e,'anotarImpressoes'\); DB\._hash=\{\}; \}/.test(codigoNu));
t('o download chama anotarImpressoes', /anotarImpressoes\(\)/.test(codigoNu));
t('a anotação acontece depois do carimbo da empresa (senão nada é reconhecido)',
  codigoNu.indexOf('_r._loja=_l') < codigoNu.indexOf('var _imp=anotarImpressoes()'));
t('envio e volta usam a MESMA conta de impressão',
  /hNovo\[x\.id\]=impressaoDaLinha\(E2,x,i\)/.test(codigoNu));
t('não sobrou nenhuma segunda conta de impressão no envio',
  !/hNovo\[x\.id\]=hashTexto\(/.test(codigoNu));

console.log('\n── Fechar o meu caixa não fecha o dos outros\n');

t('a limpeza olha a unidade do caixa',
  /if\(c\.sucursalId&&_minhaUn&&c\.sucursalId!==_minhaUn\)return;/.test(codigoNu));
t('e nunca fecha um caixa aberto DEPOIS deste',
  /if\(isoHoraDoCaixa\(c\.aberto\)>isoHoraDoCaixa\(cx\.aberto\)\)return;/.test(codigoNu));
t('a limpeza deixa rastro no diagnóstico',
  /foi encerrado junto/.test(fonte));

console.log('\n── O caixa em operação é o último aberto\n');

const fCx = new Function('ctx', `
  var DB=ctx.DB, lojaAtualId=ctx.lojaAtualId;
  ${corpoDaFuncao('isoHoraDoCaixa', fonte)}
  ${corpoDaFuncao('caixaDeOutroDia', fonte)}
  ${corpoDaFuncao('caixaAberto', fonte)}
  ${corpoDaFuncao('caixasEsquecidos', fonte)}
  return {caixaAberto:caixaAberto,caixasEsquecidos:caixasEsquecidos,
          isoHoraDoCaixa:isoHoraDoCaixa};
`);

const hoje = new Date().toLocaleDateString('pt-BR');
const DBc = { caixas: [
  { id: 'cx_27', aberto: '27/08/2026 13:40', sucursalId: 'suc_sf' },
  { id: 'cx_hoje', aberto: hoje + ' 13:22', sucursalId: 'suc_sf' },
  { id: 'cx_alpha', aberto: '27/08/2026 15:10', sucursalId: 'suc_alpha' }
] };
const C = fCx({ DB: DBc, lojaAtualId: () => 'suc_sf' });

t('com dois abertos, o caixa do dia é o mais novo',
  (C.caixaAberto() || {}).id === 'cx_hoje', (C.caixaAberto() || {}).id);
t('o caixa de outra unidade nunca é o meu',
  (C.caixaAberto() || {}).id !== 'cx_alpha');
t('o caixa esquecido de outro dia é listado', 
  C.caixasEsquecidos().map(c => c.id).join(',') === 'cx_27',
  C.caixasEsquecidos().map(c => c.id).join(','));
t('o caixa do Alphaville não entra na lista de Santa Fé',
  C.caixasEsquecidos().every(c => c.id !== 'cx_alpha'));
t('sem caixa esquecido, a lista vem vazia',
  fCx({ DB: { caixas: [{ id: 'x', aberto: hoje + ' 10:00', sucursalId: 'suc_sf' }] },
        lojaAtualId: () => 'suc_sf' }).caixasEsquecidos().length === 0);
t('a data vira texto que ordena certo',
  C.isoHoraDoCaixa('27/08/2026 13:40') === '2026-08-27 13:40',
  C.isoHoraDoCaixa('27/08/2026 13:40'));
t('caixa único continua sendo o caixa aberto',
  (fCx({ DB: { caixas: [{ id: 'so', aberto: hoje + ' 09:00', sucursalId: 'suc_sf' }] },
         lojaAtualId: () => 'suc_sf' }).caixaAberto() || {}).id === 'so');
t('nenhum caixa aberto devolve nulo',
  fCx({ DB: { caixas: [{ id: 'f', aberto: hoje + ' 09:00', fechadoEm: hoje + ' 20:00',
                         sucursalId: 'suc_sf' }] },
        lojaAtualId: () => 'suc_sf' }).caixaAberto() === null);

console.log('\n── O caixa esquecido aparece na Frente de Caixa\n');

t('a tela calcula os esquecidos', /var esquecidos=/.test(codigoNu));
t('e mostra um botão que fecha aquele caixa',
  /onclick="fecharCaixa\(\\'\'\+c\.id\+\'\\'\)"/.test(codigoNu) ||
  /fecharCaixa\(\\'/.test(codigoNu));
t('fecharCaixa aceita o caixa a fechar', /function fecharCaixa\(id\)\{/.test(codigoNu));
t('sem id, continua fechando o caixa em operação',
  /var cx=id\?\(DB\.caixas\|\|\[\]\)\.find/.test(codigoNu));
t('fechar o esquecido não encerra a venda em andamento de hoje',
  /if\(_eraOAtual\)\{encerrarSessaoPDV\(\);telaPDV\(\);\}/.test(codigoNu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — NO DIA 1º DO MÊS A TELA NÃO PODE ABRIR VAZIA

   01/09/2026. A Contagem de Estoque e a Frente de Caixa abrem filtrando
   sozinhas "do dia 1º do mês até hoje". No dia 1º isso vira "de 01/09 até
   01/09": nada de agosto aparece.

   O que a loja vê:
     · Contagem — o Rafael conta de manhã e lança como o dia anterior. No
       dia 1º, a contagem de 31/08 some da lista. Ela está gravada,
       ajustou o estoque, entrou na movimentação; só não está na tela.
     · Frente de Caixa — a lista de fechamentos abre em branco, como se o
       mês inteiro tivesse sumido.

   Nos dois casos o dado está lá; quem esconde é o filtro que a própria
   tela pôs. A regra ganhou uma segunda metade: se o período AUTOMÁTICO
   não mostraria nada, ele não filtra. O período escolhido à mão nunca é
   mexido — quem filtrou quis aquilo, mesmo que dê vazio.

   E as duas datas passaram a sair do dia DA LOJA (`hojeISO`), não de
   `toISOString`, que devolve o dia de Greenwich e vira o dia seguinte
   depois das 21h em São Paulo.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── Contagem de Estoque\n');
{
  const tc = corpoDaFuncao('telaContagem', fonte);
  t('o período automático sai do dia da loja', /var _h=hojeISO\(\)/.test(tc));
  t('e não mais do dia de Greenwich',
    !/CT2\.de=new Date\(d\.getFullYear\(\),d\.getMonth\(\),1\)\.toISOString/.test(tc));
  t('o automático se identifica como automático', /CT2\._auto=true/.test(tc));
  t('e se esconderia tudo, mostra todas',
    /if\(!lista\.length&&CT2\._auto&&\(DB\.contagens\|\|\[\]\)\.length\)/.test(tc));
  const fc = corpoDaFuncao('filtrarContagens', fonte);
  t('filtrar à mão desliga o automático', /CT2\._auto=false/.test(fc));
  t('"Este mês" também', /CT2\._auto=false/.test(corpoDaFuncao('mesAtualCT', fonte)));
  t('e "Todas" também', /CT2\._auto=false/.test(corpoDaFuncao('verTodasContagens', fonte)));
}

console.log('\n── Frente de Caixa\n');
{
  const tf = corpoDaFuncao('telaFrenteCaixa', fonte);
  t('o período automático sai do dia da loja', /var _h=hojeISO\(\)/.test(tf));
  t('e não mais do dia de Greenwich',
    !/FC\.de=new Date\(d\.getFullYear\(\),d\.getMonth\(\),1\)\.toISOString/.test(tf));
  t('o automático se identifica como automático', /FC\._auto=true/.test(tf));
  t('e se esconderia todos os fechamentos, mostra todos',
    /if\(!fechados\.length&&FC\._auto\)/.test(tf));
  t('o botão Limpar desliga o automático', /FC\._auto=false;telaFrenteCaixa\(\)/.test(tf));
}

console.log('\n── A regra, rodada de verdade\n');
{
  /* o filtro da contagem, como está no sistema, com o relógio no dia 1º */
  const HOJE = '2026-09-01';
  const contagens = [
    { id: 'ct1', data: '2026-08-31', hora: '09:12', ganho: 1, sucursalId: 'suc_sf' },
    { id: 'ct2', data: '2026-08-15', hora: '10:00', ganho: 3, sucursalId: 'suc_sf' }
  ];
  function periodo() { return { de: HOJE.slice(0, 8) + '01', ate: HOJE, auto: true }; }
  function filtrar(cs, p) {
    return cs.filter(c => (!p.de || c.data >= p.de) && (!p.ate || c.data <= p.ate));
  }
  let p = periodo();
  t('o período automático do dia 1º é 01/09 a 01/09',
    p.de === '2026-09-01' && p.ate === '2026-09-01', p.de + ' a ' + p.ate);
  let lista = filtrar(contagens, p);
  t('e sozinho ele esconderia as duas contagens de agosto', lista.length === 0, lista.length);
  if (!lista.length && p.auto && contagens.length) { p = { de: '', ate: '', auto: true }; lista = filtrar(contagens, p); }
  t('com a segunda metade da regra, as duas aparecem', lista.length === 2, lista.length);
  t('a de 31/08 está entre elas', lista.some(c => c.data === '2026-08-31'));

  /* e no meio do mês nada muda */
  const HOJE2 = '2026-09-20';
  let p2 = { de: HOJE2.slice(0, 8) + '01', ate: HOJE2, auto: true };
  const setembro = [{ id: 'ct3', data: '2026-09-05', hora: '09:00', ganho: 2 }];
  let l2 = filtrar(setembro.concat(contagens), p2);
  t('no meio do mês o período continua sendo o mês', l2.length === 1 && l2[0].id === 'ct3',
    l2.map(c => c.id).join(','));
  t('e a regra não é acionada, porque não esconderia tudo', l2.length > 0);
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

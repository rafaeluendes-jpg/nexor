/* ==========================================================
   JOIA — A FOLHA DA CONTAGEM NÃO PODE MORAR SÓ NA MEMÓRIA

   O Rafael, no meio do inventário em 01/09/2026: "cancelei a atualização
   porque estou no meio da contagem. Se eu atualizar, tudo que eu
   preenchi eu vou perder, não é isso?"

   Era isso mesmo. O que ele digitava ficava em `CT2.cont`, uma variável
   da página; `salvar()` só era chamado no fim, ao finalizar. Recarregar,
   fechar sem querer, a máquina reiniciar, o navegador matar a aba por
   memória — qualquer um apagava um inventário de duzentos e cinquenta
   itens contados à mão, sem aviso e sem volta. Foi só a sorte que
   impediu isso de acontecer antes.

   Agora cada número digitado é guardado no aparelho na hora. É um
   RASCUNHO: mora numa chave própria do navegador, não entra no `DB` e
   não sobe para a nuvem — contagem pela metade não é dado, e não pode
   virar ajuste de estoque em lugar nenhum.
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

function mundo() {
  const guardado = {};
  const CT2 = { aba: 'nova', busca: '', grupo: '', cont: {}, custo: {},
                de: '', ate: '', data: '', _auto: false, _retomado: '' };
  const amb = {
    CT2: CT2,
    localStorage: {
      setItem: (k, v) => { guardado[k] = v; },
      getItem: k => (k in guardado ? guardado[k] : null),
      removeItem: k => { delete guardado[k]; }
    },
    lojaAtualId: () => amb._loja || 'suc_sf',
    hojeISO: () => '2026-09-01',
    telaContagem: () => { amb._desenhou = (amb._desenhou || 0) + 1; },
    toast: () => {}, _quieto: () => {},
    setTimeout: (f) => { f(); return 1; }, clearTimeout: () => {},
    _guardado: guardado
  };
  const nomes = ['guardarRascunhoContagem', 'lerRascunhoContagem',
                 'limparRascunhoContagem', 'descartarRascunhoContagem', 'novaContagem'];
  const feito = new Function('amb',
    'with(amb){' + nomes.map(n => corpoDaFuncao(n, fonte)).join('\n') +
    "\nvar _CHAVE_RASCUNHO='nexor_contagem_rascunho', _tRascunho=null;" +
    '\nreturn {' + nomes.join(',') + '};}')(amb);
  Object.assign(amb, feito);
  return { amb, CT2, guardado, f: feito };
}

console.log('\n── O que foi digitado é guardado na hora\n');
{
  const m = mundo();
  m.CT2.data = '2026-08-31';
  m.CT2.cont = { in_copo: '13', in_casca: '40' };
  m.f.guardarRascunhoContagem();
  const bruto = m.guardado['nexor_contagem_rascunho'];
  t('foi para o navegador', !!bruto);
  const r = JSON.parse(bruto || '{}');
  t('com os números contados', r.cont.in_copo === '13' && r.cont.in_casca === '40');
  t('com a data escolhida', r.data === '2026-08-31', r.data);
  t('e com a unidade, para não misturar loja', r.suc === 'suc_sf', r.suc);
  t('e com a hora, para a tela poder dizer de quando é', !!r.quando);
}

console.log('\n── Recarregar a página não perde mais nada\n');
{
  const m = mundo();
  m.CT2.data = '2026-08-31';
  m.CT2.cont = { in_copo: '13' };
  m.CT2.custo = { in_copo: '0,60' };
  m.f.guardarRascunhoContagem();
  /* a página recarrega: CT2 nasce vazio de novo */
  m.CT2.cont = {}; m.CT2.custo = {}; m.CT2.data = ''; m.CT2._retomado = '';
  m.f.novaContagem();
  t('a contagem volta com o que estava digitado', m.CT2.cont.in_copo === '13',
    JSON.stringify(m.CT2.cont));
  t('o custo corrigido volta junto', m.CT2.custo.in_copo === '0,60');
  t('a data escolhida volta junto', m.CT2.data === '2026-08-31', m.CT2.data);
  t('e a tela sabe que retomou, para avisar', !!m.CT2._retomado);
}

console.log('\n── Mas sem confundir loja, nem ressuscitar folha vazia\n');
{
  const m = mundo();
  m.CT2.cont = { in_copo: '13' };
  m.f.guardarRascunhoContagem();
  m.amb._loja = 'suc_jales';
  t('rascunho de outra unidade não é oferecido', m.f.lerRascunhoContagem() === null);
  m.amb._loja = 'suc_sf';
  t('e o da unidade certa é', m.f.lerRascunhoContagem() !== null);

  const m2 = mundo();
  m2.CT2.cont = {};
  m2.f.guardarRascunhoContagem();
  t('folha vazia não conta como rascunho', m2.f.lerRascunhoContagem() === null);
  m2.f.novaContagem();
  t('e a contagem nova começa limpa', Object.keys(m2.CT2.cont).length === 0 &&
    m2.CT2._retomado === '');
}

console.log('\n── "Começar do zero" e finalizar apagam o rascunho\n');
{
  const m = mundo();
  m.CT2.cont = { in_copo: '13' };
  m.f.guardarRascunhoContagem();
  m.f.descartarRascunhoContagem();
  t('"Começar do zero" limpa o navegador', !m.guardado['nexor_contagem_rascunho']);
  t('e limpa a folha da tela', Object.keys(m.CT2.cont).length === 0);
  t('e a marca de retomada', m.CT2._retomado === '');

  const fc = corpoDaFuncao('fecharContagem', fonte);
  t('finalizar a contagem apaga o rascunho', /limparRascunhoContagem\(\)/.test(fc));
  t('e só depois grava', fc.indexOf('limparRascunhoContagem()') < fc.indexOf('salvar();telaContagem()'));
}

console.log('\n── O rascunho não vira dado nem sobe para a nuvem\n');
{
  t('não mora no DB', !/DB\.[a-zA-Z]+\s*=\s*[^;]*_CHAVE_RASCUNHO/.test(fonte));
  const i = fonte.indexOf('var MAPA=[');
  const mapa = fonte.slice(i, fonte.indexOf('\n];', i));
  /* "rascunho" aparece no MAPA como situação de ordem de produção — outra
     coisa. O que não pode existir lá é a chave do rascunho da contagem. */
  t('a chave do rascunho não existe no mapa do que sobe',
    !/nexor_contagem_rascunho/.test(mapa));
  t('nem existe coleção de rascunho para subir',
    !/\{col:'rascunho/.test(mapa));
  const gr = corpoDaFuncao('guardarRascunhoContagem', fonte);
  t('e é gravado só no navegador', /localStorage\.setItem\(_CHAVE_RASCUNHO/.test(gr) &&
    !/salvar\(\)/.test(gr));
}

console.log('\n── Cada tecla digitada é guardada\n');
{
  const lc = corpoDaFuncao('ligarContagem', fonte);
  t('a quantidade contada', /CT2\.cont\[this\.getAttribute\('data-id'\)\]=this\.value;[\s\S]{0,120}guardarRascunhoContagem\(\)/.test(lc));
  t('o custo corrigido', /CT2\.custo\[id\]=this\.value;[\s\S]{0,120}guardarRascunhoContagem\(\)/.test(lc));
  t('"Preencher com o sistema" também',
    /guardarRascunhoContagem\(\)/.test(corpoDaFuncao('preencherContagem', fonte)));
  t('e trocar a data também',
    /guardarRascunhoContagem\(\)/.test(corpoDaFuncao('mudarDataContagem', fonte)));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

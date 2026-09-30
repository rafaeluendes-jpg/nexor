/* ==========================================================
   JOIA — LISTA INCOMPLETA NÃO PODE TER O ROSTO DE LISTA COMPLETA (V390)

   Rafael, 30/09/2026: *"Onde você já viu a conta tá na nuvem e não tá no
   sistema? O dono da loja entra e vai entrar dentro da nuvem para poder
   ver a conta? A conta tem que estar no sistema, não na nuvem. Agora, se
   você é um engenheiro de software e tem uma dúvida dessa, como é que tá
   as outras coisas?"*

   Ele está certo nas duas coisas. "Está na nuvem" não é resposta — para
   quem usa, o sistema é a tela. E estava assim no resto.

   Toda tela de cadastro desenha o que estiver no aparelho. Enquanto o
   download não chegou — ou quando a tabela daquela coleção **falhou** no
   download — a tela mostra uma lista curta, ou vazia, com título, total
   e contagem, exatamente igual a uma lista completa. A falha só era dita
   no Diagnóstico, que ninguém abre.

   Nas contas isso levou a recadastrarem o Itaú dez vezes. Nas formas de
   pagamento levaria a perder taxa e prazo; nas categorias financeiras, a
   quebrar o vínculo dos lançamentos; nos produtos e fichas, a duplicar o
   cardápio.

   O aviso é UM só, usado por todas as listas — consertar uma tela por
   vez só garante que a próxima nasça com o mesmo defeito.
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

console.log('\n── A pergunta "esta lista está inteira?"\n');
function estado(col, { baixou = true, ligada = true, falhou = [] } = {}) {
  const amb = {
    NUVEM: { ligada, baixou }, DB: { _uuid: {} },
    _FALHOU_BAIXA: falhou, _quieto: () => {},
    _TAB_VINCULO: { contas: 'contas_capital', formasPag: 'formas_pagamento',
                    produtos: 'produtos', insumos: 'insumos', clientes: 'clientes' },
    MAPA: [{ col: 'catfin', tab: 'categorias_financeiras' }],
    _TAB_FILHAS: { fichas: ['ficha_itens'], catfin: ['subcategorias_financeiras'] }
  };
  return new Function('amb', 'col',
    'with(amb){' + corpoDaFuncao('esperandoDownload', fonte) + '\n' +
    corpoDaFuncao('tabelaDaColecao', fonte) + '\n' +
    corpoDaFuncao('colecaoIncompleta', fonte) +
    '\n return colecaoIncompleta(col);}')(amb, col);
}

t('download ainda não chegou: "chegando"',
  estado('contas', { baixou: false }) === 'chegando');
t('download chegou e nada falhou: a lista está inteira',
  estado('contas') === '');
t('A TABELA DESTA COLEÇÃO FALHOU: "falhou" — era o caso que só ia para o Diagnóstico',
  estado('contas', { falhou: ['contas_capital'] }) === 'falhou');
t('falha em OUTRA tabela não acusa esta',
  estado('contas', { falhou: ['produtos'] }) === '');
t('funciona para coleção que está só no MAPA, não no mapa de vínculos',
  estado('catfin', { falhou: ['categorias_financeiras'] }) === 'falhou');
t('coleção desconhecida não inventa alarme', estado('inventada') === '');
t('e um erro ao perguntar não derruba a tela', estado(null) === '');

console.log('\n── O aviso diz o que a pessoa precisa saber\n');
const av = corpoDaFuncao('avisoListaIncompleta', fonte);
t('sem problema, não aparece aviso nenhum', /if\(!st\)return '';/.test(semComentario(av)));
t('"chegando" diz que a lista está vindo da nuvem', /ainda está chegando/.test(av));
t('"falhou" diz que a busca não trouxe os dados', /não trouxe estes dados/.test(av));
t('OS DOIS pedem para NÃO cadastrar de novo',
  (av.match(/Não cadastre de novo/g) || []).length === 2,
  (av.match(/Não cadastre de novo/g) || []).length);
t('e dizem que o que está guardado volta sozinho',
  (av.match(/volta sozinho/g) || []).length === 2);
t('o aviso nomeia o que pode faltar, em português de gente',
  /pode '\+\s*\n?\s*'faltar '\+oQue/.test(av) || /faltar '\+oQue/.test(av));
t('usa a faixa amarela que já existe, sem inventar aparência',
  (av.match(/class="imAviso"/g) || []).length === 2);
t('e no caso de falha indica o caminho: Sincronização', /Sincronização/.test(av));

console.log('\n── E TODAS as listas que doem perguntam\n');
/* a lista das telas onde recadastrar causa dano real: taxa perdida,
   vínculo quebrado, cardápio duplicado */
const TELAS = [
  ['telaContas', 'contas', 'a conta do banco e os recebimentos ligados a ela'],
  ['telaFormasPag', 'formasPag', 'a taxa e o prazo de cada cartão'],
  ['telaCatFin', 'catfin', 'o plano de contas que os lançamentos usam'],
  ['telaInsumos', 'insumos', 'os ingredientes e o custo deles'],
  ['telaFichaTecnica', 'fichas', 'as fichas técnicas'],
  ['telaCardapio', 'produtos', 'o cardápio inteiro'],
  ['telaFornecedores', 'fornec', 'os fornecedores das notas'],
  ['telaClientes', 'clientes', 'os clientes e o fiado'],
  ['telaCupons', 'cupons', 'os cupons de desconto']
];
for (const [tela, col, porque] of TELAS) {
  const c = semComentario(corpoDaFuncao(tela, fonte));
  t(tela + ' avisa — senão perde ' + porque,
    new RegExp("avisoListaIncompleta\\('" + col + "'").test(c) ||
    /avisoContasIncompleto\(\)/.test(c));
}

console.log('\n── E as listas que a varredura apontou como perigosas\n');
const PERIGOSAS = [
  ['telaSucursais', 'sucursais', 'a unidade — e tudo no sistema é filtrado por ela'],
  ['telaBasesValores', 'basesCat', 'a tabela de preços que as unidades usam para pedir'],
  ['telaBaixaManual', 'motivosMov', 'o motivo, e a tela ainda oferece o botão de cadastrar'],
  ['telaStatusVendas', 'statusVenda', 'o status — e o Kanban do PDV some na frente do cliente'],
  ['telaGruposIng', 'gruposIng', 'o grupo, que decide o que compõe o CMV'],
  ['telaMesas', 'mesas', 'as mesas — e os QR Codes já impressos'],
  ['telaAcertos', 'entregadores', 'o entregador, e o acerto sai pago duas vezes'],
  ['telaTurnos', 'turnos', 'os turnos, que já voltaram de fábrica uma vez'],
  ['telaMotivosCanc', 'motivosCanc', 'o motivo, que já triplicou uma vez'],
  ['telaModeloImp', 'modelosImp', 'o leiaute do cupom da loja'],
  ['telaCfgDRE', 'catfin', 'a rubrica de cada categoria no DRE'],
  ['telaUsuarios', 'usuarios', 'os acessos — e login duplicado já aconteceu'],
  ['telaOperadores', 'operadores', 'o operador, casado por nome no histórico de caixa'],
  ['telaAreasEntrega', 'areas', 'a taxa cobrada em cada cidade'],
  ['telaCfgCardapio', 'cardapioL', 'logo, cores e chave Pix do cardápio digital'],
  ['telaGerente', 'zap', 'o número e os textos do robô']
];
for (const [tela, col, porque] of PERIGOSAS) {
  const c = semComentario(corpoDaFuncao(tela, fonte));
  t(tela + ' avisa — senão perde ' + porque,
    new RegExp("avisoListaIncompleta\\('" + col + "'").test(c));
}

console.log('\n── Abrir uma tela não pode gravar por cima\n');
const mi = semComentario(corpoDaFuncao('telaModeloImp', fonte));
t('a tela de Modelo de Impressão não grava enquanto a lista pode estar incompleta',
  /_impIncompleto=\(typeof colecaoIncompleta==='function'\)/.test(mi) &&
  /if\(!_impIncompleto\)salvar\(\);/.test(mi));
t('mas continua DESENHANDO com o padrão, para a tela não abrir quebrada',
  /m\.blocos=blocosPadrao\(m\.tipo\);/.test(mi));

console.log('\n── E a tabela filha, que falha sozinha\n');
t('a ficha técnica avisa pela coleção certa (fichas, não produtos)',
  /avisoListaIncompleta\('fichas','ficha'\)/.test(corpoDaFuncao('telaFichaTecnica', fonte)));
t('e a conferência cobre a tabela dos ingredientes da ficha',
  /fichas:\['ficha_itens'\]/.test(fonte));
t('as subcategorias do plano de contas também',
  /catfin:\['subcategorias_financeiras'\]/.test(fonte));
t('e o uso dos cupons', /cupons:\['cupom_usos'\]/.test(fonte));
(function () {
  const f = (col, falhou) => new Function('amb', 'col',
    'with(amb){' + corpoDaFuncao('esperandoDownload', fonte) + '\n' +
    corpoDaFuncao('tabelaDaColecao', fonte) + '\n' +
    corpoDaFuncao('colecaoIncompleta', fonte) + '\n return colecaoIncompleta(col);}')(
    { NUVEM: { ligada: true, baixou: true }, DB: {}, _FALHOU_BAIXA: falhou, _quieto: () => {},
      _TAB_VINCULO: { fichas: 'fichas_tecnicas' }, MAPA: [],
      _TAB_FILHAS: { fichas: ['ficha_itens'] } }, col);
  t('FICHA CHEIA COM RECEITA VAZIA: a falha da tabela filha é acusada',
    f('fichas', ['ficha_itens']) === 'falhou', f('fichas', ['ficha_itens']));
  t('e a do pai continua sendo', f('fichas', ['fichas_tecnicas']) === 'falhou');
})();

console.log('\n── E o aviso é um só, não uma cópia por tela\n');
t('a tela de Contas usa a função comum, não uma versão própria',
  /return avisoListaIncompleta\('contas','conta'\);/
    .test(semComentario(corpoDaFuncao('avisoContasIncompleto', fonte))));
t('só existe uma função que monta o texto do aviso',
  (fonte.match(/function avisoListaIncompleta\(/g) || []).length === 1);
t('e ela é chamada por muitas telas',
  (fonte.match(/avisoListaIncompleta\(/g) || []).length >= 9,
  (fonte.match(/avisoListaIncompleta\(/g) || []).length + ' chamada(s)');

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · lista incompleta avisa');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

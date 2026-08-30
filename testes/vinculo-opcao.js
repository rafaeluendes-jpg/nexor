/* ==========================================================
   JOIA — O VINCULO DA OPCAO COM A FICHA TECNICA

   O Rafael disse: "eu tinha vinculado, o sistema deve ter tirado". Ele
   estava certo nas duas metades.

   1. O CADASTRO NUNCA ESTEVE ERRADO. A opcao guarda `fichaId`, ele sobe
      para `opcoes.ficha_id` e desce de volta. A tela de cardapio mostra o
      nome da ficha ao lado de cada opcao.

   2. A VENDA JOGAVA O VINCULO FORA. `modalOpcoes` montava a linha da
      comanda com {grupo, nome, preco} e mais nada. A baixa de estoque,
      sem o vinculo, caia num plano B: achar a ficha PELO NOME da opcao.
      Isso so acerta quando os dois nomes sao iguais — e no banco da Jolo,
      7 das 10 opcoes vinculadas tinham nome diferente da ficha.

   3. E O DOWNLOAD PODIA APAGAR O VINCULO. `_mapaFichaId` vem de uma
      consulta a parte, num try/catch que engole a falha. Sem o mapa, toda
      opcao voltava com `fichaId:''`, e o envio seguinte gravava `null` na
      nuvem — apagando o cadastro da rede inteira a partir de um aparelho
      que teve uma consulta ruim.

   Estes testes prendem as tres coisas no lugar.
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

console.log('\n── A opção leva a ficha para a comanda\n');

const mo = corpoDaFuncao('modalOpcoes', fonte);
t('a linha da comanda carrega o fichaId',
  /esc\.push\(\{grupo:g\.id,nome:o\.nome,preco:o\.preco,fichaId:o\.fichaId\|\|''\}\)/.test(mo));
t('e continua carregando nome e preço',
  /nome:o\.nome/.test(mo) && /preco:o\.preco/.test(mo));

console.log('\n── A baixa prefere o identificador, e só depois o nome\n');

const bx = corpoDaFuncao('baixarEstoqueVenda', fonte);
t('lê o vínculo gravado primeiro',      /o\.fichaId\|\|o\.ficha_id/.test(bx));
t('e só então tenta pelo nome',
  /String\(f\.nome\|\|''\)\.trim\(\)\.toLowerCase\(\)===String\(o\.nome\|\|''\)\.trim\(\)\.toLowerCase\(\)/.test(bx));

/* roda a baixa de verdade, com um DB montado a mão */
function mundo() {
  return {
    fichas: [{ id: 'fi1', nome: 'BORDA DOCE LEITE', rendimento: 1, unidadesVenda: 50,
               itens: [{ insumoId: 'in1', qtd: 1, unidade: 'kg' }] }],
    produtos: [{ id: 'pr1', nome: 'Casquinha', vinculaEstoque: false }],
    movEst: [], insumos: [{ id: 'in1', nome: 'Doce de leite', unidade: 'kg', custo: 20 }]
  };
}
function baixar(DB, opcao) {
  const linhas = [];
  const amb = {
    DB: DB,
    insumo: id => DB.insumos.find(i => i.id === id),
    custoNaUnidade: () => 1,
    baseMov: () => {}, toast: () => {}, uid: p => p + '1',
    hojeISO: () => '2026-08-28', agoraHM: () => '10:00', diaLocal: d => d,
    aplicarMovimento: m => { (m.linhas || []).forEach(l => linhas.push(l)); },
    destinoDaFicha: () => null, custoPorUnidade: () => 0
  };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao('baixarEstoqueVenda', fonte) +
    '\n var _ultimoMovVenda=null; return baixarEstoqueVenda(arguments[1]);}');
  f(amb, { id: 'p', numero: 1, itens: [{ produtoId: 'pr1', qtd: 1, opcoes: [opcao] }] });
  return linhas;
}

console.log('\n── E o vínculo funciona onde o nome não funcionava\n');

/* este é o caso real da Jolô: opção "Borda de Doce de Leite",
   ficha "BORDA DOCE LEITE" — nomes diferentes */
const semVinculo = baixar(mundo(), { nome: 'Borda de Doce de Leite', preco: 3 });
t('nome diferente e SEM vínculo: não baixa nada (era o defeito)',
  semVinculo.length === 0, JSON.stringify(semVinculo));

const comVinculo = baixar(mundo(), { nome: 'Borda de Doce de Leite', preco: 3, fichaId: 'fi1' });
t('nome diferente e COM vínculo: baixa',
  comVinculo.length === 1, JSON.stringify(comVinculo));
t('e baixa o insumo certo',
  comVinculo[0] && comVinculo[0].insumoId === 'in1');
t('na quantidade da receita dividida pelas unidades de venda',
  comVinculo[0] && Math.abs(comVinculo[0].qtd - 0.02) < 1e-9, comVinculo[0] && comVinculo[0].qtd);

const soNome = baixar(mundo(), { nome: 'BORDA DOCE LEITE', preco: 3 });
t('comanda antiga com o nome exato continua sendo resolvida',
  soNome.length === 1, JSON.stringify(soNome));

console.log('\n── O download não apaga o vínculo quando não sabe traduzir\n');

const dl = fonte;
t('o mapa de fichas registra se conseguiu ou não',
  /_mapaFichaOk\s*=\s*true/.test(dl));
t('existe a memória do que o aparelho já sabia',
  /_fichaAntes\[op\.id\]\s*=\s*op\.fichaId/.test(dl));
t('opção sem ficha na nuvem continua sem ficha',
  /if\(!op\.ficha_id\)return '';/.test(dl));
t('opção com ficha que o mapa não traduz cai no que estava guardado',
  /var guardado=_fichaAntes\[op\.ref_local\];/.test(dl));
t('e isso é registrado, não fica em silêncio',
  /vínculo com ficha técnica preservado do aparelho/.test(dl));

/* roda a decisão de verdade */
function decidir(mapa, antes, opcaoNuvem) {
  const corpo = `
    var _mapaFichaId=${JSON.stringify(mapa)};
    var _fichaAntes=${JSON.stringify(antes)};
    var _fichaSalvas=0;
    ${corpoDaFuncao('_fichaDaOpcao', fonte)}
    return {v:_fichaDaOpcao(arguments[0]),salvas:_fichaSalvas};`;
  return new Function(corpo)(opcaoNuvem);
}
const semFicha = decidir({}, { op9: 'fi_velha' }, { ref_local: 'op9', ficha_id: null });
t('desvincular de propósito continua funcionando',
  semFicha.v === '' && semFicha.salvas === 0, JSON.stringify(semFicha));

const traduz = decidir({ 'uuid-1': 'fi_nova' }, { op9: 'fi_velha' },
                       { ref_local: 'op9', ficha_id: 'uuid-1' });
t('quando a nuvem sabe traduzir, a nuvem manda',
  traduz.v === 'fi_nova' && traduz.salvas === 0, JSON.stringify(traduz));

const salva = decidir({}, { op9: 'fi_velha' }, { ref_local: 'op9', ficha_id: 'uuid-1' });
t('mapa vazio NÃO apaga o vínculo — usa o do aparelho',
  salva.v === 'fi_velha' && salva.salvas === 1, JSON.stringify(salva));

const nada = decidir({}, {}, { ref_local: 'op8', ficha_id: 'uuid-9' });
t('sem mapa e sem memória, devolve vazio em vez de inventar',
  nada.v === '' && nada.salvas === 0, JSON.stringify(nada));

console.log('\n── O envio continua mandando o vínculo\n');

t('a subida das opções manda ficha_id',
  /ficha_id:fk\('fichas',o\.fichaId\)/.test(fonte));

/* ==========================================================
   O SABOR DESLIGADO NAO PODE VOLTAR LIGADO

   A loja passou a desligar um sabor em vez de apagar. Campo que existe
   de um lado e nao do outro apaga trabalho em silencio — este arquivo
   ja registrou isso onze vezes, e a decima segunda seria esta: a pessoa
   desliga, o valor fica no aparelho, e o proximo download devolve a
   opcao ligada.

   Estes testes prendem as DUAS pontas do caminho.
   ========================================================== */
console.log('\n── O "desligado" da opcao sobe e desce\n');

/* SUBIDA: o mapa que monta a linha da tabela `opcoes` */
const mapa = fonte.slice(fonte.indexOf("filhos:[{lista:'opcoes'"),
                          fonte.indexOf("filhos:[{lista:'opcoes'") + 420);
t('a subida manda `ativo` para a nuvem',
  /ativo:o\.ativo!==false/.test(mapa), mapa.slice(0, 200));
t('e continua mandando nome, preco, ordem e a ficha',
  /nome:o\.nome/.test(mapa) && /preco_adicional/.test(mapa) &&
  /ordem:k/.test(mapa) && /ficha_id/.test(mapa));

/* DESCIDA: o mapa que reconstroi a opcao a partir da nuvem */
const desce = fonte.slice(fonte.indexOf('opcoes:(x.opcoes||[]).sort'),
                          fonte.indexOf('opcoes:(x.opcoes||[]).sort') + 520);
t('a descida traz `ativo` de volta',
  /ativo:o\.ativo!==false/.test(desce), desce.slice(0, 240));
t('faltando na nuvem, a opção volta LIGADA — nunca some da venda por omissão',
  /ativo:o\.ativo!==false/.test(desce));

/* a regra de quem enxerga, rodada de verdade */
const oa = new Function(corpoDaFuncao('opcoesAtivas', fonte) + '\nreturn opcoesAtivas;')();
t('opcoesAtivas tira só o que está desligado',
  oa({ opcoes: [{ nome: 'a' }, { nome: 'b', ativo: false }, { nome: 'c', ativo: true }] })
    .map(o => o.nome).join(',') === 'a,c');
t('opção sem o campo conta como ligada — cadastro antigo continua vendendo',
  oa({ opcoes: [{ nome: 'velha' }] }).length === 1);
t('grupo sem opções não estoura', oa(null).length === 0 && oa({}).length === 0);

/* a venda usa a regra; o cadastro NAO — senão não há como religar */
for (const alvo of ['modalOpcoes', 'gruposDoProduto', 'escolherOpcao']) {
  t(alvo + ' passa pela regra', /opcoesAtivas\(/.test(corpoDaFuncao(alvo, fonte)));
}
t('a lista do cadastro mostra a desligada, para poder religar',
  /o\.ativo===false/.test(corpoDaFuncao('renderOps', fonte)));
t('e o formulário grava o estado da caixinha',
  /ativo:!a\[i\]\|\|a\[i\]\.checked/.test(corpoDaFuncao('lerOps', fonte)));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · vínculo da opção com a ficha');
console.log(testes - falhas + ' de ' + testes + ' testes passaram');
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

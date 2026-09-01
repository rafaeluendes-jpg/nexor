/* ==========================================================
   JOIA — A BAIXA MANUAL ACHA O ITEM E CADASTRA O MOTIVO

   O Rafael, em 01/09/2026, três coisas na mesma tela:

   1. "aonde eu digito produto ou insumo, eu digito uma letra e tenho que
      ficar clicando em cima" — o campo mandava refazer a tela inteira a
      cada tecla; o <input> deixava de existir e o foco ia embora.
   2. "quando eu digito gelato venda, que é o que está vinculado à ficha
      técnica, não aparece" — exigia 3 letras, casava só o pedaço exato
      (então "venda gelato" não achava "GELATO VENDA") e parava nos 8
      primeiros. A loja tem 61 itens com "gelato" no nome.
   3. "coloca um assim, pra mim cadastrar esses motivos" — o cadastro só
      existia em outra tela, e ir até lá perdia o registro em digitação.
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

/* os 61 nomes com "gelato" que a loja tem de verdade, na ordem de cadastro
   (GELATO VENDA é o último — era exatamente por isso que sumia) */
const NOMES = ['TIRAMISU GELATO','COCO ZERO 3 KG GELATO','Pazinha Gelato','MARACUJA GELATO',
 'GELATO 1 KG','COCADA GELATO','KINDER BUENO GELATO','TENTAÇÃO ZERO GELATO','PISTACHE GELATO',
 'CHARGE GELATO','FERRERO GELATO','PRESTIGIO ZERO GELATO','GELATO 500GR','SNICHERS GELATO',
 'GIANDUIA GELATO','ABACAXI GELATO','IOGURTE COM MORANGO ZERO 3KG GELATO','CARAMELO GELATO',
 'LEITE WHEY ZERO 3KG GELATO','CHOCOTONE GELATO','CHOCOLATE PASCOA GELATO','BAUNILHA GELATO',
 'TORTA DE NOZES GELATO','LEITE NINHO MORANGO GELATO','MADERO GELATO','BATIDO DI GELATO 500',
 'BANANA ZERO WHEY GELATO','FIOR DI LATTE  GELATO','CHOCOLATE BRANCO PASCOA GELATO',
 'ESPECIAL DE PASCOA GELATO','Embalagem Base Gelato','JOLO GELATO','IOGURTE AMARENA GELATO',
 'CAMAFEU GELATO','CHOCOLATE ZERO 3 KG GELATO','JOLO VANILLA GELATO','CHOCOBIS GELATO',
 'LEITE NINHO TRUFADO GELATO','KOPENHAGEN GELATO','MORANGO GELATO','CHOCONINHO ZERO WHEY GELATO',
 'BELGA GELATO','GELATO 3KG','Adesivo Base Gelato','CHOCONINHO GELATO','FATIATTO DI GELATO',
 'ROMEU E JULIETA GELATO','LEITE NINHO GELATO','JOLO DUBAI GELATO','OREO GELATO','BROWNIE GELATO',
 'IOGURTE ZERO GELATO','BATIDO DI GELATO 300','DOCE LEITE GELATO','OVOMALTINE GELATO',
 'DANONINHO GELATO','SENSACAO ZERO GELATO','DIA GELATO DO DIA','ESPECIAL JUNINO GELATO',
 'CROCANTE TRUFADO GELATO','GELATO VENDA'];

function montarBusca(){
  const amb = {
    itensParaBaixa: () => NOMES.map((n, k) => ({
      id: 'ins_' + k, nome: n, tipo: 'insumo', unidade: 'kg', custo: 1 }))
  };
  amb._semAcento = new Function('amb', 'with(amb){' + corpoDaFuncao('_semAcento', fonte) +
    '\nreturn _semAcento;}')(amb);
  return new Function('amb', 'with(amb){' + corpoDaFuncao('buscarItensBaixa', fonte) +
    '\nreturn buscarItensBaixa;}')(amb);
}

console.log('\n── GELATO VENDA aparece\n');
{
  const b = montarBusca();
  const tem = (q) => b(q).some(i => i.nome === 'GELATO VENDA');
  t('"gelato venda" acha GELATO VENDA', tem('gelato venda'), JSON.stringify(b('gelato venda').map(i => i.nome)));
  t('"GELATO VENDA" em maiúscula também', tem('GELATO VENDA'));
  t('"venda" sozinho acha', tem('venda'));
  t('"venda gelato", na ordem trocada, acha', tem('venda gelato'));
  t('e ele vem entre os primeiros, não perdido no fim',
    b('gelato venda').findIndex(i => i.nome === 'GELATO VENDA') === 0);
  /* era este o corte: 61 nomes com "gelato", 8 de resultado */
  t('"gelato" sozinho não esconde a lista atrás de um corte de 8',
    b('gelato').length > 8, b('gelato').length);
}

console.log('\n── Duas letras bastam, e acento não atrapalha\n');
{
  const b = montarBusca();
  t('duas letras já procuram', b('or').length > 0);
  t('uma letra ainda não (a lista seria a loja inteira)', b('o').length === 0);
  t('campo vazio não devolve nada', b('').length === 0 && b('   ').length === 0);
  t('"tentacao" sem cedilha acha TENTAÇÃO',
    b('tentacao').some(i => i.nome === 'TENTAÇÃO ZERO GELATO'));
  t('quem começa com o texto vem antes de quem só contém',
    b('gelato')[0].nome.toLowerCase().indexOf('gelato') === 0, b('gelato')[0].nome);
  t('nome com espaço duplo não quebra a busca',
    b('fior di latte').some(i => i.nome === 'FIOR DI LATTE  GELATO'));
}

console.log('\n── O campo não perde o cursor\n');
{
  const tela = corpoDaFuncao('telaBaixaManual', fonte);
  t('digitar não manda mais refazer a tela inteira',
    !/setTimeout\(telaBaixaManual/.test(tela));
  t('o campo chama só a função que redesenha a listinha',
    /oninput="sugerirItemBaixa\(this\)"/.test(tela));
  const sg = corpoDaFuncao('sugerirItemBaixa', fonte);
  t('e essa função mexe apenas no quadro das sugestões',
    /getElementById\('bxSug'\)/.test(sg) && !/telaBaixaManual\(\)/.test(sg));
  t('o quadro existe sempre no HTML, para ser preenchido',
    /id="bxSug"/.test(tela));
  /* a listinha some sozinha quando está vazia — sem isso ficaria uma
     faixa branca pendurada embaixo do campo */
  const css = fonte.slice(0, fonte.indexOf('</style>'));
  t('e some da tela quando não há sugestão', /\.bxSug:empty\{display:none\}/.test(css));
}

console.log('\n── Cadastrar o motivo sem sair da tela\n');
{
  const tela = corpoDaFuncao('telaBaixaManual', fonte);
  t('há um botão de cadastrar motivo ao lado da lista',
    /novoMotivoDaBaixa\(\)/.test(tela));
  t('e também quando não existe nenhum motivo ainda',
    (tela.match(/novoMotivoDaBaixa\(\)/g) || []).length >= 2);
  t('a tela não manda mais o usuário procurar outra tela sozinho',
    !/Cadastre em Configuração da Loja/.test(tela));

  /* o formulário é o mesmo de sempre; o que mudou é ele saber voltar */
  const fm = corpoDaFuncao('formMotivo', fonte);
  t('o formulário de motivo aceita para onde voltar', /aoSalvar/.test(fm));
  t('sem esse aviso, ele continua indo para a configuração como antes',
    /else\s*telaCfgMovimentacao\(\)/.test(fm));

  /* prova de comportamento: salvar pelo caminho da baixa escolhe o motivo
     novo e volta para a Baixa Manual — não para a tela de configuração */
  let voltouPara = '', escolhido = '';
  const BX = { motivo: '' };
  const amb = {
    BX: BX,
    telaBaixaManual: () => { voltouPara = 'baixa'; escolhido = BX.motivo; },
    telaCfgMovimentacao: () => { voltouPara = 'config'; },
    formMotivo: (id, tipo, aoSalvar) => {
      t('a baixa pede um motivo de SAÍDA', tipo === 'saida');
      aoSalvar({ id: 'mt_novo', nome: 'Degustação', tipo: 'saida' });
    }
  };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao('novoMotivoDaBaixa', fonte) +
    '\nreturn novoMotivoDaBaixa;}')(amb);
  f();
  t('depois de salvar, volta para a Baixa Manual', voltouPara === 'baixa', voltouPara);
  t('e o motivo novo já vem escolhido', escolhido === 'mt_novo', escolhido);
}

console.log('\n── E o motivo chega ao relatório de Movimentação\n');
{
  /* a mesma lista alimenta o filtro do relatório: o motivo cadastrado aqui
     já serve para filtrar lá, sem nenhum outro passo */
  const tm = corpoDaFuncao('telaMovimentacao', fonte);
  t('o relatório tem o filtro por movimentação', /MV\.motivoId=this\.value/.test(tm));
  t('e ele é montado a partir de DB.motivosMov', /DB\.motivosMov\|\|\[\]/.test(tm));
  t('e o filtro realmente corta pelo motivo escolhido',
    /if\(MV\.motivoId&&m\.motivoId!==MV\.motivoId\)return/.test(fonte));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

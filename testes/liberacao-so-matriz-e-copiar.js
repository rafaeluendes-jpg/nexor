/* ==========================================================
   QUEM ENXERGA: SO A MATRIZ, E COPIAR O QUE UMA LOJA ENXERGA
   (V405, 01/10/2026)

   Rafael: "a ficha tecnica da base as lojas nao veem — so o insumo
   base. Quero a opcao de so a matriz ver; e um jeito melhor de escolher
   as lojas." A janela exigia ao menos uma loja marcada.
   E: "estou configurando Santa Fe — o que ela ve e o que nao ve. Quero
   escolher a loja padrao e replicar para as outras."

   Prende:
     · a janela tem tres escolhas: so a matriz (lista vazia), todas
       ('*') e escolher lojas — e "so a matriz" salva sem pedir loja;
     · copiar: o que a modelo ve, o destino passa a ver; o que ela nao
       ve, o destino deixa de ver; item de todas nao muda; a modelo e as
       outras lojas nao mudam.
   O fluxo no Chromium esta na prova 11f de ferramentas/provar.js.

   Rodar:  node testes/liberacao-so-matriz-e-copiar.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const semCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — quem enxerga e copiar de uma loja\n');

console.log('── 1. A janela\n');
const ab = semCom(corpoDaFuncao('abrirEscolhaUnidades', fonte));
t('três escolhas: só a matriz, todas, escolher lojas',
  /id:'matriz',n:'Só a matriz'/.test(fonte) && /id:'todas', n:'Todas as unidades'/.test(fonte) && /id:'lojas', n:'Escolher lojas'/.test(fonte));
t('"Só a matriz" grava a lista vazia; "Todas" grava a marca de todas',
  /x\.sucursais=m==='todas'\?\[TODAS_UN\]:\(m==='lojas'\?escolhidas\.slice\(\):\[\]\);/.test(ab));
t('a loja só é exigida quando a escolha é "Escolher lojas"',
  /if\(m==='lojas'&&!escolhidas\.length\)/.test(ab) && !/if\(!todas&&!escolhidas\.length\)/.test(ab));
t('a matriz não entra na lista de lojas (ela vê sempre)', /sucAtivas\(\)\.filter\(function\(s\)\{return !s\.matriz\}\)/.test(ab));
t('a tela tem o botão "Copiar de uma loja"', /abrirCopiaLiberacao\(\)/.test(corpoDaFuncao('telaLiberacao', fonte)));

console.log('\n── 2. As regras\n');
const fns = ['marcadoTodas', 'modoLiberacao', 'copiaLiberacaoPlano', 'copiarLiberacao'];
const mk = new Function('DB', 'CADASTROS_LIB', 'ehSucMatriz',
  "var TODAS_UN='*';\n" + fns.map(n => corpoDaFuncao(n, fonte)).join('\n') + '\nreturn {' + fns.join(',') + '};');
const DB = {
  insumos: [
    { id: 'a', sucursais: ['sf'] },            // modelo vê, destinos não
    { id: 'b', sucursais: ['ja'] },            // modelo não vê, destino vê
    { id: 'c', sucursais: ['*'] },             // todas
    { id: 'd', sucursais: [] },                // só a matriz
    { id: 'e', sucursais: ['sf', 'al', 'ou'] } // modelo e um destino veem; outra loja fora da cópia
  ],
  fichas: [{ id: 'f', sucursais: ['ja', 'ou'] }]
};
const f = mk(DB, [{ col: 'insumos', n: 'Ingredientes' }, { col: 'fichas', n: 'Fichas' }], (id) => id === 'mtz');
t('estado de cada item: todas, só a matriz, lojas',
  f.modoLiberacao(DB.insumos[2]) === 'todas' && f.modoLiberacao(DB.insumos[3]) === 'matriz' &&
  f.modoLiberacao(DB.insumos[0]) === 'lojas' && f.modoLiberacao({ sucursais: ['mtz'] }) === 'matriz');
const plano = f.copiaLiberacaoPlano('sf', ['ja', 'al']);
t('o plano conta as mudanças antes de copiar', plano.muda === 5, JSON.stringify(plano));
const n = f.copiarLiberacao('sf', ['ja', 'al']);
const v = (l, id) => JSON.stringify(DB[l].find(x => x.id === id).sucursais);
t('o que a modelo vê, os destinos passam a ver', v('insumos', 'a') === '["sf","ja","al"]', v('insumos', 'a'));
t('o que a modelo não vê, os destinos deixam de ver', v('insumos', 'b') === '[]' && v('fichas', 'f') === '["ou"]', v('fichas', 'f'));
t('item de todas e item só da matriz não mudam', v('insumos', 'c') === '["*"]' && v('insumos', 'd') === '[]');
t('loja fora da cópia não muda, e o destino que faltava entra', v('insumos', 'e') === '["sf","al","ou","ja"]', v('insumos', 'e'));
t('depois de copiar, não sobra diferença', f.copiaLiberacaoPlano('sf', ['ja', 'al']).muda === 0 && n === 4, n);

console.log('\n── 3. Ficha de gelato e ficha de base separadas (02/10/2026)\n');
const fns2 = ['fichasDoGrupoFicha', 'acertarPastasFicha'];
const mk2 = new Function('DB', "var TODAS_UN='*';\n" + fns2.map(n => corpoDaFuncao(n, fonte)).join('\n') + '\nreturn {' + fns2.join(',') + '};');
const DB2 = { fichaCats: [{ id: 'p', nome: 'Produzido', sucursais: [] }, { id: 'b', nome: 'Base', paiId: 'p', sucursais: [] },
  { id: 'g', nome: 'Artesanal', paiId: 'p', sucursais: ['sf'] }],
  fichas: [{ id: 'f1', categoriaId: 'p', subgrupoId: 'b', sucursais: [] }, { id: 'f2', categoriaId: 'p', subgrupoId: 'g', sucursais: ['sf'] }] };
const g2 = mk2(DB2);
g2.acertarPastasFicha();
t('a pasta passa a enxergar onde as fichas dela são enxergadas', JSON.stringify(DB2.fichaCats[0].sucursais) === '["sf"]');
t('e o subgrupo da base, sem ficha liberada, continua só na matriz', JSON.stringify(DB2.fichaCats[1].sucursais) === '[]');
t('a liberação de pasta leva o subgrupo e todas as fichas dele', /var itens=\[g\]\.concat/.test(corpoDaFuncao('liberarGrupoFicha', fonte)) &&
  /abrirEscolhaUnidades\(itens,nomeG\+' — '\+nF\+' ficha\(s\)',acertarPastasFicha\)/.test(corpoDaFuncao('liberarGrupoFicha', fonte)));
t('na unidade, a pasta de uma ficha liberada nunca sai', /if\(c\.col==='fichaCats'\)\{/.test(corpoDaFuncao('filtrarCadastroDaUnidade', fonte)));
t('a lista de fichas filtra por pasta e subgrupo e mostra a pasta de cada uma',
  /LB\.pasta\)lista=lista\.filter/.test(corpoDaFuncao('telaLiberacao', fonte)) && /nomePastaFicha\(x\)/.test(corpoDaFuncao('telaLiberacao', fonte)));
t('ficha nova sem loja segue a liberação do subgrupo', /if\(!f&&!\(o\.sucursais\|\|\[\]\)\.length\)\{/.test(fonte));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

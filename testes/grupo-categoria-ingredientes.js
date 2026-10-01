/* ==========================================================
   GRUPO > CATEGORIA DE INGREDIENTES (V402, 01/10/2026)

   Rafael: "a descricao do grupo nao e grupo, e categoria. Criar tres
   grandes grupos, em pasta, mandar cada categoria para dentro deles. No
   ingrediente escolho o grupo e aparecem so as categorias dele; no
   estoque, nos relatorios, escolho o grupo e depois a categoria. Mexa so
   nisso, nao danifique mais nada."

   Prende:
     · o grupo mora na coluna `categoria` de grupos_ingredientes, que SOBE
       e agora DESCE (sem isso, o grupo sumia no proximo download);
     · o ingrediente continua guardando a categoria (grupoId) — CMV,
       liberacao e relatorios seguem lendo o mesmo campo;
     · a tela e uma arvore de pastas; grupo novo nasce com categorias;
     · no ingrediente, o grupo filtra as categorias;
     · estoque total, contagem, posicao, movimentacao e itens consumidos
       filtram por grupo e depois por categoria.
   O fluxo inteiro, no Chromium, esta na prova 11e de ferramentas/provar.js.

   Rodar:  node testes/grupo-categoria-ingredientes.js
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
console.log('\n── Sistema ' + versaoDoSistema() + ' — grupo > categoria de ingredientes\n');

console.log('── 1. Onde o grupo mora\n');
t('sobe na coluna categoria', /categoria:x\.categoria\|\|null,sucursais:x\.sucursais\|\|\[\]\}\}\}/.test(fonte));
t('e desce de volta', /categoria:x\.categoria\|\|''\}\},null,'gruposIng'\)/.test(fonte));

const fns = ['grupoIng', 'grupoMaiorDe', 'gruposMaiores', 'categoriasDoGrupo', 'itemNoGrupoMaior'];
const mk = new Function('DB', 'var _mapaGrp={},_mapaGrpL=null,_mapaGrpN=-1;\n' +
  fns.map(n => corpoDaFuncao(n, fonte)).join('\n') + '\nreturn {' + fns.join(',') + '};');
const DB = { gruposIng: [
  { id: 'c1', nome: 'Sorvete', categoria: 'Insumos' }, { id: 'c2', nome: 'Embalagem', categoria: 'Insumos' },
  { id: 'c3', nome: 'Limpeza', categoria: 'Material' }, { id: 'c4', nome: 'Avulsa' } ] };
const f = mk(DB);
console.log('\n── 2. As regras\n');
t('os grupos são os nomes distintos, em ordem', JSON.stringify(f.gruposMaiores()) === '["Insumos","Material"]');
t('as categorias de um grupo', f.categoriasDoGrupo('Insumos').map(x => x.id).join() === 'c2,c1');
t('sem grupo escolhido, todas as categorias', f.categoriasDoGrupo('').length === 4);
t('o item está no grupo pela categoria dele', f.itemNoGrupoMaior({ grupoId: 'c3' }, 'Material') && !f.itemNoGrupoMaior({ grupoId: 'c1' }, 'Material'));
t('sem grupo escolhido, todo item passa', f.itemNoGrupoMaior({ grupoId: 'c4' }, ''));
t('categoria sem grupo não entra em grupo nenhum', !f.itemNoGrupoMaior({ grupoId: 'c4' }, 'Insumos'));

console.log('\n── 3. As telas\n');
const tg = semCom(corpoDaFuncao('telaGruposIng', fonte));
t('a tela é uma árvore de pastas', /gmPasta/.test(tg) && /abreGrupoIng\(/.test(tg) && /linhaCategoriaIng\(/.test(tg));
t('tem Novo grupo e Nova categoria', /modalGrupoMaior\(\)/.test(tg) && /modalGrupoIng\(\)/.test(tg));
const mg = semCom(corpoDaFuncao('modalGrupoMaior', fonte));
t('grupo novo nasce com ao menos uma categoria', /Marque ao menos uma categoria/.test(mg));
t('e só diz salvo depois de conferir na nuvem', /conferirConfigNaNuvem\('gruposIng'/.test(mg));
t('a coluna Grupo manda a categoria para outro grupo',
  /g\.categoria=String\(nome\|\|''\)\.trim\(\);/.test(semCom(corpoDaFuncao('moverCategoria', fonte))));
const mi = semCom(corpoDaFuncao('modalInsumo', fonte));
t('no ingrediente, o grupo filtra a categoria', /id="isGM" onchange="trocaGrupoMaiorIns\(\)"/.test(mi) && /opcoesCategoriaIns\(/.test(mi));
t('o ingrediente continua guardando a categoria (grupoId)',
  /grupoId:\$\('isG'\)\.value/.test(semCom(corpoDaFuncao('salvarInsumo', fonte))));
[['estoque total', 'telaEstoqueTotal', "filtroGrupoCat('ET','telaEstoqueTotal','f2')"],
 ['contagem', 'telaContagem', "filtroGrupoCat('CT2','telaContagem','f2')"],
 ['posição', 'telaHistPosicao', "filtroGrupoCat('HP','telaHistPosicao','f2')"],
 ['movimentação', 'telaMovimentacao', "filtroGrupoCat('MV','telaMovimentacao','f2')"],
 ['itens consumidos', 'telaItensConsumidos', "filtroGrupoCat('IC','telaItensConsumidos','bfCampo',gruposFicha())"],
 ['ingredientes', 'telaInsumos', "filtroGrupoCat('IN','telaInsumos','fl')"]].forEach(([n, fn, pedaco]) => {
  t(n + ': filtro de grupo e categoria', fonte.indexOf(pedaco) >= 0);
});
t('estoque total filtra pelo grupo', /itemNoGrupoMaior\(i,ET\.grupoMaior\)/.test(fonte));
t('contagem filtra pelo grupo', /itemNoGrupoMaior\(i,CT2\.grupoMaior\)/.test(fonte));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

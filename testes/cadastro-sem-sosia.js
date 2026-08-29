/* ==========================================================
   DUAS CATEGORIAS COM O MESMO NOME — A RAIZ DO "O PRODUTO SUMIU"

   28 e 29/08/2026, o mesmo relato duas vezes: "só está a categoria
   Taxa de Entrega, o produto sumiu" e "aparece na frente de caixa uma
   categoria que só está em delivery".

   Nada tinha sumido. No banco havia DUAS categorias chamadas
   "Taxa de Entrega":

     cat_mtcsns9qtbzj  liberada para Santa Fé do Sul   1 produto
     cat_mtbs8p78b5rx  liberada para todas as unidades 0 produtos

   Na tela, duas linhas idênticas. A matriz enxerga o cadastro da rede
   inteira, então as duas apareciam. Clicando na vazia, não havia
   produto — e a única conclusão possível era que o sistema tinha
   apagado. O produto estava inteiro na nuvem, na outra categoria.

   E a vazia aparecia também na frente de caixa, porque a regra dizia
   "categoria sem produto continua à vista".

   Três travas, testadas aqui:
   1. o sistema não deixa mais criar categoria com nome repetido;
   2. categoria sem produto nenhum não entra na tela de venda;
   3. quando a matriz olha a rede, cada linha diz de que unidade é.

   Rodar:  node testes/cadastro-sem-sosia.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── Sistema ' + versaoDoSistema() + ' — nome repetido é barrado\n');

/* a comparação de nomes é a do sistema, extraída do próprio código */
const mCmp = fonte.match(/var _cmp=function\(x\)\{return String\(x\|\|''\)[\s\S]{0,160}?\};/);
if (!mCmp) throw new Error('não achei a comparação de nomes em formCategoria');
const cmp = new Function('return ' + mCmp[0].replace('var _cmp=', '').replace(/;$/, ''))();

t('"Taxa de Entrega" e "taxa de entrega" são o mesmo nome',
  cmp('Taxa de Entrega') === cmp('taxa de entrega'));
t('espaço sobrando não cria nome novo', cmp(' Bebidas ') === cmp('Bebidas'));
t('acento não cria nome novo', cmp('Cascão') === cmp('Cascao'));
t('nomes diferentes continuam diferentes', cmp('Copo') !== cmp('Cascão'));
t('nome vazio não quebra', cmp(null) === '');

t('a checagem está no salvamento da categoria',
  /_igual=\(DB\.categorias\|\|\[\]\)\.find/.test(codigoNu));
t('e ela ignora a própria categoria ao editar (senão não dá para renomear)',
  /\(!c\|\|x\.id!==c\.id\)&&_cmp\(x\.nome\)===_cmp\(nome\)/.test(codigoNu));
t('a mensagem diz o que fazer, sem termo técnico',
  /Já existe a categoria[\s\S]{0,80}edite a que existe/.test(fonte));

console.log('\n── Categoria vazia não entra na tela de venda\n');

t('a regra "vazia continua à vista" saiu do PDV',
  !/if\(!prodsDaCategoria\(c\.id,''\)\.length\)return true/.test(codigoNu));
t('a categoria entra pela contagem do canal',
  /return prodsDaCategoria\(c\.id,canalPDV\)\.length>0;/.test(codigoNu));

console.log('\n── Na matriz, cada linha diz de quem é\n');

const rot = new Function('ctx', `
  var TODAS_UN='*';
  var lojaAtualId=ctx.lojaAtualId, ehSucMatriz=ctx.ehSucMatriz, sucNome=ctx.sucNome;
  ${corpoDaFuncao('rotuloUnidades', fonte)}
  return rotuloUnidades;
`);
const naMatriz = rot({ lojaAtualId: () => 'suc_matriz', ehSucMatriz: id => id === 'suc_matriz',
                       sucNome: id => ({ suc_sf: 'Jolô Santa Fé do Sul' })[id] || '—' });
const naLoja = rot({ lojaAtualId: () => 'suc_sf', ehSucMatriz: () => false,
                     sucNome: id => 'Jolô Santa Fé do Sul' });

t('categoria de uma unidade mostra o nome dela',
  naMatriz({ sucursais: ['suc_sf'] }) === 'Jolô Santa Fé do Sul',
  naMatriz({ sucursais: ['suc_sf'] }));
t('liberada para todas não ganha etiqueta (seria ruído em 43 produtos)',
  naMatriz({ sucursais: ['*'] }) === '');
t('sem liberação nenhuma também não', naMatriz({ sucursais: [] }) === '');
t('em duas unidades, mostra a contagem',
  naMatriz({ sucursais: ['suc_sf', 'suc_alpha'] }) === '2 unidades');
t('na loja, ninguém precisa de etiqueta: tudo o que ela vê é dela',
  naLoja({ sucursais: ['suc_sf'] }) === '');
t('item sem o campo não quebra', naMatriz({}) === '');
t('a etiqueta aparece na lista de categorias',
  /rotuloUnidades\(c\)[\s\S]{0,80}catUnid/.test(codigoNu));

console.log('\n── O sistema confere o próprio cadastro\n');

const conf = new Function('ctx', `
  var DB=ctx.DB, _quieto=function(){};
  ${corpoDaFuncao('conferirCadastro', fonte)}
  return conferirCadastro;
`);
/* o caso real de 28/08: duas categorias com o mesmo nome, uma vazia */
let achados = conf({ DB: {
  categorias: [{ id: 'c1', nome: 'Taxa de Entrega', ativo: true },
               { id: 'c2', nome: 'Taxa de entrega', ativo: true }],
  produtos: [{ id: 'p1', nome: 'Taxa de Entrega', categoriaId: 'c1', ativo: true }],
  insumos: [], fichas: [] } })();
t('o nome repetido é apontado',
  achados.some(x => x.tipo === 'nome repetido' && /Categoria/.test(x.o)),
  JSON.stringify(achados.map(x => x.tipo)));
t('a categoria vazia é apontada',
  achados.some(x => x.tipo === 'categoria vazia' && /Taxa de entrega/.test(x.o)));
t('e cada apontamento diz o que fazer',
  achados.every(x => x.faca && x.faca.length > 20));

achados = conf({ DB: {
  categorias: [{ id: 'c1', nome: 'Copo', ativo: true }],
  produtos: [{ id: 'p1', nome: 'Copo P', categoriaId: 'sumiu', ativo: true },
             { id: 'p2', nome: 'Copo M', categoriaId: 'c1', ativo: true, sucursais: [] }],
  insumos: [], fichas: [] } })();
t('produto apontando para categoria que não existe é apontado',
  achados.some(x => x.tipo === 'sem categoria' && /Copo P/.test(x.o)));
t('produto sem unidade nenhuma é apontado',
  achados.some(x => x.tipo === 'sem unidade' && /Copo M/.test(x.o)));

achados = conf({ DB: {
  categorias: [{ id: 'c1', nome: 'Copo', ativo: true }],
  produtos: [{ id: 'p1', nome: 'Copo P', categoriaId: 'c1', ativo: true, sucursais: ['*'] }],
  insumos: [{ id: 'i1', nome: 'Leite', ativo: true }],
  fichas: [{ id: 'f1', nome: 'BASE', ativo: true }] } })();
t('cadastro sadio não gera apontamento nenhum', achados.length === 0,
  JSON.stringify(achados));

achados = conf({ DB: {
  categorias: [{ id: 'c1', nome: 'Copo', ativo: true },
               { id: 'c2', nome: 'Copo', ativo: false }],
  produtos: [{ id: 'p1', nome: 'Copo P', categoriaId: 'c1', ativo: true }],
  insumos: [], fichas: [] } })();
t('categoria inativa não conta como nome repetido',
  !achados.some(x => x.tipo === 'nome repetido'), JSON.stringify(achados.map(x=>x.tipo)));

t('a conferência aparece na tela de Diagnóstico',
  /pintaSumicos\(\)\+\s*pintaCadastro\(\)/.test(codigoNu));
t('e ela não conserta nada sozinha — cadastro é decisão do dono',
  !/conferirCadastro[\s\S]{0,600}(splice|declararExclusao)/.test(codigoNu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — ANULAR NÃO É APAGAR (V381)

   A RDS, item 19: *"a operação poderá desaparecer das telas
   operacionais, mas não deverá ser apagada da auditoria. Registrar como
   ANULADA, preservando registro original, etapas revertidas, usuário,
   data e hora, motivo."*

   Excluir a nota apagava a linha daqui **e da nuvem**. O que sobrava
   era o `audit_log` — o ANTES inteiro no registro do DELETE. Isso serve
   para uma perícia e não serve para o dia a dia: quando alguém pergunta
   por que o estoque de setembro mudou, a resposta está numa tabela que
   ninguém abre.

   Agora a nota FICA. Sai das listas, dos totais e da exportação, com o
   motivo, quem anulou e quando. E o vínculo continua de pé: um
   lançamento antigo que aponta para ela continua achando a nota e
   explicando de onde veio — filtrar também a busca por id faria a tela
   dizer "nota não encontrada" justamente onde há explicação para dar.
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

console.log('\n── A nota anulada some das listas, não do sistema\n');

const ativa = new Function(corpoDaFuncao('notaAtiva', fonte) + '\n return notaAtiva;')();
t('nota normal está ativa', ativa({ id: 'n1' }) === true);
t('nota anulada não está', ativa({ id: 'n1', anuladaEm: '2026-09-30T10:00:00Z' }) === false);
t('e nulo não estoura', ativa(null) === false);

const lst = new Function('amb',
  'with(amb){' + corpoDaFuncao('notaAtiva', fonte) + '\n' +
  corpoDaFuncao('notasAtivas', fonte) + '\n return notasAtivas();}');
const mundo = { notas: [{ id: 'a' }, { id: 'b', anuladaEm: 'x' }, { id: 'c' }] };
t('a lista das ativas deixa a anulada de fora',
  lst({ DB: mundo }).map(n => n.id).join(',') === 'a,c',
  lst({ DB: mundo }).map(n => n.id).join(','));

console.log('\n── Os lugares que param de contá-la\n');
t('a tela de Notas de Entrada lista só as ativas',
  /var lista=notasAtivas\(\)/.test(semComentario(corpoDaFuncao('telaNotas', fonte))));
t('a exportação em CSV também', /notasAtivas\(\)\.forEach/.test(semComentario(corpoDaFuncao('exportarNotas', fonte))));
t('e os dois contadores de "o que está no sistema"',
  (fonte.match(/notasAtivas\(\)\.length/g) || []).length >= 3,
  (fonte.match(/notasAtivas\(\)\.length/g) || []).length);

console.log('\n── Mas o vínculo continua de pé\n');
/* o `find` por id NÃO pode filtrar: é ele que explica de onde veio um
   lançamento antigo */
const nd = semComentario(corpoDaFuncao('notaDoLanc', fonte));
t('a conciliação continua achando a nota anulada pelo id',
  /ns\.find\(function\(x\)\{return x\.id===l\.ref\}\)/.test(nd) && !/notaAtiva/.test(nd));
t('e o motivo está escrito no código, para ninguém "consertar" isso depois',
  /nota nao encontrada|não encontrada/.test(corpoDaFuncao('notaAtiva', fonte)) ||
  /find` continua enxergando/.test(fonte));

console.log('\n── O que a anulação guarda\n');
const ex = semComentario(corpoDaFuncao('excluirNota', fonte));
t('carimba quando foi anulada', /n\.anuladaEm=n\.excluidoEm/.test(ex));
t('guarda quem e por quê', /n\.excluidoMotivo=motivo/.test(ex) && /n\.excluidoPor=/.test(ex));
t('e registra se o estoque foi devolvido ou mantido', /n\.anuladaEstoque=!!ajusta/.test(ex));
t('NÃO apaga mais a nota da lista', !/DB\.notas=DB\.notas\.filter/.test(ex));
t('nem manda apagá-la da nuvem', !/declararExclusao\('notas'/.test(ex));
t('o movimento de estoque continua sendo revertido e declarado',
  /aplicarMovimento\(mov,true\)/.test(ex) && /declararExclusao\('movEst',n\.movId\)/.test(ex));
t('e o vínculo do movimento é solto, para a nota não apontar para o que não existe',
  /n\.movId=''/.test(ex));
t('o lançamento da nota continua saindo, e declarado',
  /declararExclusao\('lancFin',l\.id\)/.test(ex));
t('a mensagem diz que ela continua no histórico',
  /continua no histórico/.test(corpoDaFuncao('excluirNota', fonte)));

console.log('\n── E a anulação sobrevive ao download\n');
t('a nota anulada volta da nuvem com o carimbo',
  /anuladaEm:x\.excluida_em\|\|''/.test(fonte));
t('com quem anulou e o motivo',
  /excluidoPor:x\.excluida_por\|\|''/.test(fonte) && /excluidoMotivo:x\.excluida_motivo\|\|''/.test(fonte));
t('e o motivo está escrito: se ela não voltasse, o vínculo apontaria para o vazio',
  /o vinculo do lancamento antigo apontaria para\s*\n?\s*o vazio/.test(fonte) ||
  /apontaria para/.test(fonte));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · anular não é apagar');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   A CONTAGEM QUE ABRE O MÊS (V398, 30/09/2026)

   Rafael, véspera da contagem de 01/10 lançada como 30/09: "o que eu
   digitar tem de ficar salvo; saiu da tela e voltou, aparece onde
   parou; só zera quando finalizar; o relatório salvo abre e tem EDITAR,
   naquele mesmo dia, e fica anotado o que foi modificado".

   Prende:
     · "1,5" com vírgula é 1,5 — e texto torto NÃO vira zero nem perda;
     · o número é guardado no aparelho na hora, e ao sair da página;
     · finalizar duas vezes seguidas grava UMA contagem;
     · "preencher com o sistema" não troca o que já foi digitado;
     · a correção: só a contagem mais recente, no dia dela, estoque
       ajustado só pela diferença, e anotação de quem, quando e o quê;
     · o relatório abre com um clique e tem o botão Editar.
   O fluxo inteiro, no Chromium, com recarga da página, está na prova
   11c de ferramentas/provar.js.

   Rodar:  node testes/contagem-inicio-do-mes.js
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
console.log('\n── Sistema ' + versaoDoSistema() + ' — a contagem que abre o mês\n');

/* as funções de verdade, tiradas do index.html */
const leitor = new Function(
  corpoDaFuncao('qtdContada', fonte) + '\n' + corpoDaFuncao('contadoOk', fonte) + '\n' +
  corpoDaFuncao('contadoErrado', fonte) + '\n' + corpoDaFuncao('normCont', fonte) + '\n' +
  'return {qtdContada:qtdContada,contadoOk:contadoOk,contadoErrado:contadoErrado,normCont:normCont};')();

console.log('── 1. O número que a loja digita\n');
t('"12" é 12', leitor.qtdContada('12') === 12);
t('"1,5" com vírgula é 1,5', leitor.qtdContada('1,5') === 1.5);
t('"1.5" com ponto também', leitor.qtdContada('1.5') === 1.5);
t('"1.250,5" com milhar é 1250,5', leitor.qtdContada('1.250,5') === 1250.5);
t('" 0 " é zero contado (e não vazio)', leitor.qtdContada(' 0 ') === 0 && leitor.contadoOk(' 0 '));
t('campo vazio é NÃO contado', leitor.qtdContada('') === null && !leitor.contadoOk('') && !leitor.contadoErrado(''));
t('texto torto é ERRADO — nunca vira zero', Number.isNaN(leitor.qtdContada('abc')) && leitor.contadoErrado('abc'));
t('"2,,5" é errado', leitor.contadoErrado('2,,5'));
t('número negativo é errado', leitor.contadoErrado('-3'));
t('normCont entrega o formato da conta', leitor.normCont('4,5') === '4.5' && leitor.normCont('') === '');

console.log('\n── 2. A folha não se perde\n');
const lc = semCom(corpoDaFuncao('ligarContagem', fonte));
const lcIn = lc.slice(lc.indexOf('ins[i].oninput'));
t('cada tecla guarda antes de redesenhar',
  lcIn.indexOf('guardarRascunhoContagem()') > 0 && lcIn.indexOf('guardarRascunhoContagem()') < lcIn.indexOf('atualizaLinhaCont(id)'));
const gr = semCom(corpoDaFuncao('guardarRascunhoContagem', fonte));
t('a gravação é na hora (sem espera que perde a última tecla)', !/setTimeout/.test(gr) && /localStorage\.setItem/.test(gr));
t('e guarda a edição em andamento junto', /editando:CT2\.editando/.test(gr));
t('sair da página também grava', /addEventListener\('pagehide'/.test(fonte) && /visibilityState==='hidden'/.test(fonte));
const nc = semCom(corpoDaFuncao('novaContagem', fonte));
t('voltar para a contagem retoma a folha e a data', /CT2\.cont=r\.cont/.test(nc) && /CT2\.data=r\.data/.test(nc));
const lin = semCom(corpoDaFuncao('linhaContagem', fonte));
t('o campo aceita vírgula (texto com teclado numérico)', /inputmode="decimal"/.test(lin) && !/class="ctIn"[^>]*type="number"/.test(lin));
const cl = semCom(corpoDaFuncao('classeLinhaCont', fonte));
t('toda linha contada fica marcada (verde)', /'contado '/.test(cl));
t('linha errada fica marcada (vermelha)', /'invalido'/.test(cl));
t('a marca verde existe na folha de estilo', /tr\.contado td:first-child\{box-shadow:inset 4px 0 0 var\(--ok\)\}/.test(fonte));

console.log('\n── 3. Finalizar\n');
const fc = semCom(corpoDaFuncao('fecharContagem', fonte));
t('confere a permissão primeiro', fc.indexOf("exigirAcao('estoque/contagem-estoque:inventariar')") < 60);
t('dois cliques não gravam duas contagens', /if\(_finalizandoContagem\)return;/.test(fc) && /finally\{ _finalizandoContagem=false; \}/.test(fc));
t('número errado trava antes de gravar', fc.indexOf('avisoContagemErrada()') > 0 && fc.indexOf('avisoContagemErrada()') < fc.indexOf('DB.contagens.push'));
t('item em branco não entra, texto torto não vira zero', /var c=normCont\(CT2\.cont\[i\.id\]\);\s*if\(!contadoOk\(c\)\)return;/.test(fc));
t('só zera a folha depois de gravar', fc.indexOf('limparRascunhoContagem()') > fc.indexOf('DB.contagens.push'));
const pc = semCom(corpoDaFuncao('preencherContagem', fonte));
t('"preencher com o sistema" não troca o que já foi digitado', /if\(c!==undefined&&String\(c\)\.trim\(\)!==''\)return;/.test(pc));

console.log('\n── 4. Corrigir a contagem\n');
const pe = semCom(corpoDaFuncao('podeEditarContagem', fonte));
t('só a contagem mais recente da unidade', /contagemMaisRecente\(c\)/.test(pe) && /lojaAtualId\(\)/.test(pe));
const se = semCom(corpoDaFuncao('salvarEdicaoContagem', fonte));
t('pede a permissão de inventariar', /exigirAcao\('estoque\/contagem-estoque:inventariar'\)/.test(se));
t('confere de novo se pode corrigir', /podeEditarContagem\(c\)/.test(se));
t('o estoque recebe só a diferença entre o novo e o antigo', /var delta=\+\(novo-base\)\.toFixed\(4\);/.test(se));
t('com a data da contagem, num movimento próprio', /data:c\.data/.test(se) && /'Correção da contagem '/.test(se));
t('anota quando, quem, de e para', /em:agora,por:porQuem,de:/.test(se) && /para:m\.novo/.test(se));
t('as anotações se acumulam, não se apagam', /edicoes:\(\(m\.orig&&m\.orig\.edicoes\)\|\|\[\]\)\.concat\(\[reg\]\)/.test(se));
t('recalcula sobra, perda e resultado', /c\.perda=/.test(se) && /c\.ganho=/.test(se) && /c\.resultado=/.test(se));
t('não cria outra contagem', !/DB\.contagens\.push/.test(se));
const ec = semCom(corpoDaFuncao('editarContagem', fonte));
t('a edição abre no dia da contagem', /CT2\.data=c\.data/.test(ec));
t('com o que foi contado', /CT2\.cont\[x\.insumoId\]=String\(x\.conferido\)/.test(ec));

console.log('\n── 4b. Diferença acima de 30% e a prova de que gravou (V399)\n');
t('o limite é 30%', /var LIMITE_DIF_CONTAGEM=0\.30;/.test(fonte));
const dp = semCom(corpoDaFuncao('difContagemPct', fonte));
t('a conta é contra o mesmo saldo da folha', /sistemaNaContagem\(i\)/.test(dp));
t('sistema zerado e contado acima de zero também pergunta', /return q>0\?1:0;/.test(dp));
const cd = semCom(corpoDaFuncao('conferirDiferencaGrande', fonte));
t('pergunta "Confirma esta quantidade?"', /Confirma esta quantidade\?/.test(cd) && /ok:'Sim, está certo',cancelar:'Corrigir'/.test(cd));
t('Enter e a saída do campo fazem UMA pergunta só', /if\(_perguntandoDif\[id\]\)return _perguntandoDif\[id\];/.test(cd));
t('o OK fica guardado com o número', /CT2\.confirmados\[id\]=normCont\(CT2\.cont\[id\]\)/.test(cd));
const lc2 = semCom(corpoDaFuncao('ligarContagem', fonte));
t('o Enter só segue com a confirmação', /if\(!\(await conferirDiferencaGrande\(campo\.getAttribute\('data-id'\)\)\)\)\{\s*campo\.focus\(\);campo\.select\(\);return;/.test(lc2));
t('sair do campo também confere', /onchange=async function/.test(lc2));
t('a linha escreve "✓ contado"', /✓ contado/.test(semCom(corpoDaFuncao('seloContagem', fonte))));
const fc2 = semCom(corpoDaFuncao('fecharContagem', fonte));
t('a finalização avisa as diferenças grandes sem confirmação', /_grandes\.length/.test(fc2));
t('e termina conferindo o que gravou', /conferirContagemGravada\(_ctId,mov\.id,/.test(fc2));
const cg = semCom(corpoDaFuncao('conferirContagemGravada', fonte));
t('confere o estoque item por item pelo saldo do dia', /saldoNaData\(x\.insumoId,c\.data/.test(cg));
t('confere a gravação no aparelho', /indexOf\(ctId\)>=0/.test(cg));
t('e só diz "no banco" depois de LER de volta da nuvem',
  /api\('contagens_estoque\?loja_id=eq\.'/.test(cg) && /api\('movimentacoes_estoque\?loja_id=eq\.'/.test(cg) &&
  /nuvem\.ok=!!\(lc&&lc\.length\)&&!!\(lm&&lm\.length\)/.test(cg));
t('sem internet, diz que sobe depois — nunca que já está no banco', /sem conexão agora/.test(cg));

console.log('\n── 5. O relatório\n');
const vc = semCom(corpoDaFuncao('verContagem', fonte));
t('tem o botão Editar', /editarContagem\(/.test(vc));
t('mostra as correções feitas', /Correções feitas nesta contagem/.test(vc));
t('e as perdas e sobras', /Ver perdas/.test(vc) && /Ver sobras/.test(vc));
const tc = semCom(corpoDaFuncao('telaContagem', fonte));
t('a linha do histórico abre o relatório com um clique', /class="ctLinhaHist" onclick=/.test(tc));
t('e diz quando a contagem foi corrigida', /' · corrigida'/.test(tc));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

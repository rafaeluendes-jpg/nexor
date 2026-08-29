/* ==========================================================
   A EXIGÊNCIA DE SENHA NÃO PODE VIRAR PORTA TRANCADA

   29/08/2026. A loja de Santa Fé do Sul não conseguia fechar o caixa —
   com o dinheiro na gaveta e o comprovante já impresso. Não era nuvem,
   não era sessão, não era o operador esquecer.

   Fechar caixa está na lista das ações que exigem senha de operador
   cadastrada. No banco da Jolô, NENHUM operador tem senha: a tabela
   `operador_senhas` está vazia para os oito usuários. Com isso:

     podeFazer(op,'fechar')  → false para todo mundo
     operadoresPara('fechar') → lista VAZIA
     campo "Operador que fecha" → só "Selecione"
     clique em Confirmar → "Selecione quem está autorizando"

   Beco sem saída, e sem dizer o porquê. No log do servidor dá para ver o
   tamanho dele: 15 aberturas do modal de fechamento numa hora e ZERO
   conferências de senha — o clique nunca chegava lá.

   A exigência existe por um bom motivo: retirada de dinheiro sem
   assinatura foi um buraco real. Mas quando ninguém tem senha, exigir
   assinatura não protege nada — só impede a loja de fechar o caixa.

   Rodar:  node testes/fechar-sem-senha.js
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

function motor(quemTem, operadores) {
  const nomes = ['temSenhaCadastrada', 'alguemTemSenha', 'podeFazer', 'operadoresPara'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  return new Function('ctx', `
    var _quemTemSenha=ctx.quemTem, PERM_CAIXA={}, EXIGE_SENHA=${JSON.stringify(
      (fonte.match(/var EXIGE_SENHA=(\[[^\]]*\])/) || [])[1] || "['fechar']")};
    var operAtivos=function(){return ctx.ops};
    ${codigo}
    return {temSenhaCadastrada,alguemTemSenha,podeFazer,operadoresPara};
  `)({ quemTem, ops: operadores });
}

const jolo = [
  { id: 'u_sf', nome: 'Jolo Santa Fe do Sul', funcao: 'administrador' },
  { id: 'u_adm', nome: 'Administrador da Joia', funcao: 'administrador' }
];

console.log('\n── Sistema ' + versaoDoSistema() + ' — o beco de 29/08\n');

/* o estado real do banco da Jolô: a lista de quem tem senha veio VAZIA */
let m = motor([], jolo);
t('o sistema reconhece que ninguém tem senha', m.alguemTemSenha() === false);
t('e mesmo assim deixa fechar o caixa',
  m.podeFazer(jolo[0], 'fechar') === true);
t('a lista de quem pode fechar NÃO fica vazia',
  m.operadoresPara('fechar').length === 2, m.operadoresPara('fechar').length);
t('vale para sangria também — mexer na gaveta não pode travar',
  m.podeFazer(jolo[0], 'sangria') === true);

console.log('\n── Mas onde a senha existe, a regra continua inteira\n');

m = motor(['u_adm'], jolo);
t('agora alguém tem senha', m.alguemTemSenha() === true);
t('quem tem senha fecha', m.podeFazer(jolo[1], 'fechar') === true);
t('quem NÃO tem senha não fecha — a assinatura volta a ser exigida',
  m.podeFazer(jolo[0], 'fechar') === false);
t('e a lista mostra só quem pode',
  m.operadoresPara('fechar').map(o => o.nome).join('') === 'Administrador da Joia',
  m.operadoresPara('fechar').map(o => o.nome).join(', '));

console.log('\n── Aparelho que ainda não recebeu a lista da nuvem\n');

m = motor(null, [{ id: 'u1', nome: 'Com senha local', senha: '1234' },
                 { id: 'u2', nome: 'Sem senha' }]);
t('usa a senha que tem no aparelho', m.alguemTemSenha() === true);
t('e continua exigindo de quem não tem',
  m.podeFazer({ id: 'u2', nome: 'Sem senha' }, 'fechar') === false);

m = motor(null, [{ id: 'u1', nome: 'Ninguém tem' }]);
t('sem lista e sem senha nenhuma, não trava a loja',
  m.podeFazer({ id: 'u1', nome: 'Ninguém tem' }, 'fechar') === true);

console.log('\n── O que ficou preso no código\n');

t('a exigência só vale quando alguém tem senha',
  /EXIGE_SENHA\.indexOf\(acao\)>=0 && !temSenhaCadastrada\(op\) && alguemTemSenha\(\)/.test(codigoNu));
t('a tela de fechamento avisa quando ninguém tem senha',
  /Nenhum operador tem senha de autorização cadastrada/.test(fonte));
t('e diz onde cadastrar, sem termo técnico',
  /Operadores do Caixa/.test(fonte) && !/operador_senhas/.test(codigoNu.split('Nenhum operador tem senha')[1] || ''));
t('quem fechou continua sendo gravado no caixa',
  /cx\.fechadoPor=opF\.nome/.test(codigoNu));

console.log('\n── O clique nunca morre calado\n');

t('a trava de duplo toque avisa em vez de sumir',
  /O fechamento já está sendo processado/.test(fonte));
t('erro no meio do fechamento aparece na tela, em português',
  /Não consegui concluir o fechamento: /.test(fonte));
t('e diz que nada foi perdido', /Nada foi perdido — o caixa continua aberto/.test(fonte));
t('e o motivo técnico fica no Diagnóstico',
  /registrarFalha\('caixa','fecharCaixa'/.test(codigoNu));
t('a trava é liberada quando dá erro, senão o próximo clique também morre',
  /catch\(e\)\{\s*liberarOperacao\('fechar-caixa'\);/.test(codigoNu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

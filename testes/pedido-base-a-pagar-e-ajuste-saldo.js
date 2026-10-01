/* ==========================================================
   PEDIDO DE BASE NA LOJA E SEMPRE A PAGAR · AJUSTE DE SALDO (V400, 01/10/2026)

   Rafael: "o Raylan entrou com o login dele e selecionou Santa Fe: toda a
   tela, todo o relatorio tem que ver Santa Fe. Pedido de base, quem
   recebe e so a franqueadora; as lojas pagam. Nao pode ter a opcao de
   contas a receber de base." E: "coloco o valor que esta no banco, ele
   faz o real menos o que existe no sistema, e e aquele valor que vale".

   Prende:
     · a unidade do lancamento desce da nuvem (sem ela o filtro deixava
       passar tudo e o envio carimbava a loja aberta);
     · a tela de lancamentos so mostra a loja escolhida;
     · a cobranca do pedido de base nasce na MATRIZ, a conta a pagar na loja;
     · lancamento novo nasce com a loja de agora; trocar de loja carimba o
       que ainda nao subiu;
     · o lancamento do pedido de base abre travado em despesa, e fora da
       matriz "Pedido de base — a receber" nao aparece nem passa;
     · o ajuste de saldo: um lancamento pago, hoje, no valor da diferenca,
       sem mexer no saldo inicial, e so diz "ajustado" depois de conferir.
   O fluxo inteiro, no Chromium, esta na prova 11d de ferramentas/provar.js.

   Rodar:  node testes/pedido-base-a-pagar-e-ajuste-saldo.js
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
console.log('\n── Sistema ' + versaoDoSistema() + ' — pedido de base a pagar e ajuste de saldo\n');

console.log('── 1. Cada lançamento na sua loja\n');
t('a unidade do lançamento desce da nuvem', /sucursalRef:x\.sucursal_id\|\|undefined\}\},null,'lancFin'\)/.test(fonte));
t('a tela de lançamentos só mostra a loja escolhida',
  /if\(!daUnidadeAberta\(l\)\)return false;/.test(semCom(corpoDaFuncao('filtrarLanc', fonte))));
const ml = semCom(corpoDaFuncao('modalLanc', fonte));
t('lançamento novo nasce com a loja aberta agora', /o\.sucursalRef=lojaAtualId\(\);/.test(ml));
const tl = semCom(corpoDaFuncao('trocarLoja', fonte));
t('trocar de loja carimba o que ainda não subiu, antes de trocar',
  /l\.sucursalRef=_ant/.test(tl) && tl.indexOf('l.sucursalRef=_ant') < tl.indexOf('DB.lojaAtual=id'));

console.log('\n── 2. Pedido de base: a matriz recebe, a loja paga\n');
t('a cobrança nasce na matriz, qualquer loja aberta',
  /sucursalRef: \(typeof unidadeMatrizId === 'function'\) \? unidadeMatrizId\(\) : 'suc_matriz'/.test(semCom(corpoDaFuncao('gerarReceberPedido', fonte))));
t('a conta a pagar nasce na loja que recebeu',
  /sucursalRef: p\.sucursalRef \|\| lojaAtualId\(\)/.test(semCom(corpoDaFuncao('receberPedidoBase', fonte))));
t('a nota do Franqueador lança só despesa', /soDespesa:true/.test(semCom(corpoDaFuncao('abrirFinanceiroNota', fonte))));
t('na edição, o lançamento do pedido de base fica travado em despesa',
  /var travaBase=lancDePedidoBase\(l\);/.test(ml) && /\|\|travaBase;/.test(ml) && /if\(travaBase\)tp='despesa';/.test(ml));
t('e diz isso na tela', /sempre <b>conta a pagar<\/b> ao Franqueador/.test(ml));
t('fora da matriz, "a receber" de base não passa no salvar', /if\(catSoDaMatriz\(\$\('lnCat'\)\.value\)\)\{/.test(ml));
t('e nem aparece na lista de categorias',
  /p\.itens\.filter\(function\(it\)\{return !catSoDaMatriz\(it\.id\)\}\)/.test(semCom(corpoDaFuncao('desenhaCatLanc', fonte))));
const pb = new Function('l', 'notaDoLanc', 'categoriaDoEvento',
  corpoDaFuncao('lancDePedidoBase', fonte) + '\nreturn lancDePedidoBase(l);');
const cat = (ev) => ev === 'pedbase-pagar' ? 'sub_pb' : '';
t('reconhece pela origem', pb({ tipo: 'despesa', origem: 'pedido_base' }, () => null, cat));
t('reconhece pela categoria', pb({ tipo: 'despesa', categoriaId: 'sub_pb' }, () => null, cat));
t('reconhece pela nota do pedido', pb({ tipo: 'despesa' }, () => ({ pedidoBaseRef: 'pb1' }), cat));
t('compra comum não é travada', !pb({ tipo: 'despesa', origem: 'nota-entrada' }, () => ({}), cat));

console.log('\n── 3. Ajuste de saldo, dentro do Editar da conta\n');
const aj = semCom(corpoDaFuncao('gravarAjusteSaldo', fonte));
t('caixa aberto: acerto pelo PDV, não por aqui', /vivo\.fixa==='caixa'&&caixaAberto\(\)/.test(aj));
t('relê o saldo na hora de gravar', /var agora=saldoConta\(vivo\);/.test(aj));
t('a diferença é real menos o sistema', /var dif=\+\(real-agora\)\.toFixed\(2\);/.test(aj));
t('pergunta antes de gravar, e desistir não grava', /var ok=await confirmar\(/.test(aj) && /if\(!ok\)return null;/.test(aj));
t('um lançamento pago, hoje, no valor da diferença, na conta',
  /tipo:dif>0\?'receita':'despesa',contaId:vivo\.id/.test(aj) && /valor:Math\.abs\(dif\)/.test(aj) &&
  /pagamento:hoje,pago:true/.test(aj) && /origem:'ajuste-saldo'/.test(aj));
t('fora do DRE e da lista de "sem categoria"', /categoriaId:'',categoriaTxt:'Ajuste de saldo'/.test(aj));
t('não mexe no saldo inicial', !/saldoInicial/.test(aj));
t('confere que bateu e que subiu antes de dizer ajustado',
  /saldoConta\(vivo\)!==real/.test(aj) && /conferirLancNaNuvem\(\[l\.id\]\)/.test(aj));
const tc = semCom(corpoDaFuncao('telaContas', fonte));
t('toda conta tem o Editar — banco, cofre e caixa',
  /'<button class="ctB" onclick="modalConta\(\\''\+c\.id\+'\\'\)"/.test(tc) && !/:'<button class="ctB" onclick="modalConta/.test(tc));
const mc = semCom(corpoDaFuncao('modalConta', fonte));
t('o Editar tem o campo do saldo atual, já com o saldo do sistema',
  /moedaHTML\(\{id:'cbReal',valor:sisIni,zeroVazio:false/.test(mc));
t('mudar só o saldo inicial não gera ajuste', /var mexeuReal=Math\.abs\(real-sisIni\)>=0\.005;/.test(mc));
t('ao salvar com o saldo mexido, grava o ajuste', /await gravarAjusteSaldo\(vivo,real\)/.test(mc));
t('caixa e cofre não viram banco ao salvar', /var o=fixa\?\{nome:nome,saldoInicial:/.test(mc));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

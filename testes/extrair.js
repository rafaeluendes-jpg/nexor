/* ==========================================================
   EXTRAI AS FUNCOES DE VERDADE DO SISTEMA

   O ponto mais importante desta suite: os testes NAO reimplementam a
   regra. Eles pegam as funcoes reais de dentro do index.html e rodam
   ELAS.

   Se alguem mudar `diaLocal` amanha, o teste roda a versao nova e
   quebra. Se o teste tivesse uma copia da regra, ele continuaria
   passando com o sistema errado — que e exatamente o tipo de teste que
   da falsa seguranca.
   ========================================================== */
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');

function corpoDaFuncao(nome, fonte) {
  const marca = 'function ' + nome + '(';
  let i = fonte.indexOf(marca);
  if (i < 0) throw new Error('função não encontrada no index.html: ' + nome);
  /* ==========================================================
     O `async` FAZ PARTE DA FUNCAO

     A marca procurada e "function nome(", que casa DENTRO de
     "async function nome(" — e o corte comecava depois do `async`. Quem
     extraia uma funcao assincrona recebia o corpo com `await` dentro e
     sem o `async` na frente: colocar isso num `new Function` estoura com
     "await is only valid in async functions".

     Mesma familia do defeito que o mapear.js tinha: regra escrita sem
     contar com o `async`.
     ========================================================== */
  if (fonte.slice(Math.max(0, i - 6), i) === 'async ') i -= 6;
  let j = fonte.indexOf('{', i), nivel = 0, fim = j;
  while (fim < fonte.length) {
    const c = fonte[fim];
    if (c === '{') nivel++;
    else if (c === '}') { nivel--; if (nivel === 0) { fim++; break; } }
    fim++;
  }
  return fonte.slice(i, fim);
}

function carregar(nomes) {
  const fonte = fs.readFileSync(ARQ, 'utf8');
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  const fabrica = new Function(codigo + '\n return {' + nomes.join(',') + '};');
  return fabrica();
}

function versaoDoSistema() {
  const fonte = fs.readFileSync(ARQ, 'utf8');
  const m = fonte.match(/var VERSAO='(V[0-9.]+)'/);
  return m ? m[1] : '(desconhecida)';
}

module.exports = { carregar, versaoDoSistema, corpoDaFuncao, ARQ };

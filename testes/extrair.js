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
  const i = fonte.indexOf(marca);
  if (i < 0) throw new Error('função não encontrada no index.html: ' + nome);
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

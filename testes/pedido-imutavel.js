/* ==========================================================
   JOIA — O PEDIDO FECHADO É IMUTÁVEL: OS ITENS NÃO MUDAM DEPOIS DA VENDA

   03/09/2026. Pedido #849: o cupom impresso na venda trazia 3 "Cascão
   Chocolate Avulso", e a consulta depois mostrava outro conjunto — mesmo
   total (R$ 38), itens diferentes. No banco os itens nem somavam o total.

   Três defeitos, todos aqui cobertos:

   1. O item da venda nascia SEM id. Os dois caminhos que sobem a venda
      davam nomes diferentes à mesma linha (pacote atômico: posição;
      sincronização comum: aleatório), então reenviar duplicava/embaralhava.
      Agora o item nasce com id próprio (uid('it')).

   2. A limpeza de pré-envio colapsava filhos de mesmo nome — regra que só
      vale para OPÇÃO de cardápio. Num pedido, três casquinhas e duas águas
      são reais: colapsar apagava produtos. Agora só colapsa `opcoes`.

   3. O preço unitário vivia em `unit` (carrinho/envio) e voltava em
      `unitario` (download). Escrever só um zerava o outro no reenvio — a
      venda voltava com preço 0. Agora os dois nomes andam juntos.

   Rodar:  node testes/pedido-imutavel.js
   ========================================================== */
const fs = require('fs');
const { ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* réplica da limpeza de filhos: colapsa por nome SÓ quando é opção */
function limpar(tab, filhos) {
  const visto = {}, limpo = [];
  filhos.forEach(function (o) {
    if (!o) return;
    if (tab !== 'opcoes') { limpo.push(o); return; }
    if (!String(o.nome || '').trim()) { limpo.push(o); return; }
    const ch = String(o.nome).trim().toLowerCase() + '|' + (Number(o.preco) || 0);
    if (visto[ch]) return;
    visto[ch] = true; limpo.push(o);
  });
  return limpo;
}

console.log('\n── Itens repetidos de um PEDIDO sobrevivem ao envio\n');
{
  const itens = [
    { id: 'it1', nome: 'Cascão Chocolate Avulso' },
    { id: 'it2', nome: 'Cascão Chocolate Avulso' },
    { id: 'it3', nome: 'Cascão Chocolate Avulso' },
    { id: 'it4', nome: 'Agua' }, { id: 'it5', nome: 'Agua' }
  ];
  const r = limpar('pedido_itens', itens);
  t('as 3 casquinhas e as 2 águas continuam (5 itens)', r.length === 5, r.length);
}

console.log('\n── Opções de cardápio de mesmo nome ainda colapsam\n');
{
  const opc = [{ nome: 'Borda Nutella', preco: 5 }, { nome: 'Borda Nutella', preco: 5 }];
  t('duas "Borda Nutella" iguais viram uma', limpar('opcoes', opc).length === 1);
}

console.log('\n── O preço unitário sobrevive ao round-trip (unit ⇄ unitario)\n');
{
  /* como o envio lê o preço: unit no carrinho, unitario no que voltou */
  const leUnit = o => (o.unit != null ? o.unit : o.unitario) || 0;
  t('item do carrinho (só unit) sobe com preço', leUnit({ unit: 7 }) === 7);
  t('item que voltou da nuvem (só unitario) sobe com preço', leUnit({ unitario: 7 }) === 7);
  t('item sem preço nenhum vira 0, não quebra', leUnit({}) === 0);
}

console.log('\n── As travas estão no código\n');
{
  t('o item da comanda nasce com id próprio',
    /PDV\.comanda\.push\(\{id:uid\('it'\)/.test(fonte));
  t('a limpeza por nome só vale para opções',
    /if\(F2\.tab!=='opcoes'\)\{ limpo\.push\(o\); return; \}/.test(fonte));
  t('o download traz o preço nos dois nomes (unit e unitario)',
    /unit:_u,unitario:_u/.test(fonte));
  t('o envio comum lê o preço de onde estiver',
    /unitario:n\(o\.unit!=null\?o\.unit:o\.unitario\)/.test(fonte));
  t('o pacote atômico também não manda mais it.preco (0)',
    /it\.unit!=null\?it\.unit:\(it\.unitario!=null\?it\.unitario:it\.preco\)/.test(fonte));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

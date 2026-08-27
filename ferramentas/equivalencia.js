/* ==========================================================
   EQUIVALENCIA — o que mudou de verdade entre duas versoes

   Comparar dois arquivos de 50 mil linhas a olho nao e auditoria, e
   opiniao. Aqui a comparacao e mecanica, funcao por funcao.

   O raciocinio que sustenta o resultado:

     Funcao cujo TEXTO e identico nas duas versoes nao pode ter mudado
     de comportamento. Nao e prova por leitura, e por igualdade.

   Entao o trabalho vira: separar as funcoes identicas (que se provam
   sozinhas) das diferentes (que precisam de justificativa uma a uma).

   Uso: node ferramentas/equivalencia.js <antigo.html> <novo.html>
   ========================================================== */
const fs = require('fs');
const crypto = require('crypto');

function corpos(fonte) {
  /* devolve {nome: texto} de toda funcao declarada no topo */
  const out = {};
  const re = /^[ \t]*(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/gm;
  let m;
  while ((m = re.exec(fonte))) {
    const nome = m[1];
    let j = fonte.indexOf('{', m.index);
    if (j < 0) continue;
    let nivel = 0, fim = j;
    while (fim < fonte.length) {
      const c = fonte[fim];
      if (c === '{') nivel++;
      else if (c === '}') { nivel--; if (!nivel) { fim++; break; } }
      fim++;
    }
    out[nome] = fonte.slice(m.index, fim);
  }
  return out;
}

/* todo nome de funcao usado num atributo de evento do HTML */
function handlers(fonte) {
  const out = new Set();
  const re = /\bon(?:click|change|input|submit|keyup|keydown|focus|blur|mouseover|mouseout|dblclick|contextmenu)\s*=\s*[\\"']+\s*([a-zA-Z0-9_$]+)\s*\(/g;
  let m; while ((m = re.exec(fonte))) out.add(m[1]);
  return out;
}

function telas(fonte) {
  return new Set((fonte.match(/^function (tela[A-Za-z0-9_]+)/gm) || []).map(s => s.replace('function ', '')));
}

function ouvintes(fonte) {
  const c = {};
  const re = /addEventListener\(\s*['"]([a-z]+)['"]/g;
  let m; while ((m = re.exec(fonte))) c[m[1]] = (c[m[1]] || 0) + 1;
  return c;
}

function rpcs(fonte) {
  return new Set((fonte.match(/rpc\/[a-z_]+/g) || []));
}

function tabelas(fonte) {
  return new Set((fonte.match(/tab:'[a-z_]+'/g) || []).map(s => s.slice(5, -1)));
}

function comparar(A, B) {
  const fa = corpos(A), fb = corpos(B);
  const na = new Set(Object.keys(fa)), nb = new Set(Object.keys(fb));

  const soA = [...na].filter(x => !nb.has(x)).sort();
  const soB = [...nb].filter(x => !na.has(x)).sort();
  const comuns = [...na].filter(x => nb.has(x));
  const iguais = comuns.filter(n => fa[n] === fb[n]).sort();
  const mudadas = comuns.filter(n => fa[n] !== fb[n]).sort();

  const ha = handlers(A), hb = handlers(B);
  const soltosA = [...ha].filter(x => !na.has(x)).sort();
  const soltosB = [...hb].filter(x => !nb.has(x)).sort();

  const ta = telas(A), tb = telas(B);
  const la = ouvintes(A), lb = ouvintes(B);
  const ra = rpcs(A), rb = rpcs(B);
  const ba = tabelas(A), bb = tabelas(B);

  return {
    funcoes: { antes: na.size, depois: nb.size, iguais: iguais.length,
               mudadas, removidas: soA, novas: soB },
    handlers: { antes: ha.size, depois: hb.size,
                semFuncaoAntes: soltosA, semFuncaoDepois: soltosB,
                perdidos: [...ha].filter(x => !hb.has(x)).sort(),
                ganhos: [...hb].filter(x => !ha.has(x)).sort() },
    telas: { antes: ta.size, depois: tb.size,
             removidas: [...ta].filter(x => !tb.has(x)).sort(),
             novas: [...tb].filter(x => !ta.has(x)).sort() },
    ouvintes: { antes: la, depois: lb,
                iguais: JSON.stringify(la) === JSON.stringify(lb) },
    rpc: { antes: ra.size, depois: rb.size,
           removidas: [...ra].filter(x => !rb.has(x)).sort(),
           novas: [...rb].filter(x => !ra.has(x)).sort() },
    tabelas: { antes: ba.size, depois: bb.size,
               removidas: [...ba].filter(x => !bb.has(x)).sort(),
               novas: [...bb].filter(x => !ba.has(x)).sort() }
  };
}

if (require.main === module) {
  const A = fs.readFileSync(process.argv[2], 'utf8');
  const B = fs.readFileSync(process.argv[3], 'utf8');
  const r = comparar(A, B);
  const saida = process.argv[4];
  if (saida) fs.writeFileSync(saida, JSON.stringify(r, null, 1));

  const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
  console.log('\n  FUNÇÕES');
  console.log('    antes ' + r.funcoes.antes + '  ·  depois ' + r.funcoes.depois);
  console.log('    texto IDÊNTICO: ' + r.funcoes.iguais + '  (' + pct(r.funcoes.iguais, r.funcoes.depois) + ' das que existem hoje)');
  console.log('    mudadas: ' + r.funcoes.mudadas.length + (r.funcoes.mudadas.length ? '  → ' + r.funcoes.mudadas.join(', ') : ''));
  console.log('    removidas: ' + r.funcoes.removidas.length);
  console.log('    novas: ' + r.funcoes.novas.length + (r.funcoes.novas.length ? '  → ' + r.funcoes.novas.join(', ') : ''));

  console.log('\n  BOTÕES (handlers no HTML)');
  console.log('    antes ' + r.handlers.antes + '  ·  depois ' + r.handlers.depois);
  console.log('    apontando para função que NÃO existe — antes: ' + r.handlers.semFuncaoAntes.length +
              '  ·  depois: ' + r.handlers.semFuncaoDepois.length +
              (r.handlers.semFuncaoDepois.length ? '  → ' + r.handlers.semFuncaoDepois.join(', ') : ''));
  console.log('    perdidos: ' + r.handlers.perdidos.length + (r.handlers.perdidos.length ? '  → ' + r.handlers.perdidos.join(', ') : ''));
  console.log('    ganhos: ' + r.handlers.ganhos.length + (r.handlers.ganhos.length ? '  → ' + r.handlers.ganhos.join(', ') : ''));

  console.log('\n  TELAS');
  console.log('    antes ' + r.telas.antes + '  ·  depois ' + r.telas.depois);
  console.log('    removidas: ' + (r.telas.removidas.join(', ') || 'nenhuma'));
  console.log('    novas: ' + (r.telas.novas.join(', ') || 'nenhuma'));

  console.log('\n  OUVINTES DE EVENTO');
  console.log('    ' + (r.ouvintes.iguais ? 'IDÊNTICOS' : 'DIFERENTES'));
  console.log('    antes:  ' + JSON.stringify(r.ouvintes.antes));
  console.log('    depois: ' + JSON.stringify(r.ouvintes.depois));

  console.log('\n  BANCO');
  console.log('    RPC — antes ' + r.rpc.antes + ' · depois ' + r.rpc.depois +
              (r.rpc.removidas.length ? '  removidas: ' + r.rpc.removidas.join(', ') : '  nenhuma removida') +
              (r.rpc.novas.length ? '  novas: ' + r.rpc.novas.join(', ') : ''));
  console.log('    tabelas sincronizadas — antes ' + r.tabelas.antes + ' · depois ' + r.tabelas.depois +
              (r.tabelas.removidas.length ? '  removidas: ' + r.tabelas.removidas.join(', ') : '  nenhuma removida'));
  console.log('');
}
module.exports = { comparar, corpos, handlers, telas, ouvintes };

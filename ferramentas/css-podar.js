/* ==========================================================
   CSS — apaga a copia que nao vale, mantendo a que vale

   Havia blocos inteiros repetidos ate 8 vezes ("USUARIOS E PERMISSOES",
   "LAYOUTS DO PDV"). Eu tinha adiado isso por medo de mexer no layout da
   frente de caixa. O medo estava no lado errado da conta:

     Em CSS, entre regras de MESMA especificidade, vence a ULTIMA.
     Entao a copia que "funciona" e sempre a de baixo, e as de cima nao
     produzem efeito nenhum — sao justamente as que nao funcionam.

     Apagar uma copia ANTERIOR e sempre seguro: o valor final daquele
     seletor e daquela propriedade continua vindo da copia de baixo, que
     fica. Apagar a ULTIMA e que mudaria o resultado — e essa nunca sai.

     Especificidade nao depende de ordem, so o desempate depende. Entao
     nada que esteja no meio muda de comportamento.

   E a prova nao fica no raciocinio: o script monta o mapa final
   (contexto + seletor + propriedade -> ultimo valor) antes e depois, e
   recusa a poda se os dois nao forem identicos.
   ========================================================== */
const fs = require('fs');
const path = require('path');

/* ---------- leitor ---------- */
function semComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

/* devolve a lista de regras: {contexto, seletor, corpo, de, ate} */
function lerRegras(css) {
  const limpo = semComentarios(css);
  const regras = [];
  let i = 0, contexto = '';
  let fimContexto = -1;

  while (i < limpo.length) {
    /* ==========================================================
       O `}` QUE FECHA O @media PRECISA SER CONSUMIDO

       Sem isto, a ultima regra de dentro do bloco terminava, o `}` do
       proprio @media ficava para tras, e a proxima leitura o engolia
       dentro do seletor seguinte — que passava a ser "} .algo". Seletor
       corrompido significa mapa final diferente, e foi por isso que a
       trava recusou a primeira poda. A trava fez o trabalho dela.
       ========================================================== */
    while (i < limpo.length) {
      const c = limpo[i];
      if (c === ' ' || c === '\n' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '}' && fimContexto >= 0) { i++; contexto = ''; fimContexto = -1; continue; }
      break;
    }
    if (fimContexto >= 0 && i >= fimContexto) { contexto = ''; fimContexto = -1; }
    const abre = limpo.indexOf('{', i);
    if (abre < 0) break;
    const bruto = limpo.slice(i, abre);
    const cabeca = bruto.trim();
    /* o corte comeca no SELETOR, nao no espaco nem no comentario que vem
       antes dele — senao ele engole a marca que separa os arquivos, e a
       banner de secao que explica o bloco seguinte */
    const inicio = i + (bruto.length - bruto.trimStart().length);

    if (cabeca.startsWith('@')) {
      /* at-rule com bloco: entra nele, mantendo o cabecalho como contexto */
      let nivel = 0, j = abre;
      while (j < limpo.length) {
        if (limpo[j] === '{') nivel++;
        else if (limpo[j] === '}') { nivel--; if (!nivel) { j++; break; } }
        j++;
      }
      if (/^@(media|supports|layer|container)/.test(cabeca)) {
        contexto = cabeca.replace(/\s+/g, ' ');
        fimContexto = j - 1;
        i = abre + 1;
        continue;
      }
      /* @keyframes, @font-face: trata como bloco unico */
      regras.push({ contexto, seletor: cabeca.replace(/\s+/g, ' '),
                    corpo: limpo.slice(abre + 1, j - 1), de: i, ate: j });
      i = j;
      continue;
    }

    const fecha = limpo.indexOf('}', abre);
    if (fecha < 0) break;
    regras.push({ contexto, seletor: cabeca.replace(/\s+/g, ' '),
                  corpo: limpo.slice(abre + 1, fecha), de: inicio, ate: fecha + 1 });
    i = fecha + 1;
  }
  return regras;
}

/* mapa final: quem vence cada propriedade, no fim das contas */
function mapaFinal(regras) {
  const m = new Map();
  for (const r of regras) {
    for (const sel of r.seletor.split(',').map(s => s.trim()).filter(Boolean)) {
      for (const d of r.corpo.split(';')) {
        const k = d.indexOf(':');
        if (k < 0) continue;
        const prop = d.slice(0, k).trim(), val = d.slice(k + 1).trim();
        if (!prop) continue;
        m.set(r.contexto + '|' + sel + '|' + prop, val);
      }
    }
  }
  return m;
}

function iguais(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

/* ---------- poda ---------- */
function podar(css) {
  const regras = lerRegras(css);
  const antes = mapaFinal(regras);

  /* a ultima ocorrencia de cada regra identica e a que vale */
  const chaveDe = r => r.contexto + ' ' + r.seletor + ' ' + r.corpo.replace(/\s+/g, ' ').trim();
  const ultima = new Map();
  regras.forEach((r, n) => { ultima.set(chaveDe(r), n); });

  const fora = [];
  regras.forEach((r, n) => {
    if (!r.corpo.trim()) return;              /* regra vazia: deixa quieta */
    if (ultima.get(chaveDe(r)) !== n) fora.push(n);
  });

  if (!fora.length) return { css, removidas: 0, linhas: 0 };

  /* remove de tras para frente para nao mexer nas posicoes */
  let saida = css, linhas = 0;
  for (const n of fora.slice().sort((a, b) => b - a)) {
    const r = regras[n];
    linhas += css.slice(r.de, r.ate).split('\n').length - 1;
    saida = saida.slice(0, r.de) + saida.slice(r.ate);
  }
  saida = saida.replace(/\n{3,}/g, '\n\n');

  const depois = mapaFinal(lerRegras(saida));
  if (!iguais(antes, depois)) {
    throw new Error('a poda mudaria o resultado final do CSS — recusada');
  }
  return { css: saida, removidas: fora.length, linhas };
}

module.exports = { podar, lerRegras, mapaFinal, iguais };

if (require.main === module) {
  const raiz = path.join(__dirname, '..', 'src', 'css');
  const arqs = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1))
      e.isDirectory() ? anda(path.join(d, e.name))
                      : e.name.endsWith('.css') && arqs.push(path.join(d, e.name));
  })(raiz);

  /* o CSS e uma cascata so: a poda tem de olhar as folhas JUNTAS, senao
     uma copia num arquivo e a outra no seguinte passam despercebidas */
  const marca = '\n/*__CORTE__*/\n';
  const juntos = arqs.map(a => fs.readFileSync(a, 'utf8')).join(marca);
  const r = podar(juntos);
  const partes = r.css.split('/*__CORTE__*/');
  if (partes.length !== arqs.length) {
    console.error('css-podar: a marca de corte se perdeu — nada foi escrito');
    process.exit(1);
  }
  arqs.forEach((a, n) => fs.writeFileSync(a, partes[n].replace(/^\n/, '').replace(/\n$/, '')));
  console.log('css-podar: ' + r.removidas + ' regra(s) repetida(s) removida(s), ~' + r.linhas + ' linhas');
  console.log('css-podar: o mapa final do CSS ficou identico — conferido');
}

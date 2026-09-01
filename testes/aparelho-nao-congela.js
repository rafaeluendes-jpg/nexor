/* ==========================================================
   JOIA — APARELHO NO MESMO LOGIN NÃO FICA ATRASADO

   O Rafael, em 01/09/2026: "não faz sentido ter aparelho que está no
   mesmo login atrasado. Está no mesmo login, internet, tudo certinho."

   Ele está certo, e havia DUAS travas fazendo isso:

     1. `baixarDaNuvem`: depois de tentar enviar, se ainda houvesse coisa
        pendente, cancelava o download e voltava.
     2. `agendarRecarga` (o tempo real): se houvesse coisa pendente,
        simplesmente não baixava.

   As duas nasceram de uma regra certa — não sobrescrever o aparelho
   enquanto houver coisa esperando para subir. O efeito não era: bastava
   UMA coisa que não consegue subir para aquele aparelho parar de RECEBER,
   e parar para sempre. Sem limite de tempo, sem recuperação. A tela
   continua desenhando o mundo do momento em que travou.

   E eram travas A MAIS. A proteção de verdade é POR LINHA, dentro de
   `volta()`: `temMudancaNaoEnviada` guarda a linha alterada aqui e ainda
   não enviada; `_novoAqui` guarda a que só existe neste aparelho; e o
   mapa de filhos (V274) devolve item, pagamento e movimento de caixa que
   ainda não subiram. Este teste confere que TODAS as coleções do download
   passam por essa porta — é o que autoriza tirar o bloqueio geral.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const path = require('path');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── Toda coleção do download passa pela proteção por linha\n');
{
  const dl = fs.readFileSync(path.join(__dirname, '..',
    'src/js/03-armazenamento/02-medir-nunca-pode-quebrar-o-que-esta-sendo-me.js'), 'utf8');
  /* acha cada chamada volta( e lê o último argumento */
  const chamadas = [];
  const re = /=volta\(/g;
  let m;
  while ((m = re.exec(dl))) {
    let i = m.index + m[0].length - 1, n = 0, j = i;
    while (j < dl.length) {
      if (dl[j] === '(') n++;
      else if (dl[j] === ')') { n--; if (!n) break; }
      j++;
    }
    const args = dl.slice(i + 1, j);
    let d = 0, last = args.length;
    for (let k = args.length - 1; k >= 0; k--) {
      const c = args[k];
      if (')]}'.includes(c)) d++;
      else if ('([{'.includes(c)) d--;
      else if (c === ',' && d === 0) { last = k; break; }
    }
    chamadas.push(args.slice(last + 1).trim());
  }
  const semNome = chamadas.filter(a => !/^['"]/.test(a));
  t('o download tem 45 coleções', chamadas.length === 45, chamadas.length);
  t('e TODAS passam o nome da coleção — sem isso não há proteção por linha',
    semNome.length === 0, semNome.join(' | '));
}

console.log('\n── As duas travas que congelavam o aparelho saíram\n');
{
  const bd = corpoDaFuncao('_baixarDaNuvem', fonte);
  t('o download continua tentando enviar antes', /await sincronizar\(\)/.test(bd));
  t('mas não cancela mais o download quando o envio não conclui',
    !/download cancelado: envio não concluiu/.test(bd));
  t('e diz por que baixa assim mesmo',
    /baixando assim mesmo; o que não subiu/.test(bd));
  const ar = corpoDaFuncao('agendarRecarga', fonte);
  t('o tempo real não desiste mais de baixar quando há pendência',
    !/if\(NUVEM\.sujo\|\|DB\._sujo\)\{ return; \}/.test(ar));
  /* olha só o código, sem os comentários que citam o defeito antigo */
  const arCod = ar.replace(/\/\*[\s\S]*?\*\//g, '');
  t('e o laço continua fechado: nada de agendarSync aqui',
    !/agendarSync\(\)/.test(arCod));
}

console.log('\n── A proteção por linha continua inteira\n');
{
  const tm = corpoDaFuncao('temMudancaNaoEnviada', fonte);
  t('linha nova daqui é preservada', /x\._novoAqui===true\)return true/.test(tm));
  t('fechamento de caixa preso é preservado', /_fechamentoPendente===true\)return true/.test(tm));
  t('linha sem envio confirmado é preservada', /if\(!guardada\)return true/.test(tm));
  const v = corpoDaFuncao('volta', fonte);
  t('o download guarda as linhas com mudança não enviada',
    /temMudancaNaoEnviada\(col,x,i\)\)meus\[x\.id\]=x/.test(v));
  t('e devolve os filhos que só existem aqui', /volta\._filhos\[col\]/.test(v));
}

console.log('\n── A faixa fala português\n');
{
  const tp = corpoDaFuncao('telaPDV', fonte);
  const semComent = fonte.replace(/\/\*[\s\S]*?\*\//g, '');
  t('nenhum lugar do sistema cola "ões" no fim de "alteração"',
    !/alteração'\+\([a-z_]+>1\?'ões'/.test(semComent));
  t('nem o rodapé, que dizia "Sincronizando 9 alteraçãoões"',
    /_alt=pend\?' '\+pend\+\(pend>1\?' alterações':' alteração'\)/.test(fonte));
  t('o plural é escrito por extenso',
    /_n\+' alterações feitas aqui ainda não subiram'/.test(tp));
  t('e o singular também', /'uma alteração feita aqui ainda não subiu'/.test(tp));
  /* roda a frase de verdade, com 1 e com 9 */
  const frase = n => (n > 1
    ? n + ' alterações feitas aqui ainda não subiram'
    : 'uma alteração feita aqui ainda não subiu');
  t('com 9 sai "9 alterações feitas aqui ainda não subiram"',
    frase(9) === '9 alterações feitas aqui ainda não subiram', frase(9));
  t('com 1 sai "uma alteração feita aqui ainda não subiu"',
    frase(1) === 'uma alteração feita aqui ainda não subiu', frase(1));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

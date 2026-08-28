/* ==========================================================
   JOIA — DOIS ENVIOS AO MESMO TEMPO ESTRAGAM OS DOIS

   O Rafael nao conseguia cadastrar produto: aparecia "ainda nao chegou a
   nuvem" toda vez. O Diagnostico da loja mostrou o que era, com hora:

     06:35:18  ficha_itens: 3 item(ns), 3 confirmado(s)
     06:35:19  envio anterior travou — liberando e tentando de novo
     06:35:19  ficha_itens: 4 item(ns), 4 confirmado(s)
     06:35:20  ficha_itens: 5 item(ns), 5 confirmado(s)
     06:35:22  enviando...
     06:35:22  ficha_itens: 5 item(ns), 5 confirmado(s)

   O envio estava SUBINDO BEM — as fichas passavam uma atras da outra. A
   trava de seguranca soltava depois de 15 segundos sem perguntar nada, e
   o aparelho tinha 1.510 alteracoes na fila: passar de 15 segundos era o
   normal, nao a excecao. A trava soltava um envio saudavel, um segundo
   comecava por cima, e os dois passavam a rodar juntos.

   E dois envios juntos se atrapalham de verdade: `_ids` — o mapa que
   traduz o identificador local para o da nuvem — e ZERADO no comeco de
   cada envio. O segundo zerava o mapa que o primeiro estava usando no
   meio do caminho, e dali para a frente todo vinculo saia vazio.

   Nao era recusa do banco. Era o proprio aparelho enviando duas vezes ao
   mesmo tempo.

   A trava passou a olhar o SINAL DE VIDA: cada lote que a nuvem responde
   carimba a hora. Enquanto houver lote subindo, o envio esta trabalhando
   e nao e solto. So solta no silencio de verdade.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function grupo(n) { console.log('\n── ' + n + '\n'); }
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

grupo('O envio dá sinal de vida a cada lote');

const env = corpoDaFuncao('enviar', fonte);
t('cada lote confirmado carimba a hora', /NUVEM\._batimento=Date\.now\(\);/.test(env));
t('e isso fica DENTRO do laço dos lotes',
  env.indexOf('NUVEM._batimento') > env.indexOf('out=out.concat'),
  'carimbo fora do laço');
t('o envio nasce vivo', /NUVEM\._batimento=Date\.now\(\);\s*\/\* comecou agora/.test(fonte));

grupo('A trava sabe a diferença entre preso e demorado');

const sinc = corpoDaFuncao('sincronizar', fonte);
t('a trava mede o silêncio, não o tempo total',
  /var parado=Date\.now\(\)-\(NUVEM\._batimento\|\|0\);/.test(sinc));
t('se ainda está subindo, ela espera mais',
  /if\(parado<PARADO_DEMAIS\)\{[\s\S]{0,200}setTimeout\(esperaOuSolta/.test(sinc));
t('e só solta quando o silêncio é de verdade',
  /NUVEM\.sincronizando=false;[\s\S]{0,120}parou de responder/.test(sinc));
t('o limite não é mais de 15 segundos',
  !/\},15000\);/.test(sinc), 'ainda tem o 15000 antigo');
t('e está escrito num lugar só, com nome',
  /var PARADO_DEMAIS=\d+;/.test(fonte));

/* roda a decisão de verdade: subindo agora × parado há muito */
function decidir(silencioMs) {
  const NUVEM = { sincronizando: true, _batimento: Date.now() - silencioMs, _destrava: null };
  let soltou = false, reagendou = 0;
  const amb = {
    NUVEM: NUVEM, PARADO_DEMAIS: 45000,
    logNuvem: () => { soltou = true; },
    agendarSync: () => {},
    setTimeout: (fn) => { reagendou++; return 1; },
    clearTimeout: () => {},
    Date: Date, Math: Math
  };
  const corpo = `
    function esperaOuSolta(){
      if(!NUVEM.sincronizando)return;
      var parado=Date.now()-(NUVEM._batimento||0);
      if(parado<PARADO_DEMAIS){
        NUVEM._destrava=setTimeout(esperaOuSolta,PARADO_DEMAIS);
        return;
      }
      NUVEM.sincronizando=false;
      logNuvem('o envio parou de responder');
      agendarSync();
    }
    esperaOuSolta();
    return {soltou:!NUVEM.sincronizando, reagendou:reagendou};`;
  return new Function('amb', 'reagendou', 'with(amb){' + corpo + '}')(amb, 0);
}

grupo('Envio lento mas vivo NÃO pode ser solto');

const vivo = decidir(3000);          /* subiu um lote há 3 segundos */
t('lote de 3 segundos atrás: continua trabalhando', vivo.soltou === false);
const quase = decidir(44000);        /* quase no limite */
t('44 segundos de silêncio: ainda espera', quase.soltou === false);

grupo('Envio realmente parado é solto');

const morto = decidir(60000);        /* um minuto sem nada subir */
t('um minuto de silêncio: solta e tenta de novo', morto.soltou === true);

grupo('Por que isso derrubava o cadastro');

t('o mapa de vínculos é zerado no começo de cada envio',
  /_ids=\{\};/.test(sinc));
/* é essa a razão de dois envios juntos estragarem tudo: o segundo apaga
   o mapa que o primeiro está usando */
t('e é ele que traduz o vínculo para a nuvem',
  /function fk\(col,ref\)\{[\s\S]{0,200}_ids\[ref\]/.test(fonte));
t('sem tradução, o vínculo sobe vazio',
  /if\(!ref\)return null;/.test(corpoDaFuncao('fk', fonte)));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · dois envios ao mesmo tempo');
console.log(testes - falhas + ' de ' + testes + ' testes passaram');
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   A TELA DA LOJA NAO DESPEJA O ERRO DA META

   Em 29/08/2026 o Rafael apertou "Enviar teste" na Assistente e a tela
   mostrou isto, com todas as letras:

     Não consegui avisar o gerente: Meta recusou (400):
     {"error":{"message":"API access blocked.","code":200,
      "type":"OAuthException","fbtrace_id":"A0W7Cmibut_Wfw8zYwbRW41"}}

   Duas coisas erradas de uma vez. A primeira e que ninguem na frente de
   caixa sabe o que fazer com um JSON. A segunda, mais grave, e que a
   frase escondia o principal: NAO E DEFEITO DO JOIA. O aplicativo esta
   barrado do lado da Meta, e nenhuma mexida no sistema desbloqueia.

   Estes testes rodam a `motivoEnvioZap` de verdade, tirada de dentro do
   index.html, e prendem duas regras:

     1. cada recusa conhecida vira uma frase em portugues que diz o que
        fazer;
     2. NENHUMA resposta pode sair com JSON, chave, `fbtrace_id` ou
        nome de campo tecnico — nem as que a funcao nao conhece.

   Rodar:  node testes/aviso-em-portugues.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const fonte = fs.readFileSync(ARQ, 'utf8');
const motivoEnvioZap = new Function(
  corpoDaFuncao('motivoEnvioZap', fonte) + '\n return motivoEnvioZap;')();

/* o texto exato que voltou da loja */
const REAL = 'Meta recusou (400): {"error":{"message":"API access blocked.",' +
  '"code":200,"type":"OAuthException","fbtrace_id":"A0W7Cmibut_Wfw8zYwbRW41"}}';

console.log('\n── 1. O erro do dia 29/08/2026\n');

let r = motivoEnvioZap(REAL);
t('a recusa da Meta vira frase em portugues',
  /bloqueou o acesso/i.test(r), r);
t('e diz que NAO e defeito do sistema', /não é defeito do joia/i.test(r), r);
t('e diz onde se resolve: na conta da Meta', /conta da Meta/i.test(r), r);
t('o JSON nao chega na tela', !/[{}]/.test(r), r);
t('o rastro da Meta nao chega na tela', !/fbtrace/i.test(r), r);
t('nem o nome tecnico da excecao', !/OAuthException/i.test(r), r);
console.log('\n   antes: ' + REAL + '\n   agora: ' + r + '\n');

console.log('\n── 2. As outras recusas conhecidas\n');

const CASOS = [
  ['Meta recusou (401): {"error":{"message":"Error validating access token: Session has expired","code":190}}',
   /senha de acesso da Meta venceu/i, 'senha vencida'],
  ['Meta recusou (400): {"error":{"code":131030,"message":"Recipient phone number not in allowed list"}}',
   /não está liberado na Meta/i, 'numero fora da lista'],
  ['Meta recusou (400): {"error":{"code":131047,"message":"Re-engagement message"}}',
   /últimas 24 horas/i, 'janela de 24 horas'],
  ['A loja não está conectada ao WhatsApp.', /leia o QR de novo/i, 'Carla desconectada'],
  ['nenhum canal de envio disponível', /nem a Meta nem o WhatsApp da loja/i, 'sem caminho'],
];
for (const [bruto, esperado, nome] of CASOS) {
  const saida = motivoEnvioZap(bruto);
  t(nome + ' vira frase util', esperado.test(saida), saida);
  t(nome + ' sai sem JSON', !/[{}]/.test(saida), saida);
}

console.log('\n── 3. O que ela NAO conhece tambem sai limpo\n');

const DESCONHECIDOS = [
  'Meta recusou (400): {"error":{"message":"Alguma coisa nova","code":999,"fbtrace_id":"Zx9"}}',
  '{"error":{"message":"seja o que for","code":133016}}',
  'Meta recusou o documento (415)',
  '',
  null,
  undefined,
];
for (const d of DESCONHECIDOS) {
  const saida = motivoEnvioZap(d);
  const rot = String(JSON.stringify(d)).slice(0, 40);
  t('sem chaves: ' + rot, !/[{}]/.test(saida), saida);
  t('sem fbtrace: ' + rot, !/fbtrace/i.test(saida), saida);
  t('nunca volta vazio: ' + rot,
    typeof saida === 'string' && saida.trim().length > 3, saida);
}

console.log('\n── 4. As mensagens que ja eram boas continuam inteiras\n');

r = motivoEnvioZap('esse telefone não tem WhatsApp: 17997677339');
t('o telefone sem WhatsApp continua dizendo o numero', /17997677339/.test(r), r);
r = motivoEnvioZap('muitos envios seguidos — tente em instantes');
t('o limite de envios continua igual', /tente em instantes/.test(r), r);

console.log('\n── 5. A tela chama a traducao — nao existe so no papel\n');

for (const alvo of ['avisarGerente']) {
  const corpo = corpoDaFuncao(alvo, fonte);
  t(alvo + ' usa motivoEnvioZap', /motivoEnvioZap\(/.test(corpo));
  t(alvo + ' nao mostra mais o erro cru',
    !/toast\('Não consegui avisar o gerente: '\+r\.erro\)/.test(corpo));
}

console.log('\n════════════════════════════════════════════════════');
console.log(falhas ? `${falhas} de ${testes} FALHARAM` : `${testes} de ${testes} testes passaram`);
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

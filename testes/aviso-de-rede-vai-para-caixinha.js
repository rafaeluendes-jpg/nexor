/* ==========================================================
   AVISO DE REDE NÃO APARECE NA TELA — VAI PARA A CAIXINHA (03/10/2026)

   Rafael, com a foto do celular: "Internet de volta, mas a nuvem está
   desligada" em vermelho, com o rodapé dizendo "Nuvem ligada · tempo
   real". "Esses avisos não poderiam nem aparecer, ainda mais se for
   falso. Só geram confusão. Tudo para a caixinha de erros."

   Prende:
     · nenhum aviso de rede (caiu, voltou, nuvem, envio) aparece na tela;
     · problema de verdade vai para a Central de Erros, sem HTML;
     · "a internet caiu" não é erro: não vai para a caixinha;
     · a nuvem tem 30 s para religar antes de contar como problema;
     · a recusa de envio não vira aviso na tela com nome de tabela.

   Rodar:  node testes/aviso-de-rede-vai-para-caixinha.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — aviso de rede vai para a caixinha\n');

const caixinha = [];
let telas = 0;
const doc = { getElementById() { return null; }, createElement() { telas++; return { remove() {} }; }, body: { appendChild() { telas++; } } };
const avisoRede = new Function('document', 'reportarErro', 'sv', 'AVISO_REDE_NA_TELA',
  corpoDaFuncao('avisoRede', fonte) + '\nreturn avisoRede;')(doc, (tipo, onde, msg) => caixinha.push({ tipo, onde, msg }), () => '', false);

avisoRede('A internet caiu. <b>Pode continuar vendendo normalmente</b> — tudo fica guardado.', 'off');
avisoRede('Internet de volta. Enviando o que ficou para trás...', 'on', true);
avisoRede('Internet de volta, mas a nuvem está desligada. Entre em <b>Banco de dados</b> para enviar.', 'off');
avisoRede('A conexão voltou, mas <b>ainda ficou coisa para enviar</b>. Abra Administração &rsaquo; Sincronização.', 'off');
avisoRede('Pronto — tudo enviado. <b>Está tudo no sistema, normal.</b>', 'on');

t('nenhum aviso de rede aparece na tela', telas === 0, telas);
t('"a internet caiu" não é erro: não vai para a caixinha', !caixinha.some(c => /internet caiu/.test(c.msg)));
t('os avisos de "voltou" e "enviado" não vão para a caixinha', !caixinha.some(c => /Enviando|tudo enviado/.test(c.msg)));
t('a nuvem que não voltou e o que ficou para enviar vão para a caixinha',
  caixinha.length === 2 && caixinha.every(c => c.tipo === 'rede'), JSON.stringify(caixinha));
t('na caixinha o texto chega limpo, sem HTML', caixinha.every(c => !/[<>]|&rsaquo;/.test(c.msg)), JSON.stringify(caixinha));
t('a chave de volta para a tela existe e nasce desligada', /var AVISO_REDE_NA_TELA=false;/.test(fonte));

const volta = corpoDaFuncao('voltouARede', fonte);
t('a nuvem tem 30 s para religar antes de contar como problema',
  /for\(var _t=0;_t<30&&!NUVEM\.ligada;_t\+\+\)/.test(volta) &&
  volta.indexOf('_t<30') < volta.indexOf("a nuvem está desligada"));
t('a recusa de envio não vira aviso na tela com nome de tabela',
  !/toast\('Atenção: '\+faltou\+' registro\(s\) de '\+E2\.tab/.test(fonte));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

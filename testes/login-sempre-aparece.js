/* ==========================================================
   JOIA — O LOGIN APARECE SEMPRE

   O Rafael, 02/09/2026: "toda vez que vai entrar, quando fechou a página e
   clica de novo, ele já entra direto, não passa pelo login. Tem que seguir
   o processo: clicou, aparece o login, daí entra."

   Antes, com a sessão guardada ("Manter conectado"), o aparelho voltava
   DIRETO para dentro do sistema. Agora `restaurarSessaoGuardada` não entra
   mais sozinha — só traz o e-mail de volta ao campo. O login é sempre
   mostrado. Este teste lê a função e garante que ela nunca mais chame
   `abrirSessao()` para entrar sem passar pela tela.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const rg = corpoDaFuncao('restaurarSessaoGuardada', fonte);

t('a restauração não entra mais sozinha (não chama abrirSessao)',
  !/abrirSessao\(\)/.test(rg), rg.match(/abrirSessao\(\)/g));
t('ela descarta a sessão guardada antiga',
  /removeItem\('nexor_sessao'\)/.test(rg) &&
  /sessionStorage\.removeItem\('nexor_sessao'\)/.test(rg));
t('ela traz o e-mail de volta ao campo',
  /nexor_ultimo_email/.test(rg) && /lgU/.test(rg));
t('e garante que a tela de login continua visível',
  /getElementById\('login'\)/.test(rg) && /remove\('hide'\)/.test(rg) &&
  /getElementById\('app'\)/.test(rg) && /add\('hide'\)/.test(rg));

/* o próprio login não pode voltar a gravar uma sessão que entre sozinha */
const en = corpoDaFuncao('entrar', fonte);
t('o login não grava mais nexor_sessao para entrar sozinho',
  !/setItem\('nexor_sessao'/.test(en) && !/setItem\("nexor_sessao"/.test(en));
t('a caixa "Lembrar meu e-mail" ainda guarda só o e-mail',
  /nexor_ultimo_email/.test(en));

/* o texto da tela precisa ser honesto: não promete mais "manter conectado" */
const corpo = fonte.slice(0, fonte.indexOf('</body>') >= 0 ? fonte.indexOf('</body>') : fonte.length);
t('a caixa se chama "Lembrar meu e-mail", não "Manter conectado"',
  /Lembrar meu e-mail/.test(corpo) && !/Manter conectado<\/span>/.test(corpo));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

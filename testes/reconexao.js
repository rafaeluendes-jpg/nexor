/* ==========================================================
   A LOJA TEM DE VOLTAR SOZINHA — E, QUANDO NÃO DER, DIZER O QUE FAZER

   29/08/2026, 9h. Santa Fé do Sul abriu o dia sem conseguir conectar.
   No servidor: uma única recusa em /auth/v1/token e mais nada — nenhum
   pedido da loja a manhã inteira. Na tela: "Servidor não respondeu —
   reconectando sozinho", com o servidor no ar e nenhuma reconexão
   possível acontecendo.

   `religarNuvem()` fazia isto:

       var ses = await cli.auth.getSession();
       if (!ses) { estadoNuvem('offline'); return false; }

   Sem sessão, offline. O relógio de 8 segundos chamava de novo, e de
   novo, sempre com o mesmo vazio. Não havia nada para reconectar: o
   refresh token do Supabase é de uso único e roda a cada renovação; se
   o aparelho fecha no meio de um rodízio, ou se uma renovação leva
   recusa, a biblioteca joga a sessão fora e o aparelho fica sem
   credencial nenhuma.

   A trava é dupla:
   1. o sistema guarda a PRÓPRIA cópia da sessão, atualizada a cada
      rodízio, e a devolve para a biblioteca quando ela vem vazia;
   2. se nem a cópia valer, a sessão acabou de verdade — e a loja ouve
      isso, com o botão de entrar de novo, em vez de esperar por nada.

   Rodar:  node testes/reconexao.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* localStorage de mentira, igual ao do navegador no que importa */
function memoria() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; },
           _tudo: m };
}
function motor(loja) {
  const nomes = ['guardarSessao', 'sessaoGuardada', 'apagarSessaoGuardada', 'recuperarSessao'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  const logs = [];
  /* a chave vem do sistema, não é copiada aqui: se ela mudar lá, o teste
     acompanha em vez de continuar passando com o nome velho */
  const mChave = fonte.match(/var _CHAVE_SESSAO='([^']+)'/);
  if (!mChave) throw new Error('_CHAVE_SESSAO não encontrada no index.html');
  const f = new Function('ctx', `
    var localStorage=ctx.loja, _quieto=function(){}, logNuvem=function(m){ctx.logs.push(m)};
    var _CHAVE_SESSAO=${JSON.stringify(mChave[1])};
    ${codigo}
    return {${nomes.join(',')}};
  `)({ loja, logs });
  return { f, logs };
}

const SES = { access_token: 'tok1', refresh_token: 'ref1', expires_at: 111 };

console.log('\n── Sistema ' + versaoDoSistema() + ' — a cópia da sessão\n');

(async function () {
  let loja = memoria();
  let m = motor(loja);
  m.f.guardarSessao(SES);
  t('a sessão é guardada', !!m.f.sessaoGuardada());
  t('com o token de renovação, que é o que importa',
    m.f.sessaoGuardada().refresh_token === 'ref1');
  t('e NÃO na chave do "manter conectado"',
    loja.getItem('nexor_sessao') === null, Object.keys(loja._tudo).join(','));
  t('a chave é própria e diferente da do login',
    Object.keys(loja._tudo).length === 1 &&
    Object.keys(loja._tudo)[0] !== 'nexor_sessao',
    Object.keys(loja._tudo).join(','));

  m.f.apagarSessaoGuardada();
  t('sair apaga a cópia', m.f.sessaoGuardada() === null);

  m.f.guardarSessao({ access_token: 'x' });   /* sem refresh_token */
  t('sessão pela metade não é guardada', m.f.sessaoGuardada() === null);

  console.log('\n── A biblioteca veio vazia: o sistema devolve a cópia\n');

  loja = memoria(); m = motor(loja);
  m.f.guardarSessao(SES);
  let pediu = null;
  const cliBom = { auth: { setSession: async o => { pediu = o;
    return { data: { session: { access_token: 'tok2', refresh_token: 'ref2', expires_at: 222 } } }; } } };
  const volta = await m.f.recuperarSessao(cliBom);
  t('a sessão volta', !!volta && volta.access_token === 'tok2');
  t('devolvendo exatamente o token guardado', pediu && pediu.refresh_token === 'ref1');
  t('e a cópia é atualizada com a sessão nova',
    m.f.sessaoGuardada().refresh_token === 'ref2');
  t('e fica registrado no diagnóstico',
    m.logs.some(x => /recuperada/i.test(x)), m.logs.join(' | '));

  console.log('\n── A cópia também não vale mais: aí sim acabou\n');

  loja = memoria(); m = motor(loja);
  m.f.guardarSessao(SES);
  const cliRuim = { auth: { setSession: async () => ({ data: { session: null },
    error: new Error('Invalid Refresh Token') }) } };
  const nada = await m.f.recuperarSessao(cliRuim);
  t('não devolve sessão nenhuma', nada === null);
  t('e joga fora a cópia que não vale, para não insistir com ela',
    m.f.sessaoGuardada() === null);
  t('dizendo que é preciso entrar de novo',
    m.logs.some(x => /entrar de novo/i.test(x)), m.logs.join(' | '));

  loja = memoria(); m = motor(loja);
  t('sem cópia nenhuma, não quebra', (await m.f.recuperarSessao(cliBom)) === null);
  const cliVelho = { auth: {} };
  m.f.guardarSessao(SES);
  t('biblioteca sem setSession não quebra', (await m.f.recuperarSessao(cliVelho)) === null);

  console.log('\n── O que ficou preso no código\n');

  t('religar tenta recuperar antes de desistir',
    /ses=await recuperarSessao\(cli\)/.test(codigoNu));
  t('e só então declara que a sessão caiu',
    /if\(!ses\)\{[\s\S]{0,400}NUVEM\.sessaoCaiu=true;[\s\S]{0,120}avisoSessaoCaiu\(\)/.test(codigoNu));
  t('e o aviso nunca aparece na tela de login, para quem nem entrou',
    /if\(navigator\.onLine&&_dentro\)\{/.test(codigoNu));
  t('a cópia é atualizada a cada renovação automática',
    /NUVEM\.token=ses\.access_token;\s*guardarSessao\(ses\);/.test(codigoNu));
  t('entrar cria a cópia', /guardarSessao\(r\.data\.session\)/.test(codigoNu));
  t('sair apaga a cópia (pelos dois caminhos)',
    (codigoNu.match(/apagarSessaoGuardada\(\)/g) || []).length >= 3,
    (codigoNu.match(/apagarSessaoGuardada\(\)/g) || []).length);
  t('o aviso de sessão sai da tela ao voltar para o login',
    /'avisoNuvem','avisoTab','avisoSessao'/.test(codigoNu));
  t('o e-mail volta preenchido para quem precisa entrar de novo',
    /nexor_ultimo_email/.test(codigoNu));
  t('a senha NUNCA é guardada',
    !/localStorage\.setItem\([^)]*senha/i.test(codigoNu));

  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                             : '✓ ' + testes + ' testes passaram') + '\n');
  process.exit(falhas ? 1 : 0);
})();

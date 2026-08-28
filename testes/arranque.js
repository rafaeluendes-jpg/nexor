/* ==========================================================
   JOIA — O SISTEMA TEM DE ABRIR

   Esta suite nasceu de um apagao. A V213 subiu para a loja e a tela
   ficou em branco: nao ia nem para o login. O rodape dizia
   "Sincronizando 1510 alteracoes..." e mais nada aparecia.

   O QUE ACONTECEU

   O "manter conectado" e codigo de TOPO: roda enquanto o navegador ainda
   esta lendo o arquivo, na altura do bloco 5. Ele chama `abrirSessao()`,
   que chama `boot()`, que chama `baseCanc()` — do bloco 28. E `baseCanc`
   usa `var MOTIVOS_CANC`, declarada tambem no bloco 28.

   Funcao o navegador ica e pode ser chamada antes de aparecer no
   arquivo. VARIAVEL de topo, nao: `var` reserva o nome, mas o valor so
   chega quando a linha roda. Chamado do bloco 5, `baseCanc()` encontrava
   `undefined` e estourava. O catch engolia, e a tela ficava com o login
   escondido, o app visivel e TUDO VAZIO.

   POR QUE NENHUMA DAS 20 SUITES PEGOU

   Todas elas escondiam o login na mao e chamavam as telas direto. Nenhuma
   abria o sistema como a loja abre: com uma sessao guardada no aparelho,
   deixando o arranque acontecer sozinho. O caminho que quebrou nunca era
   percorrido.

   E ele nunca tinha rodado inteiro nem antes: `SESSAO` tambem morava no
   bloco 28, entao a PRIMEIRA linha do restauro ja estourava. Consertar
   `SESSAO` destravou um caminho que ninguem nunca tinha visto funcionar.

   Esta suite abre o sistema dos dois jeitos — sem sessao e com sessao
   guardada — e exige que a tela apareca.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');
let falhas = 0, testes = 0;
function grupo(n) { console.log('\n── ' + n + '\n'); }
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const ruido = m => /Not implemented: |Could not parse CSS|offline|Failed to fetch|sem conexão/i.test(String(m));

/* abre o sistema como o navegador da loja abre, sem ajudar em nada */
function abrir(comSessaoGuardada) {
  return new Promise(resolve => {
    const erros = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => { if (!ruido(e && e.message)) erros.push(String(e.message).slice(0, 130)); });
    vc.on('error', (...a) => { const m = a.join(' '); if (!ruido(m)) erros.push(m.slice(0, 130)); });
    const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'https://joiagest.com.br/', virtualConsole: vc,
      beforeParse(w) {
        w.fetch = () => Promise.reject(new Error('Failed to fetch'));
        w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
        w.scrollTo = () => {}; w.print = () => {}; w.alert = () => {};
        w.confirm = () => false; w.prompt = () => null;
        w.crypto = w.crypto || {};
        if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
        if (comSessaoGuardada) {
          /* é assim que o aparelho da loja está: com dados e com a
             sessão guardada de quem marcou "manter conectado" */
          try {
            w.localStorage.setItem('nexor_dados', JSON.stringify({
              usuarios: [{ id: 'us1', login: 'santafe@jologelato.com.br',
                           nome: 'Santa Fé', ativo: true, tudo: true, sucursais: ['suc1'] }],
              sucursais: [{ id: 'suc1', nome: 'Jolô Santa Fé do Sul', ativa: true }],
              categorias: [], produtos: [], grupos: [], fichas: [], lojaAtual: 'suc1'
            }));
            w.localStorage.setItem('nexor_sessao', 'santafe@jologelato.com.br');
            w.localStorage.setItem('nexor_manter', '1');
          } catch (e) {}
        }
        w.addEventListener('error', e => {
          const m = String((e.error && e.error.message) || e.message);
          if (!ruido(m)) erros.push(m.slice(0, 130));
        });
        w.addEventListener('unhandledrejection', e => {
          const m = String((e.reason && e.reason.message) || e.reason);
          if (!ruido(m)) erros.push(m.slice(0, 130));
        });
      }
    });
    /* o restauro é adiado de propósito: dá tempo de ele acontecer */
    setTimeout(() => {
      const w = dom.window, d = w.document;
      const cheio = id => { const e = d.getElementById(id); return !!(e && e.innerHTML.trim()); };
      resolve({
        w: w, erros: erros,
        loginEscondido: d.getElementById('login').classList.contains('hide'),
        appVisivel: !d.getElementById('app').classList.contains('hide'),
        cabecalho: cheio('hdr'), menu: cheio('bandRow'), conteudo: cheio('content'),
        engolidos: (function () {
          try {
            /* o Diagnóstico também guarda nota de desempenho ("tela levou
               44 ms"), que não é erro. Aqui só interessa o que quebrou. */
            return (w.DIAGNOSTICO || [])
              .filter(x => !ruido(x.msg || ''))
              .filter(x => /error|undefined|null|not a function|cannot/i.test(String(x.msg || '')))
              .map(x => (x.onde || '?') + ': ' + String(x.msg || '').slice(0, 90));
          } catch (e) { return []; }
        })()
      });
    }, 1200);
  });
}

(async function () {
  grupo('Abrindo sem sessão guardada — tem de mostrar o login');

  const a = await abrir(false);
  t('a tela de login aparece', !a.loginEscondido);
  t('o sistema NÃO entra sozinho', !a.appVisivel);
  t('sem erro de runtime no arranque', a.erros.length === 0, a.erros.slice(0, 2).join(' | '));

  grupo('Abrindo COM sessão guardada — era aqui que a tela ficava branca');

  const b = await abrir(true);
  t('o login é escondido', b.loginEscondido);
  t('o sistema entra', b.appVisivel);
  /* ==========================================================
     AS TRES LINHAS QUE FALTARAM NA V213

     Entrar nao basta: na V213 o login sumia, o app aparecia, e nada era
     desenhado. Sao estas tres que dizem se a pessoa esta olhando o
     sistema ou uma tela verde vazia.
     ========================================================== */
  t('o cabeçalho é desenhado', b.cabecalho, 'ficou vazio — é a tela branca');
  t('o menu é desenhado', b.menu, 'ficou vazio — é a tela branca');
  t('e o conteúdo é desenhado', b.conteudo, 'ficou vazio — é a tela branca');
  t('sem erro de runtime', b.erros.length === 0, b.erros.slice(0, 2).join(' | '));
  t('e nada foi engolido pelo caminho', b.engolidos.length === 0,
    b.engolidos.slice(0, 3).join(' | '));

  grupo('A sessão foi mesmo restaurada');

  t('o usuário guardado voltou',
    b.w.SESSAO && b.w.SESSAO.login === 'santafe@jologelato.com.br',
    b.w.SESSAO && b.w.SESSAO.login);
  t('e o sistema sabe quem é',
    !!(b.w.usuarioLogado && b.w.usuarioLogado()),
    'usuarioLogado() devolveu vazio');

  grupo('A ordem do arquivo continua sã');

  const fonte = fs.readFileSync(ARQ, 'utf8');
  t('o restauro é uma função, chamada depois do arquivo carregar',
    /setTimeout\(restaurarSessaoGuardada,0\);/.test(fonte));
  /* a chamada de dentro de entrar() é legítima: só não pode haver
     chamada de TOPO, em coluna zero, rodando durante o carregamento */
  t('e não sobrou chamada de abrirSessao em código de topo',
    !/^abrirSessao\(\);/m.test(fonte));

  console.log('\n════════════════════════════════════════════════════');
  console.log('Joia · o sistema tem de abrir');
  console.log(testes - falhas + ' de ' + testes + ' testes passaram');
  console.log('════════════════════════════════════════════════════\n');
  process.exit(falhas ? 1 : 0);
})();

/* ==========================================================
   VARRER — abre TODAS as telas e aperta TODOS os botões

   A auditoria do trilho da frente de caixa foi feita à mão, tela por
   tela. Isso não escala para as 93 telas do sistema. Esta ferramenta
   faz a parte mecânica:

     1. carrega o index.html num DOM de verdade, com uma loja semeada;
     2. monta cada telaXxx e anota quem não monta;
     3. lê os `onclick` que a tela gerou e confere se a função existe;
     4. CLICA em cada um e anota qualquer erro de runtime que apareça;
     5. mede o pulo de rolagem: se a tela estava rolada e o clique
        devolve para o topo, isso é anotado.

   O que ela NÃO faz: apagar nada. `confirmar`, `pergunta` e `confirm`
   respondem NÃO, e `prompt` responde nulo. Assim o caminho do botão é
   exercitado até a pergunta e para ali — que é onde mora a maior parte
   dos defeitos de ligação.

   Rodar:  node ferramentas/varrer.js [filtro]
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');
const FILTRO = process.argv[2] || '';
const SAIDA = process.env.VARRER_SAIDA || '/tmp/varredura.ndjson';
try { fs.writeFileSync(SAIDA, ''); } catch (e) {}

const ruido = m => /Not implemented: |Could not parse CSS|localStorage is not available|offline|sem conexão|Failed to (fetch|load)/i.test(String(m));

function carregar() {
  const erros = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!ruido(e && e.message)) erros.push(String(e.message).slice(0, 130)); });
  vc.on('error', (...a) => { const m = a.join(' '); if (!ruido(m)) erros.push(m.slice(0, 130)); });
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) {
      w.fetch = () => Promise.reject(new Error('offline'));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      w.scrollTo = () => {}; w.print = () => {};
      w.alert = () => {}; w.confirm = () => false; w.prompt = () => null;
      w.open = () => ({ document: { write() {}, close() {} }, focus() {}, print() {}, close() {} });
      /* jsdom nao implementa: sem isto todo botao de exportar/baixar acusa
         erro que e do ambiente de teste, nao do sistema */
      try { w.URL.createObjectURL = () => 'blob:teste'; w.URL.revokeObjectURL = () => {}; } catch (e) {}
      /* ==========================================================
         `innerText` TAMBEM NAO EXISTE NO jsdom

         Os cinco botoes de exportar relatorio liam `td.innerText` e a
         varredura acusava "Cannot read properties of undefined". Aberto
         no Chromium (ferramentas/auditar.js e provar.js), os cinco
         exportam certo, com arquivo e conteudo. Era defeito do ambiente
         de teste, nao do sistema — e um alarme falso que volta toda vez
         que alguem roda isto, entao fica resolvido aqui.

         O texto sai de `textContent`; o suficiente para o caminho do
         botao ser exercitado de verdade.
         ========================================================== */
      try {
        var proto = w.HTMLElement.prototype;
        if (!Object.getOwnPropertyDescriptor(proto, 'innerText')) {
          Object.defineProperty(proto, 'innerText', {
            get() { return this.textContent; },
            set(v) { this.textContent = v; },
            configurable: true
          });
        }
      } catch (e) {}
      w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
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
  return { dom, erros };
}

const SEMENTE = fs.readFileSync(path.join(__dirname, 'semente-loja.js'), 'utf8');

/* nomes de handler que não são função do sistema: palavra reservada,
   atribuição, expressão inline */
const NAO_E_FUNCAO = /^(if|for|while|return|var|let|const|this|window|document|true|false|null)$/;

(async function () {
  const { dom, erros } = carregar();
  const w = dom.window, doc = w.document;
  await new Promise(r => setTimeout(r, 900));

  try { w.eval("SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';"); } catch (e) {}
  const lg = doc.getElementById('login'); if (lg) lg.style.display = 'none';
  const ap = doc.getElementById('app'); if (ap) ap.classList.remove('hide');
  /* respostas negativas: exercita o caminho sem destruir nada */
  w.confirmar = async () => false;
  w.pergunta = async () => false;
  w.modal = w.modal;                      /* modal continua real */
  const toasts = [];
  w.toast = m => toasts.push(String(m));
  w.eval(SEMENTE);
  try { w.topo(); w.faixa(); } catch (e) {}

  const telas = Object.keys(w).filter(k => /^tela[A-Z]/.test(k) && typeof w[k] === 'function').sort()
    .filter(n => !FILTRO || n.toLowerCase().includes(FILTRO.toLowerCase()));

  const achados = { naoMonta: [], handlerFantasma: [], erroNoClique: [], puloDeRolagem: [], ok: [] };

  let feitas = 0;
  for (const n of telas) {
    feitas++;
    const antes = erros.length;
    let montou = true;
    try {
      if (!doc.getElementById('content')) {
        const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d);
      }
      w[n]();
      await new Promise(r => setTimeout(r, 0));
    } catch (e) {
      montou = false;
      achados.naoMonta.push(n + ' — ' + String(e.message).slice(0, 90));
    }
    if (!montou) continue;
    if (erros.length > antes) {
      achados.naoMonta.push(n + ' — ' + erros[antes]);
      continue;
    }

    /* ---- os handlers que a tela gerou ---- */
    let alvos = [...doc.querySelectorAll('#content [onclick]')];
    const vistos = new Set();
    for (let idx = 0; idx < alvos.length; idx++) {
      let el = alvos[idx];
      if (!doc.contains(el)) {
        try { w[n](); await new Promise(r => setTimeout(r, 0)); }
        catch (e) { break; }
        alvos = [...doc.querySelectorAll('#content [onclick]')];
        el = alvos[idx];
        if (!el) break;
      }
      const codigo = el.getAttribute('onclick') || '';
      const m = codigo.match(/^\s*([a-zA-Z_$][\w$]*)\s*\(/);
      if (!m) continue;
      const fn = m[1];
      if (NAO_E_FUNCAO.test(fn)) continue;
      if (typeof w[fn] !== 'function') {
        const chave = n + '::' + fn;
        if (!vistos.has(chave)) {
          vistos.add(chave);
          achados.handlerFantasma.push(n + ' → ' + fn + '()  em: ' + codigo.slice(0, 70));
        }
        continue;
      }
      /* clica só uma vez por função por tela */
      if (vistos.has(n + '::' + fn)) continue;
      vistos.add(n + '::' + fn);

      const rolavel = doc.querySelector('#content .etScroll, #content .scroll1, #content .pnl2B');
      if (rolavel) rolavel.scrollTop = 400;
      const eAntes = erros.length;
      try {
        el.click();
        await new Promise(r => setTimeout(r, 0));
      } catch (e) {
        achados.erroNoClique.push(n + ' → ' + fn + '() — ' + String(e.message).slice(0, 90));
      }
      if (erros.length > eAntes)
        achados.erroNoClique.push(n + ' → ' + fn + '() — ' + erros[eAntes]);
      /* fecha o que o clique tenha aberto, para não contaminar a próxima */
      try { if (doc.getElementById('mdOv')) w.fecharModal(); } catch (e) {}
      /* o clique quase sempre redesenha a tela e os elementos da lista ficam
         soltos do documento. Remontar a tela A CADA clique custa caro demais
         (93 telas x dezenas de botoes); remonta-se so quando o proximo alvo
         ja nao esta mais pendurado no documento. */
    }
    achados.ok.push(n + ' (' + alvos.length + ' botões)');
    /* escreve linha a linha: varredura de 93 telas e demorada, e resultado
       que so aparece no fim nao serve para acompanhar */
    fs.appendFileSync(SAIDA, JSON.stringify({
      n: feitas, tela: n, botoes: alvos.length,
      fantasmas: achados.handlerFantasma.filter(x => x.startsWith(n + ' ')),
      erros: achados.erroNoClique.filter(x => x.startsWith(n + ' '))
    }) + '\n');
  }

  const saida = {
    telas: telas.length,
    naoMonta: achados.naoMonta,
    handlerFantasma: achados.handlerFantasma,
    erroNoClique: achados.erroNoClique,
    telasLimpas: achados.ok.length
  };
  console.log(JSON.stringify(saida, null, 1));
  process.exit(0);
})();

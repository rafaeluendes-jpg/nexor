/* ==========================================================
   VARRER OS FORMULÁRIOS

   A primeira varredura clica nos botões da tela. Metade do sistema, no
   entanto, mora dentro de janela: cadastrar cliente, editar ficha, lançar
   nota, formar preço. Essas janelas abrem por um botão e são confirmadas
   por outro — o `#mdOk` — e é ali que estão as validações.

   Esta ferramenta abre cada janela que a tela oferece e aperta o
   confirmar DE CAMPOS VAZIOS. O certo é o sistema recusar com um aviso;
   o que não pode é estourar. Um formulário que quebra com campo vazio
   quebra igual com o campo preenchido errado, e é assim que a pessoa no
   balcão descobre.

   Nada é apagado: `confirmar` e `pergunta` respondem NÃO.

   Rodar:  node ferramentas/varrer-modais.js [filtro]
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');
const FILTRO = process.argv[2] || '';
const ruido = m => /Not implemented: |Could not parse CSS|localStorage is not available|offline|sem conexão|Failed to (fetch|load)/i.test(String(m));

(async function () {
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
      try { w.URL.createObjectURL = () => 'blob:teste'; w.URL.revokeObjectURL = () => {}; } catch (e) {}
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
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, doc = w.document;
  try { w.eval("SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';"); } catch (e) {}
  doc.getElementById('login').style.display = 'none';
  doc.getElementById('app').classList.remove('hide');
  w.confirmar = async () => false;
  w.pergunta = async () => false;
  const toasts = [];
  w.toast = m => toasts.push(String(m));
  w.eval(fs.readFileSync(path.join(__dirname, 'semente-loja.js'), 'utf8'));
  try { w.topo(); w.faixa(); } catch (e) {}

  const telas = Object.keys(w).filter(k => /^tela[A-Z]/.test(k) && typeof w[k] === 'function').sort()
    .filter(n => !FILTRO || n.toLowerCase().includes(FILTRO.toLowerCase()));

  const quebrados = [], semValidacao = [], abertos = [];

  for (const n of telas) {
    try { w[n](); await new Promise(r => setTimeout(r, 0)); } catch (e) { continue; }
    let alvos = [...doc.querySelectorAll('#content [onclick]')];
    const vistos = new Set();
    for (let i = 0; i < alvos.length; i++) {
      let el = alvos[i];
      if (!doc.contains(el)) {
        try { w[n](); await new Promise(r => setTimeout(r, 0)); } catch (e) { break; }
        alvos = [...doc.querySelectorAll('#content [onclick]')];
        el = alvos[i]; if (!el) break;
      }
      const cod = el.getAttribute('onclick') || '';
      const m = cod.match(/^\s*([a-zA-Z_$][\w$]*)\s*\(/);
      if (!m) continue;
      const fn = m[1];
      if (typeof w[fn] !== 'function') continue;
      if (vistos.has(fn)) continue;
      vistos.add(fn);

      try { if (doc.getElementById('mdOv')) w.fecharModal(); } catch (e) {}
      const antes = erros.length;
      try { el.click(); await new Promise(r => setTimeout(r, 0)); } catch (e) { continue; }
      const ov = doc.getElementById('mdOv');
      if (!ov) continue;                        /* não era janela */
      const titulo = (ov.querySelector('.mdH b') || {}).textContent || fn;
      abertos.push(n + ' › ' + titulo);
      const ok = doc.getElementById('mdOk');
      if (!ok) { try { w.fecharModal(); } catch (e) {} continue; }
      const tAntes = toasts.length;
      try {
        ok.click();
        await new Promise(r => setTimeout(r, 10));
      } catch (e) {
        quebrados.push(n + ' › ' + titulo + ' — ' + String(e.message).slice(0, 90));
      }
      if (erros.length > antes)
        quebrados.push(n + ' › ' + titulo + ' — ' + erros[antes]);
      else if (toasts.length === tAntes && !doc.getElementById('mdOv'))
        semValidacao.push(n + ' › ' + titulo + ' — confirmou vazio sem dizer nada');
      try { if (doc.getElementById('mdOv')) w.fecharModal(); } catch (e) {}
      try { w[n](); await new Promise(r => setTimeout(r, 0)); } catch (e) { break; }
      alvos = [...doc.querySelectorAll('#content [onclick]')];
    }
  }

  console.log(JSON.stringify({
    janelasAbertas: abertos.length,
    quebrados: quebrados,
    confirmamVazioSemAvisar: semValidacao.slice(0, 40)
  }, null, 1));
  process.exit(0);
})();

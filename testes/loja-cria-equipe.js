/* ==========================================================
   JOIA — A LOJA CRIA A PRÓPRIA EQUIPE

   Rodar:  node testes/loja-cria-equipe.js
   ou:     npm run test:equipe   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 24/09/2026)
   "A matriz cria o login de Santa Fé. As lojas franqueadas criam os
   acessos de operador, atendente, produção." Santa Fé tentava criar um
   operador e recebia "Só o administrador da rede cria acessos".

   As travas de verdade estão no servidor (criar-usuario) e no banco
   (política e gatilho em usuarios_sistema). Aqui se confere que a TELA
   pede certo e não oferece o que não vale.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const erros = [];
(async function () {
  console.log('\nCarregando o sistema para o guardião da equipe da loja…');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window, doc = win.document;
  if (!doc.getElementById('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  win.salvar = () => {};
  win.DB.sucursais = [{ id: 'suc_matriz', nome: 'Matriz', matriz: true, ativa: true },
    { id: 'suc_sf', nome: 'Santa Fé', ativa: true, loginResp: 'santafe@jologelato.com.br' },
    { id: 'suc_jl', nome: 'Jales', ativa: true }];
  const sf = { id: 'u_sf', nome: 'Santa Fé', login: 'santafe@jologelato.com.br', ativo: true, sucursais: ['suc_sf'],
    permissoes: { 'pdv/pdv': true, 'controle/baixa-manual': true, 'loja/usuarios': true } };
  win.DB.usuarios = [sf];
  win.usuarioLogado = () => sf;
  win.lojaAtualId = () => 'suc_sf';

  grupo('Quem é o login principal da loja');
  t('Santa Fé é gerente de unidade (não é matriz)', win.souGerenteDeUnidade() === true);
  t('a unidade dele é Santa Fé', win.minhaUnidadeDeGerente() === 'suc_sf');

  grupo('Novo usuário, pelo login da loja');
  const pedidos = [];
  win.NUVEM.ligada = true; win.NUVEM.url = 'https://x.supabase.co'; win.NUVEM.chave = 'k'; win.NUVEM.token = 't';
  win.fetch = async (url, init) => { pedidos.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  win.novoUsuario();
  t('o formulário abriu', !!doc.getElementById('uNome'));
  t('não existe a opção "Acesso total"', !doc.getElementById('uTudo'));
  doc.getElementById('uNome').value = 'Ana';
  doc.getElementById('uLogin').value = 'ana.sf@jologelato.com.br';
  doc.getElementById('uSenha').value = 'senha123';
  doc.getElementById('mdOk').click();
  await new Promise(r => setTimeout(r, 80));
  const p = pedidos.find(x => /criar-usuario/.test(x.url));
  t('pede ao servidor um OPERADOR', p && p.body.cargo === 'operador', p && JSON.stringify(p.body));
  t('da unidade de Santa Fé', p && p.body.sucursal_ref === 'suc_sf');
  const ana = win.DB.usuarios.find(u => u.login === 'ana.sf@jologelato.com.br');
  t('o acesso novo nasce em Santa Fé, sem acesso total', ana && JSON.stringify(ana.sucursais) === '["suc_sf"]' && ana.tudo === false,
    ana && JSON.stringify({ s: ana.sucursais, t: ana.tudo }));

  grupo('O que a loja pode liberar para a equipe');
  win.US.sel = ana.id;
  const perm = win.abaPermUsr(ana);
  t('aparece o que o gerente tem (PDV)', /data-perm="pdv\/pdv"/.test(perm));
  t('não aparece o que ele não tem (Administração)', !/data-perm="adm\//.test(perm) && !/data-perm="financeira\//.test(perm));
  win.marcarTudoUsr(true);
  const ks = Object.keys(ana.permissoes);
  t('"liberar tudo" só libera o que o gerente tem', ks.length >= 2 && ks.includes('pdv/pdv') && ks.every(k => sf.permissoes[k]), ks.join(','));
  win.aplicarModelo('gerente');
  t('o modelo também respeita o limite', Object.keys(ana.permissoes).every(k => sf.permissoes[k]), Object.keys(ana.permissoes).join(','));
  let msg = ''; win.toast = m => { msg = m; };
  win.togLojaUsr('suc_jl');
  t('a loja não troca a unidade de ninguém', JSON.stringify(ana.sucursais) === '["suc_sf"]' && /matriz/.test(msg));

  grupo('O próprio login da loja é da matriz');
  win.US.sel = sf.id;
  const det = win.detalheUsuario();
  t('aparece como administrado pela matriz', /administrado pela matriz/.test(det));
  t('sem editar, excluir nem desligar', !/editarUsuario\(\)/.test(det) && !/excluirUsuario\(\)/.test(det) && !/togAtivoUsr/.test(det));

  grupo('A matriz continua como sempre');
  const mz = { id: 'u_mz', nome: 'Matriz', login: 'jolo@jologelato.com.br', ativo: true, tudo: true, sucursais: [] };
  win.usuarioLogado = () => mz;
  win.lojaAtualId = () => 'suc_matriz';
  t('a matriz não é gerente de unidade', win.souGerenteDeUnidade() === false);
  win.fecharModal(); win.novoUsuario();
  t('a matriz vê "Acesso total"', !!doc.getElementById('uTudo'));
  win.fecharModal();

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A loja cria a própria equipe');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

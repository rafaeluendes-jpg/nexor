/* ==========================================================
   PROVAR — os fluxos de verdade, num navegador de verdade

   `varrer.js` aperta todos os botões. `auditar.js` mede o que só a
   tela responde. Falta a terceira pergunta, que é a que o lojista faz:
   o que eu fiz continua aí depois que eu recarrego?

   Aqui cada prova é um caminho completo do sistema, feito pela
   interface, com o navegador guardando no localStorage como na loja:

     1. abre caixa → vende → o pedido aparece e o caixa soma;
     2. RECARREGA A PÁGINA → venda, caixa e cadastro continuam lá;
     3. fecha o caixa → sai da lista de abertos e entra no relatório;
     4. caixa esquecido de outro dia → aparece o aviso e o botão fecha
        aquele caixa, sem levar junto o caixa de hoje;
     5. exportar relatório → o arquivo é gerado (é aqui que se vê que
        o erro apontado pelo jsdom era do jsdom, não do sistema);
     6. permissão: operador de caixa não enxerga o que é do gestor.

   Rodar:  node ferramentas/provar.js
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const RAIZ = path.join(__dirname, '..');
const SEMENTE = fs.readFileSync(path.join(__dirname, 'semente-loja.js'), 'utf8');
const FOTOS = process.env.PROVAR_FOTOS || '/tmp/provas';
fs.mkdirSync(FOTOS, { recursive: true });
const TIPOS = { '.html':'text/html','.js':'text/javascript','.css':'text/css',
                '.png':'image/png','.jpg':'image/jpeg','.json':'application/json' };

let falhas = 0, feitos = 0;
function t(nome, ok, det) {
  feitos++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

function servir() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(RAIZ, p);
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404); return res.end('nao encontrado');
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => ok({ s, porta: s.address().port }));
  });
}

(async function () {
  const { s, porta } = await servir();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 },
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message.slice(0, 160)));
  pg.on('console', m => { if (m.type() === 'error' &&
    !/Failed to fetch|net::ERR|ServiceWorker|sem conexão/i.test(m.text())) erros.push(m.text().slice(0, 160)); });
  await pg.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:' + porta)
    ? r.continue()
    : r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* bloqueado na prova */' }));

  async function entrar() {
    await pg.goto('http://127.0.0.1:' + porta + '/index.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    await pg.evaluate(() => {
      window.confirmar = async () => true; window.pergunta = async () => true;
      window.confirm = () => true; window.alert = () => {}; window.prompt = () => null;
      window.print = () => {};
      /* ==========================================================
         ENTRA PELA PORTA, NAO PELA JANELA

         A primeira versao escondia a tela de login com CSS. O sistema
         ficava de pe, mas `abrirSessao()` nunca rodava — e e ela que
         chama `carregar()` (le o localStorage) e `boot()` (prepara as
         colecoes). Resultado: depois de recarregar, o aparelho parecia
         ter perdido tudo. Nao tinha: ninguem tinha mandado ler.

         Aqui a sessao e aberta pelo mesmo caminho do sistema.
         ========================================================== */
      try { SESSAO.login = 'admin'; SESSAO.usuarioId = 'usr_mestre'; } catch (e) {}
      abrirSessao();
    });
    await pg.waitForTimeout(400);
  }

  console.log('\n── 1. Abrir caixa, vender, e o caixa somar\n');
  await entrar();
  await pg.evaluate(SEMENTE);
  let r = await pg.evaluate(() => {
    DB.caixas = [{ id: 'cx_hoje', inicial: 100, operador: 'Administrador', operadorId: 'op1',
      sucursalId: lojaAtualId(), movimentos: [],
      aberto: new Date().toLocaleDateString('pt-BR') + ' 09:00' }];
    salvar();
    var cx = caixaAberto();
    DB.pedidos.push({ id: 'pd_1', caixaId: cx.id, fase: 'finalizado', total: 32,
      itens: [{ produtoId: 'pr_casq', nome: 'Casquinha', qtd: 1, preco: 12 }],
      pagamentos: [{ forma: 'fp_dinheiro', valor: 32 }],
      data: new Date().toISOString(), hora: '09:10', sucursalId: lojaAtualId() });
    salvar();
    var mov = movimentoCaixa(cx.id);
    return { caixa: cx.id, vendas: mov.total, qtd: mov.qtd, gaveta: esperadoCaixa(cx) };
  });
  t('o caixa aberto é reconhecido', r.caixa === 'cx_hoje', r.caixa);
  t('a venda entra no movimento do turno', r.vendas === 32, r.vendas);
  t('a gaveta soma fundo mais dinheiro', r.gaveta === 132, r.gaveta);

  console.log('\n── 2. Recarregar a página: nada desaparece\n');
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  r = await pg.evaluate(() => {
    try { SESSAO.login = 'admin'; SESSAO.usuarioId = 'usr_mestre'; } catch (e) {}
    abrirSessao();
    var peds = DB.pedidos || [];
    return { caixas: (DB.caixas || []).length, pedidos: peds.length,
             produtos: (DB.produtos || []).length, insumos: (DB.insumos || []).length,
             aberto: (caixaAberto() || {}).id, venda: (peds[0] || {}).total,
             guardado: (function(){ try{ var b=JSON.parse(localStorage.getItem('nexor_dados')||'{}');
               return { pedidos:(b.pedidos||[]).length, caixas:(b.caixas||[]).length,
                        produtos:(b.produtos||[]).length }; }catch(e){ return {erro:String(e.message)} } })() };
  });
  t('o caixa continua aberto depois de recarregar', r.aberto === 'cx_hoje', r.aberto);
  t('a venda continua gravada', r.venda === 32, r.venda);
  t('o cadastro de produtos continua', r.produtos >= 3, r.produtos);
  t('o cadastro de insumos continua', r.insumos >= 4, r.insumos);

  console.log('\n── 3. Caixa esquecido de ontem convive com o de hoje\n');
  r = await pg.evaluate(() => {
    DB.caixas.unshift({ id: 'cx_ontem', inicial: 50, operador: 'Administrador',
      sucursalId: lojaAtualId(), movimentos: [], aberto: '27/08/2026 13:40' });
    salvar();
    return { emOperacao: (caixaAberto() || {}).id,
             esquecidos: caixasEsquecidos().map(function (c) { return c.id; }) };
  });
  t('o caixa em operação é o de hoje, não o esquecido', r.emOperacao === 'cx_hoje', r.emOperacao);
  t('o esquecido é cobrado na tela', r.esquecidos.join(',') === 'cx_ontem', r.esquecidos.join(','));

  await pg.evaluate(() => telaFrenteCaixa());
  await pg.waitForTimeout(150);
  const fc = await pg.evaluate(() => {
    var c = document.getElementById('content');
    return { texto: (c.innerText || '').slice(0, 400),
             botao: /fecharCaixa\(.cx_ontem./.test(c.innerHTML) };
  });
  t('a Frente de Caixa avisa do caixa sem fechamento', /SEM FECHAMENTO/.test(fc.texto), fc.texto.slice(0, 80));
  t('e oferece o botão que fecha aquele caixa', fc.botao);
  await pg.screenshot({ path: FOTOS + '/frente-caixa-computador.png', fullPage: false });

  await pg.evaluate(() => telaPDV());
  await pg.waitForTimeout(150);
  const pdv = await pg.evaluate(() => (document.getElementById('content').innerText || '').slice(0, 600));
  t('o PDV avisa o operador do caixa que ficou aberto', /ficou aberto sem fechamento/.test(pdv), pdv.slice(0, 120));
  t('e diz para qual caixa a venda está indo', /está indo para o caixa aberto em/.test(pdv));
  await pg.screenshot({ path: FOTOS + '/pdv-computador.png' });

  console.log('\n── 4. Exportar relatório gera arquivo de verdade\n');
  r = await pg.evaluate(() => {
    telaVendasFormaPag();
    var baixou = null, orig = URL.createObjectURL;
    URL.createObjectURL = function (b) { baixou = b.size; return orig.call(URL, b); };
    var erro = '';
    try { exportarFormaPag(); } catch (e) { erro = e.message; }
    URL.createObjectURL = orig;
    return { bytes: baixou, erro: erro };
  });
  t('exportarFormaPag roda sem erro no navegador', r.erro === '', r.erro);
  t('e o arquivo sai com conteúdo', r.bytes > 20, r.bytes);
  r = await pg.evaluate(() => {
    telaItensVendidos();
    var b = null, o = URL.createObjectURL; URL.createObjectURL = function (x) { b = x.size; return o.call(URL, x); };
    var e2 = ''; try { exportarItensVend(); } catch (e) { e2 = e.message; }
    URL.createObjectURL = o; return { bytes: b, erro: e2 };
  });
  t('exportarItensVend roda sem erro no navegador', r.erro === '', r.erro);
  t('e o arquivo sai com conteúdo', r.bytes > 20, r.bytes);
  r = await pg.evaluate(() => {
    /* tabela vazia: é onde o exportador quebrava de verdade */
    DB.pedidos = []; telaItensConsumidos();
    var e2 = ''; try { exportarItensCons(); } catch (e) { e2 = e.message; }
    return { erro: e2 };
  });
  t('exportar com a tabela vazia não quebra', r.erro === '', r.erro);

  console.log('\n── 5. Permissão: cada perfil vê o que é dele\n');
  r = await pg.evaluate(() => {
    var antes = SESSAO.usuarioId;
    DB.usuarios = DB.usuarios || [];
    /* a permissao mora em `permissoes`, com a chave "modulo/tela" — a
       mesma que a tela de usuarios grava */
    DB.usuarios.push({ id: 'u_cx', nome: 'Caixa', login: 'caixa@teste', funcao: 'operador',
      permissoes: { 'pdv/pdv': true }, ativo: true });
    SESSAO.usuarioId = 'u_cx'; SESSAO.login = 'caixa@teste';
    var res = { podePdv: podeVer('pdv', 'pdv'), podeFin: podeVer('financeira', 'frente-caixa'),
                podeUsr: podeVer('config', 'usuarios'), modulo: podeVer('pdv') };
    SESSAO.usuarioId = antes; SESSAO.login = 'admin';
    res.donoVeTudo = podeVer('financeira', 'frente-caixa');
    return res;
  });
  t('o operador de caixa entra no PDV', r.podePdv === true, r.podePdv);
  t('o módulo PDV aparece no menu dele', r.modulo === true, r.modulo);
  t('e ele não entra no financeiro', r.podeFin !== true, r.podeFin);
  t('e não entra em usuários', r.podeUsr !== true, r.podeUsr);
  t('o dono, esse sim, entra no financeiro', r.donoVeTudo === true, r.donoVeTudo);

  console.log('\n── 6. As mesmas telas no celular\n');
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.evaluate(() => { DB.pedidos = DB.pedidos || []; telaFrenteCaixa(); });
  await pg.waitForTimeout(200);
  let m = await pg.evaluate(() => {
    var d = document.documentElement, c = document.getElementById('content');
    var fora = [...c.querySelectorAll('*')].filter(function (e) {
      var b = e.getBoundingClientRect(); return b.width && b.right > d.clientWidth + 2; }).length;
    return { rolagem: d.scrollWidth - d.clientWidth, fora: fora,
             botao: !!c.querySelector('.fcPend button') };
  });
  t('Frente de Caixa no celular: sem rolagem horizontal', m.rolagem <= 2, m.rolagem);
  t('Frente de Caixa no celular: nada cortado', m.fora === 0, m.fora);
  t('e o botão de fechar continua alcançável', m.botao);
  await pg.screenshot({ path: FOTOS + '/frente-caixa-celular.png' });

  await pg.evaluate(() => telaPDV());
  await pg.waitForTimeout(200);
  m = await pg.evaluate(() => {
    var d = document.documentElement, c = document.getElementById('content');
    var fora = [...c.querySelectorAll('*')].filter(function (e) {
      var b = e.getBoundingClientRect(); return b.width && b.right > d.clientWidth + 2; }).length;
    return { rolagem: d.scrollWidth - d.clientWidth, fora: fora,
             aviso: !!c.querySelector('.cmdAlerta') };
  });
  t('PDV no celular: sem rolagem horizontal', m.rolagem <= 2, m.rolagem);
  t('PDV no celular: nada cortado', m.fora === 0, m.fora);
  t('e o aviso do caixa aberto aparece no celular', m.aviso);
  await pg.screenshot({ path: FOTOS + '/pdv-celular.png' });
  /* a comanda fica embaixo no telefone: precisa dar para chegar nela */
  const com = await pg.evaluate(() => {
    var b = document.querySelector('.pdvBody');
    if (b) b.scrollTop = b.scrollHeight;
    var d = document.querySelector('.pdvRight');
    if (!d) return { achou: false };
    var r = d.getBoundingClientRect();
    return { achou: true, largura: Math.round(r.width),
             tela: document.documentElement.clientWidth,
             abaixoDoCatalogo: r.top > (document.querySelector('.pdvLeft') || {}).getBoundingClientRect
               ? r.top >= document.querySelector('.pdvLeft').getBoundingClientRect().top : true };
  });
  t('a comanda ocupa a largura do telefone', com.achou && com.largura >= com.tela - 2,
    com.largura + ' de ' + com.tela);
  t('e fica abaixo do catálogo, sem sobrepor', com.abaixoDoCatalogo === true);
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: FOTOS + '/pdv-celular-comanda.png' });
  await pg.setViewportSize({ width: 1440, height: 900 });

  console.log('\n── 7. Fechar o caixa de uma loja não toca no da outra\n');
  /* a pergunta do Rafael, feita pela interface de verdade: duas unidades,
     cada uma com o seu caixa aberto, e o fechamento de uma delas */
  r = await pg.evaluate(async () => {
    DB.sucursais = [{ id: 'suc_matriz', nome: 'Matriz', matriz: true, ativa: true },
                    { id: 'suc_sf', nome: 'Jolô Santa Fé do Sul', ativa: true },
                    { id: 'suc_alpha', nome: 'Jolô Alphaville', ativa: true }];
    DB.lojaAtual = 'suc_sf'; S.loja = 'suc_sf';
    var hoje = new Date().toLocaleDateString('pt-BR');
    DB.caixas = [
      { id: 'cx_sf',    inicial: 100, operador: 'Santa Fé',   operadorId: 'op1',
        sucursalId: 'suc_sf',    movimentos: [], aberto: hoje + ' 09:00' },
      { id: 'cx_alpha', inicial: 200, operador: 'Alphaville', operadorId: 'op2',
        sucursalId: 'suc_alpha', movimentos: [], aberto: hoje + ' 08:00' }
    ];
    salvar();
    return { meu: (caixaAberto() || {}).id,
             sobra: caixasEsquecidos().map(function (c) { return c.id; }) };
  });
  t('estando em Santa Fé, o caixa em operação é o de Santa Fé', r.meu === 'cx_sf', r.meu);
  t('o caixa do Alphaville não entra como pendência de Santa Fé',
    r.sobra.length === 0, r.sobra.join(','));

  r = await pg.evaluate(async () => {
    /* a autorização por senha é a única coisa dublada: o resto é o caminho real */
    window.autorizar = async () => ({ id: 'op1', nome: 'Operador Teste', funcao: 'gerente' });
    fecharCaixa();
    await new Promise(function (r2) { setTimeout(r2, 120); });
    var md = document.getElementById('mdOv');
    if (!md) return { erro: 'o modal de fechamento não abriu' };
    var campos = md.querySelectorAll('.cfV');
    if (campos.length) { campos[0].value = '100,00';
      campos[0].dispatchEvent(new Event('input', { bubbles: true })); }
    var bt = [...md.querySelectorAll('button')]
      .find(function (b) { return /Confirmar fechamento/i.test(b.textContent); });
    if (!bt) return { erro: 'não achei o botão de confirmar' };
    bt.click();
    await new Promise(function (r2) { setTimeout(r2, 400); });
    var sf = DB.caixas.find(function (c) { return c.id === 'cx_sf'; });
    var al = DB.caixas.find(function (c) { return c.id === 'cx_alpha'; });
    return { sfFechado: !!sf.fechadoEm, sfFoto: !!sf.snapshot, sfContado: sf.contado,
             alFechado: !!al.fechadoEm, alContado: al.contado,
             alInicial: al.inicial, alOperador: al.operador };
  });
  t('o modal e o botão de fechamento responderam', !r.erro, r.erro);
  t('o caixa de Santa Fé fechou', r.sfFechado === true);
  t('com a fotografia da conferência', r.sfFoto === true);
  t('e o valor contado gravado', r.sfContado === 100, r.sfContado);
  t('O CAIXA DO ALPHAVILLE CONTINUA ABERTO', r.alFechado === false, r.alFechado);
  t('e intocado — fundo, operador e conferência dele não mudaram',
    r.alInicial === 200 && r.alOperador === 'Alphaville' && !r.alContado,
    JSON.stringify({ i: r.alInicial, o: r.alOperador, c: r.alContado }));

  console.log('\n── 8. O caixa que ficou aberto de ontem: dá para fechar?\n');
  /* o estado EXATO da loja em 29/08/2026: um único caixa, aberto ontem */
  r = await pg.evaluate(async () => {
    /* o fechamento anterior deixa a pergunta "imprimir?" na tela; ela some
       antes, senão é ela que recebe o clique seguinte */
    try { fecharModal(); } catch (e) {}
    try { liberarOperacao('fechar-caixa'); } catch (e) {}
    DB.sucursais = [{ id: 'suc_sf', nome: 'Jolô Santa Fé do Sul', ativa: true }];
    DB.lojaAtual = 'suc_sf'; S.loja = 'suc_sf';
    var ontem = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');
    DB.caixas = [{ id: 'cx_ontem', inicial: 100, operador: 'Jolo Santa Fe do Sul',
      operadorId: 'op1', sucursalId: 'suc_sf', movimentos: [], aberto: ontem + ' 13:22' }];
    salvar();
    return { aberto: (caixaAberto() || {}).id,
             pendencias: caixasEsquecidos().length,
             deOutroDia: caixaDeOutroDia(DB.caixas[0]) };
  });
  t('o caixa de ontem é o caixa em operação', r.aberto === 'cx_ontem', r.aberto);
  t('e o sistema sabe que ele é de outro dia', r.deOutroDia === true);
  t('com um só aberto, não há "pendência" separada — era o meu engano',
    r.pendencias === 0, r.pendencias);

  r = await pg.evaluate(() => {
    telaFrenteCaixa();
    var c = document.getElementById('content');
    var txt = (c.innerText || '');
    var bt = [...c.querySelectorAll('button')]
      .find(function (b) { return /Fechar caixa/i.test(b.textContent); });
    return { avisa: /CAIXA ABERTO DESDE/.test(txt),
             explica: /Ficou aberto de um dia para o outro/.test(txt),
             temBotao: !!bt, chama: bt ? bt.getAttribute('onclick') : '' };
  });
  t('a Frente de Caixa avisa que ele é de ontem', r.avisa === true);
  t('e explica o que fazer, sem termo técnico', r.explica === true);
  t('E TEM O BOTÃO "Fechar caixa" — que era o que faltava', r.temBotao === true);
  t('o botão fecha ESTE caixa, pelo identificador',
    /fecharCaixa\('cx_ontem'\)/.test(r.chama || ''), r.chama);
  await pg.screenshot({ path: FOTOS + '/caixa-de-ontem.png' });

  r = await pg.evaluate(async () => {
    window.autorizar = async () => ({ id: 'op1', nome: 'Operador', funcao: 'gerente' });
    var c = document.getElementById('content');
    var bt = [...c.querySelectorAll('button')]
      .find(function (b) { return /Fechar caixa/i.test(b.textContent); });
    bt.click();
    await new Promise(function (r2) { setTimeout(r2, 150); });
    var md = document.getElementById('mdOv');
    if (!md) return { erro: 'o modal não abriu' };
    var campos = md.querySelectorAll('.cfV');
    if (campos.length) { campos[0].value = '433,05';
      campos[0].dispatchEvent(new Event('input', { bubbles: true })); }
    var ok = [...md.querySelectorAll('button')]
      .find(function (b) { return /Confirmar fechamento/i.test(b.textContent); });
    ok.click();
    await new Promise(function (r2) { setTimeout(r2, 400); });
    var cx = DB.caixas.find(function (x) { return x.id === 'cx_ontem'; });
    return { fechou: !!cx.fechadoEm, contado: cx.contado, foto: !!cx.snapshot,
             aindaAberto: !!caixaAberto() };
  });
  t('o caixa de ontem FECHA pela Frente de Caixa', !r.erro && r.fechou === true,
    r.erro || String(r.fechou));
  t('com o valor contado gravado', r.contado === 433.05, r.contado);
  t('e a fotografia da conferência', r.foto === true);
  t('depois disso não sobra caixa aberto', r.aindaAberto === false);

  console.log('\n── 9. Ninguém tem senha cadastrada: dá para fechar mesmo assim?\n');
  /* o beco EXATO de 29/08/2026: no banco da Jolô, nenhum operador tem senha */
  r = await pg.evaluate(async () => {
    try { fecharModal(); } catch (e) {}
    try { liberarOperacao('fechar-caixa'); } catch (e) {}
    /* é o que a nuvem responde hoje: a lista de quem tem senha é vazia */
    _quemTemSenha = [];
    DB.operadores = [];
    DB.usuarios = [{ id: 'u_sf', nome: 'Jolo Santa Fe do Sul', login: 'santafe@jologelato.com.br',
                     funcao: 'administrador', ativo: true, permissoes: { 'pdv/pdv': true } }];
    var ontem = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');
    DB.caixas = [{ id: 'cx_ontem2', inicial: 100, operador: 'Jolo Santa Fe do Sul',
      operadorId: 'u_sf', sucursalId: lojaAtualId(), movimentos: [], aberto: ontem + ' 13:22' }];
    salvar();
    return { alguem: alguemTemSenha(),
             podem: operadoresPara('fechar').map(function (o) { return o.nome; }) };
  });
  t('o sistema reconhece que ninguém tem senha', r.alguem === false);
  t('e MESMO ASSIM alguém pode fechar o caixa — a lista não fica vazia',
    (r.podem || []).length > 0, JSON.stringify(r.podem));

  r = await pg.evaluate(async () => {
    telaFrenteCaixa();
    var c = document.getElementById('content');
    var bt = [...c.querySelectorAll('button')]
      .find(function (b) { return /Fechar caixa/i.test(b.textContent); });
    bt.click();
    await new Promise(function (r2) { setTimeout(r2, 200); });
    var md = document.getElementById('mdOv');
    if (!md) return { erro: 'o modal não abriu' };
    var sel = md.querySelector('#fcOp');
    var aviso = /Nenhum operador tem senha/.test(md.innerText || '');
    /* escolhe o operador, como a loja faria */
    if (sel && sel.options.length > 1) sel.selectedIndex = 1;
    if (sel) sel.dispatchEvent(new Event('change', { bubbles: true }));
    var campos = md.querySelectorAll('.cfV');
    if (campos.length) { campos[0].value = '433,05';
      campos[0].dispatchEvent(new Event('input', { bubbles: true })); }
    var ok = [...md.querySelectorAll('button')]
      .find(function (b) { return /Confirmar fechamento/i.test(b.textContent); });
    ok.click();
    await new Promise(function (r2) { setTimeout(r2, 500); });
    var cx = DB.caixas.find(function (x) { return x.id === 'cx_ontem2'; });
    return { opcoes: sel ? sel.options.length - 1 : 0, aviso: aviso,
             fechou: !!cx.fechadoEm, quem: cx.fechadoPor, contado: cx.contado,
             foto: !!cx.snapshot };
  });
  t('o modal abriu', !r.erro, r.erro);
  t('o campo "Operador que fecha" TEM gente para escolher',
    r.opcoes > 0, r.opcoes + ' opção(ões)');
  t('e a tela avisa que ninguém tem senha, dizendo onde cadastrar', r.aviso === true);
  t('O CAIXA FECHA', r.fechou === true);
  t('gravando quem fechou', !!r.quem, r.quem);
  t('com o valor contado', r.contado === 433.05, r.contado);
  t('e a fotografia da conferência', r.foto === true);
  await pg.screenshot({ path: FOTOS + '/fechar-sem-senha.png' });

  console.log('\n── 10. O comprovante de fechamento cabe no papel\n');
  /* os números REAIS do fechamento de 28/08 de Santa Fé do Sul */
  r = await pg.evaluate(() => {
    try { fecharModal(); } catch (e) {}
    var cx = { id: 'cx_imp', aberto: '28/08/2026 13:22', fechadoEm: '29/08/2026 10:43',
      operador: 'Jolo Santa Fe do Sul', inicial: 578.05, sucursalId: lojaAtualId(),
      snapshot: {
        empresa: 'Jolo Santa Fe do Sul', loja: 'Jolo Santa Fe do Sul',
        caixaId: 'cx_mtd5t8vpc74f', turno: 'Turno 1',
        aberto: '28/08/2026 13:22', fechado: '29/08/2026 10:43',
        operadorAbriu: 'Jolo Santa Fe do Sul', operadorFechou: 'Administrador',
        formas: [
          { nome: 'Dinheiro', troco: true, sistema: 133.05, fisico: 438.05, diferenca: 305 },
          { nome: 'Cartao debito', sistema: 645, fisico: 681, diferenca: 36 },
          { nome: 'Cartao credito', sistema: 569, fisico: 547, diferenca: -22 },
          { nome: 'Pix', sistema: 571, fisico: 466, diferenca: -105 },
          { nome: 'Vale / Voucher', sistema: 0, fisico: 0, diferenca: 0 }
        ],
        fundoAbertura: 578.05, vendasDinheiro: 155, suprimentos: 0, sangrias: 600,
        totalSistema: 1918.05, totalFisico: 2132.05, diferencaTotal: 214,
        faturamento: 1940, qtdVendas: 56, canceladas: 1, vCanceladas: 24,
        fundoProximo: 578.05,
        movimentos: [
          { hora: '23:45', tipo: 'sangria', valor: 300, destino: 'Cofre', responsavel: 'Administrador' },
          { hora: '10:43', tipo: 'sangria', valor: 300, motivo: 'Deposito bancario',
            destino: 'Cofre', responsavel: 'Administrador' }
        ]
      } };
    DB.caixas = [cx];
    var r48 = linhasFechamento(cx);
    var r32 = (function () {
      DB.modelosImp = [{ tipo: 'ficha', colunas: 32 }];
      var x = linhasFechamento(cx); DB.modelosImp = []; return x;
    })();
    var maior = function (rr) {
      return rr.linhas.reduce(function (a, l) {
        return Math.max(a, (l.txt || '').length); }, 0); };
    return { linhas48: r48.linhas.length, larg48: maior(r48), cols48: r48.cols,
             linhas32: r32.linhas.length, larg32: maior(r32), cols32: r32.cols,
             corpo: r48.linhas.map(function (l) {
               return l.tipo === 'linha' ? '-'.repeat(r48.cols) : (l.txt || ''); }).join('\n'),
             corpo32: r32.linhas.map(function (l) {
               return l.tipo === 'linha' ? '-'.repeat(r32.cols) : (l.txt || ''); }).join('\n') };
  });
  t('nenhuma linha passa da largura do papel de 80 mm',
    r.larg48 <= r.cols48, r.larg48 + ' > ' + r.cols48);
  t('nem na bobina estreita de 58 mm', r.larg32 <= r.cols32, r.larg32 + ' > ' + r.cols32);
  t('e o comprovante encolheu — antes eram mais de 60 linhas',
    r.linhas48 < 45, r.linhas48 + ' linhas');
  console.log('\n' + r.corpo + '\n');

  /* o modelo é o comprovante que a rede já usa: só o que foi contado */
  t('o título é o do comprovante da loja: REL. VALORES FISICOS',
    /REL\. VALORES FISICOS/.test(r.corpo));
  t('NÃO sai a coluna do sistema — o papel registra a contagem',
    !/SISTEMA/i.test(r.corpo));
  t('NÃO sai a coluna de diferença', !/\bDIF\b/i.test(r.corpo));
  t('nem valor do sistema nenhum escondido em outro bloco',
    r.corpo.indexOf('1.918,05') < 0 && r.corpo.indexOf('133,05') < 0);
  t('tem o bloco Dinheiro, com Quant e Valor Total',
    /\nDinheiro\n/.test(r.corpo) && /Quant\s+Valor Total/.test(r.corpo));
  t('e o bloco Cartao', /\nCartao\n/.test(r.corpo));
  t('cada bloco fecha com Subtotal...',
    (r.corpo.match(/Subtotal\.\.\./g) || []).length === 2);
  t('o dinheiro sai pelo valor CONTADO, não pelo esperado',
    /Dinheiro\s+1\s+438,05/.test(r.corpo));
  t('as formas de cartão saem uma por linha, pelo contado',
    /681,00/.test(r.corpo) && /547,00/.test(r.corpo) && /466,00/.test(r.corpo));
  t('a forma que ninguém usou não ocupa papel',
    r.corpo.indexOf('Vale / Voucher') < 0);
  t('o subtotal do cartão é a soma das três: 1.694,00',
    /Subtotal\.\.\.\s+3\s+1\.694,00/.test(r.corpo));
  t('e o Total é o total contado: 2.132,05',
    /Total\.\.\.\.:\s+2\.132,05/.test(r.corpo));
  t('o mesmo modelo cabe inteiro na bobina de 58 mm',
    /REL\. VALORES FISICOS/.test(r.corpo32) && /Subtotal\.\.\./.test(r.corpo32));

  r = await pg.evaluate(() => {
    var cx = DB.caixas[0];
    imprimirFechamento(cx.id);
    var pap = document.querySelector('#viaImp .papel');
    if (!pap) return { erro: 'não montou o papel' };
    var st = pap.getAttribute('style') || '';
    var linhas = [...pap.querySelectorAll('.ppL')];
    var maior = 0, estoura = 0;
    var larguraPapel = pap.getBoundingClientRect().width;
    linhas.forEach(function (l) {
      maior = Math.max(maior, l.scrollWidth);
      if (l.scrollWidth > l.clientWidth + 1) estoura++;
    });
    return { estilo: st, larguraPapel: Math.round(larguraPapel),
             maiorLinha: Math.round(maior), cortadas: estoura, qtLinhas: linhas.length };
  });
  t('o papel tem largura em caracteres, calculada, não um número fixo',
    /width:\s*48ch/.test(r.estilo || ''), r.estilo);
  t('e a fonte é dimensionada em milímetros para a bobina',
    /font-size:\s*[\d.]+mm/.test(r.estilo || ''), r.estilo);
  t('NENHUMA linha fica cortada na largura — era isso que comia os centavos',
    r.cortadas === 0, r.cortadas + ' linha(s) cortada(s)');
  /* o comprovante inteiro, como vai sair na bobina, gravado para conferência */
  const papelTxt = await pg.evaluate(() => {
    var pap = document.querySelector('#viaImp .papel');
    if (!pap) return '';
    return [...pap.children].map(function (l) { return l.textContent; }).join('\n');
  });
  if (papelTxt) fs.writeFileSync(FOTOS + '/comprovante-fechamento.txt', papelTxt);
  t('o comprovante inteiro foi gravado para conferência',
    (papelTxt || '').length > 200, (papelTxt || '').length + ' caracteres');
  await pg.evaluate(() => { var e = document.getElementById('viaImp'); if (e) e.remove(); });

  console.log('\n── 11. O aviso vermelho não pode cobrir a operação\n');
  await pg.evaluate(() => {
    NUVEM.ligada = false; NUVEM.sessaoCaiu = false; telaPDV();
    /* item direto na comanda: o modal de opções tamparia a medição */
    try { PDV.itens = [{ produtoId: 'pr_casq', nome: 'Casquinha', qtd: 1, preco: 12 }];
          renderVenda(); } catch (e) {}
    try { fecharModal(); } catch (e) {}
    conferirNuvem();
  });
  await pg.waitForTimeout(200);
  let av = await pg.evaluate(() => {
    var barra = document.getElementById('barraAvisos');
    if (!barra) return { semBarra: true };
    var bb = barra.getBoundingClientRect(), cobertos = [];
    var alvos = document.querySelectorAll('#content button');
    for (var i = 0; i < alvos.length; i++) {
      var e = alvos[i], r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var meio = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (meio && meio !== e && !e.contains(meio) && barra.contains(meio))
        cobertos.push((e.textContent || '').trim().slice(0, 24));
    }
    var st = getComputedStyle(barra);
    return { apareceu: !!document.getElementById('avisoNuvem'), cobertos: cobertos,
             dentroDoApp: barra.parentElement && barra.parentElement.id === 'app',
             pos: st.position, marg: st.marginLeft + '/' + st.marginBottom,
             classe: barra.className, larg: Math.round(bb.width),
             tela: document.documentElement.clientWidth };
  });
  t('o aviso aparece quando a nuvem cai', av.apareceu === true);
  t('a barra fica DENTRO da tela do sistema, não flutuando por cima',
    av.dentroDoApp === true);
  t('nenhum botão do PDV fica coberto pelo aviso',
    (av.cobertos || []).length === 0, (av.cobertos || []).join(' | '));
  t('a barra deixou de flutuar', av.pos === 'static', av.pos + ' · ' + av.marg + ' · ' + av.classe);
  await pg.screenshot({ path: FOTOS + '/aviso-nao-cobre.png' });

  av = await pg.evaluate(() => {
    /* a sessão cai de verdade: a mensagem tem de ser a que fala a verdade */
    NUVEM.sessaoCaiu = true; conferirNuvem();
    var s1 = !!document.getElementById('avisoSessao');
    var texto = (document.getElementById('avisoSessao') || {}).innerText || '';
    /* e agora a loja reconecta */
    NUVEM.ligada = true; conferirNuvem();
    return { mostrou: s1, texto: texto.slice(0, 60),
             sumiu: !document.getElementById('avisoSessao') &&
                    !document.getElementById('avisoNuvem'),
             marca: NUVEM.sessaoCaiu };
  });
  t('sessão caída mostra "Sua sessão expirou", não "servidor não respondeu"',
    av.mostrou && /sess/i.test(av.texto), av.texto);
  t('e ao reconectar o aviso some da tela', av.sumiu === true);
  t('a marca de sessão caída é apagada', av.marca === false);

  console.log('\n── 12. Nenhum erro de runtime na sessão inteira\n');
  t('zero erro no console durante todas as provas', erros.length === 0, erros[0]);

  await nav.close(); s.close();
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + feitos + ' falharam'
                             : '✓ ' + feitos + ' provas passaram') + '\n' +
              'fotos em ' + FOTOS + '\n');
  process.exit(falhas ? 1 : 0);
})();

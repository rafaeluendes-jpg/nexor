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

  /* ==========================================================
     O TAMANHO DA FOLHA, MEDIDO NO PDF QUE VAI PARA A IMPRESSORA

     `@page{size:80mm auto}` parece certo e NÃO EXISTE em CSS: misturar
     medida com `auto` é regra inválida, o navegador descarta e imprime
     no papel padrão dele — A4. Era a "folha gigante". Aqui a folha é
     medida de verdade, no PDF gerado pelo próprio Chromium.
     ========================================================== */
  const regra = await pg.evaluate(() => {
    var st = document.getElementById('impCSS');
    return (st ? st.textContent : '').match(/@page\{[^}]*\}/)[0];
  });
  t('a folha é declarada com DUAS medidas, nunca "auto"',
    /size:\s*\d+mm\s+\d+mm/.test(regra) && !/size:[^;}]*auto/.test(regra), regra);
  t('e a largura declarada é a da bobina de 80 mm',
    /size:\s*80mm/.test(regra), regra);
  const medir = async () => {
    const buf = await pg.pdf({ preferCSSPageSize: true, printBackground: true });
    const cx = [...buf.toString('latin1').matchAll(/MediaBox *\[([^\]]*)\]/g)]
      .map(m => m[1].trim().split(/\s+/).map(Number));
    return cx.map(v => ({ l: +((v[2] - v[0]) * 25.4 / 72).toFixed(1),
                          a: +((v[3] - v[1]) * 25.4 / 72).toFixed(1) }));
  };
  let folhas = await medir();
  t('o navegador imprime UMA folha só, não uma pilha',
    folhas.length === 1, folhas.length + ' folha(s)');
  t('a folha mede 80 mm de largura — a bobina da loja, não A4',
    Math.abs(folhas[0].l - 80) <= 1, folhas[0].l + ' mm');
  t('e a altura é só o tamanho do comprovante, não uma folha inteira',
    folhas[0].a > 60 && folhas[0].a < 200, folhas[0].a + ' mm');
  console.log('   →  a folha impressa mede ' + folhas[0].l + ' x ' + folhas[0].a + ' mm');
  await pg.evaluate(() => { var e = document.getElementById('viaImp'); if (e) e.remove(); });

  /* a bobina estreita tem de sair em 58 mm, não na mesma folha da larga */
  await pg.evaluate(() => {
    DB.modelosImp = [{ tipo: 'ficha', colunas: 32 }];
    var cx = DB.caixas[0], r = linhasFechamento(cx);
    imprimirPapel(r.linhas, r.cols, 1);
  });
  await pg.waitForTimeout(300);
  folhas = await medir();
  t('na bobina estreita a folha mede 58 mm, e não 80',
    Math.abs(folhas[0].l - 58) <= 1, folhas[0].l + ' mm');
  console.log('   →  na bobina de 58 mm a folha mede ' +
    folhas[0].l + ' x ' + folhas[0].a + ' mm');
  await pg.evaluate(() => {
    DB.modelosImp = [];
    var e = document.getElementById('viaImp'); if (e) e.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
  });

  console.log('\n── 10b. A abertura do caixa também imprime\n');
  /* clicado de verdade: botão do PDV → modal → confirmar → oferta de imprimir */
  await pg.evaluate(() => {
    DB.caixas = []; DB.pedidos = []; DB.modelosImp = []; salvar();
    var e = document.getElementById('mdOv'); if (e) e.remove();
    telaPDV();
  });
  await pg.waitForTimeout(300);
  await pg.click('#content button:has-text("Abrir frente de caixa")');
  await pg.waitForTimeout(400);
  t('a janela de abrir caixa abriu pelo botão do PDV',
    await pg.isVisible('#cxIni'));
  await pg.evaluate(() => { moedaSet('cxIni', 250.5); });
  await pg.click('#mdOk');
  await pg.waitForTimeout(500);
  r = await pg.evaluate(() => {
    var ov = document.getElementById('mdOv');
    var cx = caixaAberto();
    var bt = ov ? [...ov.querySelectorAll('button')]
      .find(b => /imprimir abertura/i.test(b.textContent)) : null;
    return { abriu: !!cx, valor: cx ? cx.inicial : null, quem: cx ? cx.operador : '',
             temModal: !!ov, titulo: ov ? (ov.querySelector('.mdH b') || {}).textContent : '',
             temBotao: !!bt, texto: ov ? ov.textContent : '' };
  });
  t('O CAIXA ABRE', r.abriu === true);
  t('com o valor que foi digitado', r.valor === 250.5, r.valor);
  t('a tela oferece imprimir a abertura, sem obrigar',
    r.temModal && r.temBotao && /não imprimir/i.test(r.texto), r.titulo);
  t('e já mostra na tela quem abriu, quando e com quanto',
    r.texto.indexOf(r.quem) >= 0 && /250,50/.test(r.texto), r.texto.slice(0, 90));

  const quemAbriu = r.quem;
  await pg.screenshot({ path: FOTOS + '/abertura-imprimir.png' });
  /* clicar no botão e medir o papel que sai */
  await pg.evaluate(() => {
    var ov = document.getElementById('mdOv');
    [...ov.querySelectorAll('button')]
      .find(b => /imprimir abertura/i.test(b.textContent)).click();
  });
  await pg.waitForTimeout(400);
  r = await pg.evaluate(() => {
    var pap = document.querySelector('#viaImp .papel');
    if (!pap) return { erro: 'não montou o papel' };
    var linhas = [...pap.querySelectorAll('.ppL')];
    var cortadas = linhas.filter(l => l.scrollWidth > l.clientWidth + 1).length;
    var st = document.getElementById('impCSS');
    return { corpo: [...pap.children].map(l => l.textContent).join('\n'),
             cortadas: cortadas, qt: linhas.length,
             estiloAb: pap.getAttribute('style') || '',
             regra: (st ? st.textContent : '').match(/@page\{[^}]*\}/)[0] };
  });
  t('o comprovante da abertura é montado ao clicar', !r.erro, r.erro);
  t('tem o título ABERTURA DE CAIXA', /ABERTURA DE CAIXA/.test(r.corpo || ''));
  t('diz QUEM abriu', r.corpo.indexOf('Operador: ' + quemAbriu) >= 0,
    'esperava ' + quemAbriu);
  t('diz a DATA', /Data: \d\d\/\d\d\/\d{4}/.test(r.corpo || ''));
  t('diz a HORA', /Hora: \d\d:\d\d/.test(r.corpo || ''));
  t('e traz o VALOR do fundo de troco', /VALOR: 250,50/.test(r.corpo || ''));
  t('tem a linha da assinatura de quem recebeu a gaveta',
    /Assinatura: _/.test(r.corpo || ''));
  t('nenhuma linha da abertura fica cortada na largura',
    r.cortadas === 0, r.cortadas + ' linha(s)');
  t('e sai na bobina, não em A4',
    /size:\s*80mm\s+\d+mm/.test(r.regra || ''), r.regra);
  /* ==========================================================
     COMPROVANTE CURTO SAÍA DEITADO E COM LETRA MIÚDA

     A abertura tem 14 linhas: dava `size:80mm 60mm`. Para o driver da
     impressora, altura menor que largura é PAISAGEM — e ele girou o
     papel 90°. Foi o que saiu na bobina de Santa Fé do Sul.
     ========================================================== */
  const pgAb = (r.regra || '').match(/size:\s*(\d+)mm\s+(\d+)mm/) || [];
  t('a folha NUNCA é mais baixa que larga — senão a impressora deita',
    Number(pgAb[2]) > Number(pgAb[1]), pgAb[1] + ' x ' + pgAb[2]);
  t('a letra da abertura é grande: 32 colunas na bobina de 80 mm',
    /font-size:\s*3\.9\d*mm/.test(r.estiloAb || ''), r.estiloAb);
  t('e não sobra identificador de máquina no papel',
    !/Caixa: [a-z0-9]{5,}/.test(r.corpo || ''), r.corpo.slice(0, 60));

  /* o nome impresso é o da LOJA em que a pessoa está, não o da rede */
  const nomes = await pg.evaluate(() => {
    baseSuc();
    var atual = lojaAtualId();
    var outra = (DB.sucursais || []).find(x => x.id !== atual);
    return { tela: nomeLojaAtual(),
             cupom: dadosImp({ sucursalId: atual }).loja,
             cupomSemUnidade: dadosImp({}).loja,
             daOutra: outra ? dadosImp({ sucursalId: outra.id }).loja : null,
             primeira: ((DB.sucursais || [])[0] || {}).nome };
  });
  t('o cupom sai com o nome da loja logada, não com o da primeira da lista',
    nomes.cupom === nomes.tela, nomes.cupom + ' ≠ ' + nomes.tela);
  t('mesmo quando o pedido não guardou a unidade',
    nomes.cupomSemUnidade === nomes.tela, nomes.cupomSemUnidade);
  if (nomes.daOutra !== null)
    t('e a segunda via de um pedido de outra loja sai com o nome DAQUELA loja',
      nomes.daOutra !== nomes.tela, nomes.daOutra);
  t('a abertura também traz a loja no cabeçalho',
    (r.corpo || '').indexOf(nomes.tela) === 0, (r.corpo || '').split('\n')[0]);

  /* "imprimir apenas uma via" tem de valer */
  const vias = await pg.evaluate(() => {
    var conta = function (n) {
      var e = document.getElementById('viaImp'); if (e) e.remove();
      var m = modeloImp('ficha'); m.vias = n; salvar();
      var ped = pedidoExemplo('ficha'); ped.sucursalId = lojaAtualId();
      imprimirPapel(montarImp(textoDoModelo(m), ped, m.colunas || 48),
        m.colunas || 48, m.vias || 1);
      return document.querySelectorAll('#viaImp .papelPg').length;
    };
    var um = conta(1), dois = conta(2);
    var e = document.getElementById('viaImp'); if (e) e.remove();
    var m = modeloImp('ficha'); m.vias = 1; salvar();
    return { um: um, dois: dois };
  });
  t('modelo com UMA via imprime uma folha só', vias.um === 1, vias.um + ' via(s)');
  t('e com duas vias imprime duas — a configuração manda',
    vias.dois === 2, vias.dois + ' via(s)');
  console.log('\n' + (r.corpo || '') + '\n');
  fs.writeFileSync(FOTOS + '/comprovante-abertura.txt', r.corpo || '');

  /* e dá para reimprimir depois, pelo relatório da frente de caixa */
  r = await pg.evaluate(() => {
    var e = document.getElementById('viaImp'); if (e) e.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    fecharModal();
    var cx = caixaAberto();
    verCaixa(cx.id);
    var ov = document.getElementById('mdOv');
    var bt = ov ? [...ov.querySelectorAll('.mdF button')]
      .find(b => /abertura/i.test(b.textContent)) : null;
    if (bt) bt.click();
    var pap = document.querySelector('#viaImp .papel');
    return { tinhaBotao: !!bt,
             imprimiu: !!pap && /ABERTURA DE CAIXA/.test(pap.textContent) };
  });
  t('o relatório de frente de caixa tem o botão Abertura', r.tinhaBotao === true);
  t('e ele reimprime o comprovante da abertura', r.imprimiu === true);
  await pg.evaluate(() => {
    fecharModal();
    var e = document.getElementById('viaImp'); if (e) e.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
  });

  console.log('\n── 10d. A comanda mostra o troco, e com letra legível\n');
  r = await pg.evaluate(() => {
    var e = document.getElementById('viaImp'); if (e) e.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    baseImp();
    var m = modeloImp('ficha');
    /* venda de R$ 29 paga com R$ 40 — o caso do cupom que o Rafael mandou */
    var ped = { numero: 504, senha: 504, data: hojeISO(), hora: '13:14',
      clienteNome: 'Consumidor', sucursalId: lojaAtualId(),
      itens: [{ qtd: 1, nome: 'Cascao 2 Bolas', total: 24 },
              { qtd: 1, nome: 'Borda de creme', total: 5 }],
      taxa: 0, acrescimo: 0, desconto: 0, total: 29,
      pagamentos: [{ forma: ((DB.formasPag || [])
        .find(f => /dinheiro/i.test(f.nome)) || (DB.formasPag || [])[0] || {}).id,
        valor: 29, recebido: 40 }] };
    imprimirPapel(montarImp(textoDoModelo(m), ped, m.colunas), m.colunas,
      m.vias || 1, papelDoModelo(m));
    var pap = document.querySelector('#viaImp .papel');
    var st = document.getElementById('impCSS');
    var linhas = [...pap.querySelectorAll('.ppL, .ppCorte')];
    return { corpo: [...pap.children].map(l => l.textContent).join('\n'),
      estilo: pap.getAttribute('style') || '',
      regra: (st ? st.textContent : '').match(/@page\{[^}]*\}/)[0],
      cols: m.colunas, papel: papelDoModelo(m), letra: letraDoModelo(m),
      maiorLinha: linhas.reduce((a, l) => Math.max(a, (l.textContent || '').length), 0),
      cortadas: linhas.filter(l => l.scrollWidth > l.clientWidth + 1).length };
  });
  t('a comanda mostra QUANTO O CLIENTE ENTREGOU, não o valor da venda',
    /Dinheiro\s+40,00/.test(r.corpo), r.corpo);
  t('e o TROCO logo embaixo, como na nota fiscal da rede',
    /Troco R\$\s+11,00/.test(r.corpo), r.corpo);
  t('o total da venda continua correto', /TOTAL\(=\)\s+29,00/.test(r.corpo));
  t('sem troco, nada de linha de troco sobrando', await pg.evaluate(() => {
    var ped = { numero: 1, total: 29, itens: [{ qtd: 1, nome: 'X', total: 29 }],
      pagamentos: [{ forma: (DB.formasPag[0] || {}).id, valor: 29, recebido: 29 }] };
    return !/Troco/.test(linhasPag(ped, 34).map(x => x.txt).join('\n'));
  }));
  t('pedido antigo, sem "recebido" gravado, continua imprimindo certo',
    await pg.evaluate(() => {
      var ped = { pagamentos: [{ forma: (DB.formasPag[0] || {}).id, valor: 29 }] };
      var txt = linhasPag(ped, 34).map(x => x.txt).join('\n');
      return /29,00/.test(txt) && !/Troco/.test(txt);
    }));

  /* a letra: menos colunas na mesma bobina = letra maior */
  t('a comanda vem de fábrica na letra Maior, não na miúda de 48 colunas',
    r.cols === 34 && r.letra === 'maior', r.cols + ' colunas · ' + r.letra);
  t('e continua na bobina de 80 mm', r.papel === 80 && /size:\s*80mm/.test(r.regra),
    r.papel + ' · ' + r.regra);
  const mmLetra = Number((r.estilo.match(/font-size:\s*([\d.]+)mm/) || [])[1]);
  t('a letra passou de 2,6 mm para mais de 3,5 mm', mmLetra > 3.5, mmLetra + ' mm');
  t('e o tamanho é MEDIDO, não chutado pelo fator 0,6',
    Math.abs(mmLetra - 76 / (34 * 0.6)) > 0.001, mmLetra + ' mm');
  t('nenhuma linha da comanda passa da largura do papel',
    r.maiorLinha <= r.cols, r.maiorLinha + ' > ' + r.cols);
  t('e nenhuma fica cortada', r.cortadas === 0, r.cortadas + ' linha(s)');

  /* o controle da tela: Largura do papel e Tamanho da letra */
  r = await pg.evaluate(() => {
    var e = document.getElementById('viaImp'); if (e) e.remove();
    abrir('loja', 'modelo-impressao');
    var pp = document.getElementById('impPapelMM'), lt = document.getElementById('impLetra');
    if (!pp || !lt) return { faltou: true, r58: {} };
    var antes = modeloImp('ficha').colunas;
    /* a tela e refeita a cada mudanca: pega o campo de novo sempre */
    var põe = function (id, v) {
      var el = document.getElementById(id); el.value = v; el.onchange();
    };
    põe('impLetra', 'normal');
    var normal = modeloImp('ficha').colunas;
    põe('impLetra', 'maior');
    var maior = modeloImp('ficha').colunas;
    põe('impPapelMM', '58');
    var estreita = modeloImp('ficha');
    var r58 = { cols: estreita.colunas, papel: papelDoModelo(estreita),
                letra: letraDoModelo(estreita) };
    põe('impPapelMM', '80');
    põe('impLetra', 'maior');
    return { antes: antes, normal: normal, maior: maior, r58: r58,
             fim: modeloImp('ficha').colunas };
  });
  t('a tela de impressão tem o controle "Tamanho da letra"', !r.faltou);
  await pg.evaluate(() => abrir('loja', 'modelo-impressao'));
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: FOTOS + '/config-impressao.png' });
  const prev = await pg.evaluate(() => {
    var el = document.getElementById('impPapel');
    var linhas = [...el.querySelectorAll('.ppL')];
    return { cabe: el.getBoundingClientRect().width <= el.parentElement.clientWidth + 1,
      cortadas: linhas.filter(l => l.scrollWidth > l.clientWidth + 1).length,
      quais: linhas.filter(l => l.scrollWidth > l.clientWidth + 1)
        .slice(0, 4).map(l => l.className + ':' + l.scrollWidth + '/' + l.clientWidth +
          ' [' + (l.textContent || '').slice(0, 20) + ']'),
      larg: Math.round(el.getBoundingClientRect().width),
      painel: el.parentElement.clientWidth };
  });
  t('a prévia cabe inteira na coluna da prévia', prev.cabe === true,
    prev.larg + ' > ' + prev.painel);
  t('e nenhuma linha da prévia sai cortada na direita',
    prev.cortadas === 0, prev.cortadas + ' linha(s): ' + (prev.quais || []).join(' | '));
  t('escolher Normal volta para 48 colunas', r.normal === 48, r.normal);
  t('escolher Maior vai para 34 — letra grande na bobina de 80 mm',
    r.maior === 34, r.maior);
  t('trocar para a bobina de 58 mm não confunde com tamanho de letra',
    r.r58.papel === 58, JSON.stringify(r.r58));
  t('e a escolha fica gravada no modelo, que é o que o PDV lê',
    r.fim === 34, r.fim);
  await pg.evaluate(() => {
    var e = document.getElementById('viaImp'); if (e) e.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
  });

  console.log('\n── 10f. Sangria e suprimento saem no papel, para assinar\n');
  r = await pg.evaluate(() => {
    var e = document.getElementById('mdOv'); if (e) e.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    var v = document.getElementById('viaImp'); if (v) v.remove();
    DB.modelosImp = [];
    /* a sangria do fim da noite: 23:26 na loja é 02:26 do dia seguinte em
       UTC — é aqui que a data do papel costuma sair errada */
    var cx = { id: 'cx_mv', turno: 'Turno 1', sucursalId: lojaAtualId(),
      aberto: '28/08/2026 13:22', inicial: 500, movimentos: [
        { id: 'mv_1', tipo: 'sangria', valor: 300, motivoNome: 'Depósito bancário',
          motivo: '', destinoNome: 'Cofre', responsavel: 'Priscila',
          hora: '23:26', data: '2026-08-29T02:26:00.000Z' },
        { id: 'mv_2', tipo: 'suprimento', valor: 150, motivoNome: 'Troco',
          motivo: 'trazido de casa', destinoNome: 'Conta corrente',
          responsavel: 'Administrador', hora: '13:05',
          data: '2026-08-29T16:05:00.000Z' }
      ] };
    DB.caixas = [cx]; salvar();
    imprimirMovimento('cx_mv', 'mv_1');
    var pap = document.querySelector('#viaImp .papel');
    var st = document.getElementById('impCSS');
    var linhas = [...pap.querySelectorAll('.ppL')];
    return { corpo: [...pap.children].map(l => l.textContent).join('\n'),
      estilo: pap.getAttribute('style') || '',
      regra: (st ? st.textContent : '').match(/@page\{[^}]*\}/)[0],
      vias: document.querySelectorAll('#viaImp .papelPg').length,
      maior: linhas.reduce((a, l) => Math.max(a, (l.textContent || '').length), 0),
      cortadas: linhas.filter(l => l.scrollWidth > l.clientWidth + 1).length };
  });
  t('a sangria imprime um comprovante', /SANGRIA - RETIRADA/.test(r.corpo), r.corpo);
  t('diz QUEM fez', /Responsavel: Priscila/.test(r.corpo));
  t('diz a HORA', /Hora: 23:26/.test(r.corpo));
  t('diz o VALOR', /VALOR: 300,00/.test(r.corpo));
  t('diz PARA ONDE foi', /Destino: Cofre/.test(r.corpo));
  t('traz o motivo', /Motivo: Depósito bancário|Motivo: Dep/.test(r.corpo));
  t('e tem o espaço para assinar', /Assinatura: _/.test(r.corpo));
  t('A DATA É A DA LOJA, não a de Greenwich — 23:26 continua sendo dia 28',
    /Data: 28\/08\/2026/.test(r.corpo), (r.corpo.match(/Data: .*/) || [])[0]);
  t('sai uma via só', r.vias === 1, r.vias);
  t('em pé, na bobina, nunca deitado',
    /size:\s*80mm\s+\d+mm/.test(r.regra) &&
    Number((r.regra.match(/size:\s*(\d+)mm\s+(\d+)mm/) || [])[2]) > 80, r.regra);
  t('com a letra grande, como a abertura',
    /font-size:\s*3\.\d+mm/.test(r.estilo), r.estilo);
  t('nenhuma linha passa da largura do papel', r.maior <= 32, r.maior);
  t('e nenhuma fica cortada', r.cortadas === 0, r.cortadas);
  console.log('\n' + r.corpo + '\n');
  fs.writeFileSync(FOTOS + '/comprovante-sangria.txt', r.corpo);

  /* o suprimento é o irmão: muda o título e "Origem" no lugar de "Destino" */
  r = await pg.evaluate(() => {
    var v = document.getElementById('viaImp'); if (v) v.remove();
    imprimirMovimento('cx_mv', 'mv_2');
    var pap = document.querySelector('#viaImp .papel');
    return [...pap.children].map(l => l.textContent).join('\n');
  });
  t('o suprimento também imprime', /SUPRIMENTO - REFORCO/.test(r), r);
  t('e diz de ONDE veio o dinheiro', /Origem: Conta corrente/.test(r));
  t('com o valor certo', /VALOR: 150,00/.test(r));
  t('e o motivo escrito à mão entra junto', /Troco - trazido de casa/.test(r));
  fs.writeFileSync(FOTOS + '/comprovante-suprimento.txt', r);

  /* a oferta de imprimir, e a segunda via pela lista do turno */
  r = await pg.evaluate(() => {
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var e = document.getElementById('mdOv'); if (e) e.remove();
    var cx = DB.caixas[0];
    perguntaImprimirMovimento(cx, cx.movimentos[0]);
    var ov = document.getElementById('mdOv');
    var bt = ov ? [...ov.querySelectorAll('button')]
      .find(b => /imprimir comprovante/i.test(b.textContent)) : null;
    var texto = ov ? ov.textContent : '';
    if (bt) bt.click();
    var saiu = !!document.querySelector('#viaImp .papel');
    return { temModal: !!ov, temBotao: !!bt, saiu: saiu, texto: texto,
      naoImprimir: /não imprimir/i.test(texto) };
  });
  t('depois da sangria a tela oferece imprimir, sem obrigar',
    r.temModal && r.temBotao && r.naoImprimir, r.texto.slice(0, 80));
  t('e já mostra o valor, a hora e quem fez',
    /300,00/.test(r.texto) && /23:26/.test(r.texto) && /Priscila/.test(r.texto));
  t('clicar no botão imprime', r.saiu === true);

  r = await pg.evaluate(() => {
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var e = document.getElementById('mdOv'); if (e) e.remove();
    telaPDV(); painelCaixa();
    var bts = [...document.querySelectorAll('#mdOv button')]
      .filter(b => /imprimirMovimento/.test(b.getAttribute('onclick') || ''));
    if (bts.length) bts[0].click();
    return { botoes: bts.length,
             saiu: !!document.querySelector('#viaImp .papel') };
  });
  t('a lista de movimentações do turno tem botão de segunda via',
    r.botoes === 2, r.botoes + ' botão(ões)');
  t('e ele imprime', r.saiu === true);

  /* O DEFEITO DE 29/08/2026, o que o Rafael viu na loja e aqui não
     aparecia: o botão existe, ele clica, sai "Movimentação não
     encontrada" e nada imprime.

     Só acontece com a nuvem ligada. Entre fazer a sangria e clicar em
     imprimir, o download chega e troca `DB.caixas` inteiro pela versão
     da nuvem — que ainda NÃO tem esse movimento, porque ele nasceu há
     três segundos e não subiu. O botão procurava o movimento pelo
     identificador dentro de `DB.caixas`; não achava mais nada.

     Aqui a troca é feita de propósito, no meio do caminho. */
  r = await pg.evaluate(() => {
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var e = document.getElementById('mdOv'); if (e) e.remove();
    window.__av = [];
    var _to = window.toast;
    window.toast = function (m) { window.__av.push(String(m)); try { _to(m) } catch (x) {} };
    var cx = DB.caixas[0];
    perguntaImprimirMovimento(cx, cx.movimentos[0]);
    /* o download da nuvem chegando: o mesmo caixa, sem o movimento novo */
    DB.caixas = [{ id: 'cx_mv', turno: 'Turno 1', sucursalId: cx.sucursalId,
      aberto: '28/08/2026 13:22', inicial: 500, movimentos: [] }];
    salvar();
    var ov = document.getElementById('mdOv');
    var bt = ov ? [...ov.querySelectorAll('button')]
      .find(b => /imprimir comprovante/i.test(b.textContent)) : null;
    if (bt) bt.click();
    var pap = document.querySelector('#viaImp .papel');
    window.toast = _to;
    return { temBotao: !!bt, saiu: !!pap,
      corpo: pap ? [...pap.children].map(l => l.textContent).join('\n') : '',
      avisos: (window.__av || []).join(' | ') };
  });
  t('IMPRIME MESMO SE O DOWNLOAD DA NUVEM CHEGAR NO MEIO',
    r.temBotao && r.saiu === true, r.avisos || 'não imprimiu');
  t('e o papel sai completo, com o valor e quem fez',
    /VALOR: 300,00/.test(r.corpo) && /Responsavel: Priscila/.test(r.corpo),
    r.corpo.slice(0, 60));
  t('sem nenhum aviso de erro na tela', r.avisos === '', r.avisos);
  await pg.evaluate(() => {
    fecharModal();
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    DB.caixas = []; salvar();
  });

  console.log('\n── 10g. Cancelar uma venda: papel e coluna no Kanban\n');
  /* Os dois defeitos que o Rafael achou em 30/08/2026:
     · cancelou e nao imprimiu nada — o comprovante nao existia;
     · cancelou e o cartao SUMIU do Kanban em vez de ir para a coluna
       Cancelado, que estava ligada e vazia desde sempre. */
  r = await pg.evaluate(() => {
    var e = document.getElementById('mdOv'); if (e) e.remove();
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    baseStatus(); baseCanc(); baseImp();
    var cx = { id: 'cx_k', turno: 'Turno 1', sucursalId: lojaAtualId(), inicial: 200,
      operador: 'Maria', aberto: '30/08/2026 09:00', movimentos: [] };
    DB.caixas = [cx];
    var novo = function (n, fase) {
      return { id: 'pd_' + n, numero: n, fase: fase, clienteNome: 'Consumidor',
        tipo: 'balcao', caixaId: 'cx_k', sucursalId: lojaAtualId(),
        itens: [{ nome: 'Copo P', qtd: 1, preco: 18, total: 18 }], total: 18,
        hora: '12:59', data: new Date().toISOString(), pagamentos: [] };
    };
    DB.pedidos = [novo(599, statusInicial('balcao')), novo(600, statusInicial('entrega'))];
    var p = DB.pedidos[0];
    p.fase = statusDoPapel('cancelado') || 'cancelado';
    p.canceladoEm = new Date().toISOString();
    p.canceladoPor = 'Maria';
    p.motivoCancelamento = 'Cliente desistiu';
    p.produzidoNoCancelamento = false;
    /* 23:26 na loja e 02:26 do dia seguinte em UTC — a mesma armadilha
       de data que o comprovante da sangria tinha */
    DB.cancelamentos = [{ id: 'cn1', pedidoId: p.id, numero: 599, valor: 18,
      data: '2026-08-31T02:26:00.000Z', hora: '23:26', motivo: 'Cliente desistiu',
      obs: '', produzido: false, estoqueVoltou: true, operador: 'Maria',
      caixaId: 'cx_k', turno: 'Turno 1' }];
    salvar();
    PDV.aba = 'pedidos'; telaPDV(); renderKanban();
    var cols = [...document.querySelectorAll('.kanCol')].map(function (c) {
      return { nome: c.querySelector('.kanH b').textContent,
        n: +c.querySelector('.kanH .n').textContent,
        pedidos: [...c.querySelectorAll('.ped .t1 b')].map(function (b) { return b.textContent }) };
    });
    var canc = cols.find(function (c) { return /cancel/i.test(c.nome) }) || { pedidos: [] };
    var fila = cols.find(function (c) { return /aguardando/i.test(c.nome) }) || { pedidos: [] };
    return { colunaCancelado: canc.pedidos, colunaFila: fila.pedidos,
      temSegundaVia: !!document.querySelector('.ped [onclick*="imprimirCancelamento"]') };
  });
  t('O PEDIDO CANCELADO VAI PARA A COLUNA CANCELADO, não some',
    r.colunaCancelado.indexOf('#599') >= 0, JSON.stringify(r.colunaCancelado));
  t('e sai da fila onde estava', r.colunaFila.indexOf('#599') < 0);
  t('o pedido que não foi cancelado continua na fila',
    r.colunaFila.indexOf('#600') >= 0);
  t('e o cartão cancelado oferece a segunda via do comprovante',
    r.temSegundaVia === true);

  r = await pg.evaluate(() => {
    var v = document.getElementById('viaImp'); if (v) v.remove();
    DB.modelosImp = [];
    imprimirCancelamento('pd_599');
    var pap = document.querySelector('#viaImp .papel');
    var st = document.getElementById('impCSS');
    var linhas = [...pap.querySelectorAll('.ppL')];
    return { corpo: [...pap.children].map(l => l.textContent).join('\n'),
      estilo: pap.getAttribute('style') || '',
      regra: (st ? st.textContent : '').match(/@page\{[^}]*\}/)[0],
      vias: document.querySelectorAll('#viaImp .papelPg').length,
      maior: linhas.reduce((a, l) => Math.max(a, (l.textContent || '').length), 0),
      cortadas: linhas.filter(l => l.scrollWidth > l.clientWidth + 1).length };
  });
  t('O CANCELAMENTO IMPRIME UM COMPROVANTE', /VENDA CANCELADA/.test(r.corpo), r.corpo);
  t('diz o número do pedido', /Pedido: #599/.test(r.corpo));
  t('diz QUEM cancelou', /Cancelou: Maria/.test(r.corpo));
  t('diz o MOTIVO', /Motivo: Cliente desistiu/.test(r.corpo));
  t('diz o VALOR', /VALOR: 18,00/.test(r.corpo));
  t('e explica o estoque, que é o que a conferência precisa',
    /Produzido: Nao/.test(r.corpo) && /Estoque: voltou/.test(r.corpo));
  t('tem o espaço para assinar', /Assinatura: _/.test(r.corpo));
  t('A DATA É A DA LOJA — 23:26 do dia 30, não dia 31 de Greenwich',
    /Data: 30\/08\/2026/.test(r.corpo), (r.corpo.match(/Data: .*/) || [])[0]);
  t('sai uma via só', r.vias === 1, r.vias);
  t('em pé, na bobina, nunca deitado',
    Number((r.regra.match(/size:\s*(\d+)mm\s+(\d+)mm/) || [])[2]) > 80, r.regra);
  t('com a letra grande, como a sangria', /font-size:\s*3\.\d+mm/.test(r.estilo), r.estilo);
  t('nenhuma linha passa da largura do papel', r.maior <= 32, r.maior);
  t('e nenhuma fica cortada', r.cortadas === 0, r.cortadas);
  console.log('\n' + r.corpo + '\n');
  fs.writeFileSync(FOTOS + '/comprovante-cancelamento.txt', r.corpo);

  /* a janela que oferece — e o download da nuvem chegando no meio */
  r = await pg.evaluate(() => {
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var e = document.getElementById('mdOv'); if (e) e.remove();
    window.__ac = [];
    var _to = window.toast;
    window.toast = function (m) { window.__ac.push(String(m)); try { _to(m) } catch (x) {} };
    var p = DB.pedidos.find(function (x) { return x.id === 'pd_599' });
    perguntaImprimirCancelamento(p, DB.cancelamentos[0]);
    var ov = document.getElementById('mdOv');
    var texto = ov ? ov.textContent : '';
    var bt = ov ? [...ov.querySelectorAll('button')]
      .find(b => /imprimir comprovante/i.test(b.textContent)) : null;
    /* o download troca a lista antes do clique */
    DB.pedidos = []; salvar();
    if (bt) bt.click();
    var saiu = !!document.querySelector('#viaImp .papel');
    window.toast = _to;
    return { texto: texto, temBotao: !!bt, saiu: saiu,
      naoImprimir: /não imprimir/i.test(texto), avisos: (window.__ac || []).join(' | ') };
  });
  t('depois de cancelar a tela oferece imprimir, sem obrigar',
    r.temBotao && r.naoImprimir, r.texto.slice(0, 80));
  t('e já mostra o pedido, o valor e quem cancelou',
    /#599/.test(r.texto) && /18,00/.test(r.texto) && /Maria/.test(r.texto));
  t('IMPRIME MESMO SE O DOWNLOAD DA NUVEM CHEGAR NO MEIO', r.saiu === true, r.avisos);
  t('sem nenhum aviso de erro na tela', r.avisos === '', r.avisos);

  console.log('\n── 10h. O papel não sai com um palmo de branco\n');
  r = await pg.evaluate(() => {
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var e = document.getElementById('mdOv'); if (e) e.remove();
    var st0 = document.getElementById('impCSS'); if (st0) st0.remove();
    fecharModal();
    /* o comprovante mais curto do sistema: a abertura */
    var cx = { id: 'cx_b', turno: 'Turno 1', sucursalId: lojaAtualId(),
      inicial: 200, operador: 'Maria', aberto: '30/08/2026 09:00', movimentos: [] };
    DB.caixas = [cx]; DB.modelosImp = []; salvar();
    imprimirAbertura('cx_b');
    var st = document.getElementById('impCSS');
    var regra = (st ? st.textContent : '').match(/@page\{[^}]*\}/)[0];
    var mm = regra.match(/size:(\d+)mm (\d+)mm/);
    var vi = document.getElementById('viaImp');
    var antes = vi.getAttribute('style') || '';
    vi.setAttribute('style', 'display:block;position:fixed;left:-9000px;top:0;padding:0;margin:0;width:auto');
    var pap = document.querySelector('#viaImp .papel');
    pap.style.padding = '0';
    var h = pap.getBoundingClientRect().height * 25.4 / 96;
    vi.setAttribute('style', antes);
    return { largura: +mm[1], pagina: +mm[2], conteudo: +h.toFixed(1),
      branco: +(+mm[2] - 4 - h).toFixed(1) };
  });
  t('a folha continua mais alta do que larga — nunca deitada',
    r.pagina > r.largura, r.largura + 'x' + r.pagina);
  t('o texto CABE na folha, sem empurrar uma segunda página',
    r.conteudo <= r.pagina - 4, r.conteudo + ' de ' + (r.pagina - 4) + ' mm');
  t('E SOBRA POUCO BRANCO: no máximo 10 mm depois da última linha',
    r.branco <= 10, r.branco + ' mm de branco');
  console.log('   folha ' + r.largura + 'x' + r.pagina + ' mm · texto ' +
    r.conteudo + ' mm · branco ' + r.branco + ' mm\n');
  await pg.evaluate(() => {
    fecharModal();
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    DB.caixas = []; DB.pedidos = []; DB.cancelamentos = []; salvar();
  });

  console.log('\n── 10i. A entrega do cardápio sai com endereço e sabor legível\n');
  /* O cupom que chegou da loja em 30/08/2026: pedido 600, Anna Vithória.
     Saiu com "Todos os Bairros" e NADA de rua — o entregador escreveu
     "Antonio Laerte margiotte 530" a mao no proprio papel. Os sabores
     do gelato sairam em letra miuda e cinza, ilegiveis. */
  r = await pg.evaluate(() => {
    var e = document.getElementById('mdOv'); if (e) e.remove();
    var v = document.getElementById('viaImp'); if (v) v.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    fecharModal();
    DB.modelosImp = []; baseImp();
    var end = { rua: 'Antônio Laerte margiotte', numero: '530 ',
      referencia: 'Caminho das águas- portão preto ' };
    DB.clientes = [{ id: 'cli_av', nome: 'Anna Vithória', tel: '(17) 99678-6823',
      rua: end.rua, numero: end.numero, ref: end.referencia,
      cidade: 'Santa fe do sul', zona: 'Todos os Bairros' }];
    var ped = { id: 'pd_600', numero: 600, tipo: 'entrega', canal: 'cardapio',
      fase: statusInicial('entrega'), clienteId: 'cli_av',
      clienteNome: 'Anna Vithória', clienteFone: '(17) 99678-6823',
      endereco: enderecoDeEntrega(end), cidade: 'Santa fe do sul',
      zona: 'Todos os Bairros', sucursalId: lojaAtualId(),
      total: 75, taxa: 7, desconto: 0, hora: '13:06',
      itens: [{ nome: 'Gelato 500 Gramas', qtd: 1, unitario: 68, total: 68, obs: '',
        opcoes: [{ nome: 'Cascão Tradicional', preco: 3 },
                 { nome: 'Leite Ninho Trufado Gelato', preco: 0 },
                 { nome: 'Jolô Gelato', preco: 0 }] }],
      pagamentos: [{ forma: 'Dinheiro', valor: 75 }],
      data: new Date().toISOString() };
    DB.pedidos = [ped]; salvar();
    imprimirVia(ped);
    var pap = document.querySelector('#viaImp .papel');
    var linhas = [...pap.querySelectorAll('.ppL')];
    /* o mesmo pedido SEM endereco proprio: tem de achar no cadastro */
    var velho = JSON.parse(JSON.stringify(ped));
    delete velho.endereco; delete velho.clienteFone;
    return { corpo: [...pap.children].map(l => l.textContent).join('\n'),
      fonte: (pap.getAttribute('style') || '').match(/font-size:[^;]*/)[0],
      miudas: [...pap.querySelectorAll('.pq')].map(x => x.textContent.trim()),
      colunas: (DB.modelosImp.find(m => m.tipo === 'entrega') || {}).colunas,
      maior: linhas.reduce((a, l) => Math.max(a, (l.textContent || '').length), 0),
      cortadas: linhas.filter(l => l.scrollWidth > l.clientWidth + 1).length,
      doCadastro: dadosImp(velho).end_entrega,
      juntou: enderecoDeEntrega({ rua: 'Rua A', numero: '', referencia: '' }) };
  });
  t('O ENDEREÇO SAI NO CUPOM DA ENTREGA',
    /Antônio Laerte margiotte, 530/.test(r.corpo), r.corpo);
  t('com a referência, que é como se acha a casa',
    /Caminho das águas- portão preto/.test(r.corpo));
  t('e o telefone de quem recebe', /Telefone: \(17\) 99678-6823/.test(r.corpo));
  t('o bairro continua saindo', /Todos os Bairros/.test(r.corpo));
  t('pedido antigo, sem endereço próprio, busca no cadastro do cliente',
    /Antônio Laerte margiotte, 530/.test(r.doCadastro), r.doCadastro);
  t('endereço sem número não sai com vírgula solta',
    r.juntou === 'Rua A', r.juntou);
  t('OS SABORES SAEM NO CUPOM', /Cascão Tradicional/.test(r.corpo) &&
    /Leite Ninho Trufado Gelato/.test(r.corpo) && /Jolô Gelato/.test(r.corpo));
  t('E NÃO EM LETRA MIÚDA — sabor é o que a cozinha lê',
    r.miudas.every(x => !/Cascão|Ninho|Jolô/.test(x)), r.miudas.join(' | '));
  t('a letra do cupom é grande: 34 colunas, não as 48 de fábrica',
    r.colunas === 34, r.colunas + ' colunas');
  t('e passa de 3 mm no papel', /font-size:\s*3\.\d+mm/.test(r.fonte), r.fonte);
  t('nenhuma linha passa da largura do papel', r.maior <= 34, r.maior);
  t('e nenhuma fica cortada', r.cortadas === 0, r.cortadas);
  console.log('\n' + r.corpo + '\n');
  fs.writeFileSync(FOTOS + '/cupom-entrega.txt', r.corpo);
  await pg.evaluate(() => {
    var vi = document.getElementById('viaImp');
    document.querySelectorAll('body>*').forEach(x => { if (x !== vi) x.style.display = 'none' });
    vi.setAttribute('style', 'display:block;position:fixed;left:0;top:0;background:#fff;padding:0;margin:0;z-index:9999');
    document.querySelectorAll('#viaImp .papelPg').forEach(g => {
      g.style.cssText = 'width:80mm;padding:2mm;margin:0;box-sizing:border-box;background:#fff;display:block';
    });
    document.querySelectorAll('#viaImp .papel').forEach(g => {
      g.style.padding = '0'; g.style.boxShadow = 'none'; g.style.maxWidth = 'none';
    });
  });
  await pg.setViewportSize({ width: 330, height: 780 });
  await pg.screenshot({ path: FOTOS + '/cupom-entrega.png', fullPage: true });
  await pg.setViewportSize({ width: 1440, height: 900 });

  /* o pedido aceito imprime sozinho: a ligacao tem de existir de verdade */
  r = await pg.evaluate(() => {
    var f = String(window.aceitarPedidoOnline || '');
    return { chamaImprimir: /imprimirVia\(/.test(f),
             levaEndereco: /endereco:\s*enderecoDeEntrega\(/.test(f),
             levaFone: /clienteFone:/.test(f) };
  });
  t('ACEITAR UM PEDIDO DO CARDÁPIO IMPRIME SOZINHO', r.chamaImprimir === true);
  t('e o pedido nasce carregando o endereço', r.levaEndereco === true);
  t('e o telefone do cliente', r.levaFone === true);
  await pg.evaluate(() => {
    var vi = document.getElementById('viaImp'); if (vi) vi.remove();
    var s2 = document.getElementById('impCSS'); if (s2) s2.remove();
    document.querySelectorAll('body>*').forEach(x => { x.style.display = '' });
    DB.pedidos = []; DB.clientes = []; salvar();
  });

  console.log('\n── 10c. O PDV obedece a tela de Turnos\n');
  /* o caso exato de 29/08/2026: o dono desativa os dois turnos e a
     abertura de caixa continua exigindo escolher um */
  r = await pg.evaluate(() => {
    var e = document.getElementById('mdOv'); if (e) e.remove();
    DB.caixas = []; DB.turnos = [];
    DB._semeado = {};
    baseTurnos();
    if (DB.turnos.length < 2)
      DB.turnos.push({ id: uid('tn'), nome: 'Turno 2', ini: '15:00', fim: '23:00',
        ativo: true, ordem: 1 });
    salvar();
    return { cadastrados: DB.turnos.length, ativos: turnosAtivos().length };
  });
  t('a loja tem dois turnos cadastrados e ativos', r.ativos === 2, r.ativos);

  /* desativa pela TELA, clicando no mesmo interruptor que o Rafael usa */
  r = await pg.evaluate(() => {
    telaTurnos();
    var cx = [...document.querySelectorAll('#content input[type=checkbox]')];
    cx.forEach(function (c) { if (c.checked) c.onchange({ target: c }); });
    return { ativos: turnosAtivos().length,
             gravado: (DB.turnos || []).filter(x => x.ativo === false).length };
  });
  t('desmarcar os dois na tela de Turnos desativa os dois', r.ativos === 0, r.ativos);
  t('e isso fica gravado, não só na tela', r.gravado === 2, r.gravado);

  await pg.evaluate(() => { telaPDV(); });
  await pg.waitForTimeout(200);
  await pg.evaluate(() => abrirCaixa());
  await pg.waitForTimeout(400);
  r = await pg.evaluate(() => {
    var ov = document.getElementById('mdOv');
    return { radios: document.querySelectorAll('input[name=cxTurno]').length,
             texto: ov ? ov.innerText : '' };
  });
  t('A ABERTURA DE CAIXA NÃO PEDE MAIS TURNO NENHUM', r.radios === 0, r.radios + ' opção(ões)');
  t('e não manda cadastrar turno — quem desligou foi o dono',
    !/Nenhum turno cadastrado/i.test(r.texto), r.texto.slice(0, 80));
  t('a janela continua pedindo o que importa: operador e valor',
    /Quem está abrindo o caixa/.test(r.texto) && /Valor inicial/.test(r.texto));
  await pg.screenshot({ path: FOTOS + '/abrir-sem-turno.png' });

  /* e o caixa abre, sem turno, sem travar */
  r = await pg.evaluate(() => {
    moedaSet('cxIni', 100);
    document.getElementById('mdOk').click();
    return true;
  });
  await pg.waitForTimeout(600);
  r = await pg.evaluate(() => {
    var cx = caixaAberto();
    return { abriu: !!cx, turno: cx ? (cx.turno || '') : 'x', turnoId: cx ? (cx.turnoId || '') : 'x' };
  });
  t('O CAIXA ABRE DIRETO, sem turno', r.abriu === true);
  t('e fica gravado sem turno nenhum — não inventa "Turno 1"',
    r.turno === '' && r.turnoId === '', r.turno + '/' + r.turnoId);

  /* ==========================================================
     A RAIZ: DOWNLOAD QUE FALHA NÃO PODE ZERAR O CADASTRO

     `baixarTab()` devolve [] quando a consulta falha. Antes isso zerava
     DB.turnos, e `baseTurnos()` semeava os dois turnos de fábrica,
     ATIVOS — desfazendo a decisão do dono e subindo isso para a nuvem.
     ========================================================== */
  r = await pg.evaluate(() => {
    var e = document.getElementById('mdOv'); if (e) e.remove();
    /* a lista some — é o que a falha de leitura provocava. A semente
       NÃO pode ressuscitar os turnos de fábrica por cima da decisão
       do dono. (Que o download vazio não zere a lista é provado em
       testes/turno-obedece.js, onde `volta` roda isolada.) */
    DB.turnos = [];
    baseTurnos();
    return { qt: (DB.turnos || []).length, ativos: turnosAtivos().length,
             nomes: (DB.turnos || []).map(x => x.nome).join(' ') };
  });
  t('a semente NÃO ressuscita os turnos de fábrica', r.qt === 0,
    r.qt + ' turno(s): ' + r.nomes);
  t('e a abertura continua sem turno nenhum para pedir', r.ativos === 0, r.ativos);

  /* a mesma trava para os outros cadastros com semente */
  r = await pg.evaluate(() => {
    baseCanc(); baseStatus();
    DB.motivosCanc = []; DB.statusVenda = [];
    baseCanc(); baseStatus();
    return { canc: (DB.motivosCanc || []).length, stat: (DB.statusVenda || []).length };
  });
  t('motivos de cancelamento também não voltam sozinhos', r.canc === 0, r.canc);
  t('status de venda também não', r.stat === 0, r.stat);
  await pg.evaluate(() => {
    DB.caixas = []; DB.turnos = []; DB._semeado = {}; baseTurnos(); salvar();
    var e = document.getElementById('mdOv'); if (e) e.remove();
  });

  console.log('\n── 10e. A matriz tem mais de um dono\n');
  r = await pg.evaluate(() => {
    var e = document.getElementById('mdOv'); if (e) e.remove();
    /* a nuvem está desligada nas provas: o que se mede aqui é a TELA —
       as linhas dos sócios, os campos e os botões que ela monta */
    _appPublicados = [
      { ref: (DB.usuarios || [{}])[0].id, login: 'rafael', tem_senha: true, ativo: true },
      { ref: 'soc_a1', login: 'carlos', tem_senha: true, ativo: true },
      { ref: 'soc_b2', login: 'marcia', tem_senha: false, ativo: true }
    ];
    abrir('loja', 'canais');
    try { CN2.aba = 'app'; telaCanaisIntegracao(); } catch (er) { return { erro: String(er) }; }
    var linhas = [...document.querySelectorAll('#content table.etTab tbody tr')];
    return {
      linhas: linhas.length,
      socios: linhas.filter(l => /sócio — só o aplicativo/.test(l.textContent)).length,
      temLoginCarlos: !!document.getElementById('lo_soc_a1'),
      temSenhaCarlos: !!document.getElementById('sa_soc_a1'),
      botaoAdicionar: [...document.querySelectorAll('#content button')]
        .some(b => /Adicionar sócio/.test(b.textContent)),
      publicarMarcia: [...document.querySelectorAll('#content button')]
        .some(b => /Publicar/.test(b.textContent) && /soc_b2/.test(b.getAttribute('onclick') || '')),
      republicarCarlos: [...document.querySelectorAll('#content button')]
        .some(b => /Republicar/.test(b.textContent) && /soc_a1/.test(b.getAttribute('onclick') || '')),
      enviarCarlos: [...document.querySelectorAll('#content button')]
        .some(b => /Enviar/.test(b.textContent) && /soc_a1/.test(b.getAttribute('onclick') || '')),
      enviarMarcia: [...document.querySelectorAll('#content button')]
        .some(b => /Enviar/.test(b.textContent) && /soc_b2/.test(b.getAttribute('onclick') || '')),
      removerVermelho: [...document.querySelectorAll('#content button.rdB')]
        .some(b => /removerSocioApp/.test(b.getAttribute('onclick') || '')),
      lojasDoSocio: (linhas.find(l => /carlos/.test(l.textContent)) || {}).textContent || ''
    };
  });
  t('a aba Aplicativo Joia monta com os sócios', !r.erro, r.erro);
  t('os dois sócios aparecem na mesma tabela', r.socios === 2, r.socios);
  t('cada sócio tem campo de login', r.temLoginCarlos === true);
  t('e campo de senha na própria linha', r.temSenhaCarlos === true);
  t('existe o botão "Adicionar sócio"', r.botaoAdicionar === true);
  t('sócio sem senha aparece como Publicar', r.publicarMarcia === true);
  t('sócio já liberado aparece como Republicar', r.republicarCarlos === true);
  t('e só o liberado tem o botão Enviar',
    r.enviarCarlos === true && r.enviarMarcia === false,
    'carlos=' + r.enviarCarlos + ' marcia=' + r.enviarMarcia);
  t('o botão de tirar acesso usa a cor de perigo do sistema (rdB)',
    r.removerVermelho === true);
  t('o sócio vê todas as lojas', /todas/.test(r.lojasDoSocio));
  await pg.screenshot({ path: FOTOS + '/app-socios.png' });

  /* o cadastro do sócio: a janela e as recusas */
  r = await pg.evaluate(() => {
    /* a janela só abre com a nuvem ligada — sem ela não há onde publicar.
       Nas provas a nuvem está desligada de propósito, então liga só aqui. */
    var _lig = NUVEM.ligada; NUVEM.ligada = true;
    novoSocioApp();
    NUVEM.ligada = _lig;
    var ov = document.getElementById('mdOv');
    if (!ov) return { semJanela: true };
    var res = {};
    var tenta = function (lg, sn) {
      document.getElementById('soLogin').value = lg;
      document.getElementById('soSenha').value = sn;
      document.getElementById('mdOk').click();
      return !!document.getElementById('mdOv');   /* janela aberta = recusou */
    };
    res.loginCurto = tenta('ab', '1234');
    res.loginComEspaco = tenta('ana maria', '1234');
    res.senhaCurta = tenta('ana', '123');
    res.loginRepetidoDeSocio = tenta('carlos', '1234');
    /* o login de um usuário do sistema DE VERDADE, tirado do cadastro */
    var u0 = (DB.usuarios || [])[0] || {};
    res.usado = String(u0.loginApp || u0.login || '').toLowerCase();
    res.loginRepetidoDeUsuario = res.usado ? tenta(res.usado, '1234') : true;
    var e = document.getElementById('mdOv'); if (e) e.remove();
    return res;
  });
  t('a janela de novo sócio abre', !r.semJanela);
  t('login com menos de 3 letras é recusado', r.loginCurto === true);
  t('login com espaço é recusado', r.loginComEspaco === true);
  t('senha com menos de 4 é recusada', r.senhaCurta === true);
  t('login repetido de outro sócio é recusado', r.loginRepetidoDeSocio === true);
  t('login repetido de um usuário do sistema também',
    r.loginRepetidoDeUsuario === true, 'testado com "' + r.usado + '"');

  /* publicar direto na linha: as mesmas recusas, sem tocar na nuvem */
  r = await pg.evaluate(() => {
    var res = {}, avisos = [];
    var _t = window.toast; window.toast = function (m) { avisos.push(String(m)); };
    var _g = window.gravarSocioApp, gravou = null;
    window.gravarSocioApp = function (ref, lg, sn) { gravou = { ref: ref, lg: lg, sn: sn }; };
    document.getElementById('lo_soc_a1').value = 'ab';
    publicarSocioApp('soc_a1'); res.curto = !gravou;
    var u0 = (DB.usuarios || [])[0] || {};
    document.getElementById('lo_soc_a1').value =
      String(u0.loginApp || u0.login || 'carlos').toLowerCase();
    publicarSocioApp('soc_a1'); res.repetido = !gravou;
    document.getElementById('lo_soc_a1').value = 'carlos2';
    document.getElementById('sa_soc_a1').value = '';
    publicarSocioApp('soc_a1'); res.semSenhaMantem = !!gravou;   /* já tem senha: pode */
    gravou = null;
    document.getElementById('lo_soc_b2').value = 'marcia';
    document.getElementById('sa_soc_b2').value = '';
    publicarSocioApp('soc_b2'); res.novoExigeSenha = !gravou;    /* não tem: exige */
    gravou = null;
    document.getElementById('sa_soc_b2').value = 'abcd';
    publicarSocioApp('soc_b2'); res.comSenhaPassa = !!gravou && gravou.sn === 'abcd';
    res.limpouCampo = document.getElementById('sa_soc_b2').value === '';
    window.toast = _t; window.gravarSocioApp = _g;
    res.avisos = avisos.slice(0, 3);
    return res;
  });
  t('publicar com login curto não sobe nada', r.curto === true);
  t('publicar com login de outra pessoa não sobe nada', r.repetido === true);
  t('sócio que já tem senha pode republicar sem digitar de novo',
    r.semSenhaMantem === true);
  t('sócio novo sem senha é barrado', r.novoExigeSenha === true);
  t('com senha válida, sobe', r.comSenhaPassa === true);
  t('e a senha some da tela depois de enviada', r.limpouCampo === true);
  await pg.evaluate(() => {
    _appPublicados = null;
    var e = document.getElementById('mdOv'); if (e) e.remove();
  });

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
    /* o relógio de religar roda em segundo plano e, sem rede, torna a
       marcar a sessão como caída. Por isso o estado é montado e medido
       no MESMO passo — senão a medição pega o aviso do vizinho. */
    NUVEM.ligada = false; NUVEM.sessaoCaiu = false;
    limparAvisoSessao();
    conferirNuvem();
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
  av = await pg.evaluate(() => {
    /* a sessão cai uma SEGUNDA vez: o aviso tem de voltar */
    NUVEM.ligada = false; NUVEM.sessaoCaiu = true;
    var el = document.getElementById('avisoSessao'); if (el) el.remove();
    avisoSessaoCaiu();
    return { voltou: !!document.getElementById('avisoSessao'),
             quantos: document.querySelectorAll('#avisoSessao').length };
  });
  t('se a sessão cair OUTRA vez, o aviso volta — não avisa só na primeira',
    av.voltou === true);
  t('e nunca aparece duas faixas iguais empilhadas', av.quantos === 1, av.quantos);
  av = await pg.evaluate(() => {
    limparAvisoSessao(); NUVEM.ligada = true; conferirNuvem();
    return { marca: NUVEM.sessaoCaiu,
             limpou: !document.getElementById('avisoSessao') };
  });
  t('e ao reconectar de novo a tela volta a ficar limpa', av.limpou === true);
  t('a marca de sessão caída é apagada', av.marca === false);

  console.log('\n── 12. Nenhum erro de runtime na sessão inteira\n');
  t('zero erro no console durante todas as provas', erros.length === 0, erros[0]);

  await nav.close(); s.close();
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + feitos + ' falharam'
                             : '✓ ' + feitos + ' provas passaram') + '\n' +
              'fotos em ' + FOTOS + '\n');
  process.exit(falhas ? 1 : 0);
})();

/* Desenha o cupom fiscal EXATAMENTE como o sistema manda para a bobina:
   usa montarDanfeNfce() e imprimirPapel() do próprio Joia, com os dados
   de uma venda de exemplo de Santa Fé. Só para o Rafael VER como fica. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const PORTA = 8975;
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.json':'application/json' };
const srv = http.createServer((q,s)=>{ const f=path.join('/tmp/joia-main', q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);
  try{ s.writeHead(200,{'Content-Type':TIPOS[path.extname(f)]||'application/octet-stream'}); s.end(fs.readFileSync(f)); }catch{ s.writeHead(404); s.end(); } }).listen(PORTA);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 700, height: 1400 } });
  const erros=[]; p.on('pageerror',e=>erros.push(String(e).slice(0,140)));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:'+PORTA) ? r.continue()
    : r.fulfill({ status:200, contentType:'text/javascript', body:'/**/' }));
  await p.goto('http://127.0.0.1:'+PORTA+'/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';}catch(e){} abrirSessao(); });
  await p.waitForTimeout(800);

  const html = await p.evaluate(() => {
    const danfe = {
      emitente:{ nome:'ULIAN & SOUZA SORVETERIA LTDA', fantasia:'Jolô Gelato Santa Fé do Sul',
        cnpj:'50058498000111', ie:'123456789110',
        rua:'Av. Navarro de Andrade', numero:'845', bairro:'Centro',
        cidade:'Santa Fé do Sul', uf:'SP', cep:'15775000' },
      numero:'1', serie:'1', emissao:new Date().toISOString(),
      homologacao:false, contingencia:false,
      itens:[
        { codigo:'001', nome:'Gelato 500g - Chocolate Belga', qtd:1, un:'UN', unit:39.90, total:39.90 },
        { codigo:'014', nome:'Casquinha Trufada', qtd:2, un:'UN', unit:12.00, total:24.00 },
        { codigo:'007', nome:'Petit Jolo', qtd:1, un:'UN', unit:18.50, total:18.50 },
      ],
      totais:{ produtos:82.40, desconto:2.40, outros:0, frete:0, total:80.00, tributos:6.84 },
      pagamentos:[{ tipo:'03', valor:80.00 }],
      troco:0,
      consumidor:{ doc:'12345678909', nome:'' },
      chave:'35260950058498000111650010000000011000000017',
      protocolo:'135260000123456', autorizadaEm:new Date().toISOString(),
      qrCode:'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=35260950058498000111650010000000011000000017|2|1|1|ABCDEF0123456789ABCDEF0123456789ABCDEF01',
      urlChave:'www.nfce.fazenda.sp.gov.br/consulta',
      infCpl:'Obrigado pela preferencia! Jolo Gelato - Feito para valer a pena.',
    };
    const linhas = montarDanfeNfce(danfe, 48);
    /* imprimirPapel desenha num elemento da propria pagina (#viaImp) e
       manda imprimir; aqui so o desenho interessa */
    window.print = () => {};
    try { imprimirPapel(linhas, 48, 1, 80); } catch(e) { return 'ERRO: '+e.message; }
    const el = document.getElementById('viaImp');
    if (!el) return 'ERRO: nao achei o elemento da impressao';
    /* a folha fica escondida fora da impressao: mostra para a foto */
    el.style.cssText += ';display:block;position:static;visibility:visible;background:#fff;padding:14px 10px;width:320px;margin:0 auto';
    document.body.style.cssText = 'background:#fff;margin:0;padding:10px';
    for (const x of document.body.children) if (x !== el) x.style.display='none';
    return 'ok';
  });
  console.log('resultado:', html, '| erros:', erros.length, erros.slice(0,2).join(' | '));
  if (html === 'ok') {
    await p.waitForTimeout(1200);
    const el = await p.$('#viaImp');
    await el.screenshot({ path:'/tmp/cupom-fiscal.png' });
    const t = await p.$eval('#viaImp', x => x.innerText);
    console.log('--- o que sai na bobina ---'); console.log(t);
  }
  await b.close(); srv.close();
})();

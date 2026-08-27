/* ==========================================================
   BACKUP — a suite que prova que o script funciona

   O script de backup so vale se ele funcionar no dia em que a copia for
   necessaria — e esse e o pior dia para descobrir que ele nao funciona.

   Aqui ele roda de verdade, contra um servidor que imita o PostgREST:
   lista de tabelas em formato OpenAPI, paginacao por cabecalho Range,
   e uma tabela que falha de proposito.

   Tres coisas sao conferidas:
     1. le TODAS as linhas, inclusive alem das 1.000 de uma pagina
     2. o arquivo sai com manifesto e soma de conferencia
     3. tabela que falha faz o script NAO escrever arquivo nenhum —
        backup pela metade e pior do que backup nenhum, porque parece
        um backup ate o dia em que voce precisa dele
   ========================================================== */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

let falhas = 0, testes = 0;
function t(nome, ok) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome); }
}

/* 2.500 linhas: obriga o script a pedir tres paginas */
const LINHAS = { produtos: 2500, pedidos: 42, clientes: 0 };

function servidor(quebrar) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const tabela = url.pathname.replace('/rest/v1/', '').replace(/\/$/, '');

    if (url.pathname === '/rest/v1/' || url.pathname === '/rest/v1') {
      const paths = {};
      Object.keys(LINHAS).forEach(k => { paths['/' + k] = {}; });
      paths['/audit_log'] = {};                 /* tem de ficar de fora */
      paths['/rpc/alguma_funcao'] = {};         /* nao e tabela */
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ paths }));
    }
    if (quebrar && tabela === 'pedidos') { res.writeHead(500); return res.end('erro de proposito'); }

    const total = LINHAS[tabela];
    if (total === undefined) { res.writeHead(404); return res.end('[]'); }
    const faixa = (req.headers.range || '0-999').split('-').map(Number);
    const linhas = [];
    for (let i = faixa[0]; i <= Math.min(faixa[1], total - 1); i++) linhas.push({ id: i, nome: 'linha ' + i });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(linhas));
  });
}

/* ==========================================================
   O FILHO RODA EM PARALELO, NAO EM SERIE

   `execFileSync` trava o laco de eventos deste processo — e o servidor
   de mentira vive aqui dentro. O script filho pedia, o servidor nunca
   respondia por estar bloqueado, e o teste ficava parado para sempre.
   Com `spawn` os dois andam juntos, que e o ponto.
   ========================================================== */
function rodar(porta, destino) {
  return new Promise(pronto => {
    const filho = spawn(process.execPath, [path.join(__dirname, '..', 'ferramentas', 'backup.js')], {
      env: Object.assign({}, process.env, {
        SUPABASE_URL: 'http://127.0.0.1:' + porta,
        SUPABASE_SERVICE_KEY: 'chave-de-teste',
        BACKUP_DIR: destino
      })
    });
    let saida = '';
    filho.stdout.on('data', d => { saida += d; });
    filho.stderr.on('data', d => { saida += d; });
    filho.on('close', codigo => pronto({ ok: codigo === 0, saida }));
  });
}

(async function () {
  console.log('\n── Backup do banco\n');

  /* ---------- caminho feliz ---------- */
  const destino1 = fs.mkdtempSync(path.join(os.tmpdir(), 'joia-bkp-'));
  const s1 = servidor(false);
  await new Promise(ok => s1.listen(0, '127.0.0.1', ok));
  const r1 = await rodar(s1.address().port, destino1);
  s1.close();

  t('o script terminou bem', r1.ok);
  const arquivos = fs.existsSync(destino1) ? fs.readdirSync(destino1) : [];
  const json = arquivos.filter(f => f.endsWith('.json'));
  t('escreveu um arquivo de backup', json.length === 1);

  if (json.length === 1) {
    const b = JSON.parse(fs.readFileSync(path.join(destino1, json[0]), 'utf8'));
    t('trouxe as 2.500 linhas, nao so a primeira pagina', b.dados.produtos.length === 2500);
    t('a ultima linha da terceira pagina veio', b.dados.produtos[2499].id === 2499);
    t('tabela pequena veio inteira', b.dados.pedidos.length === 42);
    t('tabela vazia entra como vazia, nao some', Array.isArray(b.dados.clientes) && b.dados.clientes.length === 0);
    t('o audit_log ficou de fora', !('audit_log' in b.dados));
    t('a rota de funcao nao virou tabela', !Object.keys(b.dados).some(k => k.startsWith('rpc')));
    t('o manifesto bate com os dados', b.manifesto.produtos === 2500 && b.manifesto.pedidos === 42);
    t('gravou quando foi feito', typeof b.quando === 'string' && b.quando.length > 10);
    t('escreveu a soma de conferencia', arquivos.some(f => f.endsWith('.sha256')));

    const soma = require('crypto').createHash('sha256')
      .update(fs.readFileSync(path.join(destino1, json[0]))).digest('hex');
    const guardada = fs.readFileSync(path.join(destino1, json[0] + '.sha256'), 'utf8').split(' ')[0];
    t('a soma de conferencia confere com o arquivo', soma === guardada);
  }

  /* ---------- uma tabela falha ---------- */
  const destino2 = fs.mkdtempSync(path.join(os.tmpdir(), 'joia-bkp-'));
  const s2 = servidor(true);
  await new Promise(ok => s2.listen(0, '127.0.0.1', ok));
  const r2 = await rodar(s2.address().port, destino2);
  s2.close();

  t('tabela que falha reprova o backup inteiro', !r2.ok);
  t('e diz qual tabela falhou', /pedidos/.test(r2.saida));
  const sobrou = fs.existsSync(destino2) ? fs.readdirSync(destino2) : [];
  t('NAO escreveu arquivo pela metade', sobrou.length === 0);

  fs.rmSync(destino1, { recursive: true, force: true });
  fs.rmSync(destino2, { recursive: true, force: true });

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · backup do banco');
  console.log((testes - falhas) + ' de ' + testes + ' testes passaram');
  console.log('═'.repeat(52) + '\n');
  process.exit(falhas ? 1 : 0);
})();

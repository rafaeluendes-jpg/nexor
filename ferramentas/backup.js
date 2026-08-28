/* ==========================================================
   BACKUP — uma copia do BANCO, fora do Supabase

   O sistema ja tem duas copias, e as duas sao uteis. Nenhuma das duas e
   isto aqui:

   1. `backups` (nuvem) — uma por dia, as 30 mais novas. Mas ela guarda o
      objeto DB do NAVEGADOR: e a foto do que aquele aparelho tinha, nao
      do que o banco tem. E mora dentro do mesmo projeto Supabase que ela
      deveria proteger. Projeto perdido = copia perdida junto.
   2. Backup diario do Supabase (plano Pro) — 7 dias, gerido por eles.
      Cobre "apaguei sem querer ontem". Nao cobre "perdi a conta" nem
      "preciso de um dia de tres semanas atras".

   Este script le TABELA POR TABELA, direto do banco, e escreve um arquivo
   que voce guarda onde quiser — Drive, HD externo, outro provedor.

   Como rodar:

     SUPABASE_URL=https://cevghkndzpzvnzwifhnm.supabase.co \
     SUPABASE_SERVICE_KEY=<a chave service_role> \
     node ferramentas/backup.js

   A chave service_role ignora a RLS de proposito: backup que so enxerga
   o que o usuario enxerga nao e backup. Ela NAO pode ir para o
   repositorio nem para o navegador — so para a variavel de ambiente.

   Por padrao o audit_log fica de fora: sao 395 MB de trilha de auditoria
   contra ~15 MB de dado de negocio, e misturar os dois faz voce parar de
   guardar backup por ser grande demais. `--com-auditoria` inclui.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URL_BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_KEY;
const COM_AUDITORIA = process.argv.includes('--com-auditoria');
const DESTINO = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backup');

/* pesadas e reconstruiveis: ficam de fora salvo pedido explicito */
const FORA = COM_AUDITORIA ? [] : ['audit_log', 'backups'];

if (!URL_BASE || !CHAVE) {
  console.error('backup: faltam SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.');
  console.error('  A chave service_role esta no painel do Supabase, em');
  console.error('  Project Settings > API. Nunca a coloque num arquivo do repositorio.');
  process.exit(1);
}

const cab = { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE };

/* o PostgREST publica a lista de tabelas na raiz, no formato OpenAPI */
async function tabelas() {
  const r = await fetch(URL_BASE + '/rest/v1/', { headers: cab });
  if (!r.ok) throw new Error('nao consegui listar as tabelas: HTTP ' + r.status);
  const spec = await r.json();
  return Object.keys(spec.paths || {})
    .filter(p => /^\/[a-z_]+$/.test(p))
    .map(p => p.slice(1))
    .filter(t => !FORA.includes(t))
    .sort();
}

/* PostgREST devolve no maximo 1.000 linhas por vez: pagina ate acabar */
async function lerTudo(tabela) {
  const linhas = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const r = await fetch(URL_BASE + '/rest/v1/' + tabela + '?select=*', {
      headers: Object.assign({ Range: de + '-' + (de + passo - 1) }, cab)
    });
    if (!r.ok) throw new Error(tabela + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const parte = await r.json();
    linhas.push(...parte);
    if (parte.length < passo) break;
  }
  return linhas;
}

(async function () {
  const inicio = Date.now();
  const lista = await tabelas();
  console.log('backup: ' + lista.length + ' tabelas' + (FORA.length ? '  (fora: ' + FORA.join(', ') + ')' : ''));

  const dados = {};
  const manifesto = {};
  const falhas = [];

  for (const t of lista) {
    try {
      const linhas = await lerTudo(t);
      dados[t] = linhas;
      manifesto[t] = linhas.length;
      process.stdout.write('  ' + t.padEnd(34) + String(linhas.length).padStart(7) + ' linhas\n');
    } catch (e) {
      falhas.push(t + ': ' + e.message);
      console.error('  ' + t.padEnd(34) + '  FALHOU — ' + e.message);
    }
  }

  /* ==========================================================
     BACKUP QUE FALHOU NO MEIO NAO E BACKUP

     Um arquivo com 40 das 84 tabelas parece um backup, abre como um
     backup, e so revela o que falta no dia em que voce precisa dele.
     Entao: falhou qualquer tabela, nao escreve arquivo nenhum.
     ========================================================== */
  if (falhas.length) {
    console.error('\nbackup: NAO ESCREVI NADA — ' + falhas.length + ' tabela(s) falharam:');
    falhas.forEach(f => console.error('  ' + f));
    process.exit(1);
  }

  const quando = new Date().toISOString();
  const corpo = JSON.stringify({
    joia_backup: 1,
    quando,
    origem: URL_BASE,
    com_auditoria: COM_AUDITORIA,
    manifesto,
    dados
  });

  fs.mkdirSync(DESTINO, { recursive: true });
  const nome = 'joia-' + quando.slice(0, 10) + '-' + quando.slice(11, 16).replace(':', '') + '.json';
  const alvo = path.join(DESTINO, nome);
  fs.writeFileSync(alvo, corpo);

  const soma = crypto.createHash('sha256').update(corpo).digest('hex');
  fs.writeFileSync(alvo + '.sha256', soma + '  ' + nome + '\n');

  const totalLinhas = Object.values(manifesto).reduce((a, b) => a + b, 0);
  console.log('\nbackup: ' + alvo);
  console.log('backup: ' + totalLinhas.toLocaleString('pt-BR') + ' linhas, ' +
    (corpo.length / 1048576).toFixed(1) + ' MB, ' + ((Date.now() - inicio) / 1000).toFixed(1) + 's');
  console.log('backup: sha256 ' + soma.slice(0, 32));
  console.log('\nGuarde este arquivo FORA do Supabase. Copia que mora junto do');
  console.log('original nao protege contra perder a conta.');
})().catch(e => { console.error('backup: ' + e.message); process.exit(1); });

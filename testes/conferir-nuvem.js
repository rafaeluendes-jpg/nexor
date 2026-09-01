/* ==========================================================
   JOIA — A CONFERÊNCIA DA NUVEM PEGA OS DEFEITOS DE VERDADE

   Uma conferência que nunca reprova nada não confere nada. Este teste
   pega o `index.html` publicado, reintroduz nele — numa cópia, nunca no
   arquivo de verdade — cada um dos quatro defeitos de 01/09/2026, e
   exige que `ferramentas/conferir-nuvem.js` reprove os quatro.

   Se algum dia alguém afrouxar a conferência, é aqui que aparece.
   ========================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ARQ } = require('./extrair.js');

const FERR = path.join(__dirname, '..', 'ferramentas', 'conferir-nuvem.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

function rodar(texto, irmao) {
  const tmp = path.join(os.tmpdir(), 'joia-conf-' + Date.now() + Math.random() + '.html');
  fs.writeFileSync(tmp, texto);
  const env = Object.assign({}, process.env, { JOIA_ARQ: tmp });
  if (irmao) env.JOIA_IRMAOS = irmao;
  try {
    execFileSync(process.execPath, [FERR], { env: env, encoding: 'utf8' });
    return { reprovou: false, saida: '' };
  } catch (e) {
    return { reprovou: true, saida: String(e.stdout || '') };
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}

console.log('\n── O sistema de hoje passa\n');
{
  const r = rodar(fonte);
  t('o index.html publicado não tem nenhum desencontro com o banco',
    !r.reprovou, r.saida.slice(-600));
}

console.log('\n── E cada defeito real é reprovado\n');

/* 1 — a chave do upsert numa coluna que a tabela não tem (pedido de base) */
{
  const alvo = "return Object.prototype.hasOwnProperty.call(linhas[0],'loja_id')";
  t('o alvo 1 existe no arquivo', fonte.indexOf(alvo) >= 0);
  const r = rodar(fonte.replace(alvo, "return (true||Object.prototype.hasOwnProperty.call(linhas[0],'loja_id'))"));
  t('pega o on_conflict=loja_id,ref_local em tabela filha sem loja_id',
    r.reprovou && /índice único|loja_id/.test(r.saida), r.saida.slice(-400));
}

/* 2 — um campo que a tabela não tem (foi o caso da contagem) */
{
  const alvo = "campos:function(x){return {data:x.data||null,hora:x.hora||null,";
  t('o alvo 2 existe no arquivo', fonte.indexOf(alvo) >= 0);
  const r = rodar(fonte.replace(alvo, alvo + 'campo_que_nao_existe:1,'));
  t('pega um campo inventado no MAPA',
    r.reprovou && /campo_que_nao_existe/.test(r.saida), r.saida.slice(-400));
}

/* 3 — coluna escrita errada num select (foi `ativo` em vez de `ativa`) */
{
  const r = rodar(fonte.replace("'categorias'+qs", "'categorias?select=id,nome,ativo'+qs"));
  t('pega a coluna errada no select (ativo/ativa)',
    r.reprovou && /ativo/.test(r.saida), r.saida.slice(-400));
}

/* 4 — filtro de coluna uuid com o id local do aparelho (o interruptor) */
{
  const r = rodar(fonte.replace(/'cardapio_config\?sucursal_id=eq\.'\+[A-Za-z_$][\w$]*\(?/,
    "'cardapio_config?sucursal_id=eq.'+lojaAtualId("));
  t('pega o id local do aparelho indo para uma coluna uuid',
    r.reprovou && /uuid/.test(r.saida), r.saida.slice(-400));
}

/* 5 — tabela que não existe */
{
  const r = rodar(fonte.replace("'sucursais?loja_id=eq.'", "'sucursais?loja_id_errado=eq.'"));
  t('pega o filtro por coluna que não existe',
    r.reprovou && /loja_id_errado/.test(r.saida), r.saida.slice(-400));
}

console.log('\n── E o robô do WhatsApp entra na mesma conferência\n');
{
  const robo = path.join(__dirname, '..', '..', 'nexor-whatsapp', 'server.js');
  if (!fs.existsSync(robo)) {
    console.log('   (o repositório do robô não está aqui — conferência pulada)');
  } else {
    const src = fs.readFileSync(robo, 'utf8');
    const alvo = "from('categorias')";
    t('o alvo do robô existe', src.indexOf(alvo) >= 0);
    /* o defeito real: a coluna e `ativa`, o robo pedia `ativo`. O 400
       voltava vazio e o cardapio inteiro da Carla sumia sem erro. */
    const doente = path.join(os.tmpdir(), 'joia-robo-' + Date.now() + '.js');
    fs.writeFileSync(doente, src.replace(/\.from\('categorias'\)\s*\.select\('[^']*'\)/,
      ".from('categorias').select('id,nome,ativo')"));
    const r = rodar(fonte, doente);
    t('pega a coluna errada no select do robô',
      r.reprovou && /ativo/.test(r.saida), r.saida.slice(-400));
    const r2 = rodar(fonte, robo);
    t('e o robô de hoje passa', !r2.reprovou, r2.saida.slice(-400));
    try { fs.unlinkSync(doente); } catch (e) {}
  }
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

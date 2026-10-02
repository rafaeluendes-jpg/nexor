// Analista de Marca — a tela do sistema, servida direto pelo Supabase.
//
// Existe aqui, e nao no Cloudflare, porque publicar por la dependia de colar
// codigo no arquivo certo entre varios, e o arquivo executado nao era o que
// recebia o codigo. Servida deste lado, a publicacao e feita de uma vez so e
// pode ser conferida na hora.

const SB_URL = "https://cevghkndzpzvnzwifhnm.supabase.co";
const SB_KEY = "sb_publishable_tH04wQWnUjOUQWePZ0Bshw_RirDPUDY";

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Analista de Marca</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --creme:#F6F1E4; --papel:#FDFBF6; --tinta:#23231C; --suave:#8B8474;
    --linha:#E5DECD; --oliva:#5E6B33; --ouro:#8A7A38; --vermelho:#A93B2C;
    --ambar:#B4762A; --sombra:0 1px 2px rgba(35,35,28,.05);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:var(--creme); color:var(--tinta);
    font-family:'Outfit',system-ui,sans-serif; -webkit-font-smoothing:antialiased;}
  h1,h2,h3{font-family:'Playfair Display',Georgia,serif; font-weight:500; margin:0}
  .topo{background:var(--papel); border-bottom:1px solid var(--linha);
    padding:14px 20px; display:flex; align-items:center; gap:12px;
    position:sticky; top:0; z-index:10;}
  .marca{font-family:'Playfair Display',serif; font-size:20px; flex:1}
  .selo{width:30px;height:30px;border:1px solid var(--tinta);border-radius:50% 50% 48% 48%;
    display:flex;align-items:center;justify-content:center;font-size:13px;flex:none;}
  .capa{max-width:820px; margin:0 auto; padding:22px 16px 80px}
  .eyebrow{font-size:11px; letter-spacing:.14em; text-transform:uppercase;
    color:var(--suave); font-weight:500;}
  .cabeca{display:flex; align-items:baseline; gap:12px; margin-bottom:16px}
  .cabeca h2{font-size:30px; color:var(--ouro); flex:1}
  .cartao{background:var(--papel); border:1px solid var(--linha); border-radius:3px;
    box-shadow:var(--sombra); overflow:hidden;}
  .item{display:flex; align-items:center; gap:14px; width:100%; text-align:left;
    padding:16px 18px; background:none; border:0; border-bottom:1px solid var(--linha);
    border-left:4px solid var(--linha); cursor:pointer; font:inherit; color:inherit;}
  .item:last-child{border-bottom:0}
  .item:hover,.item:focus-visible{background:#F3EDDF; outline:none}
  .item .txt{flex:1; min-width:0}
  .item .tit{font-weight:500; font-size:16px; margin-bottom:3px}
  .item .meta{font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--suave)}
  .estado{font-size:11px; letter-spacing:.12em; text-transform:uppercase; font-weight:500; flex:none}
  .btn{font:inherit; font-weight:500; font-size:14px; cursor:pointer;
    padding:11px 18px; border-radius:3px; border:1px solid var(--tinta);
    background:var(--tinta); color:var(--creme);}
  .btn:hover{opacity:.85}
  .btn:disabled{opacity:.4; cursor:not-allowed}
  .btn.claro{background:transparent; color:var(--tinta)}
  .btn.link{background:none;border:0;color:var(--suave);padding:6px 0;text-decoration:underline}
  .acoes{display:flex; gap:10px; flex-wrap:wrap; margin:18px 0}
  label{display:block; font-size:11px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--suave); margin:14px 0 6px}
  input,select{font:inherit; width:100%; padding:11px 12px; border:1px solid var(--linha);
    border-radius:3px; background:var(--papel); color:var(--tinta);}
  input:focus,select:focus{outline:2px solid var(--ouro); outline-offset:1px}
  .foto{width:100%; display:block; background:#EDE6D6}
  .painel{padding:18px}
  .aviso{padding:12px 14px; border-radius:3px; font-size:14px; margin:14px 0;
    border:1px solid var(--linha); background:var(--papel);}
  .aviso.ruim{border-color:var(--vermelho); color:var(--vermelho)}
  table{width:100%; border-collapse:collapse; font-size:14px; margin-top:10px}
  th,td{padding:8px 6px; text-align:right; border-bottom:1px solid var(--linha)}
  th:first-child,td:first-child{text-align:left}
  th{font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--suave); font-weight:500}
  td.pior{color:var(--vermelho)} td.melhor{color:var(--oliva)}
  .ajuste{border-left:3px solid var(--oliva); padding:10px 0 10px 14px; margin:14px 0}
  .ajuste.recusa{border-left-color:var(--ambar)}
  .ajuste .tipo{font-size:11px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--suave); margin-bottom:5px}
  .ajuste p{margin:0; font-size:14px; line-height:1.55}
  .vazio{padding:40px 20px; text-align:center; color:var(--suave)}
  .carregando{padding:30px; text-align:center; color:var(--suave); font-size:14px}
  .esconde{display:none !important}
</style>
</head>
<body>

<div class="topo esconde" id="topo">
  <div class="selo">&#9678;</div>
  <div class="marca">Analista de Marca</div>
  <button class="btn claro" id="btn-sair">Sair</button>
</div>

<div class="capa">

  <section id="tela-login">
    <div class="cabeca"><h2>Entrar</h2></div>
    <div class="cartao painel">
      <label for="email">E-mail</label>
      <input id="email" type="email" autocomplete="username" placeholder="voce@exemplo.com">
      <label for="senha">Senha</label>
      <input id="senha" type="password" autocomplete="current-password">
      <div class="acoes"><button class="btn" id="btn-entrar">Entrar</button></div>
      <div id="erro-login"></div>
    </div>
  </section>

  <section id="tela-lista" class="esconde">
    <div class="cabeca"><h2>Materiais</h2><span class="eyebrow" id="contagem"></span></div>
    <div class="acoes"><button class="btn" id="btn-novo">Enviar material</button></div>
    <div class="cartao" id="lista"><div class="carregando">Carregando materiais...</div></div>
  </section>

  <section id="tela-novo" class="esconde">
    <button class="btn link" data-voltar>&#8592; Voltar para a lista</button>
    <div class="cabeca"><h2>Enviar material</h2></div>
    <div class="cartao painel">
      <label for="titulo">Titulo</label>
      <input id="titulo" type="text" placeholder="Ex.: Post de lancamento do pistache">
      <label for="formato">Formato</label>
      <select id="formato">
        <option value="feed">Feed (quadrado)</option>
        <option value="story">Story (vertical)</option>
        <option value="reels">Reels (vertical)</option>
        <option value="carrossel">Carrossel (quadrado)</option>
        <option value="anuncio">Anuncio (quadrado)</option>
        <option value="banner">Banner</option>
        <option value="impresso">Impresso</option>
        <option value="outro">Outro</option>
      </select>
      <label for="arquivo">Imagem</label>
      <input id="arquivo" type="file" accept="image/jpeg,image/png">
      <div class="acoes"><button class="btn" id="btn-enviar">Enviar material</button></div>
      <div id="erro-novo"></div>
    </div>
  </section>

  <section id="tela-detalhe" class="esconde">
    <button class="btn link" data-voltar>&#8592; Voltar para a lista</button>
    <div class="cabeca"><h2 id="det-titulo">Material</h2></div>
    <div class="eyebrow" id="det-meta"></div>
    <div class="acoes">
      <button class="btn" id="btn-analisar">Analisar contra o manual</button>
      <button class="btn claro" id="btn-corrigir">Corrigir imagem</button>
    </div>
    <div id="det-resultado"></div>
    <div id="det-versoes"></div>
  </section>

</div>

<script type="module">
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL = 'AQUI_URL';
const SB_KEY = 'AQUI_CHAVE';

const sb = createClient(SB_URL, SB_KEY, {
  db: { schema: 'mkt' },
  auth: { persistSession: true, autoRefreshToken: true }
});

let perfil = null;
let materialAberto = null;

const $ = function(id){ return document.getElementById(id); };
const mostrar = function(id){
  ['tela-login','tela-lista','tela-novo','tela-detalhe'].forEach(function(t){
    $(t).classList.toggle('esconde', t !== id);
  });
  window.scrollTo(0,0);
};
const escapar = function(t){
  return String(t == null ? '' : t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};
const aviso = function(texto, tipo){
  return '<div class="aviso ' + (tipo || '') + '">' + escapar(texto) + '</div>';
};

const ROTULO = {
  recebido:'Recebido', processando:'Processando', precisa_informacao:'Precisa de informacao',
  aprovado_automatico:'Aprovado', aprovado_com_observacoes:'Aprovado com observacoes',
  correcao_necessaria:'Precisa de correcao', reprovado:'Reprovado', em_correcao:'Em correcao',
  aguardando_revisao:'Aguardando revisao', aprovado_manual:'Aprovado', corrigido:'Corrigido',
  arquivado:'Arquivado'
};
const COR = {
  reprovado:'var(--vermelho)', correcao_necessaria:'var(--ambar)', em_correcao:'var(--ambar)',
  precisa_informacao:'var(--ambar)', processando:'var(--ouro)',
  aprovado_automatico:'var(--oliva)', aprovado_manual:'var(--oliva)',
  aprovado_com_observacoes:'var(--oliva)', corrigido:'var(--oliva)'
};
const corDe = function(s){ return COR[s] || 'var(--suave)'; };
const rotuloDe = function(s){ return ROTULO[s] || s; };

async function chamar(nome, corpo){
  const r0 = await sb.auth.getSession();
  const sessao = r0.data.session;
  if(!sessao) throw new Error('Sua sessao expirou. Entre de novo.');
  const r = await fetch(SB_URL + '/functions/v1/' + nome, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer ' + sessao.access_token,
      'apikey': SB_KEY
    },
    body: JSON.stringify(corpo)
  });
  let j = null;
  try { j = await r.json(); } catch(e){ j = null; }
  if(!r.ok || !j) throw new Error((j && (j.detalhe || j.erro)) || ('O servidor respondeu ' + r.status));
  return j;
}

async function entrar(){
  const b = $('btn-entrar');
  b.disabled = true; b.textContent = 'Entrando...';
  $('erro-login').innerHTML = '';
  const r = await sb.auth.signInWithPassword({
    email: $('email').value.trim(), password: $('senha').value
  });
  b.disabled = false; b.textContent = 'Entrar';
  if(r.error){
    $('erro-login').innerHTML = aviso('E-mail ou senha nao conferem. Confira e tente de novo.','ruim');
    return;
  }
  await iniciar();
}

async function iniciar(){
  const s = await sb.auth.getSession();
  if(!s.data.session){ mostrar('tela-login'); $('topo').classList.add('esconde'); return; }
  const eu = s.data.session.user.id;
  const r = await sb.from('perfis')
    .select('id, org_id, unidade_id, nome, funcao').eq('id', eu).maybeSingle();
  if(r.error || !r.data){
    $('erro-login').innerHTML = aviso('Entrou, mas nao foi possivel ler o perfil: '
      + (r.error ? r.error.message : 'nenhum perfil encontrado'),'ruim');
    return;
  }
  perfil = r.data;
  $('topo').classList.remove('esconde');
  await carregarLista();
}

async function carregarLista(){
  mostrar('tela-lista');
  const alvo = $('lista');
  alvo.innerHTML = '<div class="carregando">Carregando materiais...</div>';
  const r = await sb.from('materiais')
    .select('id, codigo, titulo, formato, status, versao_atual, criado_em')
    .is('arquivado_em', null).order('criado_em', { ascending:false });

  if(r.error){
    alvo.innerHTML = aviso('Nao foi possivel carregar: ' + r.error.message,'ruim');
    return;
  }
  const linhas = r.data || [];
  $('contagem').textContent = linhas.length + (linhas.length === 1 ? ' material' : ' materiais');

  if(!linhas.length){
    alvo.innerHTML = '<div class="vazio">Nenhum material ainda. Use Enviar material para mandar a primeira peca.</div>';
    return;
  }
  alvo.innerHTML = linhas.map(function(m){
    const data = new Date(m.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    return '<button class="item" data-id="' + m.id + '" style="border-left-color:' + corDe(m.status) + '">'
      + '<span class="txt">'
      + '<span class="tit">' + escapar(m.titulo || 'Sem titulo') + '</span>'
      + '<span class="meta">' + escapar(m.codigo) + ' &middot; ' + escapar(m.formato)
      + ' &middot; ' + data + ' &middot; v' + m.versao_atual + '</span>'
      + '</span>'
      + '<span class="estado" style="color:' + corDe(m.status) + '">' + escapar(rotuloDe(m.status)) + '</span>'
      + '</button>';
  }).join('');

  Array.prototype.forEach.call(alvo.querySelectorAll('.item'), function(b){
    b.addEventListener('click', function(){ abrirMaterial(b.dataset.id); });
  });
}

async function abrirMaterial(id){
  materialAberto = id;
  mostrar('tela-detalhe');
  $('det-resultado').innerHTML = '';
  $('det-versoes').innerHTML = '<div class="carregando">Carregando material...</div>';

  const rm = await sb.from('materiais')
    .select('id, codigo, titulo, formato, status, versao_atual').eq('id', id).single();
  if(rm.error){
    $('det-versoes').innerHTML = aviso('Nao foi possivel abrir: ' + rm.error.message,'ruim');
    return;
  }
  const m = rm.data;
  $('det-titulo').textContent = m.titulo || 'Sem titulo';
  $('det-meta').textContent = m.codigo + ' | ' + m.formato + ' | ' + rotuloDe(m.status);
  await desenharVersoes(id);
}

async function desenharVersoes(id){
  const alvo = $('det-versoes');
  const rv = await sb.from('material_versoes')
    .select('id, versao, origem, criado_em').eq('material_id', id)
    .order('versao', { ascending:false });
  if(rv.error){ alvo.innerHTML = aviso('Erro ao ler versoes: ' + rv.error.message,'ruim'); return; }
  const versoes = rv.data || [];
  if(!versoes.length){ alvo.innerHTML = '<div class="vazio">Este material ainda nao tem arquivo.</div>'; return; }

  const ra = await sb.from('arquivos')
    .select('material_versao_id, bucket, storage_path, mime, largura, altura, bytes')
    .in('material_versao_id', versoes.map(function(v){ return v.id; }))
    .is('timestamp_ms', null);
  const porVersao = {};
  (ra.data || []).forEach(function(a){ porVersao[a.material_versao_id] = a; });

  const blocos = [];
  for(let i = 0; i < versoes.length; i++){
    const v = versoes[i];
    const arq = porVersao[v.id];
    let img = '<div class="vazio">Sem arquivo nesta versao.</div>';
    if(arq){
      const su = await sb.storage.from(arq.bucket).createSignedUrl(arq.storage_path, 3600);
      if(su.data && su.data.signedUrl){
        img = '<img class="foto" alt="Versao ' + v.versao + '" src="' + su.data.signedUrl + '">';
      } else {
        img = aviso('A imagem existe mas nao pode ser exibida.','');
      }
    }
    const dim = arq && arq.largura ? arq.largura + ' x ' + arq.altura : 'dimensoes nao medidas';
    blocos.push('<div class="cartao" style="margin-top:16px">' + img +
      '<div class="painel"><div class="eyebrow">Versao ' + v.versao + ' | ' +
      escapar(v.origem) + ' | ' + escapar(dim) + '</div></div></div>');
  }
  alvo.innerHTML = blocos.join('');
}

async function analisar(){
  const b = $('btn-analisar');
  b.disabled = true; b.textContent = 'Analisando...';
  $('det-resultado').innerHTML = '<div class="carregando">A analise le a peca e compara com o manual. Costuma levar de 10 a 30 segundos.</div>';
  try{
    const r = await chamar('analisar', { material_id: materialAberto });
    $('det-resultado').innerHTML = '<div class="cartao painel">'
      + '<div class="eyebrow">Resultado da analise</div>'
      + '<h3 style="font-size:22px;margin:8px 0;color:' + corDe(r.status) + '">' + escapar(rotuloDe(r.status)) + '</h3>'
      + '<table><tr><th>Nota geral</th><td>' + r.nota_geral + '</td></tr>'
      + '<tr><th>Achados</th><td>' + r.achados + '</td></tr>'
      + '<tr><th>Medidos no pixel</th><td>' + r.medidos + '</td></tr>'
      + '<tr><th>Regras consideradas</th><td>' + r.regras_consideradas + '</td></tr>'
      + '<tr><th>Tipo de peca</th><td>' + escapar(r.tipo) + '</td></tr></table></div>';
    await abrirMaterial(materialAberto);
  } catch(e){
    $('det-resultado').innerHTML = aviso('A analise falhou: ' + e.message,'ruim');
  }
  b.disabled = false; b.textContent = 'Analisar contra o manual';
}

const METRICAS = [
  ['luminancia_media','Luminancia media','sobe'],
  ['faixa_tonal','Faixa tonal','sobe'],
  ['fracao_apagada','Fracao apagada','desce'],
  ['fracao_estourada','Fracao estourada','desce'],
  ['croma_medio','Croma medio','neutro'],
  ['nitidez','Nitidez','neutro']
];

async function corrigir(){
  const b = $('btn-corrigir');
  b.disabled = true; b.textContent = 'Corrigindo...';
  $('det-resultado').innerHTML = '<div class="carregando">Medindo a imagem e aplicando so o que a medicao justifica...</div>';
  try{
    const r = await chamar('corrigir-imagem', { material_id: materialAberto });
    const partes = [];
    partes.push('<div class="cartao painel">');
    partes.push('<div class="eyebrow">Correcao de imagem | algoritmo v' + (r.versao_algoritmo || '?') + '</div>');

    if(!r.corrigida){
      partes.push('<h3 style="font-size:20px;margin:8px 0">Nada foi alterado</h3>');
      partes.push('<p style="font-size:14px;line-height:1.55">' + escapar(r.motivo) + '</p>');
    } else {
      partes.push('<h3 style="font-size:20px;margin:8px 0">Versao ' + r.versao_corrigida
        + ' criada a partir da ' + r.versao_original + '</h3>');
      const a = r.medicao_antes, d = r.medicao_depois;
      partes.push('<table><tr><th>Medida</th><th>Antes</th><th>Depois</th></tr>');
      METRICAS.forEach(function(mt){
        const antes = a[mt[0]], depois = d[mt[0]];
        if(antes === undefined || depois === undefined) return;
        let classe = '';
        if(mt[2] === 'sobe') classe = depois > antes ? 'melhor' : (depois < antes ? 'pior' : '');
        if(mt[2] === 'desce') classe = depois < antes ? 'melhor' : (depois > antes ? 'pior' : '');
        partes.push('<tr><th>' + mt[1] + '</th><td>' + antes + '</td><td class="' + classe + '">' + depois + '</td></tr>');
      });
      partes.push('</table>');
      (r.ajustes || []).forEach(function(x){
        partes.push('<div class="ajuste"><div class="tipo">' + escapar(x.tipo) + '</div><p>'
          + escapar(x.descricao) + '</p></div>');
      });
    }
    (r.recusas || []).forEach(function(x){
      partes.push('<div class="ajuste recusa"><div class="tipo">Nao corrigido: ' + escapar(x.tipo)
        + '</div><p>' + escapar(x.motivo) + '</p></div>');
    });
    if(r.aviso) partes.push('<p style="font-size:13px;color:var(--suave);line-height:1.55;margin-top:14px">'
      + escapar(r.aviso) + '</p>');
    partes.push('</div>');

    $('det-resultado').innerHTML = partes.join('');
    if(r.corrigida) await desenharVersoes(materialAberto);
  } catch(e){
    $('det-resultado').innerHTML = aviso('A correcao falhou: ' + e.message,'ruim');
  }
  b.disabled = false; b.textContent = 'Corrigir imagem';
}

async function marcaDaUnidade(){
  const r = await sb.from('unidades').select('marca_id').eq('id', perfil.unidade_id).maybeSingle();
  if(r.data && r.data.marca_id) return r.data.marca_id;
  const f = await sb.from('materiais').select('marca_id').limit(1).maybeSingle();
  if(f.data && f.data.marca_id) return f.data.marca_id;
  throw new Error('nao foi possivel descobrir a marca desta unidade');
}

function medirArquivo(file){
  return new Promise(function(ok){
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = function(){ URL.revokeObjectURL(url); ok({ largura: im.naturalWidth, altura: im.naturalHeight }); };
    im.onerror = function(){ URL.revokeObjectURL(url); ok({ largura: null, altura: null }); };
    im.src = url;
  });
}

async function enviar(){
  const erro = $('erro-novo');
  const file = $('arquivo').files[0];
  const titulo = $('titulo').value.trim();
  erro.innerHTML = '';
  if(!titulo){ erro.innerHTML = aviso('De um titulo ao material antes de enviar.','ruim'); return; }
  if(!file){ erro.innerHTML = aviso('Escolha uma imagem JPG ou PNG.','ruim'); return; }

  const b = $('btn-enviar');
  b.disabled = true; b.textContent = 'Enviando...';
  try{
    const marca_id = await marcaDaUnidade();
    const rm = await sb.from('materiais').insert({
      org_id: perfil.org_id, unidade_id: perfil.unidade_id, marca_id: marca_id,
      criado_por: perfil.id, titulo: titulo, formato: $('formato').value
    }).select('id, codigo').single();
    if(rm.error) throw new Error(rm.error.message);

    const rv = await sb.from('material_versoes').insert({
      org_id: perfil.org_id, unidade_id: perfil.unidade_id,
      material_id: rm.data.id, versao: 1, origem: 'original', criado_por: perfil.id
    }).select('id').single();
    if(rv.error) throw new Error(rv.error.message);

    const limpo = file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
    const caminho = perfil.org_id + '/' + perfil.unidade_id + '/' + rm.data.id + '/v1-' + limpo;

    const up = await sb.storage.from('mkt-materiais')
      .upload(caminho, file, { contentType: file.type, upsert: true });
    if(up.error) throw new Error(up.error.message);

    const dim = await medirArquivo(file);
    const ra = await sb.from('arquivos').insert({
      org_id: perfil.org_id, unidade_id: perfil.unidade_id,
      material_versao_id: rv.data.id, bucket: 'mkt-materiais', storage_path: caminho,
      nome_original: file.name, mime: file.type, bytes: file.size,
      largura: dim.largura, altura: dim.altura
    });
    if(ra.error) throw new Error(ra.error.message);

    $('titulo').value = ''; $('arquivo').value = '';
    b.disabled = false; b.textContent = 'Enviar material';
    await abrirMaterial(rm.data.id);
    return;
  } catch(e){
    erro.innerHTML = aviso('Nao deu para enviar: ' + e.message,'ruim');
  }
  b.disabled = false; b.textContent = 'Enviar material';
}

$('btn-entrar').addEventListener('click', entrar);
$('senha').addEventListener('keydown', function(e){ if(e.key === 'Enter') entrar(); });
$('btn-sair').addEventListener('click', async function(){
  await sb.auth.signOut(); perfil = null;
  $('topo').classList.add('esconde'); mostrar('tela-login');
});
$('btn-novo').addEventListener('click', function(){ mostrar('tela-novo'); });
$('btn-enviar').addEventListener('click', enviar);
$('btn-analisar').addEventListener('click', analisar);
$('btn-corrigir').addEventListener('click', corrigir);
Array.prototype.forEach.call(document.querySelectorAll('[data-voltar]'), function(b){
  b.addEventListener('click', carregarLista);
});

iniciar();
<\/script>
</body>
</html>`;

Deno.serve(() => {
  const corpo = PAGINA.replace("AQUI_URL", SB_URL).replace("AQUI_CHAVE", SB_KEY);
  return new Response(corpo, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
});

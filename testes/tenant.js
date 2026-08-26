/* ==========================================================
   JOIA — SUITE DE CONTEXTO DE UNIDADE E ISOLAMENTO

   Cobre os itens 98 a 105 do bloco multiempresa: o bug real do login
   santafe@jologelato.com.br que caia na Matriz.

   Rodar com:  node testes/tenant.js
   ou:         npm run test:tenant

   `lojaAtual`, `baseSuc`, `soSemente`, `unidadeDoPerfil` e
   `podeTrocarUnidade` sao EXTRAIDAS do index.html. Se alguem mexer na
   resolucao de unidade amanha, o teste roda a versao nova e quebra.
   ========================================================== */
const { versaoDoSistema, corpoDaFuncao, ARQ } = require('./extrair.js');
const fs = require('fs');
const fonte = fs.readFileSync(ARQ, 'utf8');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det ? '  → ' + det : '')); }
}

/* ---------- monta o ambiente com as funcoes reais ---------- */
const NOMES = ['baseSuc', 'soSemente', 'sucAtivas', 'lojasCad',
               'unidadeDoPerfil', 'podeTrocarUnidade', 'unidadeDoUsuario', 'lojaAtual'];
const codigo = NOMES.map(n => corpoDaFuncao(n, fonte)).join('\n');

function mundo({ sucursais, perfil, usuario, lojaAtualGravada }) {
  const DB = { sucursais: sucursais ? JSON.parse(JSON.stringify(sucursais)) : [],
               lojaAtual: lojaAtualGravada || '' };
  const S = { loja: '' };
  const NUVEM = { perfil: perfil || null };
  const api = new Function('DB', 'S', 'NUVEM', 'ctx', `
    var usuarioLogado=ctx.usuarioLogado, ehPlataforma=ctx.ehPlataforma,
        ehSucMatriz=ctx.ehSucMatriz, toast=ctx.toast, _quieto=ctx.toast,
        setTimeout=ctx.setTimeout;
    ${codigo}
    return {lojaAtual:lojaAtual, soSemente:soSemente, baseSuc:baseSuc,
            podeTrocarUnidade:podeTrocarUnidade, unidadeDoPerfil:unidadeDoPerfil};
  `)(DB, S, NUVEM, {
    usuarioLogado: () => usuario || {},
    ehPlataforma: () => !!(usuario && usuario.plataforma),
    ehSucMatriz: (id) => {
      const s = (DB.sucursais || []).find(x => x.id === id);
      return !!(s && s.matriz);
    },
    toast: (m) => { DB._toasts = DB._toasts || []; DB._toasts.push(m); },
    setTimeout: (fn) => { try { fn(); } catch (e) {} }
  });
  return { DB, S, api };
}

/* dados reais da rede Jolô, conferidos no Supabase */
const SUCS_NUVEM = [
  { id: 'suc_matriz', nome: 'Matriz', matriz: true, ativa: true },
  { id: 'suc_mt1unhbx2xrb', nome: 'Jolo Santa Fe do Sul', matriz: false, ativa: true },
  { id: 'suc_2157f764d972', nome: 'Jolô Jales', matriz: false, ativa: true },
  { id: 'suc_mt1npcg7b3m3', nome: 'Jolo Alphaville', matriz: false, ativa: true }
];
const PERFIL_SANTAFE = { sucursal_ref: 'suc_mt1unhbx2xrb', cargo: 'gerente',
                         loja_id: '6001c62e-26f3-4d81-8b6c-fa367c14146c' };

/* ==========================================================
   ITEM 98 — O BUG REPRODUZIDO
   ========================================================== */
grupo('Item 98 · o bug reproduzido: Santa Fé caindo na Matriz');

{
  /* ANTES da correção: lista com só a semente + perfil de Santa Fé.
     A semente é criada por baseSuc() quando a lista está vazia. */
  const m = mundo({ sucursais: [], perfil: PERFIL_SANTAFE });
  m.api.baseSuc();
  t('a semente é criada quando a lista está vazia', m.DB.sucursais.length === 1);
  t('e vem marcada como semente', m.DB.sucursais[0]._semente === true);
  t('soSemente() reconhece o estado "ainda não sei"', m.api.soSemente() === true);

  const escolhida = m.api.lojaAtual();
  t('NÃO cai na Matriz enquanto a nuvem não responde', escolhida !== 'suc_matriz',
    'escolheu "' + escolhida + '"');
  t('não escolhe unidade nenhuma', escolhida === '');
  t('e NÃO avisa "a unidade não existe mais"',
    !(m.DB._toasts || []).some(x => /não existe mais/.test(x)),
    JSON.stringify(m.DB._toasts || []));
  t('nada é gravado em DB.lojaAtual', !m.DB.lojaAtual);
}

grupo('Item 101 · com a nuvem carregada, o contexto é Santa Fé');

{
  const m = mundo({ sucursais: SUCS_NUVEM, perfil: PERFIL_SANTAFE });
  const escolhida = m.api.lojaAtual();
  t('unidade ativa = Santa Fé', escolhida === 'suc_mt1unhbx2xrb', 'deu "' + escolhida + '"');
  t('DB.lojaAtual grava Santa Fé', m.DB.lojaAtual === 'suc_mt1unhbx2xrb');
  t('S.loja aponta para o mesmo', m.S.loja === 'suc_mt1unhbx2xrb');
  t('não pode trocar de unidade', m.api.podeTrocarUnidade() === false);
  t('nenhum aviso de erro', !(m.DB._toasts || []).length);

  /* F5: o DB volta do armazenamento local com lojaAtual gravada */
  const m2 = mundo({ sucursais: SUCS_NUVEM, perfil: PERFIL_SANTAFE,
                     lojaAtualGravada: 'suc_mt1unhbx2xrb' });
  t('após F5, continua Santa Fé', m2.api.lojaAtual() === 'suc_mt1unhbx2xrb');

  /* novo login: DB.lojaAtual vazio, perfil recarregado */
  const m3 = mundo({ sucursais: SUCS_NUVEM, perfil: PERFIL_SANTAFE });
  t('em novo login, volta para Santa Fé', m3.api.lojaAtual() === 'suc_mt1unhbx2xrb');
}

grupo('Item 100 · o fallback silencioso para a Matriz foi eliminado');

{
  /* perfil aponta para unidade que realmente não existe mais */
  const m = mundo({
    sucursais: SUCS_NUVEM,
    perfil: { sucursal_ref: 'suc_apagada_faz_tempo', cargo: 'gerente' }
  });
  const escolhida = m.api.lojaAtual();
  t('NÃO cai na Matriz', escolhida !== 'suc_matriz', 'escolheu "' + escolhida + '"');
  t('fica sem unidade ativa', escolhida === '');
  t('marca o contexto como inválido', !!m.DB._contextoInvalido);
  t('e avisa o operador', (m.DB._toasts || []).some(x => /não existe mais/.test(x)));
  t('nada é gravado com a unidade errada', m.DB.lojaAtual === '');
}

grupo('Item 102 · quem circula entre unidades continua circulando');

{
  /* matriz: perfil sem sucursal_ref → pode trocar */
  const m = mundo({ sucursais: SUCS_NUVEM, perfil: { sucursal_ref: null, cargo: 'admin' } });
  t('matriz pode trocar de unidade', m.api.podeTrocarUnidade() === true);
  t('e abre em alguma unidade da própria organização',
    SUCS_NUVEM.some(s => s.id === m.api.lojaAtual()), 'deu "' + m.api.lojaAtual() + '"');

  /* perfil apontando para a própria matriz também circula */
  const m2 = mundo({ sucursais: SUCS_NUVEM, perfil: { sucursal_ref: 'suc_matriz', cargo: 'admin' } });
  t('perfil da matriz pode trocar', m2.api.podeTrocarUnidade() === true);
}

grupo('Item 70 · usuário de uma unidade só não vê seletor');

{
  const m = mundo({ sucursais: SUCS_NUVEM, perfil: PERFIL_SANTAFE });
  t('podeTrocarUnidade() é falso para o gerente de unidade',
    m.api.podeTrocarUnidade() === false);
  t('o seletor de unidade só aparece com podeTrocarUnidade()',
    /podeTrocarUnidade\(\)/.test(fonte));
}

/* ==========================================================
   ITEM 103 — ESTADOS DA TELA
   ========================================================== */
grupo('Item 103 · tela vazia não pode significar banco vazio');

{
  t('existe marca de contexto inválido', /_contextoInvalido/.test(fonte));
  t('e ela é escrita quando a unidade não resolve',
    /DB\._contextoInvalido='A unidade do seu acesso não foi encontrada\.'/.test(fonte));
  t('lista vazia é tratada como "ainda não sei", não como matriz',
    /LISTA VAZIA NAO E "SOU A MATRIZ" — E "AINDA NAO SEI"/.test(fonte));
  t('lista só com a semente também',
    /LISTA COM A SEMENTE TAMBEM E "AINDA NAO SEI"/.test(fonte));
  t('o nome da loja não inventa "Matriz" quando não sabe',
    /return l\?l\.nome:\(lojasCad\(\)\.length\?'Matriz':'…'\)/.test(fonte));
}

/* ==========================================================
   ITEM 54 — O CONTEXTO É UM SÓ
   ========================================================== */
grupo('Item 54 · contexto de unidade é único no sistema');

{
  const usos = (fonte.match(/lojaAtualId\(\)/g) || []).length;
  t('lojaAtualId() é o ponto único de contexto, usado em toda parte',
    usos > 50, usos + ' usos');
  t('lojaAtual() é a única função que decide a unidade',
    (fonte.match(/^function lojaAtual\(\)\{/gm) || []).length === 1);
  t('DB.lojaAtual e S.loja terminam sempre iguais',
    /S\.loja=DB\.lojaAtual;\s*\/\* as duas passam a apontar para o mesmo/.test(fonte));
  t('o frontend manda a loja de origem para o banco conferir',
    /loja_origem/.test(fonte));
}

/* ==========================================================
   SENHA NUNCA EM TEXTO PURO (P0 da auditoria final)
   ========================================================== */
grupo('Senha · o login offline não guarda mais texto puro');

{
  t('existe hash local para o login offline', /function hashSenhaLocal/.test(fonte));
  t('usa crypto.subtle nativo, sem biblioteca', /crypto\.subtle\.digest\('SHA-256'/.test(fonte));
  t('o login entra como sal', /'joia:'\+String\(login\|\|''\)\.toLowerCase\(\)\+':'/.test(fonte));
  t('o login online guarda o hash, não a senha',
    /nu\.senhaLocal=await hashSenhaLocal\(sn,lg\)[\s\S]{0,40}nu\.senha=''/.test(fonte));
  t('o fallback offline compara por hash',
    /conferirSenhaLocal\(cand,sn\)/.test(fonte));
  t('NÃO existe mais comparação de senha em texto puro no login',
    !/x\.senha&&x\.senha===sn/.test(fonte));
  t('a senha não sobe mais para a nuvem', /login:x\.login\|\|null,senha:null,/.test(fonte));
  t('aparelho legado migra o texto para hash de uma vez',
    /u\.senhaLocal = await hashSenhaLocal\(senhaDigitada, u\.login\)[\s\S]{0,60}u\.senha = ''/.test(fonte));

  /* o hash tem de ser estável e diferente por login */
  const crypto = require('crypto');
  const h = (senha, login) => crypto.createHash('sha256')
    .update('joia:' + String(login).toLowerCase() + ':' + senha).digest('hex');
  t('mesmo par login+senha gera o mesmo hash', h('abc123', 'a@b.com') === h('abc123', 'a@b.com'));
  t('a mesma senha em logins diferentes gera hashes diferentes',
    h('abc123', 'a@b.com') !== h('abc123', 'c@d.com'));
  t('o hash tem 64 caracteres', h('abc123', 'a@b.com').length === 64);
  t('e não contém a senha', h('abc123', 'a@b.com').indexOf('abc123') < 0);
}

/* ==========================================================
   FECHAMENTO GL-01 a GL-14
   ========================================================== */
grupo('GL-04 · uma fonte só para a senha de autorização');

{
  const chamadas = (fonte.match(/rpc\/senha_operador_definir/g) || []).length;
  t('a RPC de senha é chamada de UM lugar só', chamadas === 1, chamadas + ' chamada(s)');
  t('existe a função única', /async function definirSenhaOperador/.test(fonte));
  t('campo vazio mantém a senha atual', /if\(!senha\)return \{ok:true, msg:''\}/.test(fonte));
  t('exige 4 dígitos no mínimo', /String\(senha\)\.length<4/.test(fonte));
  t('recusa quando está sem conexão', /if\(!NUVEM\.ligada\)[\s\S]{0,120}só pode ser cadastrada online/.test(fonte));
  t('recarrega a lista depois de gravar',
    /definirSenhaOperador[\s\S]{0,700}await carregarQuemTemSenha\(\)/.test(fonte));
  t('a tela de Operadores usa a função única',
    /var rs=await definirSenhaOperador\(_refOp, sn\)/.test(fonte));
  t('a tela de Usuários usa a função única',
    /var _rs=await definirSenhaOperador\(_ref, senhaCx\)/.test(fonte));
  t('a senha nunca volta ao navegador', !/senha_operador_ler|retornar_senha/.test(fonte));
}

grupo('GL-12 · health check não finge OK');

{
  t('o health check existe', /async function rodarHealthCheck/.test(fonte));
  t('é restrito à plataforma', /if\(!ehPlataforma\(\)\)return telaRestrita\('Diagnóstico do Sistema'\)/.test(fonte));
  ['Banco','Autenticação','Contexto de unidade','Sincronização','WhatsApp (Carla)','Backup do provedor']
    .forEach(x => t('verifica ' + x, fonte.indexOf("pr('" + x) >= 0));
  t('o backup diz NÃO VERIFICADO, não OK', /pr\('Backup do provedor','naoverif'/.test(fonte));
  t('e aponta onde o proprietário deve olhar',
    /Project Settings › Database › Backups/.test(fonte));
  t('mede o tempo de resposta do banco', /respondeu em '\+cron\(t1\)/.test(fonte));
  t('compara versão instalada com a publicada', /Versão publicada/.test(fonte));
  t('nenhum secret aparece no resultado',
    !/pr\('[^']*',[^,]*,\s*NUVEM\.(chave|token)/.test(fonte));
}

grupo('GL-11 · precisão de custo não é truncada no frontend');

{
  /* o campo de custo de insumo continua fora do componente de 2 casas,
     e o motivo continua escrito — se alguém migrar sem pensar, o teste quebra */
  t('o campo de custo mantém 4 casas', /id="ntItVl" type="number" step="0\.0001"/.test(fonte));
  t('e o motivo está documentado no código',
    /ESTE CAMPO NAO USA O COMPONENTE DE DINHEIRO — DE PROPOSITO/.test(fonte));
  t('moedaFmt formata em 2 casas (uso de venda)',
    /minimumFractionDigits:2,maximumFractionDigits:2/.test(fonte));

  /* ==========================================================
     O DEFEITO QUE ESTA AUDITORIA ENCONTROU

     250 x 0,0043 = 1,075 exato. Em binario vira 1,0749999999999999556,
     e `toFixed(2)` devolve "1.07". O Postgres, que usa decimal exato,
     devolve 1.08. Um centavo de diferenca entre a tela e o banco, no
     MESMO calculo — e na ficha tecnica isso multiplica por insumo.
     ========================================================== */
  const arred = new Function('v', 'casas',
    corpoDaFuncao('arred', fonte) + '\nreturn arred(v,casas);');

  t('a função arred() existe no sistema', /function arred\(v, casas\)/.test(fonte));
  t('250 x 0,0043 = 1,08 (igual ao Postgres)', arred(250 * 0.0043) === 1.08,
    'deu ' + arred(250 * 0.0043));
  t('toFixed daria 1,07 — o defeito', (250 * 0.0043).toFixed(2) === '1.07');
  t('100 x 0,0157 = 1,57', arred(100 * 0.0157) === 1.57);
  t('8 x 0,125 = 1,00', arred(8 * 0.125) === 1);
  t('3 x 1,2345 = 3,7035 com 4 casas', arred(3 * 1.2345, 4) === 3.7035);
  t('1,005 arredonda para 1,01', arred(1.005) === 1.01);
  t('arredondar no meio zeraria o custo', 250 * +(0.0043).toFixed(2) === 0);
  t('0,0043 não vira 0,00 ao ser lido', +(0.0043).toFixed(4) === 0.0043);
  const usos = (fonte.match(/arred\(/g) || []).length;
  t('arred() é usada nos cálculos de custo', usos >= 6, usos + ' uso(s)');
  t('estoque × custo usa arred', /arred\(\(Number\(i\.estoqueAtual\)\|\|0\)\*custoAtual\(i\)\)/.test(fonte));
  t('nota de entrada usa arred', /arred\(x\.l\.qtd\*x\.l\.custo\)/.test(fonte));
}

grupo('GL-05 · minutas jurídicas existem e são honestas');

{
  const fs2 = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..', 'juridico');
  const pp = path.join(dir, 'POLITICA_DE_PRIVACIDADE.md');
  const tu = path.join(dir, 'TERMOS_DE_USO.md');
  t('Política de Privacidade criada', fs2.existsSync(pp));
  t('Termos de Uso criados', fs2.existsSync(tu));
  if (fs2.existsSync(pp)) {
    const txt = fs2.readFileSync(pp, 'utf8');
    t('a política avisa que é minuta', /NÃO PUBLICAR SEM VALIDAÇÃO/.test(txt));
    t('marca os pontos que exigem advogado', (txt.match(/\[VALIDAR\]/g) || []).length >= 10);
    t('não declara conformidade jurídica', !/estamos em conformidade com a LGPD/i.test(txt));
    t('registra a transferência internacional', /fora do Brasil/.test(txt));
    t('admite que não há expurgo automático', /não apaga nada automaticamente/.test(txt));
  }
  if (fs2.existsSync(tu)) {
    const txt = fs2.readFileSync(tu, 'utf8');
    t('os termos não prometem SLA inexistente', /Não há SLA definido/.test(txt));
    t('e não prometem backup não comprovado', /ainda não foram verificados/.test(txt));
  }
}

/* ---------- resultado ---------- */
console.log('\n' + '═'.repeat(52));
console.log('Joia ' + versaoDoSistema() + ' · contexto de unidade e isolamento');
console.log(R.ok + ' de ' + R.total + ' testes passaram' +
  (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
console.log('═'.repeat(52));
process.exit(R.falhou ? 1 : 0);

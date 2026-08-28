/* ==========================================================
   A SESSÃO DA LOJA NÃO PODE CAIR SOZINHA

   28/08/2026, 16h. Santa Fé do Sul parou de sincronizar no meio do
   expediente e ficou a tarde inteira com "Servidor não respondeu —
   reconectando sozinho". O servidor estava no ar: nas mesmas horas
   passaram milhares de respostas 200 e 201.

   O que o log do servidor mostra são cinco recusas seguidas, das 18:59
   às 19:04 UTC, em POST /auth/v1/token?grant_type=refresh_token, com
   400. Depois disso, silêncio daquela loja.

   O refresh token do Supabase é de USO ÚNICO: quem o usa recebe outro e
   o antigo morre na hora. Havia DOIS relógios usando o mesmo token — a
   biblioteca (`autoRefreshToken:true`) e a nossa `tokenValido()`, que
   renovava por conta própria a cinco minutos do vencimento. Os dois na
   mesma janela: um renova, o outro apresenta um token já usado, leva
   400 — e a biblioteca descarta a sessão inteira.

   Dois defeitos, então:
   1. duas renovações concorrentes derrubando a sessão;
   2. a mensagem mentindo. Sessão caída não "volta quando a conexão
      voltar": só entrando de novo. O caixa seguiu vendendo à espera de
      uma reconexão que nunca ia acontecer.

   Rodar:  node testes/sessao-nao-cai.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* monta as funções reais com um Supabase de mentira que se comporta
   como o de verdade: refresh token de uso único */
function motor(cfg) {
  const chamadas = { refresh: 0, getSession: 0 };
  let tokenAtual = cfg.tokenInicial;
  let usado = false;
  const cli = {
    auth: {
      async getSession() {
        chamadas.getSession++;
        return { data: { session: tokenAtual } };
      },
      async refreshSession() {
        chamadas.refresh++;
        await new Promise(r => setTimeout(r, 10));
        if (usado || cfg.sempreRecusa) {
          /* é exatamente o que o servidor devolveu: 400 Already Used */
          return { error: new Error('Invalid Refresh Token: Already Used') };
        }
        usado = true;
        tokenAtual = cfg.tokenNovo;
        return { data: { session: cfg.tokenNovo } };
      }
    },
    realtime: { setAuth() {} }
  };
  const NUVEM = { cli, token: cfg.tokenInicial ? cfg.tokenInicial.access_token : null,
                  ligada: true, sessaoCaiu: false };
  const avisos = [];
  const codigo = [corpoDaFuncao('renovarSessao', fonte), corpoDaFuncao('tokenValido', fonte)].join('\n');
  const f = new Function('ctx', `
    var NUVEM=ctx.NUVEM, _tokenAte=0, _renovando=null;
    var _quieto=function(){}, logNuvem=function(m){ctx.avisos.push('log:'+m)};
    var avisoSessaoCaiu=function(){ctx.avisos.push('sessao-caiu')};
    var conferirNuvem=function(){}, rodape=function(){};
    ${codigo}
    return {tokenValido:tokenValido,renovarSessao:renovarSessao,
            estado:function(){return NUVEM}};
  `)({ NUVEM, avisos });
  return { f, chamadas, avisos, NUVEM };
}

const agoraSeg = () => Math.floor(Date.now() / 1000);
const sessao = (segundos, tok) => ({ access_token: tok, expires_at: agoraSeg() + segundos });

console.log('\n── Sistema ' + versaoDoSistema() + ' — uma renovação de cada vez\n');

(async function () {
  /* dois pedidos ao mesmo tempo, com a sessão vencendo: era assim que os
     dois relógios se atropelavam */
  let m = motor({ tokenInicial: sessao(10, 'velho'), tokenNovo: sessao(3600, 'novo') });
  const [a, b] = await Promise.all([m.f.tokenValido(), m.f.tokenValido()]);
  t('duas chamadas simultâneas fazem UMA renovação só', m.chamadas.refresh === 1, m.chamadas.refresh);
  t('e as duas recebem o token novo', a === 'novo' && b === 'novo', a + '/' + b);
  t('a sessão continua de pé', m.NUVEM.ligada === true && m.NUVEM.sessaoCaiu === false);

  /* a biblioteca renovou primeiro: a nossa renovação leva 400 */
  m = motor({ tokenInicial: sessao(10, 'velho'), tokenNovo: sessao(3600, 'novo'), sempreRecusa: true });
  /* a sessão guardada já é a nova — é o que a biblioteca faz ao renovar */
  m.NUVEM.cli.auth.getSession = async () => ({ data: { session: sessao(3600, 'da-biblioteca') } });
  const c = await m.f.tokenValido();
  t('renovação recusada NÃO derruba a sessão', m.NUVEM.sessaoCaiu === false, m.NUVEM.sessaoCaiu);
  t('o sistema usa a sessão que a biblioteca acabou de guardar', c === 'da-biblioteca', c);
  t('e continua ligado', m.NUVEM.ligada === true);

  /* token folgado: ninguém renova nada */
  m = motor({ tokenInicial: sessao(3600, 'bom'), tokenNovo: sessao(7200, 'outro') });
  await m.f.tokenValido();
  t('token com uma hora de vida não provoca renovação', m.chamadas.refresh === 0, m.chamadas.refresh);

  /* faltando 40 s: aí sim renova */
  m = motor({ tokenInicial: sessao(40, 'quase'), tokenNovo: sessao(3600, 'novo') });
  await m.f.tokenValido();
  t('faltando menos de um minuto, renova', m.chamadas.refresh === 1, m.chamadas.refresh);

  console.log('\n── Quando a sessão acaba mesmo, a loja ouve a verdade\n');

  m = motor({ tokenInicial: null, tokenNovo: null, sempreRecusa: true });
  m.NUVEM.cli.auth.getSession = async () => ({ data: { session: null } });
  const d = await m.f.tokenValido();
  t('sem sessão nenhuma, não inventa token', d === null || d === undefined, d);
  t('marca que foi a SESSÃO que caiu, não a rede', m.NUVEM.sessaoCaiu === true);
  t('e mostra "sua sessão expirou", com o botão de entrar de novo',
    m.avisos.indexOf('sessao-caiu') >= 0, m.avisos.join(' | '));
  t('a nuvem fica desligada', m.NUVEM.ligada === false);

  console.log('\n── O que ficou preso no código\n');

  t('existe uma única renovação em andamento por vez',
    /if\(_renovando\)return _renovando/.test(codigoNu));
  t('a renovação recusada consulta a sessão guardada antes de desistir',
    /catch\(e\)\{[\s\S]{0,400}getSession\(\)/.test(corpoDaFuncao('renovarSessao', fonte)));
  t('a janela própria é de 60 s, não de 5 minutos',
    /venceEm-agora<60000/.test(codigoNu) && !/venceEm-agora<300000/.test(codigoNu));
  t('o aviso genérico sai da frente quando a sessão caiu',
    /if\(NUVEM\.sessaoCaiu\)\{[\s\S]{0,120}avisoSessaoCaiu\(\)/.test(codigoNu));
  t('entrar de novo limpa a marca', /NUVEM\.ligada=true;NUVEM\.sessaoCaiu=false;/.test(codigoNu));
  t('a biblioteca continua renovando sozinha (não desligamos ela)',
    /autoRefreshToken:true/.test(codigoNu));

  console.log('\n── A unidade não insiste no que a regra do banco proíbe\n');

  t('a tabela de unidades só sobe pela matriz',
    /\{col:'sucursais', espelha:false, soGestor:true/.test(codigoNu));
  t('a de usuários também', /\{col:'usuarios', espelha:false, soGestor:true/.test(codigoNu));
  t('e o motor respeita essa marca',
    /if\(E2\.soGestor&&!ehMatriz\(\)\)continue;/.test(codigoNu));

  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                             : '✓ ' + testes + ' testes passaram') + '\n');
  process.exit(falhas ? 1 : 0);
})();

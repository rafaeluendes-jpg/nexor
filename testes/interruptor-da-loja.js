/* ==========================================================
   JOIA — O INTERRUPTOR DA LOJA MANDA DE VERDADE

   O Rafael, em 01/09/2026: "eu cliquei que a loja está ligada,
   automaticamente já liga o cardápio digital e já liga o robô. Isso não
   pode ser só de enfeite, isso precisa ser fato."

   Ele estava certo em desconfiar. O botão mexia em `cfg().lojaAberta`,
   que mora em `config_loja` — uma linha POR EMPRESA, não por unidade:

   1. Fechar Santa Fé fechava Jales e Alphaville junto.
   2. Cada aparelho reenviava o próprio valor a cada sincronização, e o
      estado passava a ser o de quem sincronizou por último. Era isso que
      deixava o tablet em "loja fechada" com o computador em "aberta".
   3. O robô nunca soube de nada: o botão não encostava em
      `whatsapp_config.robo_ativo`.

   O estado agora mora onde já é por unidade e já é o que o cliente
   enxerga: `cardapio_config.ativo`. A regra do banco só entrega cardápio
   com `ativo=true` para quem não está logado — loja desligada some do
   cardápio público. E o mesmo clique grava `robo_ativo`.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

function montar(opts) {
  opts = opts || {};
  const chamadas = { cardapio: [], zap: [], salvou: 0 };
  const DB = {
    config: { lojaAberta: true, tempoEntrega: 45, tempoRetirada: 20 },
    cardapio: { suc_santafe: { ativo: true }, suc_jales: { ativo: true } },
    zap: { suc_santafe: { ativo: true }, suc_jales: { ativo: true } },
    sucursais: [{ id: 'suc_santafe', nome: 'Santa Fé', ativa: true },
                { id: 'suc_jales', nome: 'Jales', ativa: true }]
  };
  const amb = {
    DB: DB, NUVEM: { ligada: opts.semNuvem ? false : true, loja: 'l1' },
    cfg: () => DB.config,
    baseCard: () => DB.cardapio, baseZap: () => DB.zap, baseSuc: () => {},
    lojaAtualId: () => opts.loja || 'suc_santafe',
    salvar: () => { chamadas.salvou++; },
    _quieto: () => {},
    api: async (caminho, metodo, corpo) => {
      if (opts.falhaCardapio) throw new Error('cardápio fora');
      chamadas.cardapio.push({ caminho, corpo }); return [{}];
    },
    gravarCfgZap: async (suc, campos) => {
      if (opts.falhaZap) return false;
      chamadas.zap.push({ suc, campos }); return true;
    }
  };
  const nomes = ['lojaLigada', 'definirLojaLigada'];
  const feito = new Function('amb',
    'with(amb){' + nomes.map(n => corpoDaFuncao(n, fonte)).join('\n') +
    '\nreturn {' + nomes.join(',') + '};}')(amb);
  Object.assign(amb, feito);
  return { DB, chamadas, f: feito };
}

console.log('\n── O estado da loja é de cada unidade, não da rede\n');
{
  const { DB, f } = montar();
  t('lê o estado da unidade aberta', f.lojaLigada() === true);
  DB.cardapio.suc_santafe.ativo = false;
  t('Santa Fé desligada aparece desligada', f.lojaLigada('suc_santafe') === false);
  t('e Jales continua ligada', f.lojaLigada('suc_jales') === true);
  t('unidade sem cardápio ainda cai no campo antigo, sem quebrar',
    f.lojaLigada('suc_nova') === true);
}

console.log('\n── Desligar a loja desliga o cardápio e o robô\n');
{
  const m = montar();
  return m.f.definirLojaLigada(false, 'suc_santafe').then(r => {
    t('o resultado volta certo', r.ok === true, JSON.stringify(r));
    t('o cardápio de Santa Fé fica desligado', m.DB.cardapio.suc_santafe.ativo === false);
    t('o robô de Santa Fé fica desligado', m.DB.zap.suc_santafe.ativo === false);
    t('Jales não foi tocada',
      m.DB.cardapio.suc_jales.ativo === true && m.DB.zap.suc_jales.ativo === true);
    t('gravou na nuvem o cardápio da unidade certa',
      m.chamadas.cardapio.length === 1 &&
      /cardapio_config\?sucursal_id=eq\.suc_santafe/.test(m.chamadas.cardapio[0].caminho),
      JSON.stringify(m.chamadas.cardapio));
    t('com ativo=false', m.chamadas.cardapio[0].corpo.ativo === false);
    t('e gravou robo_ativo=false na unidade certa',
      m.chamadas.zap.length === 1 && m.chamadas.zap[0].suc === 'suc_santafe' &&
      m.chamadas.zap[0].campos.robo_ativo === false, JSON.stringify(m.chamadas.zap));
    t('e salvou no aparelho', m.chamadas.salvou === 1);
    seguir();
  });
}
function seguir() {
  const m2 = montar({ loja: 'suc_jales' });
  m2.f.definirLojaLigada(true, 'suc_jales').then(r => {
    console.log('\n── Ligar a loja liga os dois\n');
    t('cardápio ligado', m2.DB.cardapio.suc_jales.ativo === true);
    t('robô ligado', m2.DB.zap.suc_jales.ativo === true);
    t('robo_ativo=true na nuvem', m2.chamadas.zap[0].campos.robo_ativo === true);
    t('ativo=true na nuvem', m2.chamadas.cardapio[0].corpo.ativo === true);

    console.log('\n── Sem nuvem, o interruptor não mente\n');
    const m3 = montar({ semNuvem: true });
    return m3.f.definirLojaLigada(false).then(r3 => {
      t('avisa que não deu', r3.ok === false, JSON.stringify(r3));
      t('e diz que foi a nuvem', r3.motivo === 'sem nuvem', r3.motivo);
      t('mas guarda a escolha no aparelho', m3.DB.cardapio.suc_santafe.ativo === false);

      const m4 = montar({ falhaZap: true });
      return m4.f.definirLojaLigada(false).then(r4 => {
        t('robô que não respondeu é reportado', r4.ok === false && /robô/.test(r4.motivo), r4.motivo);
        const m5 = montar({ falhaCardapio: true });
        return m5.f.definirLojaLigada(false).then(r5 => {
          t('cardápio que não respondeu é reportado',
            r5.ok === false && /cardápio/.test(r5.motivo), r5.motivo);
          fechar();
        });
      });
    });
  });
}
function fechar() {
  console.log('\n── O botão na tela é um interruptor, e diz o que faz\n');
  const tp = corpoDaFuncao('telaPDV', fonte);
  t('o botão mostra o trilho e a bolinha', /<span class="swT"><i><\/i><\/span>/.test(tp));
  t('escrito LOJA LIGADA / LOJA DESLIGADA', /LOJA LIGADA/.test(tp) && /LOJA DESLIGADA/.test(tp));
  t('é um interruptor de verdade para quem usa leitor de tela',
    /role="switch"/.test(tp) && /aria-checked/.test(tp));
  t('e o título explica que mexe no cardápio e no robô',
    /cardápio digital no ar e robô do WhatsApp atendendo/.test(tp));
  t('a tela lê o estado da unidade, não o campo da rede',
    /var _ab=lojaLigada\(\)/.test(tp));
  const tl = corpoDaFuncao('toggleLoja', fonte);
  t('o clique espera a nuvem antes de dizer que deu certo', /await definirLojaLigada/.test(tl));
  t('e trava o botão enquanto grava', /bt\.disabled=true/.test(tl));
  const at = corpoDaFuncao('aplicarTempos', fonte);
  t('mudar o tempo de entrega não abre nem fecha a loja',
    /var _lig=lojaLigada\(suc\)/.test(at) && !/ativo:c\.lojaAberta/.test(at));
  const css = fs.readFileSync(__dirname + '/../src/css/01-principal/01-inicio.css', 'utf8');
  t('a bolinha anda para o lado quando liga', /\.lojaSw\.ab \.swT i\{left:18px/.test(css));
  t('e volta quando desliga', /\.lojaSw\.fe \.swT i\{left:2px/.test(css));
  t('quem pediu menos animação não vê a bolinha correr',
    /prefers-reduced-motion[\s\S]{0,120}\.lojaSw \.swT/.test(css));

  console.log('\n── O aparelho atrasado diz que está atrasado\n');
  t('a faixa só aparece quando há coisa presa para subir',
    /if\(!\(NUVEM\.sujo\|\|DB\._sujo\)\)return '';/.test(tp));
  t('e só depois de cinco minutos parado, para não piscar a cada envio',
    /_parado<5\*60\*1000/.test(tp));
  t('ela diz desde que hora o aparelho não recebe nada',
    /não recebe novidade da nuvem desde as/.test(tp));
  t('avisa que o pedido na tela pode não ser o que já aconteceu',
    /pode não ser o que já aconteceu nos outros aparelhos/.test(tp));
  t('e explica por que o sistema não baixa por cima',
    /para não apagar o que você lançou aqui/.test(tp));
  const da = corpoDaFuncao('destravarAparelho', fonte);
  t('o botão tenta enviar primeiro', /await sincronizar\(\)/.test(da));
  t('e só baixa depois que a pendência saiu',
    /if\(NUVEM\.sujo\|\|DB\._sujo\)\{[\s\S]{0,600}return;/.test(da) &&
    da.indexOf('baixarDaNuvem') > da.indexOf('await sincronizar'));
  t('se não conseguir, diz onde ver qual tabela travou',
    /Diagnóstico da nuvem/.test(da));

  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                             : '✓ ' + testes + ' verificações, todas certas') + '\n');
  process.exit(falhas ? 1 : 0);
}

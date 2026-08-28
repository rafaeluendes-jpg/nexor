/* ==========================================================
   JOIA — O HORARIO DA LOJA TEM DE CHEGAR AO ROBO

   O horario de abertura e fechamento mora na configuracao do cardapio
   (`DB.cardapio[sucursal].horarios`). Quem o consome nao esta neste
   repositorio: e o cardapio digital e o robo do WhatsApp, que leem
   `cardapio_config.horarios` na nuvem. Entao, aqui, "funcionar" quer
   dizer uma coisa so: o que a pessoa marca na tela precisa SUBIR, e
   precisa SOBREVIVER ao proximo download.

   Duas marcas decidem isso, e elas nao sao decoracao:

     `_padrao`  — configuracao que o lojista nunca salvou nasce com ela,
                  e o envio filtra essas fora de proposito: config padrao
                  subindo apagaria o horario de verdade da nuvem.
     `_salvoEm` — e o que a trava da V119 compara com `atualizado_em` da
                  nuvem para decidir quem e mais novo. Sem ela, o
                  download seguinte escreve por cima e desfaz.

   `setHora`, `aplicarHorario` e `fecharDias` sempre gravaram as duas.
   `abrirHojeAgora` e `togDia` nao gravavam nenhuma — abriam a loja na
   tela do aparelho e o robo continuava respondendo "fechada". Corrigido
   na V210; estes testes prendem os cinco caminhos no lugar.
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* roda a função de verdade sobre um cardápio de mentira */
function comCardapio(nome, args, cfgInicial) {
  const DB = { cardapio: { s1: cfgInicial }, sucursais: [{ id: 's1', nome: 'Jales', ativa: true }] };
  const CD = { suc: 's1' };
  const chamadas = { salvar: 0, sincronizar: 0, tela: 0, toast: [] };
  const amb = {
    DB: DB, CD: CD, NUVEM: { ligada: true },
    cardAtual: () => DB.cardapio.s1,
    salvar: () => { chamadas.salvar++; },
    sincronizar: () => { chamadas.sincronizar++; },
    telaCfgCardapio: () => { chamadas.tela++; },
    toast: m => chamadas.toast.push(String(m)),
    $: id => ({ hrDe: { value: '10:00' }, hrAte: { value: '20:00' } })[id],
    horariosPadrao: () => [0, 1, 2, 3, 4, 5, 6].map(d =>
      ({ dia: d, fechado: d === 1, abre: '14:00', fecha: '22:30' }))
  };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao(nome, fonte) +
    '\n return ' + nome + '.apply(null, arguments[1]);}');
  f(amb, args);
  return { cfg: DB.cardapio.s1, chamadas };
}
function padrao(extra) {
  return Object.assign({
    _padrao: true, ativo: true,
    horarios: [0, 1, 2, 3, 4, 5, 6].map(d =>
      ({ dia: d, fechado: d === 1, abre: '14:00', fecha: '22:30' }))
  }, extra || {});
}

console.log('\n── Os cinco caminhos que mexem no horário\n');

/* 1. abrir hoje até 23:59 — o atalho do balcão */
const A = comCardapio('abrirHojeAgora', [], padrao());
const hoje = new Date().getDay();
const hj = A.cfg.horarios.find(x => Number(x.dia) === hoje);
t('abrirHojeAgora abre o dia de hoje',
  hj && hj.fechado === false && hj.abre === '00:00' && hj.fecha === '23:59',
  JSON.stringify(hj));
t('abrirHojeAgora tira a marca de configuração padrão',
  A.cfg._padrao === undefined, 'ainda tem _padrao: o envio filtraria fora');
t('abrirHojeAgora carimba a hora do salvamento',
  typeof A.cfg._salvoEm === 'number', 'sem _salvoEm o download desfaz');
t('e manda sincronizar', A.chamadas.sincronizar === 1);

/* 2. o interruptor de cada dia */
const B = comCardapio('togDia', [1], padrao());
t('togDia inverte o dia', B.cfg.horarios[1].fechado === false);
t('togDia tira a marca de padrão', B.cfg._padrao === undefined);
t('togDia carimba a hora', typeof B.cfg._salvoEm === 'number');

/* 3. digitar o horário na linha do dia */
const C = comCardapio('setHora', [2, 'abre', '11:00'], padrao());
t('setHora grava o valor', C.cfg.horarios[2].abre === '11:00');
t('setHora tira a marca de padrão', C.cfg._padrao === undefined);
t('setHora carimba a hora', typeof C.cfg._salvoEm === 'number');

/* 4. aplicar o mesmo horário em vários dias */
const D = comCardapio('aplicarHorario', [[1, 2, 3, 4, 5]], padrao());
t('aplicarHorario atinge só os dias escolhidos',
  D.cfg.horarios.filter(x => x.abre === '10:00').map(x => x.dia).join(',') === '1,2,3,4,5',
  D.cfg.horarios.map(x => x.dia + ':' + x.abre).join(' '));
t('e reabre o dia que estava fechado', D.cfg.horarios[1].fechado === false);
t('não encosta no fim de semana',
  D.cfg.horarios[0].abre === '14:00' && D.cfg.horarios[6].abre === '14:00');
t('aplicarHorario tira a marca de padrão', D.cfg._padrao === undefined);
t('aplicarHorario carimba a hora', typeof D.cfg._salvoEm === 'number');

/* 5. fechar dias de uma vez */
const E = comCardapio('fecharDias', [[0, 6]], padrao());
t('fecharDias fecha os escolhidos',
  E.cfg.horarios[0].fechado === true && E.cfg.horarios[6].fechado === true);
t('e não fecha os outros', E.cfg.horarios[3].fechado === false);
t('fecharDias tira a marca de padrão', E.cfg._padrao === undefined);
t('fecharDias carimba a hora', typeof E.cfg._salvoEm === 'number');

console.log('\n── A regra que faz o horário subir\n');

t('config padrão é filtrada do envio, de propósito',
  /filter\(function\(k\)\{return !\(DB\.cardapio\[k\]\|\|\{\}\)\._padrao;\}\)/.test(fonte));
t('e o horário vai junto no que sobe',
  /horarios:x\.horarios\|\|\[\]/.test(fonte));
t('a lista de envio é derivada por sucursal',
  /o\.id='cc_'\+k;o\.sucId=k;/.test(fonte));
t('com o carimbo da loja, senão o envio descarta',
  /o\._loja=DB\.cardapio\[k\]\._loja\|\|NUVEM\.loja;/.test(fonte));

console.log('\n── "Aberto agora" sai do horário, não de um interruptor\n');

const abaLoja = corpoDaFuncao('abaLoja', fonte);
t('compara o relógio com o dia de hoje',
  /var ag=new Date\(\),d=ag\.getDay\(\),m=ag\.getHours\(\)\*60\+ag\.getMinutes\(\)/.test(abaLoja));
t('respeita o dia marcado como fechado',
  /if\(!hoje\.fechado&&hoje\.abre\)/.test(abaLoja));
t('e entende quem fecha depois da meia-noite',
  /if\(fim<ini\)fim\+=1440;/.test(abaLoja));

console.log('\n── As duas telas têm porta de entrada\n');

t('Cardápio Digital é aba de Canais de Venda e Integração',
  /CN2\.aba==='cardapio'\)\{telaCfgCardapio\(true\);return;\}/.test(fonte));
t('Robô do WhatsApp também',
  /CN2\.aba==='whatsapp'\)\{telaZap\(true\);return;\}/.test(fonte));
t('e o item existe no menu',
  /id:'canais-integracao',n:'Canais de Venda e Integração'/.test(fonte));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · horário do cardápio e do robô');
console.log(testes - falhas + ' de ' + testes + ' testes passaram');
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

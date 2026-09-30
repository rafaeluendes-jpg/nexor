/* ==========================================================
   JOIA — O CUPOM FISCAL NÃO FICA PRESO (V375)

   A RDS, item 9.2: *"pagamento aprovado e fiscal falhou — manter a
   operação pendente, continuar a tentativa de transmissão; se houver
   rejeição definitiva, abrir regularização fiscal."*

   O Joia tinha a metade difícil pronta e a metade fácil faltando.

   `fiscalReprocessar` existe, é defensiva e faz a coisa certa: no
   máximo 10 por vez, só da unidade aberta, só cupom de até 24 h, pula
   quem está esperando cadastro. Mas tinha UM chamador em todo o
   sistema — `telaCuponsFiscais`. E ninguém abre aquela tela no balcão.

   Efeito real, medido em 29/09/2026: seis cupons parados em "enviando"
   porque a internet caiu na hora da venda. Ficaram o dia inteiro. A
   loja só descobriria se alguém fosse procurar.

   Agora ele roda onde a loja passa o dia: ao abrir o PDV. E o que NÃO
   pode ser reenviado sozinho — cupom recusado pela Receita, que precisa
   de alguém corrigir a causa — vira aviso na própria tela, em vez de
   esperar que alguém vá procurar.
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
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

console.log('\n── O reenvio sai da tela de Cupons e vai para o PDV\n');

const tp = semComentario(corpoDaFuncao('telaPDV', fonte));
t('o PDV reprocessa os cupons presos', /fiscalReprocessar\(\)/.test(tp));
t('em segundo plano, sem segurar o desenho da tela', /setTimeout\(function\(\)\{[\s\S]{0,400}fiscalReprocessar/.test(tp));
t('e a falha do reenvio nunca derruba o caixa', /\.catch\(function\(e\)\{_quieto\(e,'fiscalReprocessar'\)\}\)/.test(tp));
t('depois de reprocessar, avisa o que sobrou', /fsAvisoPendencias\(lojaAtualId\(\)\)/.test(tp));
t('e continua garantindo a configuração fiscal, como antes', /fiscalGarantir\(lojaAtualId\(\)\)/.test(tp));

/* a função continua defensiva — não pode ter sido afrouxada ao ganhar um
   chamador que roda o tempo todo */
console.log('\n── E continua tão cuidadosa quanto era\n');
const fr = semComentario(corpoDaFuncao('fiscalReprocessar', fonte));
t('sem nuvem, não faz nada', /if\(!NUVEM\.ligada\|\|!NUVEM\.token\)return 0;/.test(fr));
t('só da unidade aberta', /\(c\.sucursalId\|\|suc\)!==suc/.test(fr));
t('pula quem está esperando cadastro', /if\(c\.faltaCadastro\)return false;/.test(fr));
t('só cupom de até 24 h', /24\*3600\*1000/.test(fr));
t('no máximo 10 por vez', /\.slice\(0,10\)/.test(fr));
t('e NÃO reenvia recusado sozinho — repetir sem corrigir repete a recusa',
  /c\.status!=='pendente'&&c\.status!=='enviando'/.test(fr));

console.log('\n── O que precisa de gente vira aviso na tela\n');

function pend(cupons, suc) {
  const f = new Function('amb', 'suc',
    'with(amb){' + corpoDaFuncao('fsPendenciasDaUnidade', fonte) +
    '\n return fsPendenciasDaUnidade(suc);}');
  return f({ baseCuponsFiscais: () => cupons, lojaAtualId: () => 'sucA', _quieto: () => {} }, suc);
}

(function () {
  const r = pend([
    { id: 'c1', sucursalId: 'sucA', ambiente: 'producao', status: 'rejeitado' },
    { id: 'c2', sucursalId: 'sucA', ambiente: 'producao', status: 'enviando' },
    { id: 'c3', sucursalId: 'sucA', ambiente: 'producao', status: 'pendente' },
    { id: 'c4', sucursalId: 'sucA', ambiente: 'producao', status: 'autorizado', precisaCancelar: true },
    { id: 'c5', sucursalId: 'sucA', ambiente: 'producao', status: 'autorizado' },
    { id: 'c6', sucursalId: 'sucB', ambiente: 'producao', status: 'rejeitado' },
    { id: 'c7', sucursalId: 'sucA', ambiente: 'homologacao', status: 'rejeitado' },
    { id: 'c8', sucursalId: 'sucA', ambiente: 'producao', status: 'pendente', faltaCadastro: true },
    { id: 'c9', sucursalId: 'sucA', ambiente: 'producao', status: 'pendente', naoEmitir: true }
  ]);
  t('conta o recusado pela Receita', r.rejeitado === 1, r.rejeitado);
  t('conta o preso no envio (enviando + pendente)', r.preso === 2, r.preso);
  t('conta o que espera cancelamento', r.cancelar === 1, r.cancelar);
  t('o autorizado em ordem não é pendência', r.total === 4, r.total);
  t('cupom de OUTRA unidade fica de fora', r.total === 4);
  t('CUPOM DE HOMOLOGAÇÃO NÃO É PENDÊNCIA — nunca foi documento', r.total === 4);
  t('quem espera cadastro não entra: já tem o próprio aviso', r.total === 4);
  t('e o cupom de uma venda cancelada antes de emitir também não', r.total === 4);
})();

t('sem pendência nenhuma, o total é zero', pend([]).total === 0);
t('e cupom sem unidade é da unidade aberta',
  pend([{ id: 'x', ambiente: 'producao', status: 'rejeitado' }]).rejeitado === 1);

const av = semComentario(corpoDaFuncao('fsAvisoPendencias', fonte));
t('sem pendência, não aparece aviso nenhum', /if\(!p\.total\)return;/.test(av));
t('o aviso diz que a venda está salva — o que falta é o documento',
  /A venda está salva/.test(corpoDaFuncao('fsAvisoPendencias', fonte)));
/* a aspa vem escapada no fonte (esta dentro de uma string), entao a
   busca tem de tolerar a barra */
t('e leva direto para a tela de cupons',
  /abrir\(\\?'fiscal\\?',\\?'cupons\\?'\)/.test(corpoDaFuncao('fsAvisoPendencias', fonte)));
t('usa a faixa amarela que o fiscal já usa, sem inventar aparência',
  /className='fsChip at'/.test(av));
t('e não deixa dois avisos empilhados na tela',
  /getElementById\('fsPend'\);if\(o\)o\.remove\(\)/.test(av));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o cupom fiscal não fica preso');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

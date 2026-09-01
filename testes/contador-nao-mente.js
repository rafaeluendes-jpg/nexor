/* ==========================================================
   JOIA — O CONTADOR DE PENDÊNCIAS NÃO PODE MENTIR

   01/09/2026, computador de Santa Fé do Sul: a tela avisava "763
   alterações esperando para subir". Conferido no banco no mesmo minuto:
   756 pedidos no aparelho, 756 pedidos na nuvem, o último às 22:47.
   Não faltava nada.

   Havia DUAS regras para a mesma pergunta:
     - `anotarImpressoes` só anota a linha que é desta empresa
       (`_loja === l`) E que a nuvem já conhece (`_uuid`);
     - `contarPendencias` contava toda linha sem anotação, pulando
       apenas a de empresa DIFERENTE — a linha SEM `_loja` ele contava.

   Linha sem `_loja` nasceu antes de a sessão da empresa ficar pronta. O
   motor não a envia de propósito, e `anotarImpressoes` não a anota:
   ficava contada para sempre. Bastavam os 756 pedidos nesse caso.

   Agora há uma regra só — `precisaSubir` — e ela é a do motor de envio,
   palavra por palavra.

   E o segundo defeito, este meu, da V272: a faixa "este aparelho está
   atrasado" olhava só a marca `NUVEM.sujo` e mostrava esse número
   inflado, assustando numa loja em que nada estava preso.
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

const L = 'loja-uuid-1';
function pedidos(n, op) {
  op = op || {};
  const l = [];
  for (let i = 0; i < n; i++) {
    const p = { id: 'ped_' + i, numero: i, total: 10 + i, nome: 'p' + i };
    if (!op.semLoja) p._loja = L;
    l.push(p);
  }
  return l;
}
function api(DB) {
  const amb = {
    DB: DB, NUVEM: { loja: L, ligada: true },
    MAPA: [{ col: 'pedidos', tab: 'pedidos',
             campos: x => ({ numero: x.numero, total: x.total }) }],
    hashTexto: s => 'h' + s.length + ':' + s.split('').reduce((a, c) => (a + c.charCodeAt(0)) % 99991, 0),
    _quieto: () => {}
  };
  const nomes = ['impressaoDaLinha', 'precisaSubir', 'contarPendencias',
                 'contarRetidas', 'anotarImpressoes'];
  const feito = new Function('amb',
    'with(amb){' + nomes.map(n => corpoDaFuncao(n, fonte)).join('\n') +
    '\nreturn {' + nomes.join(',') + '};}')(amb);
  Object.assign(amb, feito);
  return feito;
}
function mundo(op) {
  op = op || {};
  const DB = { pedidos: pedidos(op.n || 756, op), _hash: {}, _uuid: { pedidos: {} } };
  if (!op.semUuid) DB.pedidos.forEach(x => { DB._uuid.pedidos[x.id] = 'uuid-' + x.id; });
  return DB;
}

console.log('\n── 756 pedidos, todos já na nuvem\n');
{
  const DB = mundo(); const f = api(DB);
  f.anotarImpressoes();
  t('o contador diz ZERO', f.contarPendencias() === 0, f.contarPendencias());
  t('e nada está retido', f.contarRetidas() === 0, f.contarRetidas());
}

console.log('\n── O caso que gerava os 763: linha sem empresa de origem\n');
{
  const DB = mundo({ semLoja: true }); const f = api(DB);
  f.anotarImpressoes();
  t('não são chamadas de "esperando para subir"', f.contarPendencias() === 0,
    f.contarPendencias());
  t('mas também não somem: aparecem como retidas', f.contarRetidas() === 756,
    f.contarRetidas());
}

console.log('\n── O que É pendência de verdade\n');
{
  const DB = mundo(); const f = api(DB);
  f.anotarImpressoes();
  DB.pedidos[3].total = 999;                       /* alterado aqui */
  t('linha alterada conta 1', f.contarPendencias() === 1, f.contarPendencias());
  DB.pedidos[7]._novoAqui = true;
  t('linha nova daqui conta junto', f.contarPendencias() === 2, f.contarPendencias());
  DB.pedidos[9]._fechamentoPendente = true;
  t('fechamento de caixa preso conta junto', f.contarPendencias() === 3, f.contarPendencias());
  delete DB._uuid.pedidos['ped_11'];
  t('linha que a nuvem não conhece conta junto', f.contarPendencias() === 4, f.contarPendencias());
}
{
  const DB = mundo({ semUuid: true }); const f = api(DB);
  f.anotarImpressoes();
  t('aparelho que nunca sincronizou conta tudo — e aí é verdade',
    f.contarPendencias() === 756, f.contarPendencias());
}

console.log('\n── Contador e anotação usam a MESMA regra\n');
{
  const DB = mundo(); const f = api(DB);
  const anotou = f.anotarImpressoes();
  t('anotou as 756', anotou === 756, anotou);
  t('e o que não foi anotado é exatamente o que o contador conta',
    f.contarPendencias() === 756 - anotou, f.contarPendencias());
  const ap = corpoDaFuncao('anotarImpressoes', fonte);
  const cp = corpoDaFuncao('contarPendencias', fonte);
  t('as duas filtram pela empresa do mesmo jeito',
    /_loja===l/.test(ap) && /_loja===l/.test(cp));
  t('o contador chama a regra única', /precisaSubir\(E2,minhas\[i\],i,h,uu\)/.test(cp));
}

console.log('\n── A faixa de aparelho atrasado exige motivo de verdade\n');
{
  const tp = corpoDaFuncao('telaPDV', fonte);
  t('não aparece sem pendência pela conta do motor',
    /var _n=0; try\{_n=contarPendencias\(\)\}catch[\s\S]{0,60}if\(!_n\)return '';/.test(tp));
  t('não aparece se ainda não houve download nesta sessão',
    /if\(!_ud\)return '';/.test(tp));
  t('e só depois de cinco minutos parado',
    /if\(Date\.now\(\)-_ud<5\*60\*1000\)return '';/.test(tp));
  t('não fala mais em "ainda não conseguiu receber nada"',
    !/ainda não conseguiu receber nada da nuvem/.test(tp));
}

console.log('\n── O endereço da unidade na nuvem é um UUID\n');
{
  const amb = { DB: { _uuid: { sucursais: { suc_abc: 'f0de0748-3532-4f4c-b107-3dc2e90e696e' } } },
                _ids: {}, _quieto: () => {} };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao('sucursalNaNuvem', fonte) +
    '\nreturn sucursalNaNuvem;}')(amb);
  t('traduz o identificador local para o da nuvem',
    f('suc_abc') === 'f0de0748-3532-4f4c-b107-3dc2e90e696e', f('suc_abc'));
  t('um uuid passa direto',
    f('f0de0748-3532-4f4c-b107-3dc2e90e696e') === 'f0de0748-3532-4f4c-b107-3dc2e90e696e');
  t('sem tradução devolve nulo, para ninguém mandar consulta quebrada',
    f('suc_desconhecida') === null, f('suc_desconhecida'));
  t('e vazio também', f('') === null);

  const dl = corpoDaFuncao('definirLojaLigada', fonte);
  t('o interruptor traduz antes de gravar', /var uu=sucursalNaNuvem\(suc\)/.test(dl));
  t('e não manda a consulta quando não sabe traduzir',
    /if\(!uu\)falhou\.push/.test(dl));
  t('confere se o PATCH achou a linha, em vez de dizer "pronto" à toa',
    /if\(Array\.isArray\(r\)&&!r\.length\)falhou\.push/.test(dl));
  const at = corpoDaFuncao('aplicarTempos', fonte);
  t('o campo de minutos do PDV também traduz',
    /var _uu=sucursalNaNuvem\(suc\)/.test(at) && /if\(NUVEM\.ligada&&_uu\)/.test(at));
  t('e nenhum dos dois manda mais o identificador local',
    !/cardapio_config\?sucursal_id=eq\.'\+suc/.test(fonte));

  const gz = corpoDaFuncao('gravarCfgZap', fonte);
  t('o robô é gravado pela chave que as duas linhas da unidade têm igual',
    /whatsapp_config\?ref_local=eq\.'\+encodeURIComponent\('wz_'\+sucursalId\)/.test(gz));
  t('com volta pela unidade, para linha antiga sem ref_local',
    /whatsapp_config\?sucursal_id=eq\.'\+encodeURIComponent\(sucursalId\)/.test(gz));
}

console.log('\n── O erro do item recusado não aparece como "undefined"\n');
{
  const sinc = fonte.slice(fonte.indexOf('async function sincronizar('),
                           fonte.indexOf('async function sincronizar(') + 60000);
  t('a falha da tabela filha grava o texto em msg, que é o que o Diagnóstico lê',
    /NUVEM\.erros\.push\(\{tab:F\.tab,motivo:_mFilho,msg:_mFilho\}\)/.test(sinc));
  t('e continua gravando em motivo, para quem já lia de lá',
    /motivo:_mFilho/.test(sinc));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

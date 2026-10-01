/* ==========================================================
   VIGIA — A CAIXINHA DE ERROS (V407, 01/10/2026)

   Rafael: "pode ligar o vigia" (VIGIA_PLANO.md) e "voces que resolvem
   esses erros das notas — pare de aparecer esses erros na tela".

   Prende:
     · todo erro vai para a caixinha (`registrar_erro`), juntando as
       repetições; o Diagnóstico local, a sincronização e os erros de tela
       estão ligados nela;
     · erro de cupom não aparece no balcão: vai para a caixinha;
     · o aviso amarelo do PDV só fica para o cancelamento com prazo;
     · o cupom de ontem à noite volta a ser reconferido (a janela de 24 h
       conta a hora da venda, não a meia-noite UTC — venda 2562);
     · cupom autorizado que não imprimiu entra na fila de reimpressão.

   Rodar:  node testes/vigia-caixinha.js
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const semCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — vigia e caixinha de erros\n');

console.log('── 1. A caixinha\n');
t('a caixinha existe no banco (migration guardada)',
  fs.existsSync(path.join(__dirname, '..', 'supabase/migrations/20261001_vigia_caixinha_de_erros.sql')));
const fns = ['vigiaNormaliza', 'vigiaAparelho', 'vigiaGuardarFila', 'reportarErro', 'vigiaDaFalha'];
const mk = new Function('lojaAtualId', 'localStorage', 'setTimeout', 'clearTimeout', 'NUVEM',
  "var VIGIA={fila:[],vistos:{},timer:null,enviando:false};var VIGIA_JANELA=600000;var VIGIA_FILA_MAX=60;var VERSAO='Vx';" +
  "function vigiaEnviar(){return Promise.resolve(0);}\n" +
  fns.map(n => corpoDaFuncao(n, fonte)).join('\n') + '\nreturn {VIGIA,' + fns.join(',') + '};');
const ls = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } };
const v = mk(() => 'suc_sf', ls, () => 0, () => {}, { perfil: { nome: 'Caixa SF' } });
v.reportarErro('fiscal', 'cupom', 'Cupom recusado 123456');
v.reportarErro('fiscal', 'cupom', 'Cupom recusado 999999');
t('o mesmo erro (só muda o número) vira uma linha só na fila', v.VIGIA.fila.length === 1, v.VIGIA.fila.length);
t('a fila fica guardada no aparelho para mandar depois', /Cupom recusado/.test(ls.d.nexor_vigia_fila || ''));
t('leva a loja, o aparelho, quem estava e a versão',
  v.VIGIA.fila[0].sucursal === 'suc_sf' && !!v.VIGIA.fila[0].aparelho && v.VIGIA.fila[0].usuario === 'Caixa SF' && v.VIGIA.fila[0].versao === 'Vx');
v.vigiaDaFalha('desempenho', 'tela', 'lento', {});
v.vigiaDaFalha('rede', 'pedidos', 'caiu', { situacao: 'vai tentar de novo' });
t('desempenho e falha que ainda vai tentar de novo não entram', v.VIGIA.fila.length === 1, v.VIGIA.fila.length);
v.vigiaDaFalha('sincronizacao', 'pedidos', 'não subiu', { situacao: 'desistiu' });
t('falha final entra', v.VIGIA.fila.length === 2);
t('o Diagnóstico local manda para a caixinha', /vigiaDaFalha\(area,onde,msg,extra\)/.test(corpoDaFuncao('registrarFalha', fonte)));
t('o aviso da sincronização manda para a caixinha', /reportarErro\('nuvem'/.test(corpoDaFuncao('logNuvem', fonte)));
const en = semCom(corpoDaFuncao('vigiaEnviar', fonte));
t('o envio usa fetch direto — nunca api(), que registraria a própria falha em laço',
  /rpc\/registrar_erro/.test(en) && !/\bapi\(/.test(en));
t('erro de tela e promessa solta também vão', /addEventListener\('error'/.test(fonte) && /addEventListener\('unhandledrejection'/.test(fonte));
t('a Central de Erros está no menu de Administração e tem rota',
  /\{id:'central-erros',n:'Central de Erros'\}/.test(fonte) && /iid==='central-erros'\)return telaCentralErros\(\)/.test(fonte));

console.log('\n── 2. O balcão não vê erro de cupom\n');
const ch = semCom(corpoDaFuncao('fsChip', fonte));
t('recusado, passageira e pendente com motivo vão para o vigia, sem aviso no balcão',
  /c\.status==='rejeitado'\)\{if\(typeof vigiaFiscal==='function'\)vigiaFiscal\(c\);return;\}/.test(ch) &&
  /c\.status==='pendente'&&c\.motivo\)\{if\(typeof vigiaFiscal==='function'\)vigiaFiscal\(c\);return;\}/.test(ch));
const av = semCom(corpoDaFuncao('fsAvisoPendencias', fonte));
t('o aviso amarelo do PDV só aparece para cancelamento com prazo',
  /vigiaFiscalPendencias\(suc\)/.test(av) && /if\(!p\.cancelar\)return;/.test(av) && !/preso\(s\) no envio/.test(av));

console.log('\n── 3. O cupom de ontem à noite (venda 2562)\n');
const q = new Function(corpoDaFuncao('fsQuandoDoCupom', fonte) + '\nreturn fsQuandoDoCupom;')();
const esperado = new Date(2026, 8, 30, 21, 0, 0).getTime();
t('a hora da venda conta (30/09 21:00 é 30/09 21:00, não meia-noite UTC)',
  q({ data: '2026-09-30', hora: '21:00' }) === esperado, q({ data: '2026-09-30', hora: '21:00' }) + ' vs ' + esperado);
t('sem data, não quebra', q({}) === 0);
const fr = semCom(corpoDaFuncao('fiscalReprocessar', fonte));
t('o reprocesso usa a hora da venda, e consulta o que já foi enviado por 72 h',
  /var _quando=fsQuandoDoCupom\(c,ped\);/.test(fr) && /c\.status==='enviando'\?limite-48\*3600\*1000:limite/.test(fr) &&
  !/new Date\(ped\.data\|\|c\.data\)/.test(fr));

console.log('\n── 4. Cupom autorizado que não imprimiu\n');
const im = semCom(corpoDaFuncao('imprimirDanfe', fonte));
t('a impressão automática que falha vai para a fila e para o vigia, sem aviso na tela',
  /c\.imprimirPendente=c\.imprimirPendente\|\|Date\.now\(\)/.test(im) && /vigiaFiscal\(c,'Cupom autorizado não imprimiu/.test(im));
t('impressa, sai da fila', /delete c\.imprimirPendente;/.test(im));
t('a reimpressão leva só a via fiscal (a da cozinha já saiu)', /&&!op\.soFiscal\)/.test(im));
t('o reprocesso reimprime, a cada 2 minutos, por até 30 minutos',
  /c\.imprimirPendente&&!c\.impressoEm/.test(fr) && /30\*60\*1000/.test(fr) && /2\*60\*1000/.test(fr) &&
  /imprimirDanfe\(_reimp\[j\]\.id,\{auto:true,soFiscal:true\}\)/.test(fr));
t('a venda que imprime sozinha é marcada como automática',
  /if\(u\.imprime==='sempre'\)_fsAuto\[c\.id\]=1;/.test(corpoDaFuncao('fsDepoisDeEmitir', fonte)));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   CUPOM RÁPIDO E "RECUSADO" QUE ERA A SEFAZ FORA DO AR (V403, 01/10/2026)

   Rafael: "ainda dá cupom recusado na frente de caixa, e está demorando
   demais para imprimir depois que fecha a venda. Resolva de uma vez."

   O que os registros mostraram:
     · o recusado de hoje (cupom 76, Santa Fé) era "Erro ao estabelecer
       comunicação com a SEFAZ" — falha passageira que ninguém reenviava;
     · cada venda fazia 4 idas ao servidor em fila (conferir a loja,
       emitir, consultar, buscar o DANFE), de 1,3 a 3 s cada.

   Prende:
     · o servidor espera a autorização dentro da emissão, reenvia a mesma
       nota (/issue) na falha de comunicação e já devolve o DANFE;
     · a ação "reenviar" só age com prova (lê a nota e exige falha de
       comunicação) e nunca cria nota nova;
     · o caixa usa o DANFE que veio, reenvia a falha passageira, e a fila
       do aparelho tenta de novo depois;
     · no balcão, falha passageira não aparece como "recusou";
     · a venda não espera a conferência da loja quando já se sabe que ela
       emite.

   Rodar:  node testes/fiscal-rapido-e-sefaz-fora.js
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const srv = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/joia-fiscal/index.ts'), 'utf8');
const semCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — cupom rápido e SEFAZ fora do ar\n');

console.log('── 1. O servidor\n');
const em = srv.slice(srv.indexOf('if (acao === "emitir")'), srv.indexOf('if (acao === "consultar")'));
t('a emissão espera a autorização ali mesmo', /const espera = await aguardarNota\(chave, r\.d\?\.id, r\.d\);/.test(em));
t('e devolve o cupom pronto para a bobina', /danfeDoCupom\(base, chave, r\.d\?\.id\)/.test(em) && /nota: nota\(base, final\), danfe/.test(em));
const ag = srv.slice(srv.indexOf('async function aguardarNota'), srv.indexOf('async function registrar'));
t('a espera tem limite (o caixa nunca fica preso)', /limiteMs = 7000/.test(ag) && /while \(Date\.now\(\) < ate\)/.test(ag));
t('falha de comunicação: reenvia a MESMA nota, no máximo duas vezes', /reenvios < 2/.test(ag) &&
  /\/consumer-invoices\/\$\{encodeURIComponent\(id\)\}\/issue/.test(ag) && !/"POST", "\/consumer-invoices"/.test(ag));
t('a falha de comunicação é reconhecida pela mensagem da SEFAZ', /comunica\[cç\]\[aã\]o com a sefaz\|erro ao estabelecer/.test(srv));
const rv = srv.slice(srv.indexOf('if (acao === "reenviar")'), srv.indexOf('if (acao === "reemitir")'));
t('"reenviar" só age com prova: lê a nota e exige falha de comunicação',
  /if \(!ehFalhaPassageira\(g\.d\)\)/.test(rv) && /return responde\(409/.test(rv));
t('"reenviar" usa a mesma nota (/issue), nunca cria outra', /\/issue`, \{\}\)/.test(rv) && !/"POST", "\/consumer-invoices",/.test(rv));
t('o DANFE continua saindo só do XML autorizado (o QR com o CSC fica no servidor)',
  /async function danfeDoCupom/.test(srv) && /qrCode: tag\(xml, "qrCode"\)/.test(srv));

console.log('\n── 2. O caixa\n');
const ec = semCom(corpoDaFuncao('emitirCupom', fonte));
t('guarda o DANFE que veio com a emissão', /_fsDanfe\[c\.id\]=r\.d\.danfe/.test(ec));
t('e o if/senão da emissão continua inteiro (o DANFE não engole o "senão")',
  ec.indexOf('_fsDanfe[c.id]=r.d.danfe') < ec.indexOf('if(r.ok&&r.d&&r.d.nota)aplicarNotaNoCupom(c,r.d.nota);\n    else if'));
t('depois de emitir, reenvia a falha passageira', /fsReenviarPassageira\(c\)/.test(ec));
const im = semCom(corpoDaFuncao('imprimirDanfe', fonte));
t('imprimir usa o DANFE que já veio, sem outra ida ao servidor', /_fsDanfe\[cupomId\]/.test(im));
const ep = new Function(corpoDaFuncao('ehFalhaPassageira', fonte).replace('function ehFalhaPassageira', 'var FS_FALHA_PASSAGEIRA=' +
  (fonte.match(/var FS_FALHA_PASSAGEIRA=(\/.*\/i);/) || [])[1] + ';return function') )();
t('"Erro ao estabelecer comunicação com a SEFAZ" é falha passageira',
  ep({ status: 'rejeitado', motivo: 'Erro ao estabelecer comunicação com a SEFAZ.' }));
t('NCM errado não é', !ep({ status: 'rejeitado', motivo: 'Rejeição: NCM inexistente' }));
t('número repetido não é (tem o caminho dele)', !ep({ status: 'rejeitado', motivo: 'Rejeição: Duplicidade de NF-e' }));
const rp = semCom(corpoDaFuncao('fsReenviarPassageira', fonte));
t('o caixa reenvia até três vezes, espaçado', /maxTent=maxTent\|\|3/.test(rp) && /\[1500,4000,8000\]/.test(rp) &&
  /fiscalChamar\('reenviar'/.test(rp));
const fr = semCom(corpoDaFuncao('fiscalReprocessar', fonte));
t('a fila do aparelho tenta de novo mais tarde', /ehFalhaPassageira\(c\)/.test(fr) && /fsReenviarPassageira\(c\)/.test(fr));
const ch = semCom(corpoDaFuncao('fsChip', fonte));
t('no balcão, falha passageira não aparece como "recusou"',
  ch.indexOf('ehFalhaPassageira(c)') >= 0 && ch.indexOf('ehFalhaPassageira(c)') < ch.indexOf("c.status==='rejeitado'"));
t('falha passageira conta como presa no envio, não como recusada',
  /ehFalhaPassageira\(c\)\)\{r\.preso\+\+;return;\}/.test(semCom(corpoDaFuncao('fsPendenciasDaUnidade', fonte))));
const rc = semCom(corpoDaFuncao('registrarCupom', fonte));
t('a venda não espera a conferência da loja quando já se sabe que ela emite',
  /var jaSabe=!!\(uC&&uC\.lidoEm&&fiscalEmite\(suc\)\);/.test(rc) && /jaSabe\?Promise\.resolve\(uC\):fiscalGarantir\(suc\)/.test(rc));

console.log('\n── 3. Login do Supabase fora do ar (V404, venda 2580)\n');
t('o servidor dá 5 s ao login, não 90', /comPrazo\(cli\.auth\.getUser\(\), 5000\)/.test(srv));
t('login fora do ar: quem confere o token é o banco (public.eu)', /cli\.rpc\("eu"\)/.test(srv) &&
  fs.existsSync(path.join(__dirname, '..', 'supabase/migrations/20261001_fiscal_eu_sem_servico_de_login.sql')));
t('token inválido de verdade continua barrado', /if \(r && st >= 400 && st < 500\) return null;/.test(srv));
t('login fora do ar responde 503 "pendente", não "sessão inválida"', /responde\(503, \{ erro: "O login do sistema não respondeu agora/.test(srv));
const fc = semCom(corpoDaFuncao('fiscalChamar', fonte));
t('o caixa desiste da chamada em 30 s', /setTimeout\(function\(\)\{try\{_ctl\.abort\(\)\}catch\(e\)\{\}\},30000\)/.test(fc) && /signal:_ctl\?_ctl\.signal:undefined/.test(fc));
t('e tenta o cupom de novo em 3, 6, 12 e 20 s', /\[3000,6000,12000,20000\]/.test(ec) &&
  /r\.status===0\|\|r\.status===401\|\|r\.status===429\|\|r\.status>=500/.test(ec));
t('o cupom que chega atrasado não repete a ficha que já saiu',
  /_fsViaSo\[ped\.id\]=1;/.test(fonte) && /!\(typeof _fsViaSo!=='undefined'&&_fsViaSo\[ped\.id\]\)/.test(im));

console.log('\n── 4. Definições fiscais da planilha (V405, PIS/COFINS 99)\n');
t('PIS/COFINS 49 e 99 sem alíquota vão com alíquota 0 explícita, no servidor',
  /Number\(t\.cst\) === 49 \|\| Number\(t\.cst\) === 99\) && t\.rate == null\) t\.rate = 0;/.test(srv) &&
  srv.indexOf('t.rate = 0;') < srv.indexOf('spedy(chave, "POST", "/consumer-invoices", n)'));
t('o cupom que ainda não tem XML é buscado de novo, em silêncio, até meio minuto',
  /\[1500,3000,5000,8000,12000\]/.test(im) && /r\.status===0\|\|r\.status===404\|\|r\.status===409\|\|r\.status===429\|\|r\.status>=500/.test(im));
t('a gravação da planilha está guardada',
  fs.existsSync(path.join(__dirname, '..', 'supabase/migrations/20261001_definicoes_fiscais_santa_fe.sql')));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

const { JSDOM, VirtualConsole } = require('jsdom');
const fs=require('fs');
(async()=>{
const vc=new VirtualConsole(); const err=[];
vc.on('jsdomError',e=>err.push(String(e.message||e).slice(0,150)));
const enviados=[];
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{
  runScripts:'dangerously',pretendToBeVisual:true,url:'https://joiagest.com.br/',
  virtualConsole:vc,
  beforeParse(w){
    /* intercepta o que o sistema tenta ENVIAR */
    w.fetch=function(url,opt){
      var u=String(url);
      if(opt&&opt.method==='POST'&&u.indexOf('/rest/v1/')>=0){
        var tab=u.split('/rest/v1/')[1].split('?')[0];
        var corpo=[]; try{corpo=JSON.parse(opt.body||'[]')}catch(e){}
        enviados.push({tab:tab,qtd:corpo.length,
          amostra:corpo.slice(0,1).map(function(x){return x.ref_local||x.nome||'?'})});
        return Promise.resolve({ok:true,status:200,headers:{get:()=>null},
          json:()=>Promise.resolve(corpo.map(function(x,i){
            return Object.assign({id:'uuid-'+tab+'-'+i},x);})),
          text:()=>Promise.resolve('[]')});
      }
      return Promise.reject(new Error('offline'));
    };
    w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){}}));
    w.scrollTo=()=>{};w.print=()=>{};w.alert=()=>{};w.confirm=()=>true;
    w.crypto=w.crypto||{}; if(!w.crypto.subtle)w.crypto.subtle={digest:async()=>new ArrayBuffer(32)};
    w.addEventListener('error',e=>err.push('onerror: '+(e.message||e)));
    w.addEventListener('unhandledrejection',e=>err.push('rejeicao: '+e.reason));
  }});
await new Promise(r=>setTimeout(r,900));
const w=dom.window;
w.eval(`
  NUVEM.loja='6001c62e'; NUVEM.ligada=true; NUVEM.chave='x'; NUVEM.token='x';
  NUVEM.url='https://cevghkndzpzvnzwifhnm.supabase.co';
  DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true},
                {id:'suc_sf',nome:'Santa Fé',matriz:false,ativa:true}];
  DB.lojaAtual='suc_sf'; S.loja='suc_sf';
  DB.categorias=[{id:'cat_taxa',nome:'Taxa',ativo:true,ordem:0,sucursais:['suc_sf'],_loja:'6001c62e'}];
  DB.produtos=[]; DB._uuid={}; DB._hash={}; DB._enviados={}; DB._snap={};
  DB._sujo=false;
`);
// cria o produto exatamente como a tela cria
w.eval(`
  _prod={id:null,nome:'PROD DIAG',preco:9,pesado:false,variacao:false,
    categoriaId:'cat_taxa',disponivel:{pdv:true,delivery:true,cardapio:true},
    codigo:'',imagem:'',ativo:true,nomeOnline:'',detalhes:'',grupos:[],promocoes:[]};
`);
await w.eval(`salvarProduto('sair')`);
await new Promise(r=>setTimeout(r,1500));
console.log('produtos em DB:', w.eval('DB.produtos.length'));
console.log('produto na lista:', w.eval("JSON.stringify(DB.produtos.map(p=>p.nome))"));
console.log('_sujo:', w.eval('DB._sujo'));
console.log('\nCHAMADAS DE ENVIO:');
if(!enviados.length) console.log('  NENHUMA — o sistema nao tentou enviar nada');
else enviados.forEach(e=>console.log('  '+e.tab+' ('+e.qtd+') '+JSON.stringify(e.amostra)));
if(err.length){console.log('\nERROS:');err.slice(0,5).forEach(e=>console.log('  '+e));}
dom.window.close();
})();

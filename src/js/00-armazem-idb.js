/* ==========================================================
   ARMAZEM DO APARELHO — IndexedDB (com localStorage de reserva)

   POR QUE ESTE ARQUIVO EXISTE

   A base do aparelho morava no `localStorage`, que o navegador limita a
   ~5 MB. Uma loja em 5 semanas quase encheu isso — foi o "memoria cheia".
   Comprimir (V310) e guardar so 30 dias (V311) empurraram o problema; a
   correcao de raiz e trocar o armazem por IndexedDB, que guarda centenas
   de MB e some com o teto.

   Esta peca e so o CANO: um par chave→valor sobre IndexedDB, com uma
   unica "gaveta" (`kv`) e uma unica chave de verdade em uso
   (`nexor_dados`). Nada de esquema, indices ou migracao de banco — quem
   cuida da migracao dos DADOS e o `01-inicio.js`.

   Regra de ouro: se o IndexedDB nao existir ou falhar, NADA para. Quem
   chama trata a promessa que rejeita e cai de volta no `localStorage`.
   Aparelho em aba anonima, navegador antigo, cota negada — todos
   continuam vendendo, como antes.
   ========================================================== */
var _IDB = { db: null, nome: 'nexor', gaveta: 'kv', versao: 1 };

/* o navegador tem IndexedDB utilizavel? (aba anonima do Safari expoe o
   objeto mas estoura ao abrir — por isso quem chama sempre trata o erro) */
function idbDisponivel(){
  try{ return typeof indexedDB !== 'undefined' && !!indexedDB; }
  catch(e){ return false; }
}
function _idbAbrir(){
  if(_IDB.db) return Promise.resolve(_IDB.db);
  return new Promise(function(resolve, reject){
    if(!idbDisponivel()){ reject(new Error('sem indexedDB')); return; }
    var req;
    try{ req = indexedDB.open(_IDB.nome, _IDB.versao); }
    catch(e){ reject(e); return; }
    req.onupgradeneeded = function(){
      try{
        var db = req.result;
        if(!db.objectStoreNames.contains(_IDB.gaveta)) db.createObjectStore(_IDB.gaveta);
      }catch(e){ /* o onerror abaixo recolhe */ }
    };
    req.onsuccess = function(){ _IDB.db = req.result; resolve(req.result); };
    req.onerror  = function(){ reject(req.error || new Error('indexedDB.open falhou')); };
    req.onblocked= function(){ reject(new Error('indexedDB bloqueado')); };
  });
}
function idbLer(chave){
  return _idbAbrir().then(function(db){
    return new Promise(function(resolve, reject){
      var req = db.transaction(_IDB.gaveta, 'readonly').objectStore(_IDB.gaveta).get(chave);
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror   = function(){ reject(req.error); };
    });
  });
}
function idbGravar(chave, valor){
  return _idbAbrir().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(_IDB.gaveta, 'readwrite');
      tx.objectStore(_IDB.gaveta).put(valor, chave);
      tx.oncomplete = function(){ resolve(true); };
      tx.onerror    = function(){ reject(tx.error); };
      tx.onabort    = function(){ reject(tx.error || new Error('transação abortada')); };
    });
  });
}
function idbApagar(chave){
  return _idbAbrir().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(_IDB.gaveta, 'readwrite');
      tx.objectStore(_IDB.gaveta).delete(chave);
      tx.oncomplete = function(){ resolve(true); };
      tx.onerror    = function(){ reject(tx.error); };
    });
  });
}

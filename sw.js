/* ==========================================================
   JOIA — Service Worker
   O sistema ja vendia sem internet: a venda e gravada no aparelho e
   sobe depois. Faltava a parte mais boba e mais fatal — se alguem
   recarregasse a pagina com a internet fora, o navegador ia buscar o
   arquivo no servidor e nao achava. A loja parava por causa de um F5.
   Este arquivo guarda o sistema no proprio aparelho.
   ========================================================== */
/* ==========================================================
   O NAVEGADOR SO TROCA O SERVICE WORKER SE O ARQUIVO MUDAR

   Este arquivo era identico a cada publicacao. O navegador compara
   byte a byte: igual, nao instala nada, e o service worker antigo
   continua servindo o sistema antigo do cache.

   Era metade da razao de a loja ficar presa na V192 com a V194 no ar.

   Agora a versao vive aqui e sobe a cada publicacao, junto com a do
   `index.html`. Arquivo diferente = service worker novo = cache novo =
   sistema novo. O nome do cache carrega a versao, entao o antigo e
   apagado no `activate`, que ja limpa tudo o que nao for o atual.
   ========================================================== */
var VERSAO_SW = 'V266.0.0';
var CACHE = 'joia-' + VERSAO_SW;
var ESSENCIAIS = [
  './',
  './index.html',
  './supabase.js',
  './manifest.json',
  './joia-icone.png',
  './joia-icone-192.png',
  './joia-fundo.jpg'
];

self.addEventListener('install', function (e) {
  /* nao falha a instalacao se um arquivo faltar: melhor cachear o que da */
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ESSENCIAIS.map(function (u) {
        return c.add(u).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        return n === CACHE ? null : caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  /* Supabase e qualquer API NUNCA sao servidos do cache: dado velho
     apresentado como atual e pior do que erro de rede. */
  if (url.origin !== self.location.origin) return;

  /* O sistema e um arquivo so, e muda toda hora. Entao: tenta a rede
     primeiro e guarda a versao nova; sem rede, serve a guardada.

     Para o index.html a rede tem prazo: se em 4 s nao respondeu, serve
     o guardado para a loja nao ficar esperando — mas continua buscando
     em segundo plano e guarda a versao nova para a proxima abertura.
     Antes, rede lenta virava cache velho sem nunca se corrigir. */
  e.respondWith(
    fetch(req).then(function (resp) {
      if (resp && resp.status === 200) {
        var copia = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return resp;
    }).catch(function () {
      return caches.match(req).then(function (achou) {
        if (achou) return achou;
        /* navegacao sem cache: devolve a pagina principal guardada */
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'sem conexão' });
      });
    })
  );
});

/* permite ao sistema pedir a limpeza do cache ao publicar versao nova */
self.addEventListener('message', function (e) {
  if (e.data === 'limpar-cache') {
    caches.delete(CACHE).then(function () {
      if (e.source) e.source.postMessage('cache-limpo');
    });
  }
});

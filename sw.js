/* Tour DAGMA — service worker v2
   HTML: network-first (pega a versão nova quando há internet; usa cache se offline).
   Demais arquivos: cache-first com atualização em segundo plano.
   Resultado: continua funcionando offline no campo, mas atualiza sozinho quando online. */
var CACHE = "gdm-licensing-v1";
var SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k !== CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if(url.origin !== self.location.origin) return; /* externos: deixa passar */

  var aceita = (req.headers.get("accept") || "");
  var ehHTML = req.mode === "navigate" ||
               aceita.indexOf("text/html") > -1 ||
               url.pathname === "/" ||
               url.pathname.slice(-1) === "/" ||
               url.pathname.slice(-5) === ".html";

  if(ehHTML){
    /* network-first: sempre tenta a versão publicada; offline cai no cache */
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.status === 200){
          var cl = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, cl); });
        }
        return res;
      }).catch(function(){
        return caches.match(req, {ignoreSearch:true}).then(function(c){
          return c || caches.match("./index.html");
        });
      })
    );
    return;
  }

  /* demais GET same-origin: cache-first, atualizando por baixo */
  e.respondWith(
    caches.match(req, {ignoreSearch:true}).then(function(cached){
      var net = fetch(req).then(function(res){
        if(res && res.status === 200){
          var cl = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, cl); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || net;
    })
  );
});

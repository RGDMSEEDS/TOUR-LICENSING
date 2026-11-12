/* GDM Licensing — service worker v3
   - Só limpa caches DESTE app (prefixo gdm-licensing-): não apaga o offline do outro app no mesmo endereço.
   - Página: tenta a internet por até 3,5 s; se não responder, abre a cópia guardada (sinal fraco no campo).
     A versão nova continua baixando e fica guardada para a próxima abertura. */
var PFX = "gdm-licensing-";
var CACHE = PFX + "v3";
var SHELL = ["./", "./index.html", "./manifest.webmanifest"];
var ESPERA_REDE = 3500;

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); })
    .then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k.indexOf(PFX)===0 && k!==CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); }));
});

function guardar(req, res){
  if(res && res.status===200){ var cl=res.clone(); caches.open(CACHE).then(function(c){ c.put(req, cl); }); }
  return res;
}
function daCopia(req){
  return caches.match(req,{ignoreSearch:true}).then(function(c){ return c || caches.match("./index.html"); });
}

self.addEventListener("fetch", function(e){
  var req=e.request;
  if(req.method!=="GET") return;
  var url; try{ url=new URL(req.url); }catch(err){ return; }
  if(url.origin!==self.location.origin) return;
  var aceita=(req.headers.get("accept")||"");
  var ehHTML = req.mode==="navigate" || aceita.indexOf("text/html")>-1 ||
               url.pathname.slice(-1)==="/" || url.pathname.slice(-5)===".html";
  if(ehHTML){
    e.respondWith(new Promise(function(resolve){
      var feito=false;
      function entrega(r){ if(!feito && r){ feito=true; resolve(r); } }
      var rede=fetch(req).then(function(res){ return guardar(req,res); });
      var t=setTimeout(function(){ daCopia(req).then(entrega); }, ESPERA_REDE);
      rede.then(function(res){ clearTimeout(t); entrega(res); },
                function(){ clearTimeout(t); daCopia(req).then(function(c){ entrega(c || Response.error()); }); });
      e.waitUntil(rede.catch(function(){}));
    }));
    return;
  }
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(function(cached){
    var net=fetch(req).then(function(res){ return guardar(req,res); }).catch(function(){ return cached; });
    return cached || net;
  }));
});

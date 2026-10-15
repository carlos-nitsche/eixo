// EIXO OS 1.0 — no voice assets; bounded static UI cache only.
const CACHE='eixo-static-v7',LIMIT=110;
const INITIAL=['/favicon.svg','/manifest.webmanifest'];
const staticAsset=pathname=>pathname==='/favicon.svg'||pathname==='/manifest.webmanifest'||/^\/(assets|brand|icons)\//.test(pathname);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(INITIAL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('eixo-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!staticAsset(url.pathname)||req.headers.has('range'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(req);
   if(response.ok&&response.type==='basic'){
    const cached=response.clone();
    event.waitUntil((async()=>{
     await cache.put(req,cached);
     const keys=await cache.keys();
     if(keys.length>LIMIT)await Promise.all(keys.slice(0,keys.length-LIMIT).map(key=>cache.delete(key)));
    })().catch(()=>{}));
   }
   return response;
  }catch{return await cache.match(req)||Response.error()}
 })());
});

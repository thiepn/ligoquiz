import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function guardedOfflineShell():Plugin{
 return {
  name:'g11-guarded-offline-shell',apply:'build',
  generateBundle(_options,bundle){
   const assets=Object.keys(bundle).filter(p=>/\.(?:js|css|woff2?|png|svg|webp|ico)$/.test(p)).sort();
   const revision=assets.join('|').replace(/[^a-zA-Z0-9]/g,'').slice(-48)||'empty';
   // All URLs are relative to registration scope: no cross-origin or legacy v1 interception.
   const code=`
'use strict';
const VERSION=${JSON.stringify('g11-'+revision)};
const CACHE='ligoquiz-v2-shell-'+VERSION;
const FILES=${JSON.stringify(['index.html',...assets])};
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
 // Intentionally no automatic skipWaiting: live games must never be interrupted by an update.
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>
  k.startsWith('ligoquiz-v2-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));
 // Do not claim existing clients silently; reload requires organizer action.
});
self.addEventListener('message',event=>{
 if(event.data?.type==='LIGO_PING'){
  event.ports[0]?.postMessage({type:'LIGO_PONG',version:VERSION,cache:CACHE});
 }else if(event.data?.type==='LIGO_APPLY_UPDATE'&&event.data?.confirmed===true){
  // Only a direct, explicit organizer action may send this command.
  self.skipWaiting();
 }
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{
   // Navigation cannot be trusted while offline: use only validated cached shell.
   return response.ok?response:caches.match('index.html').then(cached=>cached||response);
  }).catch(()=>caches.match('index.html').then(cached=>cached||
   new Response('Offline-Startpaket fehlt',{status:503,headers:{'Content-Type':'text/plain'}}))));
  return;
 }
 if(!FILES.includes(url.pathname.slice(scope.pathname.length)))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(request);
  return cached||fetch(request);
 }));
});
`;
   this.emitFile({type:'asset',fileName:'sw.js',source:code});
  },
 };
}
export default defineConfig({
 plugins:[react(),guardedOfflineShell()],
 base:'./',
 build:{target:'es2022',sourcemap:true},
 server:{host:'127.0.0.1',port:5173},
});

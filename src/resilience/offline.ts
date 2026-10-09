export type OfflineCheck={
 secure:boolean;online:boolean;storage:boolean;estimateBytes:number|null;persisted:boolean|null;
 installed:boolean;controlled:boolean;cacheReady:boolean;updateWaiting:boolean;
 problems:string[];
};
export const safeOrigin=()=>typeof location!=='undefined'&&
 (location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname));
export async function registerShell():Promise<ServiceWorkerRegistration|null>{
 if(import.meta.env.DEV||!safeOrigin()||!('serviceWorker' in navigator))return null;
 try{
  return await navigator.serviceWorker.register(new URL('sw.js',document.baseURI),{
   scope:new URL('.',document.baseURI).pathname,updateViaCache:'none',
  });
 }catch{return null;}
}
export async function checkWritableStorage():Promise<boolean>{
 if(!('indexedDB' in globalThis))return false;
 return new Promise(resolve=>{
  const name='ligoquiz.v2.g11.probe',req=indexedDB.open(name,1);
  let completed=false;
  const settle=(result:boolean)=>{
   if(completed)return;completed=true;
   try{req.result?.close();}catch{/* no db */}
   const del=indexedDB.deleteDatabase(name);
   del.onerror=()=>{/* probe is disposable */};
   resolve(result);
  };
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('p'))req.result.createObjectStore('p');};
  req.onerror=()=>settle(false);
  req.onsuccess=()=>{
   try{
    const tx=req.result.transaction('p','readwrite');
    tx.objectStore('p').put('ok','check');
    tx.oncomplete=()=>settle(true);
    tx.onerror=()=>settle(false);
    tx.onabort=()=>settle(false);
   }catch{settle(false);}
  };
  req.onblocked=()=>settle(false);
 });
}
export async function checkOffline():Promise<OfflineCheck>{
 const secure=safeOrigin();
 const online=navigator.onLine;
 const storage=await checkWritableStorage();
 let estimateBytes:number|null=null,persisted:boolean|null=null;
 try{const est=await navigator.storage?.estimate();estimateBytes=est?.quota??null;}catch{/* advisory */}
 try{persisted=await navigator.storage?.persisted()??null;}catch{/* advisory */}
 const supported='serviceWorker' in navigator;
 let installed=false,controlled=false,cacheReady=false,updateWaiting=false;
 if(supported){
  try{
   const scope=new URL('.',document.baseURI).href;
   const registration=await navigator.serviceWorker.getRegistration(scope);
   installed=Boolean(registration?.active);
   controlled=Boolean(navigator.serviceWorker.controller);
   updateWaiting=Boolean(registration?.waiting);
   if(registration?.active&&'caches' in globalThis){
    const keys=await caches.keys();
    const versions=keys.filter(k=>k.startsWith('ligoquiz-v2-shell-'));
    if(versions.length){
     const cache=await caches.open(versions[versions.length-1]!);
     const shell=await cache.match(new URL('index.html',scope));
     cacheReady=Boolean(shell);
    }
   }
  }catch{/* fail closed */}
 }
 const problems:string[]=[];
 if(!secure)problems.push('HTTPS oder localhost wird für die Offline-Installation benötigt');
 if(!storage)problems.push('IndexedDB ist nicht zuverlässig beschreibbar');
 if(!supported)problems.push('Service Worker wird hier nicht unterstützt');
 if(!installed||!cacheReady)problems.push('Offline-Startpaket noch nicht vollständig bereit');
 if(!controlled)problems.push('Dieses Fenster ist noch nicht durch die Offline-Version gesteuert; nach sicherem Abschluss neu öffnen');
 if(persisted===false)problems.push('Browser darf lokale Daten unter Speicherdruck entfernen; externe Sicherung empfohlen');
 return {secure,online,storage,estimateBytes,persisted,installed,controlled,cacheReady,updateWaiting,problems};
}
export async function offerManualUpdate(confirmNoActiveSessions:()=>Promise<boolean>):Promise<boolean>{
 if(!('serviceWorker' in navigator))return false;
 const registration=await navigator.serviceWorker.getRegistration(new URL('.',document.baseURI).href);
 if(!registration?.waiting)return false;
 if(!await confirmNoActiveSessions())return false;
 // Never call update/skipWaiting without a direct affirmative organizer action.
 registration.waiting.postMessage({type:'LIGO_APPLY_UPDATE',confirmed:true});
 return true;
}

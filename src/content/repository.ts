import {validateItem,type ContentItem} from './contracts';
import {sha256,type Preview,type Quarantine} from './migration';

export const CONTENT_DB_NAME='ligoquiz.v2.content.g10';
export type Receipt={bundleHash:string;at:number;ids:string[];quarantineIds:string[];sourceType:Preview['sourceType'];count:number};
export type StoredQuarantine=Quarantine & {id:string;bundleHash:string};
export class ContentStoreError extends Error{
 constructor(readonly code:'CONFLICT'|'IDB'|'UNSAFE'|'MISSING',message:string){super(message);this.name='ContentStoreError';}
}
export class ContentRepository{
 private promise:Promise<IDBDatabase>|null=null;
 constructor(private readonly factory:IDBFactory=indexedDB,private readonly name=CONTENT_DB_NAME){}
 private open():Promise<IDBDatabase>{
  if(this.promise)return this.promise;
  this.promise=new Promise<IDBDatabase>((resolve,reject)=>{
   const req=this.factory.open(this.name,1);
   req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('entries'))db.createObjectStore('entries',{keyPath:'id'});
    if(!db.objectStoreNames.contains('receipts'))db.createObjectStore('receipts',{keyPath:'bundleHash'});
    if(!db.objectStoreNames.contains('quarantine'))db.createObjectStore('quarantine',{keyPath:'id'});
   };
   req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
   req.onerror=()=>reject(req.error??new ContentStoreError('IDB','Speicher kann nicht geöffnet werden'));
   req.onblocked=()=>reject(new ContentStoreError('IDB','Datenbank wird in einem anderen Fenster verwendet'));
  }).catch(e=>{this.promise=null;throw e;});return this.promise;
 }
 async close():Promise<void>{const p=this.promise;this.promise=null;if(p)(await p).close();}
 async list():Promise<ContentItem[]>{
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('entries','readonly'),req=tx.objectStore('entries').getAll();
   req.onsuccess=()=>{try{resolve((req.result as unknown[]).map(validateItem));}catch(e){reject(e);}};
   req.onerror=()=>reject(req.error);
  });
 }
 async quarantined():Promise<StoredQuarantine[]>{
  const db=await this.open();return new Promise((resolve,reject)=>{
   const req=db.transaction('quarantine','readonly').objectStore('quarantine').getAll();
   req.onsuccess=()=>resolve(req.result as StoredQuarantine[]);
   req.onerror=()=>reject(req.error);
  });
 }
 async receipts():Promise<Receipt[]>{
  const db=await this.open();return new Promise((resolve,reject)=>{
   const req=db.transaction('receipts','readonly').objectStore('receipts').getAll();
   req.onsuccess=()=>resolve(req.result as Receipt[]);req.onerror=()=>reject(req.error);
  });
 }
 async put(item:ContentItem,expectedRevision:number|null):Promise<ContentItem>{
  const safe=validateItem(item);
  if(safe.status==='approved'){
   const hash=await sha256(JSON.stringify(safe.payload));
   if(!safe.review||hash!==safe.review.fingerprint)
    throw new ContentStoreError('UNSAFE','Freigabe-Fingerabdruck weicht vom aktuellen Inhalt ab');
  }
  const db=await this.open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');
   const req=store.get(safe.id);
   let fault:unknown;
   req.onsuccess=()=>{
    const prior=req.result as ContentItem|undefined;
    if((expectedRevision===null&&prior)||(
      expectedRevision!==null&&(!prior||prior.revision!==expectedRevision))){
      fault=new ContentStoreError('CONFLICT','Dieser Eintrag wurde von einem anderen Fenster geändert');
      tx.abort();return;
    }
    if(prior&&prior.status==='approved'&&safe.status==='approved'&&
       JSON.stringify(prior.payload)!==JSON.stringify(safe.payload)){
      fault=new ContentStoreError('UNSAFE','Freigegebenen Inhalt zuerst in einen Entwurf zurücksetzen');
      tx.abort();return;
    }
    store.put(safe);
   };
   tx.oncomplete=()=>resolve(safe);
   tx.onabort=()=>reject(fault??tx.error??new ContentStoreError('IDB','Speicherung abgebrochen'));
   tx.onerror=()=>{ /* onabort rejects */ };
  });
 }
 async create(item:ContentItem):Promise<ContentItem>{return this.put(item,null);}
 async saveDraft(item:ContentItem,note='Inhalt bearbeitet'):Promise<ContentItem>{
  const revised=validateItem({...item,status:'draft',review:undefined,revision:item.revision+1,
   updatedAt:Date.now(),audit:[...item.audit,{revision:item.revision+1,at:Date.now(),action:'EDIT',note}].slice(-150)});
  return this.put(revised,item.revision);
 }
 async sendToReview(item:ContentItem):Promise<ContentItem>{
  const revised=validateItem({...item,status:'review',review:undefined,revision:item.revision+1,
   updatedAt:Date.now(),audit:[...item.audit,{revision:item.revision+1,at:Date.now(),action:'REVIEW_REQUEST',note:'Zur redaktionellen Prüfung vorgelegt'}].slice(-150)});
  return this.put(revised,item.revision);
 }
 async approve(item:ContentItem,input:{reviewer:string;note:string;checklist:[true,true,true,true]}):Promise<ContentItem>{
  if(item.status!=='review'||input.reviewer.trim().length<2||input.note.trim().length<10||
     input.checklist.some(x=>x!==true))
   throw new ContentStoreError('UNSAFE','Zuerst vollständig prüfen, dokumentieren und freigeben');
  const revised=validateItem({...item,status:'approved',revision:item.revision+1,updatedAt:Date.now(),
   review:{...input,checkedAt:Date.now(),fingerprint:await sha256(JSON.stringify(item.payload))},
   audit:[...item.audit,{revision:item.revision+1,at:Date.now(),action:'APPROVE',
    note:'Prüfung durch '+input.reviewer+': '+input.note}].slice(-150)});
  return this.put(revised,item.revision);
 }
 async importPreview(preview:Preview,acknowledged:boolean):Promise<'created'|'already-imported'>{
  if(!acknowledged)throw new ContentStoreError('UNSAFE','Import erfordert ausdrückliche Bestätigung');
  if(preview.items.length+preview.quarantined.length!==preview.records)
   throw new ContentStoreError('UNSAFE','Importbericht enthält nicht alle Quelldatensätze');
  const valid=preview.items.map(item=>validateItem({...item,status:'draft',review:undefined}));
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction(['entries','receipts','quarantine'],'readwrite'),
    receipts=tx.objectStore('receipts'),entries=tx.objectStore('entries'),quarantine=tx.objectStore('quarantine');
   const rq=receipts.get(preview.bundleHash);
   let result:'created'|'already-imported'='created',fault:unknown;
   rq.onsuccess=()=>{
    if(rq.result){result='already-imported';return;}
    const quarantineIds=preview.quarantined.map(x=>preview.bundleHash+':'+x.index);
    for(const entry of valid)entries.add(entry);
    preview.quarantined.forEach((q,i)=>quarantine.add({...q,id:quarantineIds[i],bundleHash:preview.bundleHash}));
    receipts.add({bundleHash:preview.bundleHash,at:Date.now(),ids:valid.map(x=>x.id),
     quarantineIds,sourceType:preview.sourceType,count:preview.records} satisfies Receipt);
   };
   tx.oncomplete=()=>resolve(result);
   tx.onabort=()=>reject(fault??tx.error??new ContentStoreError('CONFLICT','Ein Importdatensatz existiert bereits. Quelle nicht verändert.'));
   tx.onerror=()=>{fault=tx.error;};
  });
 }
 async undo(bundleHash:string):Promise<void>{
  const db=await this.open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(['entries','receipts','quarantine'],'readwrite'),
    receipts=tx.objectStore('receipts'),entries=tx.objectStore('entries'),quarantine=tx.objectStore('quarantine');
   const rr=receipts.get(bundleHash);let fault:unknown;
   rr.onsuccess=()=>{
    const receipt=rr.result as Receipt|undefined;
    if(!receipt){fault=new ContentStoreError('MISSING','Importbeleg fehlt');tx.abort();return;}
    let pending=receipt.ids.length;let unsafe=false;
    const commit=()=>{
     if(unsafe)return;
     for(const id of receipt.ids)entries.delete(id);
     for(const id of receipt.quarantineIds)quarantine.delete(id);
     receipts.delete(bundleHash);
    };
    if(!pending){commit();return;}
    for(const id of receipt.ids){
     const r=entries.get(id);
     r.onsuccess=()=>{
      const item=r.result as ContentItem|undefined;
      if(!item||item.revision!==0||item.status!=='draft'){
       unsafe=true;fault=new ContentStoreError('UNSAFE','Import wurde seitdem bearbeitet/geprüft; automatischer Rückzug gesperrt');
       tx.abort();return;
      }
      pending--;if(pending===0)commit();
     };
    }
   };
   tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(fault??tx.error??new ContentStoreError('IDB','Rücknahme abgebrochen'));
  });
 }
}

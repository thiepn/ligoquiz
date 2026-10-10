import {evidenceSource,reviewPacket,type ReviewRecord} from './visual-evidence';
export type ReconciledPacket=ReturnType<typeof reviewPacket>;
export type ReviewEnvelope={format:'ligoquiz-g17-self-consistency-v1';algorithm:'SHA-256';
 checksum:string;packet:ReconciledPacket};
function isRecord(v:unknown):v is Record<string,unknown>{
 return typeof v==='object'&&v!==null&&!Array.isArray(v);
}
async function sha256(data:string):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
/** Self-consistency only. This is not signed evidence, operator identity or human approval. */
export async function sealObservation(input:Record<string,ReviewRecord>,notes:string):Promise<ReviewEnvelope>{
 const packet=reviewPacket(input,notes);
 return {format:'ligoquiz-g17-self-consistency-v1',algorithm:'SHA-256',
  checksum:await sha256(JSON.stringify(packet)),packet};
}
export async function reconcileObservation(input:unknown):Promise<ReconciledPacket>{
 if(!isRecord(input)||Object.keys(input).sort().join(',')!=='algorithm,checksum,format,packet'||
  input.format!=='ligoquiz-g17-self-consistency-v1'||input.algorithm!=='SHA-256'||
  typeof input.checksum!=='string'||!/^[a-f0-9]{64}$/.test(input.checksum))
  throw new Error('Prüfumschlag ungültig. Keine Aussage über Abnahme oder Urheber.');
 const packet=input.packet;
 if(!isRecord(packet)||!Array.isArray(packet.records)||packet.records.length!==evidenceSource.files.length||
  typeof packet.notes!=='string'||packet.notes.length>1200)
  throw new Error('Nachweise unvollständig oder ungültig');
 const inputRecords:Record<string,ReviewRecord>={};
 for(let i=0;i<evidenceSource.files.length;i++){
  const row:unknown=packet.records[i],ref=evidenceSource.files[i]!;
  if(!isRecord(row)||Object.keys(row).sort().join(',')!=='file,game,note,observation,sha256'||
   row.file!==ref.file||row.game!==ref.game||row.sha256!==ref.sha256||
   !['unreviewed','observed','defect'].includes(String(row.observation))||
   typeof row.note!=='string'||row.note.length>1000)
   throw new Error('Bildnachweis verändert oder nicht freigegeben');
  inputRecords[ref.file]={observation:row.observation as ReviewRecord['observation'],note:row.note};
 }
 const canonical=reviewPacket(inputRecords,packet.notes);
 if(JSON.stringify(packet)!==JSON.stringify(canonical))
  throw new Error('Abnahmefelder, Quelle, Anzahl oder Zusammenfassung stimmen nicht überein');
 if((await sha256(JSON.stringify(packet)))!==input.checksum)
  throw new Error('SHA-256 stimmt nicht mit der lokalen Sichtung überein');
 return canonical;
}

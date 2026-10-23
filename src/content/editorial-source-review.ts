import {auditLibrary,type AuditIssue} from './editorial-audit';
import {trialDraftItems,TRIAL_DRAFT_SOURCE} from './trial-draft-bundle';
import type {ContentItem} from './contracts';

type PrimaryReference={name:string;url:string;comparison:string};
const PRIMARY_LEADS:Readonly<Record<string,PrimaryReference>>={
 'rq-w4':{name:'RIS · Bundes-Verfassungsgesetz Art. 5',
  url:'https://www.ris.bka.gv.at/Dokument.wxe?Abfrage=Bundesnormen&Dokumentnummer=NOR12002679',
  comparison:'Antwort Wien mit dem Wortlaut von Art. 5 und dem Fragenbeleg abgleichen.'},
 'rq-w6':{name:'NASA · Mercury',url:'https://science.nasa.gov/mercury/',
  comparison:'Den sonnennächsten Planeten mit der NASA-Angabe und dem Fragenbeleg abgleichen.'},
 'rq-s1':{name:'BIPM · SI Brochure',
  url:'https://www.bipm.org/en/web/guest/publications/si-brochure',
  comparison:'Präfix kilo, 1000 Meter und das zugelassene Schätzformat prüfen.'},
 'rq-s4':{name:'World Athletics · Marathon',
  url:'https://worldathletics.org/disciplines/relays/marathon',
  comparison:'42,195 km, Dezimalnotation, Einheit und Auswertung gegenprüfen.'},
 'qt-geschichte-4':{name:'UNESCO · Pompeji und Herculaneum',
  url:'https://whc.unesco.org/en/list/829/',
  comparison:'Pompeji und Herculaneum sind beide betroffen; Forum und Amphitheater grenzen Pompeji ab.'},
 'qt-geschichte-5':{name:'Library of Congress · Byzantine Empire',
  url:'https://guides.loc.gov/byzantine-empire/introduction',
  comparison:'Konstantinopel, Spätantike, Mittelalter und das Jahr 1453 gegenprüfen.'},
};
const originals=new Map(trialDraftItems().map(item=>[item.id,item]));
const EARLIER_RQ_SOURCE='v2-original-trial-banks-v1';

export type HistoricalCorrection={reason:string;sourceName:string;url:string;prompt:string;reference:string};
/** Only the two unmodified original V1 trial prompts qualify for these corrections. */
const LEGACY_AMBIGUITIES:Readonly<Record<string,HistoricalCorrection & {before:string;beforeReference:string;answer:string;row:number}>>={
 'qt-geschichte-4':{
  before:'Welche Stadt wurde im Jahr 79 beim Ausbruch des Vesuvs verschüttet?',
  beforeReference:'UNESCO: Archaeological Areas of Pompei',answer:'Pompeji',row:4,
  reason:'Herculaneum wurde ebenfalls 79 verschüttet. Die neue Frage identifiziert Pompeji mit Forum und Amphitheater.',
  sourceName:'UNESCO World Heritage Centre',url:'https://whc.unesco.org/en/list/829/',
  prompt:'Welche beim Vesuvausbruch 79 n. Chr. verschüttete römische Stadt besaß ein Forum und ein Amphitheater?',
  reference:'UNESCO World Heritage Centre: Archaeological Areas of Pompei, Herculaneum and Torre Annunziata; https://whc.unesco.org/en/list/829/',
 },
 'qt-geschichte-5':{
  before:'Welches antike Reich hatte Konstantinopel als Hauptstadt?',
  beforeReference:'Encyclopaedia Britannica: Byzantine Empire',answer:'Das Byzantinische Reich',row:5,
  reason:'Die rein antike Einordnung ist irreführend; das Reich bestand auch im Mittelalter bis 1453.',
  sourceName:'Library of Congress · Byzantine Empire',url:'https://guides.loc.gov/byzantine-empire/introduction',
  prompt:'Welches Reich der Spätantike und des Mittelalters hatte Konstantinopel als Hauptstadt und bestand bis 1453?',
  reference:'Library of Congress: Byzantine Empire — Introduction; https://guides.loc.gov/byzantine-empire/introduction',
 },
};
export function historicalTrialCorrection(item:ContentItem):HistoricalCorrection|null{
 const c=LEGACY_AMBIGUITIES[item.id],p=item.payload as Record<string,unknown>;
 if(!c||item.game!=='quiztafel'||item.status==='quarantined'||
  item.provenance.origin!=='sample'||item.provenance.sourceVersion!=='v2-original-trial-banks-v1'||
  item.provenance.sourceKey!=='src/games/quiztafel/trial-bank.ts'||
  item.provenance.sourceId!==item.id||
  p.id!==item.id||p.categoryId!=='geschichte'||p.categoryName!=='Geschichte'||
  p.row!==c.row||p.value!==c.row*100||p.prompt!==c.before||
  p.answer!==c.answer||p.reference!==c.beforeReference)return null;
 return {reason:c.reason,sourceName:c.sourceName,url:c.url,prompt:c.prompt,reference:c.reference};
}

export type ReviewRoute='primary'|'lookup'|'illustrative';
export type SourceReviewTask={item:ContentItem;route:ReviewRoute;lead:PrimaryReference|null;issues:AuditIssue[]};

/** Research leads only. Changed content invalidates the original source match. */
export function originalSourceLead(item:ContentItem):PrimaryReference|null{
 const baseline=originals.get(item.id),lead=PRIMARY_LEADS[item.id];
 if(!baseline||!lead||(item.game!=='rundenquiz'&&item.game!=='quiztafel')||item.provenance.origin!=='sample'||
    !(item.provenance.sourceVersion===TRIAL_DRAFT_SOURCE||
      (item.game==='rundenquiz'&&item.provenance.sourceVersion===EARLIER_RQ_SOURCE))||
    item.provenance.sourceKey!==baseline.provenance.sourceKey||
    JSON.stringify(item.payload)!==JSON.stringify(baseline.payload))return null;
 return lead;
}
export function contentReviewTasks(items:readonly ContentItem[]):SourceReviewTask[]{
 const issues=auditLibrary(items).issues,perItem=new Map<string,AuditIssue[]>();
 for(const issue of issues){
  const group=perItem.get(issue.id)??[];
  group.push(issue);perItem.set(issue.id,group);
 }
 return items.filter(i=>i.status!=='quarantined').map(item=>{
  const lead=originalSourceLead(item);
  const payload=item.payload as {source?:{kind?:string}};
  const route:ReviewRoute=lead?'primary':
   item.game==='umfrageduell'&&payload.source?.kind==='illustrative'?'illustrative':'lookup';
  return {item,route,lead,issues:perItem.get(item.id)??[]};
 }).sort((a,b)=>{
  const order:Record<ReviewRoute,number>={primary:0,lookup:1,illustrative:2};
  return order[a.route]-order[b.route]||a.item.id.localeCompare(b.item.id);
 });
}

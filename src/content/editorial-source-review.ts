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
};
const originals=new Map(trialDraftItems().map(item=>[item.id,item]));
export type ReviewRoute='primary'|'lookup'|'illustrative';
export type SourceReviewTask={item:ContentItem;route:ReviewRoute;lead:PrimaryReference|null;issues:AuditIssue[]};

/** Research leads only. Changed content invalidates the original source match. */
export function originalSourceLead(item:ContentItem):PrimaryReference|null{
 const baseline=originals.get(item.id),lead=PRIMARY_LEADS[item.id];
 if(!baseline||!lead||item.game!=='rundenquiz'||item.provenance.origin!=='sample'||
    item.provenance.sourceVersion!==TRIAL_DRAFT_SOURCE||
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

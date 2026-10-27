import {useEffect,useMemo,useRef,useState} from 'react';
import {GAME_TYPES,type GameType,type GameProfile} from '../../domain/game/contracts';
import type {ContentItem} from '../../content/contracts';
import {launchContentInventory} from '../../content/launch-inventory';
import {composeContentPack,exportPreparationPlan,prepareFiveGameEvening} from '../../content/pack-preparation';
import {buildEditorialRehearsal,projectedRehearsalFrame} from '../../content/game-night-rehearsal';
import {gameNightRunSheet,sourceRepairChoices,applySourceRepair,prioritizedReviewSlots
} from '../../content/game-night-repairs';
import {buildEveningCueSheet,currentEveningCue,moveEveningCue,
 nextUnresolvedCue,nextTeamTurnCue,nextUntestedCue,markForCue,
 validRehearsalMarks,toggleRehearsalMark,rehearsalProgress,
 type EveningCue,type RehearsalMark} from '../../content/evening-rehearsal-queue';
import {buildTeamRotation,nextActionableRotationTurn,nextBlockedRotationTurn,
 buildRotationWorkQueue,rotationDecisionSummary,
 validEditorialHolds,setEditorialHold,type EditorialHold,
 type EditorialHoldReason} from '../../content/team-turn-rotation';
import {fiveGameReadiness,originalSlotCandidates,selectOriginalSlot,
 rehearsalIndexForSlot} from '../../content/original-slot-resolution';
import {PreparationRepository,prepareSavedDraft,reconcileSavedDraft,
 previewSelectiveRecovery,commitSelectiveRecovery,
 type SavedPreparation,type RecoveryProposal} from '../../content/pack-draft-store';
import '../../styles/g28-launch-inventory.css';

const labels:Record<GameType,string>={
 rundenquiz:'Rundenquiz',quiztafel:'Quiztafel',verbindungen:'Verbindungen',
 logikleiter:'Logikleiter',umfrageduell:'Umfrageduell',
};
/** Local original-source content planning only; all G10 and G26 authorities untouched. */
export function LaunchInventoryPanel({items,onChoose,loaded,latestItems}:{
 items:readonly ContentItem[];onChoose:(item:ContentItem)=>void;
 loaded:boolean;latestItems:()=>Promise<ContentItem[]>;
}){
 const inventory=useMemo(()=>launchContentInventory(items),[items]);
 const [draftRepo]=useState(()=>new PreparationRepository());
 const hasHydrated=useRef(false);
 const [saved,setSaved]=useState<SavedPreparation|null>(null);
 const [saveState,setSaveState]=useState<'loading'|'empty'|'ready'|'stale'|'error'>('loading');
 const [saveIssues,setSaveIssues]=useState<string[]>([]);
 const [recovery,setRecovery]=useState<RecoveryProposal|null>(null);
 const [saving,setSaving]=useState(false);
 const [saveMessage,setSaveMessage]=useState('');
 useEffect(()=>()=>{void draftRepo.close();},[draftRepo]);
 const [game,setGame]=useState<GameType>('rundenquiz');
 const [profile,setProfile]=useState<GameProfile>('lang');
 const [teams,setTeams]=useState<3|4|5>(5);
 const [showAll,setShowAll]=useState(false);
 const [stepIndex,setStepIndex]=useState(0);
 const [teamFilter,setTeamFilter]=useState(0);
 const [rehearsed,setRehearsed]=useState<RehearsalMark[]>([]);
 const [holds,setHolds]=useState<EditorialHold[]>([]);
 const [holdReason,setHoldReason]=useState<EditorialHoldReason>('question');
 const [rotationBusy,setRotationBusy]=useState(false);
 const [rotationMessage,setRotationMessage]=useState('');
 const [repairSlot,setRepairSlot]=useState<string>('');
 const [focusedIssue,setFocusedIssue]=useState('');
 const [resolving,setResolving]=useState(false);
 const [resolutionMessage,setResolutionMessage]=useState('');
 const [undoRepair,setUndoRepair]=useState<{key:string;before:Record<string,string>}|null>(null);
 const [overrides,setOverrides]=useState<Record<string,Record<string,string>>>({});
 const teamChoice=teamFilter<=teams?teamFilter:0;
 const configKey=game+'/'+profile+'/'+teams;
 const plan=useMemo(()=>composeContentPack(items,game,profile,teams,overrides[configKey]??{}),
  [items,game,profile,teams,overrides,configKey]);
 const eveningOverrides=useMemo(()=>Object.fromEntries(GAME_TYPES.map(key=>
  [key,overrides[key+'/'+profile+'/'+teams]??{}])) as Record<GameType,Record<string,string>>,
  [overrides,profile,teams]);
 const evening=useMemo(()=>prepareFiveGameEvening(items,profile,teams,eveningOverrides),
  [items,profile,teams,eveningOverrides]);
 useEffect(()=>{
  if(!loaded)return;
  let active=true;
  void draftRepo.read().then(async existing=>{
   const result=existing?await reconcileSavedDraft(existing,items):null;
   if(!active)return;
   setSaved(existing);
   setRecovery(null);
   setSaveState(!existing?'empty':result?.status==='ready'?'ready':'stale');
   setSaveIssues(result?.issues??[]);
   if(!hasHydrated.current){
    hasHydrated.current=true;
    if(existing&&result?.status==='ready'){
     setGame(existing.game);setProfile(existing.profile);setTeams(existing.teams);
     setStepIndex(existing.step);
     setRehearsed(existing.rehearsed??[]);
     setHolds(existing.holds??[]);
     setOverrides(prev=>({...prev,...Object.fromEntries(GAME_TYPES.map(key=>[
      key+'/'+existing.profile+'/'+existing.teams,
      {...existing.selections[key]},
     ]))}));
    }
   }
  }).catch(err=>{
   if(active){setSaveState('error');
    setSaveMessage(err instanceof Error?err.message:'Lokaler Plan nicht lesbar');}
  });
  return ()=>{active=false;};
 },[draftRepo,loaded,items]);
 const pendingChanges=Boolean(saved&&(
  saved.game!==game||saved.profile!==profile||saved.teams!==teams||
  saved.step!==stepIndex||
  JSON.stringify(saved.rehearsed??[])!==JSON.stringify(rehearsed)||
  JSON.stringify(saved.holds??[])!==JSON.stringify(holds)||
  GAME_TYPES.some(k=>
   JSON.stringify(saved.selections[k])!==JSON.stringify(eveningOverrides[k]))));
 async function saveLocalDraft(){
  if(saving||!loaded||saveState==='loading')return;
  if(saveState==='stale'||saveState==='error'){
   setSaveMessage('Veralteten oder beschädigten Plan zuerst ausdrücklich verwerfen.');return;
  }
  setSaving(true);setSaveMessage('');
  try{
   const existing=saved;
   const currentLibrary=await latestItems();
   if(existing){
    const verdict=await reconcileSavedDraft(existing,currentLibrary);
    if(verdict.status!=='ready'){
     setSaveState('stale');setSaveIssues(verdict.issues);
     throw Error('Quellen wurden seit der Speicherung geändert. Keine Übernahme.');
    }
   }
   const record=await prepareSavedDraft(items,{game,profile,teams,step:stepIndex,
    selections:eveningOverrides,rehearsed:validRehearsalMarks(cueSheet,rehearsed),
    holds:validEditorialHolds(cueSheet,holds)},
    (existing?.revision??0)+1);
   const verdict=await reconcileSavedDraft(record,currentLibrary);
   if(verdict.status!=='ready')throw Error('Quellen wurden in anderem Fenster verändert; zuerst neu laden.');
   await draftRepo.save(record,existing?.revision??null);
   setSaved(record);setSaveState('ready');setSaveIssues([]);
   setRehearsed(record.rehearsed??[]);
   setHolds(record.holds??[]);
   setSaveMessage('Lokaler Abendplan gespeichert · Revision '+record.revision);
  }catch(e){setSaveMessage(e instanceof Error?e.message:'Speichern fehlgeschlagen');}
  finally{setSaving(false);}
 }
 async function previewRecovery(){
  if(!saved||saveState!=='stale'||saving)return;
  setSaving(true);setSaveMessage('');setRecovery(null);
  try{
   const current=await draftRepo.read();
   if(!current||current.revision!==saved.revision)
    throw Error('Plan wurde in anderem Fenster verändert. Ansicht neu laden.');
   const fromLibrary=await latestItems();
   const verdict=await reconcileSavedDraft(current,fromLibrary);
   if(verdict.status!=='stale'){
    setSaveState('ready');setSaveIssues([]);
    setSaveMessage('Quellen stimmen inzwischen wieder überein.');return;
   }
   const proposal=await previewSelectiveRecovery(current,fromLibrary);
   setRecovery(proposal);setSaveIssues(verdict.issues);
   setSaveMessage(proposal.cleared.length?
    proposal.cleared.length+' Plätze erfordern Entscheidung; übrige Originalquellen bleiben erhalten.':
    'Alle alten Quellen stimmen überein; ursprüngliche Quellenreihenfolge kann ausdrücklich fixiert werden.');
  }catch(e){setSaveMessage(e instanceof Error?e.message:'Wiederherstellung fehlgeschlagen');}
  finally{setSaving(false);}
 }
 async function confirmSelectiveRecovery(){
  if(!saved||!recovery||!recovery.canCommit||saving||saveState!=='stale')return;
  if(!window.confirm('Unveränderte Quellen behalten und betroffene Aufgabenplätze ausdrücklich leeren? Die Originalfragen werden nicht geändert.'))return;
  setSaving(true);setSaveMessage('');
  try{
   const fromLibrary=await latestItems();
   // Avoid saving a plan built from a stale G10 tab even if a newer browser
   // tab changed an unrelated source after this view last refreshed.
   const proposed=await prepareSavedDraft(items,{
    game:saved.game,profile:saved.profile,teams:saved.teams,
    step:saved.step,selections:recovery.selections,
   },saved.revision+1);
   if((await reconcileSavedDraft(proposed,fromLibrary)).status!=='ready')
    throw Error('Quellenstand in G10 hat sich verändert. Seite neu laden.');
   const record=await commitSelectiveRecovery(draftRepo,saved,fromLibrary,recovery);
   setGame(record.game);setProfile(record.profile);setTeams(record.teams);
   setStepIndex(record.step);
   setRehearsed(record.rehearsed??[]);
   setHolds(record.holds??[]);
   setOverrides(prev=>({...prev,...Object.fromEntries(GAME_TYPES.map(key=>[
    key+'/'+record.profile+'/'+record.teams,{...record.selections[key]},
   ]))}));
   setSaved(record);setSaveState('ready');setSaveIssues([]);setRecovery(null);
   setSaveMessage('Unveränderte Quellen behalten · '+recovery.cleared.length+
    ' Aufgabenplätze offen · Revision '+record.revision);
  }catch(e){setRecovery(null);
   setSaveMessage(e instanceof Error?e.message:'Wiederherstellung fehlgeschlagen');}
  finally{setSaving(false);}
 }
 async function discardLocalDraft(){
  if(saving||saveState==='loading')return;
  if(!window.confirm('Nur den gespeicherten Abendplan löschen? Die Fragenbibliothek bleibt unverändert.'))return;
  setSaving(true);setSaveMessage('');
  try{
   await draftRepo.clear(saved?.revision??null);
   setSaved(null);setSaveState('empty');setSaveIssues([]);setRecovery(null);
   setRehearsed([]);
   setHolds([]);
   setSaveMessage('Gespeicherter Abendplan verworfen. Quellen bleiben erhalten.');
  }catch(e){setSaveMessage(e instanceof Error?e.message:'Plan konnte nicht verworfen werden');}
  finally{setSaving(false);}
 }
 const readiness=useMemo(()=>fiveGameReadiness(items,profile,teams,eveningOverrides),
  [items,profile,teams,eveningOverrides]);
 const selectedIssue=readiness.issues.find(issue=>
  issue.game+'/'+issue.slot===focusedIssue)??readiness.issues[0]??null;
 const candidateChoices=useMemo(()=>selectedIssue?
  originalSlotCandidates(items,selectedIssue.game,profile,teams,
   eveningOverrides,selectedIssue.slot,8):[],
  [items,selectedIssue,profile,teams,eveningOverrides]);
 function jumpToIssue(issue:typeof selectedIssue){
  if(!issue)return;
  setFocusedIssue(issue.game+'/'+issue.slot);
  setGame(issue.game);
  const index=rehearsalIndexForSlot(items,issue.game,profile,teams,
   eveningOverrides,issue.slot);
  if(index!==null)setStepIndex(index);
  setResolutionMessage('');
 }
 async function chooseOriginalCandidate(sourceId:string){
  const issue=selectedIssue;
  const candidate=candidateChoices.find(x=>x.sourceId===sourceId);
  if(!issue||!candidate||resolving||!loaded||saveState==='stale'||
   saveState==='error'||saveState==='loading')return;
  setResolving(true);setResolutionMessage('');
  try{
   const latest=await latestItems();
   // The user acts on a locally rendered draft; every selected original source
   // must still match the actual G10 library revision before this choice.
   const before=await prepareSavedDraft(items,{
    game,profile,teams,step:stepIndex,selections:eveningOverrides},1);
   if((await reconcileSavedDraft(before,latest)).status!=='ready')
    throw Error('Originalquellen geändert. Zuerst Inhaltsatelier aktualisieren.');
   const revised=selectOriginalSlot(latest,issue.game,profile,teams,
    eveningOverrides,candidate);
   if(!revised)throw Error('Alternativquelle nicht mehr gültig. Erneut prüfen.');
   const after=await prepareSavedDraft(items,{
    game,profile,teams,step:stepIndex,selections:revised},1);
   if((await reconcileSavedDraft(after,latest)).status!=='ready')
    throw Error('Änderung mit neuer Originalquelle nicht mehr kompatibel.');
   const key=issue.game+'/'+profile+'/'+teams;
   setUndoRepair({key,before:{...overrides[key]}});
   setOverrides(prev=>({...prev,[key]:{...revised[issue.game]}}));
   setGame(issue.game);
   const jump=rehearsalIndexForSlot(items,issue.game,profile,teams,revised,issue.slot);
   if(jump!==null)setStepIndex(jump);
   setResolutionMessage(sourceId+' als lokaler Entwurf gewählt. Zum Behalten Abendplan speichern.');
  }catch(e){setResolutionMessage(e instanceof Error?e.message:'Quellenwahl fehlgeschlagen');}
  finally{setResolving(false);}
 }
 const cueSheet=useMemo(()=>buildEveningCueSheet(items,profile,teams,eveningOverrides),
  [items,profile,teams,eveningOverrides]);
 const cue=currentEveningCue(cueSheet,game,stepIndex);
 const validMarks=useMemo(()=>validRehearsalMarks(cueSheet,rehearsed),
  [cueSheet,rehearsed]);
 const progress=useMemo(()=>rehearsalProgress(cueSheet,validMarks),
  [cueSheet,validMarks]);
 const validHolds=useMemo(()=>validEditorialHolds(cueSheet,holds),
  [cueSheet,holds]);
 const rotation=useMemo(()=>buildTeamRotation(cueSheet,teams,validMarks,validHolds),
  [cueSheet,teams,validMarks,validHolds]);
 const rotationSummary=useMemo(()=>rotationDecisionSummary(rotation),[rotation]);
 const workQueue=useMemo(()=>buildRotationWorkQueue(rotation),[rotation]);
 const cueReceipt=markForCue(cue);
 const currentHold=cueReceipt?validHolds.find(h=>h.game===cueReceipt.game&&
  h.slot===cueReceipt.slot&&h.sourceId===cueReceipt.sourceId&&
  h.sourceRevision===cueReceipt.sourceRevision):undefined;
 const isCueRehearsed=Boolean(cueReceipt&&validMarks.some(m=>
  m.game===cueReceipt.game&&m.slot===cueReceipt.slot&&
  m.sourceId===cueReceipt.sourceId&&m.sourceRevision===cueReceipt.sourceRevision));
 function openEveningCue(next:EveningCue|null){
  if(!next)return;
  setGame(next.game);setStepIndex(next.localIndex);
 }
 function moveToRotationTurn(preferred?:number,withMarks=validMarks){
  const proposed=buildTeamRotation(cueSheet,teams,withMarks,validHolds);
  const next=nextActionableRotationTurn(proposed,game,stepIndex,preferred);
  openEveningCue(next?cueSheet.cues[next.cueIndex]??null:null);
 }
 function moveToBlockedTurn(reason:'hold'|'source'){
  const next=nextBlockedRotationTurn(rotation,game,stepIndex,reason,
   teamChoice===0?undefined:teamChoice);
  if(!next)return;
  openEveningCue(cueSheet.cues[next.cueIndex]??null);
  if(reason==='source')setFocusedIssue(next.game+'/'+next.slot);
 }
 async function checkSourceCustody():Promise<void>{
  const original=await prepareSavedDraft(items,{game,profile,teams,step:stepIndex,
   selections:eveningOverrides,rehearsed:validMarks,holds:validHolds},1);
  if((await reconcileSavedDraft(original,await latestItems())).status!=='ready')
   throw Error('Originalquellen in G10 verändert. Erst neu laden oder Quellkonflikt beheben.');
 }
 async function markAndRotate(){
  if(rotationBusy||!cue||!cueReceipt||currentHold||saveState==='stale'||
   saveState==='error'||saveState==='loading')return;
  setRotationBusy(true);setRotationMessage('');
  try{
   await checkSourceCustody();
   const updated=isCueRehearsed?validMarks:
    toggleRehearsalMark(cueSheet,validMarks,cue);
   const next=buildTeamRotation(cueSheet,teams,updated,validHolds);
   const nextTurn=nextActionableRotationTurn(next,game,stepIndex,
    teamChoice===0?undefined:teamChoice);
   setRehearsed(updated);
   openEveningCue(nextTurn?cueSheet.cues[nextTurn.cueIndex]??null:null);
   setRotationMessage(nextTurn?
    'Probenstand geändert. Für dauerhafte Übernahme Abendplan speichern.':
    'Keine weitere probefähige Teamaufgabe. Fehlende Quellen oder Korrekturvermerke getrennt bearbeiten und Abendplan speichern.');
  }catch(e){setRotationMessage(e instanceof Error?e.message:'Quellenprüfung fehlgeschlagen');}
  finally{setRotationBusy(false);}
 }
 async function updateHold(reason:EditorialHoldReason|null){
  if(!cue||!cueReceipt||rotationBusy||saveState==='stale'||
   saveState==='error'||saveState==='loading')return;
  setRotationBusy(true);setRotationMessage('');
  try{
   await checkSourceCustody();
   setHolds(old=>setEditorialHold(cueSheet,old,cue,reason));
   setRotationMessage(reason?'Korrekturvermerk für G10 vorgemerkt. Abendplan speichern.':
    'Korrekturvermerk zurückgenommen. Abendplan speichern.');
  }catch(e){setRotationMessage(e instanceof Error?e.message:'Quellenprüfung fehlgeschlagen');}
  finally{setRotationBusy(false);}
 }
 const runSheet=useMemo(()=>gameNightRunSheet(items,profile,teams,eveningOverrides),
  [items,profile,teams,eveningOverrides]);
 const prioritized=useMemo(()=>prioritizedReviewSlots(plan,evening.spoilers),
  [plan,evening.spoilers]);
 const currentRepairSlot=plan.slots.find(s=>s.key===repairSlot)?repairSlot:
  prioritized[0]?.slot??'';
 const repairs=useMemo(()=>currentRepairSlot?
  sourceRepairChoices(items,plan,eveningOverrides,currentRepairSlot,5):[],
  [items,plan,eveningOverrides,currentRepairSlot]);
 function useRepair(sourceId:string){
  const choice=repairs.find(x=>x.sourceId===sourceId);
  if(!choice)return;
  const revised=applySourceRepair(items,plan,eveningOverrides,choice);
  if(!revised)return;
  setUndoRepair({key:configKey,before:{...overrides[configKey]}});
  setOverrides(prev=>({...prev,[configKey]:{...revised[game]}}));
  setStepIndex(0);
 }
 function undoLastRepair(){
  if(!undoRepair||undoRepair.key!==configKey)return;
  setOverrides(prev=>({...prev,[configKey]:undoRepair.before}));
  setUndoRepair(null);setStepIndex(0);
 }
 const rehearsal=useMemo(()=>buildEditorialRehearsal(plan,items),[plan,items]);
 const activeStep=rehearsal.steps[Math.min(stepIndex,rehearsal.steps.length-1)]??null;
 const frame=projectedRehearsalFrame(activeStep);
 const firstBySlot=new Set<string>();
 const conflicts=rehearsal.steps.filter(step=>{
  if(!step.issues.length||firstBySlot.has(step.slot))return false;
  firstBySlot.add(step.slot);return true;
 });
 function goToNextIssue(){
  if(!conflicts.length)return;
  const next=conflicts.find(s=>s.index>stepIndex)??conflicts[0];
  if(next)setStepIndex(next.index);
 }
 function setGameSelection(next:GameType){setGame(next);setStepIndex(0);}
 function setProfileSelection(next:GameProfile){setProfile(next);setStepIndex(0);}
 function setTeamsSelection(next:3|4|5){setTeams(next);setTeamFilter(0);setStepIndex(0);}
 function downloadPlan(){
  const blob=new Blob([exportPreparationPlan(plan)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  try{link.href=url;link.download='ligoquiz-g30-packplan-quell-ids.json';link.click();}
  finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 const program=inventory.programs.find(p=>
  p.game===game&&p.profile===profile&&p.teams===teams)!;
 const queue=inventory.priorities.filter(p=>p.item.game===game);
 return <section className="g28-inventory" aria-label="G28 Startinhalte und Quellenzuordnung">
  <div className="g28-inventory-head">
   <h2>Startinhalte und Quellenzuordnung</h2>
   <strong>NO_GO · Nicht freigegeben</strong>
  </div>
  <div className="g28-inventory-stats">
   <div><b>{inventory.originalDeclaredActive}</b><span>V1 deklarierte aktive Inhalte</span></div>
   <div><b>{inventory.localCount}</b><span>Tatsächliche V2-Datensätze</span></div>
   <div><b>{inventory.validUnapproved}</b><span>Valide, noch nicht freigegebene V2-Entwürfe</span></div>
   <div><b>{inventory.possibleLegacyLinks.length}</b><span>Nur strukturelle V1-Verknüpfungen</span></div>
  </div>
  <p className="g28-critical">V1-Zählungen sind historische Originalcode-Metadaten, keine übertragenen Fragen.
   Keine der {inventory.originalDeclaredActive} Altfragen ist durch diese Übersicht individuell migriert
   oder unabhängig fachlich/rechtlich freigegeben. {inventory.unreviewedIllustrative} lokale
   Umfrageaufgaben bleiben ausdrücklich illustrativ.</p>
  <details>
   <summary>Acht V1-Quellfamilien prüfen</summary>
   <div className="g28-family-grid">
    {inventory.historicFamilies.map(f=><div key={f.code}>
     <b>{f.code}</b><span>{f.declared} historisch gemeldet</span><span>0 verifizierte V2-Zuordnungen</span>
    </div>)}
   </div>
   <p>Eine Ähnlichkeit der historischen Quellfamilie zu einem V2-Spiel beweist keine
    Frage-ID, korrekte Antwort, freie Lizenz oder Schemaübernahme.</p>
  </details>
  <details>
   <summary>Strukturelle Importkandidaten ({inventory.possibleLegacyLinks.length})</summary>
   {inventory.possibleLegacyLinks.slice(0,25).map(candidate=><p key={candidate.sourceId}>
    {candidate.sourceId} → {candidate.itemId} ({labels[candidate.game]}) · Herkunft nur aus
    importierten Metadaten, Originaldatensatz nicht gegengeprüft
   </p>)}
   {inventory.legacyCollisions.map(id=><p key={id}>Mehrdeutige Quell-ID: {id}</p>)}
   {inventory.possibleLegacyLinks.length===0&&<p>Keine quellgebundenen Zuordnungskandidaten.
    Die 79 V2-Probeaufgaben sind kein V1-Migrationsnachweis.</p>}
  </details>
  <div className="g28-program-controls">
   <label>Spiel <select aria-label="G28 Spiel" value={game}
    onChange={e=>setGameSelection(e.target.value as GameType)}>
    {GAME_TYPES.map(key=><option key={key} value={key}>{labels[key]}</option>)}
   </select></label>
   <label>Profil <select aria-label="G28 Profil" value={profile}
    onChange={e=>setProfileSelection(e.target.value as GameProfile)}>
    <option value="kurz">Kurz</option><option value="standard">Standard</option>
    <option value="lang">Lang</option>
   </select></label>
   <label>Teams <select aria-label="G28 Teams" value={teams}
    onChange={e=>setTeamsSelection(Number(e.target.value) as 3|4|5)}>
    {[3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
   </select></label>
  </div>
  <div className="g28-program-result" aria-label="G28 Strukturelle Abdeckung">
   <strong>{program.structurallyComplete?'Strukturell vollständig':'Strukturell unvollständig'}</strong>
   <span>{program.candidateCount} valide Quellkandidaten · {program.locallyApproved} lokale Freigabeangaben</span>
   <div className="g28-gap-grid">
    {program.gaps.map(g=><div key={g.kind}>
     <b>{g.kind}</b><span>{g.present} / {g.required}</span>
     {g.missing>0&&<strong>{g.missing} fehlen</strong>}
    </div>)}
   </div>
   <p>Nur Strukturprüfung aus lokalen Quellen. Kein Beleg für editorische Freigabe,
    tatsächliche Spielauswahl, Sachrichtigkeit, Rechte oder Publikationsreife.</p>
  </div>
  <section className="g33-persistence" aria-label="G33 Lokaler Abendplan">
   <div className="g28-inventory-head">
    <h3>Lokaler Abendplan</h3>
    <strong>{saveState==='ready'?'Revision '+saved?.revision:
     saveState==='stale'?'Quellen geändert':
     saveState==='loading'?'Lädt':saveState==='error'?'Speicherfehler':'Nicht gespeichert'}</strong>
   </div>
   {pendingChanges&&saveState==='ready'&&<p>Ungespeicherte Auswahl oder Moderationsposition</p>}
   {saveState==='stale'&&<section className="g34-recovery" aria-label="G34 Teilwiederherstellung">
    <div className="g33-actions">
     <button type="button" className="exp-secondary" disabled={saving||!saved}
      onClick={()=>void previewRecovery()}>Gültige Quellen prüfen</button>
     {recovery&&<button type="button" className="exp-secondary"
      disabled={saving||!recovery.canCommit}
      onClick={()=>void confirmSelectiveRecovery()}>
      {recovery.cleared.length===0?'Ursprüngliche Quellwahl fixieren':
       recovery.retained+' Quellen behalten · '+recovery.cleared.length+' Plätze leeren'}
     </button>}
    </div>
    {recovery&&<section className="g34-recovery-list" aria-label="G34 Betroffene Quellplätze">
     {recovery.cleared.map(gap=><div key={gap.game+'/'+gap.slot}>
      <strong>{labels[gap.game]} · {gap.slot}</strong>
      <span>{gap.sourceId??'Ohne Quelle'} · {gap.reason==='changed'?'Quelle geändert':
       gap.reason==='missing'?'Quelle fehlt':gap.reason==='layout'?'Aufgabenstruktur geändert':
       'Zuordnung nicht mehr kompatibel'}</span>
      {gap.sourceId&&items.find(item=>item.id===gap.sourceId)&&
       <button type="button" className="exp-secondary"
        onClick={()=>{const item=items.find(x=>x.id===gap.sourceId);if(item)onChoose(item);}}>
        Quelle in G10 prüfen</button>}
     </div>)}
    </section>}
   </section>}
   {saveIssues.length>0&&<div role="alert">
    {saveIssues.map((issue,i)=><p key={i}>{issue}</p>)}
    {saveIssues.map(issue=>issue.split(':')[0]!).filter((key,i,all)=>all.indexOf(key)===i)
     .map(key=>items.find(item=>item.id===key)).filter((x):x is ContentItem=>Boolean(x))
     .map(item=><button type="button" className="exp-secondary" key={item.id}
      onClick={()=>onChoose(item)}>Quelle {item.id} in G10 prüfen</button>)}
   </div>}
   <div className="g33-actions">
    <button type="button" className="exp-secondary"
     disabled={saving||!loaded||saveState==='loading'||saveState==='stale'||saveState==='error'}
     onClick={()=>void saveLocalDraft()}>Abendplan lokal speichern</button>
    <button type="button" className="exp-secondary"
     disabled={saving||saveState==='loading'||(!saved&&saveState!=='error')}
     onClick={()=>void discardLocalDraft()}>Gespeicherten Plan verwerfen</button>
   </div>
   {saveMessage&&<p role="status">{saveMessage}</p>}
   <p>Nur Quellen-IDs, Revisionen und Prüfsummen lokal. Keine Freigabe und kein Spielstart.</p>
  </section>
  <section className="g32-evening" aria-label="G32 Fünf-Spiele-Abendplan">
   <div className="g28-inventory-head"><h3>Fünf-Spiele-Abendplan</h3><strong>NO_GO</strong></div>
   <p>{runSheet.totalSteps} Moderationsschritte · {runSheet.missing} fehlende Aufgaben
    {' '}· {runSheet.hardIssues} Strukturkonflikte · {runSheet.reviewIssues} offene Prüfpunkte</p>
   <nav className="g32-game-rail" aria-label="G32 Spiele wechseln">
    {runSheet.games.map(entry=><button type="button" key={entry.game}
     aria-pressed={game===entry.game} onClick={()=>setGameSelection(entry.game)}>
     <strong>{labels[entry.game]}</strong>
     <span>{entry.slots} Aufgaben · {entry.hardIssues} Strukturfehler</span>
     <span>{entry.reviewIssues} Prüfungen · {entry.balanced?'fair verteilt':'Verteilung prüfen'}</span>
    </button>)}
   </nav>
   <p>{runSheet.spoilers.length} spielübergreifende Hinweis-Konflikte.
    Nur Entwurfsplanung, keine Freigabe und kein Live-Spiel.</p>
  </section>
  <section className="g35-editor-completion" aria-label="G35 Fünf-Spiele-Quellenwahl">
   <div className="g28-inventory-head">
    <h3>Offene Quellenplätze</h3>
    <strong>{readiness.issues.length} Prüffälle · NO_GO</strong>
   </div>
   <div className="g35-five-stats">
    {readiness.games.map(entry=><button key={entry.game} type="button"
     className="exp-secondary" onClick={()=>setGameSelection(entry.game)}>
     {labels[entry.game]} · {entry.missing} offen · {entry.hard} Strukturfehler
     {' '}· {entry.teamTurns.join(' / ')} Teamaufgaben
    </button>)}
   </div>
   {selectedIssue&&<div className="g35-issue-resolver">
    <label>Quellenplatz
     <select aria-label="G35 Quellenplatz" value={selectedIssue.game+'/'+selectedIssue.slot}
      onChange={event=>jumpToIssue(readiness.issues.find(i=>
       i.game+'/'+i.slot===event.target.value)??null)}>
      {readiness.issues.map(issue=><option key={issue.game+'/'+issue.slot}
       value={issue.game+'/'+issue.slot}>
       {labels[issue.game]} · {issue.label} · {issue.kind}
      </option>)}
     </select>
    </label>
    <div className="g35-issue-choices">
     <strong>{labels[selectedIssue.game]} · {selectedIssue.label}</strong>
     <p>{selectedIssue.sourceId??'Nicht besetzt'} · {selectedIssue.codes.join(', ')}</p>
     {selectedIssue.sourceId&&items.some(item=>item.id===selectedIssue.sourceId)&&
      <button type="button" className="exp-secondary" onClick={()=>{
       const item=items.find(i=>i.id===selectedIssue.sourceId);
       if(item)onChoose(item);
      }}>Originalquelle in G10 korrigieren</button>}
     <section className="g35-source-options" aria-label="G35 Alternative Originalquellen">
      {candidateChoices.length===0?<p>Keine kompatible Alternative im Originalbestand.</p>:
       candidateChoices.map(option=><div key={option.sourceId}>
        <strong>{option.sourceId}</strong>
        <span>Revision {option.sourceRevision} · {option.sourceStatus}
         {' '}· {option.hardAfter} Strukturfehler · {option.spoilersAfter} Hinweis-Konflikte</span>
        <span>Teamaufgaben: {option.teamTurns.join(' / ')}</span>
        <button type="button" className="exp-secondary"
         disabled={resolving||!loaded||saveState==='stale'||saveState==='error'}
         onClick={()=>void chooseOriginalCandidate(option.sourceId)}>
         {option.sourceId} als Entwurf wählen
        </button>
       </div>)}
     </section>
    </div>
   </div>}
   {resolutionMessage&&<p role="status">{resolutionMessage}</p>}
  </section>
  <section className="g36-evening-rehearsal" aria-label="G36 Fünf-Spiele-Moderationslauf">
   <div className="g28-inventory-head">
    <h3>Moderationslauf · fünf Spiele</h3>
    <strong>NO_GO</strong>
   </div>
   <p>{cueSheet.cues.length} Moderationsphasen · {cueSheet.missingSourceSlots}
    {' '}fehlende Quellenplätze · {cueSheet.unresolvedSlots} redaktionell zu prüfen</p>
   <div className="g36-queue-controls">
    <button type="button" className="exp-secondary" disabled={!cueSheet.cues.length}
     onClick={()=>openEveningCue(moveEveningCue(cueSheet,game,stepIndex,-1))}>
     Vorherige Phase
    </button>
    <button type="button" className="exp-secondary" disabled={!cueSheet.cues.length}
     onClick={()=>openEveningCue(moveEveningCue(cueSheet,game,stepIndex,1))}>
     Nächste Phase
    </button>
    <button type="button" className="exp-secondary"
     disabled={!cueSheet.cues.some(x=>x.needsReview)}
     onClick={()=>openEveningCue(nextUnresolvedCue(cueSheet,game,stepIndex))}>
     Nächste Quelle prüfen
    </button>
    <button type="button" className="exp-secondary"
     disabled={!cueSheet.cues.some(x=>x.teamNumber!==null)}
     onClick={()=>openEveningCue(nextTeamTurnCue(cueSheet,game,stepIndex,
      teamChoice===0?undefined:teamChoice))}>
     Nächste Teamaufgabe
    </button>
    <button type="button" className="exp-secondary"
     disabled={progress.done===progress.total}
     onClick={()=>openEveningCue(nextUntestedCue(cueSheet,validMarks,game,stepIndex))}>
     Nächste ungetestete Aufgabe
    </button>
    <label>Teamfilter
     <select aria-label="G37 Teamfilter" value={teamChoice}
      onChange={e=>setTeamFilter(Number(e.target.value))}>
      <option value={0}>Alle Teams</option>
      {Array.from({length:teams},(_,i)=>i+1).map(n=>
       <option key={n} value={n}>Team {n}</option>)}
     </select>
    </label>
   </div>
   <div className="g37-progress">
    <strong>Moderationsprobe: {progress.done} / {progress.total} Aufgaben geprobt</strong>
    <div className="g37-game-progress">
     {progress.perGame.map(p=><span key={p.game}>{labels[p.game]} {p.done}/{p.total}</span>)}
    </div>
   </div>
   <section className="g38-rotation" aria-label="G38 Teamrotation und Korrektur">
    <div className="g28-inventory-head">
     <h4>Teamrotation</h4>
     <strong>{rotationSummary.done}/{rotationSummary.assigned} Teamaufgaben geprobt</strong>
    </div>
    <div className="g38-team-status">
     {rotation.perTeam.map(t=><div key={t.team}>
      <strong>Team {t.team}</strong>
      <span>{t.rehearsed}/{t.assigned} geprobt</span>
      <span>{t.missing} ohne Quelle · {t.held} Korrekturen</span>
     </div>)}
    </div>
    <div className="g39-work-queue" aria-label="G39 Aktionsfähige Teamliste">
     <p><strong>{workQueue.practice.length} probefähig</strong> · {workQueue.hold.length} mit Korrekturvermerk
      {' '}· {workQueue.source.length} ohne Quelle · {workQueue.done.length} abgeschlossen</p>
     <div className="g39-team-lanes">
      {workQueue.perTeam.map(t=><span key={t.team}>
       Team {t.team}: {t.practice} bereit · {t.hold} prüfen · {t.source} unbelegt
      </span>)}
     </div>
    </div>
    <div className="g38-rotation-actions">
     <button type="button" className="exp-secondary"
      disabled={rotationBusy||!workQueue.practice.some(t=>teamChoice===0||t.team===teamChoice)}
      onClick={()=>moveToRotationTurn(teamChoice===0?undefined:teamChoice)}>
      Nächster fairer Teamturn
     </button>
     <button type="button" className="exp-secondary"
      disabled={!workQueue.hold.some(t=>teamChoice===0||t.team===teamChoice)}
      onClick={()=>moveToBlockedTurn('hold')}>Nächsten Korrekturfall anzeigen</button>
     <button type="button" className="exp-secondary"
      disabled={!workQueue.source.some(t=>teamChoice===0||t.team===teamChoice)}
      onClick={()=>moveToBlockedTurn('source')}>Nächsten unbelegten Teamplatz anzeigen</button>
     <button type="button" className="exp-secondary"
      disabled={!cueReceipt||Boolean(currentHold)||rotationBusy||
       saveState==='stale'||saveState==='error'||saveState==='loading'}
      onClick={()=>void markAndRotate()}>
      Aufgabe proben und Teamwechsel
     </button>
    </div>
    <div className="g38-review-decision">
     <label>G10-Prüfgrund
      <select aria-label="G38 Prüfgrund" value={holdReason}
       onChange={e=>setHoldReason(e.target.value as EditorialHoldReason)}>
       <option value="question">Fragestellung korrigieren</option>
       <option value="source">Quellenbeleg prüfen</option>
       <option value="rights">Nutzungsrechte klären</option>
       <option value="rules">Spielregel klären</option>
      </select>
     </label>
     <button type="button" className="exp-secondary"
      disabled={!cueReceipt||rotationBusy||saveState==='stale'||saveState==='error'}
      onClick={()=>void updateHold(holdReason)}>Korrekturvermerk setzen</button>
     {currentHold&&<button type="button" className="exp-secondary"
      disabled={rotationBusy||saveState==='stale'||saveState==='error'}
      onClick={()=>void updateHold(null)}>Korrekturvermerk zurücknehmen</button>}
     {currentHold&&<strong>G10-Korrektur offen · {currentHold.reason}</strong>}
    </div>
    {rotationMessage&&<p role="status">{rotationMessage}</p>}
    <div className="g38-held-sources">
     {validHolds.map(h=><button type="button" className="exp-secondary"
      key={h.game+'/'+h.slot}
      onClick={()=>{const target=cueSheet.cues.find(c=>c.game===h.game&&
       c.slot===h.slot&&(c.phase==='ready'||c.phase==='prepared'));
       openEveningCue(target??null);
       const item=items.find(i=>i.id===h.sourceId);if(item)onChoose(item);}}>
      {labels[h.game]} · {h.slot} · {h.sourceId} · {h.reason} · G10
     </button>)}
    </div>
   </section>
   <div className="g36-cue">
    <div aria-live="polite">
     {cue?<><strong>{cue.index+1} / {cueSheet.cues.length} · {labels[cue.game]}</strong>
      <p>{cue.label} · {cue.phase}</p>
      {cue.teamNumber&&<p>Team {cue.teamNumber}</p>}
      <p>Quelle: {cue.sourceId??'Nicht besetzt'}
       {cue.sourceRevision!==null?' · Revision '+cue.sourceRevision:''}</p>
      {cue.needsReview&&<strong>Quelle redaktionell offen</strong>}
      {cueReceipt&&<button type="button" className="exp-secondary"
       aria-pressed={isCueRehearsed}
       onClick={()=>setRehearsed(old=>toggleRehearsalMark(cueSheet,old,cue))}>
       {isCueRehearsed?'Probenmarkierung zurücknehmen':'Aufgabe probeweise durchgespielt'}
      </button>}
      {cue.sourceId&&<button type="button" className="exp-secondary"
       onClick={()=>{const found=items.find(x=>x.id===cue.sourceId);if(found)onChoose(found);}}>
       Originalquelle in G10 öffnen
      </button>}
     </>:<p>Keine Moderationsphase vorhanden.</p>}
    </div>
    <div aria-label="G36 Öffentliche Phasenvorschau">
     <strong>Beamer-Vorschau</strong>
     <p>{cue?.stage??'Keine Aufgabe'}</p>
    </div>
   </div>
   <div className="g36-roster">
    {cueSheet.teamTurns.map(t=><div key={t.game}>
     <strong>{labels[t.game]}</strong>
     <span>{t.count.map((n,i)=>'Team '+(i+1)+': '+n).join(' · ')}</span>
     <span>{t.balanced?'Gleich verteilt':'Unterschiedliche Teamaufgaben'}</span>
    </div>)}
   </div>
  </section>
  <section className="g30-pack-plan" aria-label="G30 Original-Packplanung">
   <div className="g28-inventory-head">
    <h3>Packplanung · {labels[game]}</h3><strong>NO_GO · Quellenentwürfe</strong>
   </div>
   <p>{plan.slots.length} Plätze · {plan.selectedIds.length} zugeordnete Aufgaben ·
    {' '}{plan.sourceDrafts} ohne lokale Freigabe · {plan.problems.length} Prüfhinweise</p>
   <strong>{plan.structuralReady?'Regelstruktur erfüllt':'Spielstruktur unvollständig'}</strong>
   {plan.problems.length>0&&<div className="g30-pack-problems" aria-label="G30 Packrisiken">
    {plan.problems.slice(0,20).map((problem,i)=><p key={problem.code+'-'+i}>
     <b>{problem.code}:</b> {problem.message}
     {problem.itemIds.map(id=><span key={id}> {id}</span>)}</p>)}
   </div>}
   {evening.spoilers.length>0&&<div className="g30-pack-problems"
    aria-label="G30 Spielübergreifende Hinweis-Konflikte">
    <strong>Spielübergreifende Hinweis-Konflikte</strong>
    {evening.spoilers.map((problem,i)=><div key={i}>
     {problem.itemIds.map(id=><button type="button" className="exp-secondary" key={id}
      onClick={()=>{const item=items.find(x=>x.id===id);if(item)onChoose(item);}}>
      {id} im G10-Editor prüfen</button>)}
    </div>)}
   </div>}
   <div className="g30-plan-actions">
    <button type="button" className="exp-secondary" onClick={downloadPlan}
     disabled={!plan.selectedIds.length}>Quell-IDs als Packplan exportieren</button>
    <button type="button" className="exp-secondary"
     onClick={()=>setOverrides(prev=>({...prev,[configKey]:{}}))}>
     Auswahl zurücksetzen</button>
   </div>
   <details>
    <summary>Aufgabenplätze und Originalquellen wählen ({plan.slots.length})</summary>
    <div className="g30-pack-slots">
     {plan.slots.map(slot=><div key={slot.key} className="g30-pack-slot">
      <label>{slot.label}
       <select value={slot.selected??''} aria-label={'G30 '+slot.label}
        onChange={e=>setOverrides(prev=>({...prev,[configKey]:{
         ...prev[configKey],[slot.key]:e.target.value}}))}>
        <option value="">Nicht besetzt</option>
        {slot.options.map(id=><option value={id} key={id}>{id}</option>)}
       </select>
      </label>
      {slot.selected&&<button type="button" className="exp-secondary"
       onClick={()=>{const item=items.find(x=>x.id===slot.selected);if(item)onChoose(item);}}>
       {slot.selected} in G10 prüfen</button>}
     </div>)}
    </div>
   </details>
   <section className="g32-review" aria-label="G32 Quellenreparatur">
    <div className="g28-inventory-head">
     <h3>Offene Aufgaben · {labels[game]}</h3>
     <strong>{prioritized.length} Prüffälle</strong>
    </div>
    {prioritized.length===0?<p>Keine offenen Konflikte in dieser Auswahl.</p>:
    <div className="g32-review-grid">
     <div className="g32-review-list">
      {prioritized.slice(0,25).map(task=><div key={task.slot}>
       <button type="button" aria-pressed={currentRepairSlot===task.slot}
        className="exp-secondary" onClick={()=>setRepairSlot(task.slot)}>
        {task.label} · {task.severity} · {task.issues.join(', ')}
       </button>
       {task.itemId&&<button type="button" className="exp-secondary"
        onClick={()=>{const item=items.find(i=>i.id===task.itemId);if(item)onChoose(item);}}>
        G10: {task.itemId}</button>}
      </div>)}
     </div>
     <div className="g32-repair-choices">
      <strong>{plan.slots.find(s=>s.key===currentRepairSlot)?.label??'Kein Quellplatz'}</strong>
      {repairs.length===0?<p>Keine Alternative ohne zusätzliche strukturelle Risiken.</p>:
       repairs.map(choice=><button key={choice.sourceId} type="button" className="exp-secondary"
        onClick={()=>useRepair(choice.sourceId)}>
        {choice.sourceId} auswählen · {choice.change} Risikopunkte weniger
       </button>)}
      <button type="button" className="exp-secondary"
       disabled={!undoRepair||undoRepair.key!==configKey}
       onClick={undoLastRepair}>Letzte Quellwahl rückgängig</button>
     </div>
    </div>}
    <p>Alternativen sind lokale Entwurfsvorschläge. Fakten, Quellenrechte und Antworten werden nicht automatisch geprüft.</p>
   </section>
   <section className="g31-rehearsal" aria-label="G31 Moderationsprobe">
    <div className="g28-inventory-head">
     <h3>Moderationsprobe · {labels[game]}</h3><strong>NO_GO</strong>
    </div>
    <p>{rehearsal.taskCount} Aufgaben · {rehearsal.steps.length} Moderationsschritte
     {' '}· {rehearsal.missingCount} fehlend · {rehearsal.conflictedCount} mit Prüfhinweisen</p>
    <p>Teamaufgaben: {rehearsal.teamTurns.map((n,i)=>'Team '+(i+1)+': '+n).join(' · ')}
     {' '}· {rehearsal.balancedTeamExposure?'Gleich verteilt':'Verteilung prüfen'}</p>
    <div className="g31-nav">
     <button type="button" className="exp-secondary" disabled={!activeStep||activeStep.index===0}
      onClick={()=>setStepIndex(v=>Math.max(0,v-1))}>Vorheriger Schritt</button>
     <button type="button" className="exp-secondary"
      disabled={!activeStep||activeStep.index===rehearsal.steps.length-1}
      onClick={()=>setStepIndex(v=>Math.min(rehearsal.steps.length-1,v+1))}>Nächster Schritt</button>
     <button type="button" className="exp-secondary" disabled={!conflicts.length}
      onClick={goToNextIssue}>Nächsten Prüffall zeigen</button>
     <button type="button" className="exp-secondary"
      onClick={()=>setGameSelection(GAME_TYPES[(GAME_TYPES.indexOf(game)+1)%GAME_TYPES.length]!)}>
      Nächstes Spiel</button>
    </div>
    <div className="g31-two-views">
     <section className="g31-moderator" aria-label="G31 Spielleitung">
      <h4>Spielleitung</h4>
      {activeStep?<div aria-live="polite">
       <strong>Schritt {activeStep.index+1} / {rehearsal.steps.length} · {activeStep.slotLabel}</strong>
       <p>{activeStep.hostStep} · {activeStep.hostNext}</p>
       <p>{activeStep.scoreState}</p>
       <p>Quelle: {activeStep.sourceId??'Fehlender Inhalt'}</p>
       {activeStep.issues.length>0&&<p>{activeStep.issues.map(i=>i.code).join(' · ')}</p>}
       {activeStep.sourceId&&<button type="button" className="exp-secondary"
        onClick={()=>{const item=items.find(x=>x.id===activeStep.sourceId);
         if(item)onChoose(item);}}>Quelle {activeStep.sourceId} in G10 prüfen</button>}
      </div>:<p>Keine Aufgaben für dieses Profil.</p>}
     </section>
     <section className="g31-stage" aria-label="G31 Beamer-Probe">
      <h4>Beamer · Vorschau</h4>
      <strong aria-live="polite">{frame.stage}</strong>
     </section>
    </div>
    <p>Lesbare Simulation der ursprünglichen Moderationsphasen. Kein Spielstand,
     keine Bewertung, keine Live-Projektion oder Veröffentlichung.</p>
   </section>
   <p>Die Planung verwendet nur Original-IDs und bestehende Regeln. Auch vollständig besetzte Packs bleiben
    ohne unabhängige Redaktion, Rechteprüfung und G26-Entscheid nicht veröffentlichbar.</p>
  </section>
  <details>
   <summary>Alle 45 Kombinationen ({inventory.programs.filter(p=>p.structurallyComplete).length} strukturell vollständig)</summary>
   <table><thead><tr><th>Spiel</th><th>Profil</th><th>Teams</th><th>Struktur</th></tr></thead>
    <tbody>{inventory.programs.map(p=><tr key={p.game+'-'+p.profile+'-'+p.teams}>
     <td>{labels[p.game]}</td><td>{p.profile}</td><td>{p.teams}</td>
     <td>{p.structurallyComplete?'Vollständig':'Fehlend: '+p.gaps.filter(g=>g.missing).map(g=>g.kind+' '+g.missing).join(', ')}</td>
    </tr>)}</tbody></table>
  </details>
  <div className="g28-priority-head">
   <h3>Redaktionelle Reihenfolge · {labels[game]}</h3>
   <label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>
    Alle offenen Aufgaben</label>
  </div>
  <div className="g28-priorities">
   {queue.slice(0,showAll?queue.length:8).map(task=><button type="button"
    className="g28-priority" key={task.item.id} onClick={()=>onChoose(task.item)}>
    <strong>{task.item.id}</strong><span>{task.reasons.join(' · ')}</span>
   </button>)}
   {queue.length===0&&<p>Keine offenen Aufgaben dieses Spiels.</p>}
  </div>
 </section>;
}

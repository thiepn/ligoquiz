import {useEffect,useMemo,useState} from 'react';
import {ContentRepository} from '../../content/repository';
import {GAME_VISUALS} from '../../design-system/theme';
import type {SetupDraft} from './model';
import {assessApprovedPrograms,matchingApprovedChoice,type ApprovedProgramInventory} from './approved-program-finder';
import './u18-program-finder.css';

type Snapshot={state:'loading'|'ready'|'error';inventory:ApprovedProgramInventory|null;error:string};
const names:Record<SetupDraft['profile'],string>={kurz:'Kurz',standard:'Standard',lang:'Lang'};

/** Read-only prep-time selector; opening a game remains guarded by createPreparedApproved. */
export function ApprovedProgramFinder({draft,onSelect}:{
 draft:Pick<SetupDraft,'game'|'profile'|'count'>;
 onSelect:(selection:Pick<SetupDraft,'game'|'profile'|'count'>)=>void;
}){
 const [revision,setRevision]=useState(0);
 const [snapshot,setSnapshot]=useState<Snapshot>({state:'loading',inventory:null,error:''});
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setSnapshot({state:'loading',inventory:null,error:''});
   const repo=new ContentRepository();
   try{
    const items=await repo.list();
    const inventory=await assessApprovedPrograms(items);
    if(active)setSnapshot({state:'ready',inventory,error:''});
   }catch(e){if(active)setSnapshot({state:'error',inventory:null,error:
      e instanceof Error?e.message:'Freigegebenen Aufgabenbestand nicht lesbar'});}
   finally{await repo.close();}
  };
  void load();
  return ()=>{active=false;};
 },[revision]);
 const inventory=snapshot.inventory;
 const current=inventory?matchingApprovedChoice(inventory,draft.game,draft.profile,draft.count):null;
 const alternatives=useMemo(()=>inventory?.choices.filter(c=>c.ready&&
   (c.game!==draft.game||c.profile!==draft.profile||c.teams!==draft.count))??[],[inventory,draft]);
 const choose=(game:SetupDraft['game'],profile:SetupDraft['profile'],count:SetupDraft['count'])=>{
  onSelect({game,profile,count});
 };
 return <section className="u18-finder" aria-label="Freigegebene Programme finden">
  <header className="u18-finder-header">
   <h3>Freigegebene Programme</h3>
   <button type="button" onClick={()=>setRevision(n=>n+1)} disabled={snapshot.state==='loading'}>
    Bestand neu prüfen</button>
  </header>
  {snapshot.state==='loading'&&<p role="status">Originale Inhaltsfreigaben werden geprüft.</p>}
  {snapshot.state==='error'&&<div role="alert" className="u18-finder-error">
   <strong>Prüfung nicht möglich</strong><p>{snapshot.error}</p>
  </div>}
  {snapshot.state==='ready'&&inventory&&current&&<>
   <div className={'u18-finder-current'+(current.ready?' is-ready':' is-missing')} aria-label="Aktuelle Programmauswahl">
    <div><strong>{GAME_VISUALS[draft.game].label} · {names[draft.profile]} · {draft.count} Teams</strong>
     <b>{current.ready?'Originalauswahl möglich':'Derzeit nicht spielbar'}</b></div>
    {!current.ready&&<>
     {current.missing.length>0?<ul>{current.missing.map(m=><li key={m}>{m}</li>)}</ul>:
      <p>{current.reason}</p>}
    </>}
   </div>
   {inventory.invalidFingerprints>0&&<p className="u18-finder-error" role="alert">
    {inventory.invalidFingerprints} Freigaben haben keinen gültigen Original-Fingerabdruck und wurden nicht berücksichtigt.
   </p>}
   {alternatives.length>0?<div className="u18-finder-alternatives">
    <h4>Andere verfügbare Programme</h4>
    <div className="u18-finder-choices">
     {alternatives.map(choice=><button type="button" key={choice.game+'-'+choice.profile+'-'+choice.teams}
      onClick={()=>choose(choice.game,choice.profile,choice.teams)}
      aria-label={GAME_VISUALS[choice.game].label+' '+names[choice.profile]+' '+choice.teams+' Teams auswählen'}>
      <strong>{GAME_VISUALS[choice.game].label}</strong>
      <span>{names[choice.profile]} · {choice.teams} Teams</span>
      </button>)}
    </div>
   </div>:!current.ready&&<div className="u18-finder-empty" role="status">
    Kein vollständig freigegebenes Programm verfügbar. Fehlende Aufgaben im Inhaltsatelier erstellen und ausdrücklich prüfen lassen.
    <a href="#/inhalte">Inhaltsatelier öffnen</a>
   </div>}
  </>}
 </section>;
}

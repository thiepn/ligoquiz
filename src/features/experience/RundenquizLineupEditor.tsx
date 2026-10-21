import {useEffect,useMemo,useState} from 'react';
import {ContentRepository} from '../../content/repository';
import {ROUNDS,PROFILE_COUNTS} from '../../games/rundenquiz/engine';
import type {SetupDraft} from './model';
import {reviewedRundenquizChoices,chosenRundenquizCounts,type RundenquizLineup} from './rundenquiz-lineup';
import './u19-lineup.css';

const labels:Record<(typeof ROUNDS)[number],string>={
 wissen:'Wissen',hinweise:'Vier Hinweise',schaetzen:'Schätzen',finale:'Finale',
};
/** Local organizer-only curation. Never publishes a prompt or transfers an answer to stage. */
export function RundenquizLineupEditor({draft,onChange,onValidity}:{
 draft:Pick<SetupDraft,'profile'|'rqQuestionIds'>;
 onChange:(ids:string[]|undefined)=>void;
 onValidity:(valid:boolean)=>void;
}){
 const [inventory,setInventory]=useState<RundenquizLineup|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');setInventory(null);
  const repo=new ContentRepository();
  void (async()=>{
   try{
    const items=await repo.list();
    const next=await reviewedRundenquizChoices(items);
    if(active)setInventory(next);
   }catch(e){if(active)setError(e instanceof Error?e.message:'Inhaltsbibliothek nicht lesbar');}
   finally{await repo.close();if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[revision]);
 const active=draft.rqQuestionIds!==undefined,ids=draft.rqQuestionIds??[];
 const status=useMemo(()=>chosenRundenquizCounts(draft.profile,inventory?.questions??[],ids),
  [draft.profile,inventory,ids]);
 const valid=active&&!!inventory&&status.exact&&!loading&&!error;
 useEffect(()=>onValidity(!active||valid),[active,valid,onValidity]);
 const choose=(id:string,checked:boolean)=>{
  const chosen=new Set(ids);
  if(checked)chosen.add(id);else chosen.delete(id);
  onChange([...chosen]);
 };
 return <section className="u19-lineup" aria-label="Rundenquiz Fragen zusammenstellen">
  <div className="u19-lineup-head"><h3>Fragen für den Abend</h3>
   <button type="button" disabled={loading} onClick={()=>setRevision(n=>n+1)}>Fragen neu laden</button>
  </div>
  <div className="u19-lineup-switch">
   <button type="button" aria-pressed={!active} onClick={()=>onChange(undefined)}>
    Automatische Originalauswahl</button>
   <button type="button" aria-pressed={active} onClick={()=>onChange([])}>
    Fragen selbst auswählen</button>
  </div>
  {loading&&<p role="status">Freigegebene Fragen werden geladen.</p>}
  {error&&<p role="alert" className="u19-lineup-error">{error}</p>}
  {active&&inventory&&!loading&&<>
   <div className="u19-lineup-status" role="status" data-lineup-valid={valid}>
    <strong>{status.exact?'Fragenauswahl vollständig':'Fragenauswahl unvollständig'}</strong>
    <span>{ids.length} Fragen gewählt</span>
   </div>
   {ROUNDS.map(round=>{
    const needed=PROFILE_COUNTS[draft.profile][round];
    const selected=status.details.find(d=>d.round===round)?.selected??0;
    const options=inventory.questions.filter(q=>q.round===round);
    return <fieldset className="u19-lineup-round" key={round}>
     <legend>{labels[round]} · {selected} / {needed}</legend>
     {needed===0?<p>In diesem Profil nicht enthalten.</p>:
      options.length===0?<p>Keine freigegebenen Fragen verfügbar.</p>:
      options.map(q=><label className="u19-lineup-option" key={q.id}>
       <input type="checkbox" checked={ids.includes(q.id)}
        disabled={!ids.includes(q.id)&&selected>=needed}
        onChange={e=>choose(q.id,e.target.checked)}/>
       <span>{q.prompt}</span>
      </label>)}
    </fieldset>;
   })}
   {inventory.excluded>0&&<p className="u19-lineup-omitted">{inventory.excluded} nicht freigegebene oder veränderte Fragen ausgeschlossen.</p>}
  </>}
 </section>;
}

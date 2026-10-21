import { useEffect, useState } from 'react';
import { EventRepository } from '../../infrastructure/db/event-repository';
import {createPreparedApproved} from './approved-setup';
import {
  newSetupDraft, readSetupDraft, readPreferences, saveSetupDraft, clearSetupDraft,
  createPreparedRundenquiz, createPreparedQuiztafel, createPreparedVerbindungen,createPreparedLogikleiter,createPreparedUmfrageduell, writeHostIdentity, type SetupDraft,
} from './model';

import {StudioPopMotif} from '../../design-system/StudioPop';
import {ApprovedProgramFinder} from './ApprovedProgramFinder';
import {RundenquizLineupEditor} from './RundenquizLineupEditor';
import {QuiztafelBoardComposer} from './QuiztafelBoardComposer';
import {GAME_ORDER,GAME_VISUALS} from '../../design-system/theme';
import './u04-prep.css';

const steps=['Teams','Programm','Bereit'] as const;
function validNames(d:SetupDraft) {
  const names=d.teams.slice(0,d.count).map(s=>s.trim().toLocaleLowerCase('de-DE'));
  return names.every(name=>name.length>0) && new Set(names).size===names.length;
}

export function SetupWizard() {
  const [draft,setDraft]=useState<SetupDraft>(()=>readSetupDraft()??newSetupDraft(readPreferences()));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [projectorAcknowledged,setProjectorAcknowledged]=useState(false);
  const [lineupValid,setLineupValid]=useState(false);
  const [boardValid,setBoardValid]=useState(false);
  useEffect(()=>{
    try { saveSetupDraft(draft); } catch { setError('Vorbereitung konnte lokal nicht zwischengespeichert werden.'); }
  },[draft]);
  const set=(next:Partial<SetupDraft>)=>{setError('');setDraft(prev=>({
    ...prev,...next,...((next.game&&next.game!==prev.game||
      next.profile&&next.profile!==prev.profile||
      next.contentSource&&next.contentSource!==prev.contentSource)?
      {rqQuestionIds:undefined}:{}),
    ...((next.game&&next.game!==prev.game||next.profile&&next.profile!==prev.profile||
      next.contentSource&&next.contentSource!==prev.contentSource||
      next.count&&next.count!==prev.count)?{qtTileIds:undefined}:{}),
  }));};
  const next=()=>{if(draft.step===0&&!validNames(draft)){setError('Bitte jedem Team einen eindeutigen Namen geben.');return;}
    if(draft.step===1&&draft.game==='rundenquiz'&&draft.contentSource==='approved'&&
      draft.rqQuestionIds!==undefined&&!lineupValid){
      setError('Bitte alle Fragen je Runde vollständig auswählen.');return;
    }
    if(draft.step===1&&draft.game==='quiztafel'&&draft.contentSource==='approved'&&
      draft.qtTileIds!==undefined&&!boardValid){
      setError('Bitte jede Quiztafel-Kategorie und jeden Feldwert vollständig auswählen.');return;
    }
    set({step:Math.min(2,draft.step+1) as SetupDraft['step']});
  };
  async function prepare() {
    if(busy)return;
    if(!validNames(draft)){setError('Bitte Teamnamen prüfen.');set({step:0});return;}
    if(!projectorAcknowledged){setError('Bitte die Beamer-Hinweise bestätigen.');return;}
    if(draft.game==='rundenquiz'&&draft.contentSource==='approved'&&
       draft.rqQuestionIds!==undefined&&!lineupValid){setError('Fragenauswahl erneut prüfen.');return;}
    if(draft.game==='quiztafel'&&draft.contentSource==='approved'&&
       draft.qtTileIds!==undefined&&!boardValid){setError('Spielfeldauswahl erneut prüfen.');return;}
    setBusy(true);setError('');
    const repo=new EventRepository();
    try{
      const identity=draft.contentSource==='approved'?await createPreparedApproved(repo,draft):
        draft.game==='quiztafel'?await createPreparedQuiztafel(repo,draft):
        draft.game==='verbindungen'?await createPreparedVerbindungen(repo,draft):
        draft.game==='logikleiter'?await createPreparedLogikleiter(repo,draft):
        draft.game==='umfrageduell'?await createPreparedUmfrageduell(repo,draft):
        await createPreparedRundenquiz(repo,draft);
      writeHostIdentity(identity);
      clearSetupDraft();
      window.location.hash='#/host';
    }catch(e){setError(e instanceof Error?e.message:'Die Vorbereitung konnte nicht gespeichert werden.');}
    finally{await repo.close();setBusy(false);}
  }

  const activeNames=draft.teams.slice(0,draft.count);
  const normalized=activeNames.map(n=>n.trim().toLocaleLowerCase('de-DE'));
  const duplicateNames=new Set(normalized.filter((n,i)=>n&&normalized.indexOf(n)!==i));
  return <section className="exp-page sp-prep" aria-label="Quizabend vorbereiten">
    <header className="sp-prep-mast">
      <div>
        <h1>Quizabend vorbereiten</h1>
        <span className="sp-prep-local">LOKAL · NOCH NICHT LIVE</span>
      </div>
      <a href="#/spielen" className="sp-prep-exit">← Zur Übersicht</a>
      <span className="sp-prep-decor" aria-hidden="true">!</span>
    </header>
    <nav aria-label="Vorbereitungsschritte" className="exp-steps sp-prep-steps">
      {steps.map((name,i)=><div key={name} aria-current={draft.step===i?'step':undefined}
        className={draft.step===i?'exp-current':i<draft.step?'sp-prep-done':''}><b>0{i+1}</b><span>{name}</span></div>)}
    </nav>
    <div className="sp-prep-layout"><div className="sp-prep-main">
    {draft.step===0&&<div className="exp-form sp-prep-panel">
      <h2>Teams festlegen</h2>
      <label className="exp-field">Anzahl der Teams
        <select value={draft.count} onChange={e=>set({count:Number(e.target.value) as SetupDraft['count']})}>
          {[3,4,5].map(n=><option key={n} value={n}>{n} Teams</option>)}</select>
      </label>
      <div className="exp-roster sp-prep-roster">{draft.teams.slice(0,draft.count).map((name,i)=>
        <label className="exp-field sp-prep-team" key={i}><span><b className={'sp-prep-team-number sp-prep-team-number--'+i}>{String(i+1).padStart(2,'0')}</b> Team {i+1}</span>
          <input value={name} maxLength={40} aria-invalid={!name.trim()||duplicateNames.has(name.trim().toLocaleLowerCase('de-DE'))} onChange={e=>set({teams:draft.teams.map((v,j)=>j===i?e.target.value:v)})}/>
        </label>)}</div>
    </div>}
    {draft.step===1&&<div className="exp-form sp-prep-panel">
      <h2>Programm wählen</h2>
      <div className="exp-choice-games sp-prep-game-choices" aria-label="Spielmodus wählen">
        {GAME_ORDER.map(game=>{
          const look=GAME_VISUALS[game],chosen=draft.game===game;
          return <button type="button" key={game}
            className={'exp-program sp-prep-game sp-prep-game--'+look.tone+(chosen?' chosen':'')}
            aria-pressed={chosen} onClick={()=>set({game})}>
            <span className="sp-prep-game-art" aria-hidden="true"><StudioPopMotif game={game}/></span>
            <span className="sp-prep-game-copy">
              <strong>{look.label}</strong><span>{look.description}</span></span>
            <b>{chosen?'Ausgewählt':'Wählen'}</b>
          </button>;
        })}
      </div>      <label className="exp-field">Umfang
        <select value={draft.profile} onChange={e=>set({profile:e.target.value as SetupDraft['profile']})}>
          <option value="kurz">Kurz · {draft.game==='quiztafel'?draft.count*3+' Felder':draft.game==='logikleiter'?'3 Stufen':draft.game==='umfrageduell'?'4 Umfragen':draft.game==='verbindungen'?(draft.count+1)+' Aufgaben':'7 Aufgaben'}</option>
          <option value="standard">Standard · {draft.game==='quiztafel'?draft.count*5+' Felder':draft.game==='logikleiter'?'5 Stufen':draft.game==='umfrageduell'?'6 Umfragen':draft.game==='verbindungen'?(2*draft.count+1)+' Aufgaben':'11 Aufgaben'}</option>
          <option value="lang">Lang · {draft.game==='quiztafel'?draft.count*6+' Felder':draft.game==='logikleiter'?'7 Stufen':draft.game==='umfrageduell'?'10 Umfragen':draft.game==='verbindungen'?(3*draft.count+1)+' Aufgaben':'16 Aufgaben'}</option>
        </select>
      </label>
      <fieldset className="cx-source-choice sp-prep-sources"><legend>Woher stammen die Aufgaben?</legend>
       <label><input type="radio" name="content-source" value="trial" checked={draft.contentSource==='trial'}
          onChange={()=>set({contentSource:'trial'})}/>
        Probeprogramm – ungeprüfte Beispielaufgaben, nur zum Testen</label>
       <label><input type="radio" name="content-source" value="approved" checked={draft.contentSource==='approved'}
          onChange={()=>set({contentSource:'approved'})}/>
        Redaktionell freigegebene Inhaltsbibliothek – ohne automatische Probe-Ergänzung</label>
       {draft.contentSource==='approved'&&<p>Nur vollständig geeignete Pakete sind spielbar. Bestand unter
        {' '}<a href="#/inhalte">Inhalte</a> prüfen.</p>}
      </fieldset>
      {draft.contentSource==='approved'&&<ApprovedProgramFinder draft={draft}
       onSelect={choice=>set({...choice})}/>}
      {draft.contentSource==='approved'&&draft.game==='rundenquiz'&&
       <RundenquizLineupEditor draft={draft}
        onChange={ids=>set({rqQuestionIds:ids})} onValidity={setLineupValid}/>}
      {draft.contentSource==='approved'&&draft.game==='quiztafel'&&
       <QuiztafelBoardComposer draft={draft} onChange={ids=>set({qtTileIds:ids})}
        onValidity={setBoardValid}/>} 
      <p className="exp-notice">Die Probeinhalte sind weder importiert noch redaktionell freigegeben. Quiztafel hat feste Wahlrechte; Verbindungen verteilt alle Einzelaufgaben gleichmäßig. Logikleiter bietet allen Teams dieselben Stufen. Umfrageduell nutzt ausdrücklich erfundene Beispieldaten, keine echte Befragung.</p>
    </div>}
    {draft.step===2&&<div className="exp-form sp-prep-panel">
      <h2>Bereit zum Spielen</h2>
      <div className="exp-summary">
        <div><span>Teams</span><strong>{draft.count}</strong><p>{draft.teams.slice(0,draft.count).join(' · ')}</p></div>
        <div><span>Programm</span><strong>{draft.game==='quiztafel'?'Quiztafel':draft.game==='verbindungen'?'Verbindungen':draft.game==='logikleiter'?'Logikleiter':draft.game==='umfrageduell'?'Umfrageduell':'Rundenquiz'}</strong><p>{draft.game==='quiztafel'?draft.count*(draft.profile==='kurz'?3:draft.profile==='standard'?5:6):draft.game==='logikleiter'?(draft.profile==='kurz'?3:draft.profile==='standard'?5:7):draft.game==='umfrageduell'?(draft.profile==='kurz'?4:draft.profile==='standard'?6:10):draft.game==='verbindungen'?draft.count*(draft.profile==='kurz'?1:draft.profile==='standard'?2:3)+1:draft.profile==='kurz'?7:draft.profile==='standard'?11:16} {draft.game==='quiztafel'?'Felder':'Aufgaben'} · {draft.contentSource==='approved'?'freigegebene Bibliothek':'Probeinhalte'}</p></div>
        <div><span>Beamer</span><strong>Noch nicht verbunden</strong><p>Das Beamerfenster öffnest du in der Spielleitung.</p></div>
      </div>
      <div className="sp-prep-safety"><strong aria-hidden="true">!</strong><span>Beamer-Sicherheit: Die Spielleitung kann private Lösungen enthalten. Vermeide Bildschirmspiegelung.</span></div>
      <label className="exp-ack sp-prep-ack"><input type="checkbox" checked={projectorAcknowledged}
        onChange={e=>setProjectorAcknowledged(e.target.checked)}/>
        <span>Ich prüfe vor dem Spielen die Beameransicht auf einem <b>erweiterten</b> Bildschirm oder moderiere bewusst ohne Beamer. Beim Spiegeln könnte die private Lösung sichtbar sein.</span></label>
    </div>}
    {error&&<p className="exp-error" role="alert">{error}</p>}
    <div className="exp-actions sp-prep-actions">
      {draft.step>0&&<button className="exp-secondary sp-prep-back" disabled={busy}
        onClick={()=>set({step:(draft.step-1) as SetupDraft['step']})}>Zurück</button>}
      <button className="exp-primary sp-prep-next" disabled={busy} aria-busy={busy||undefined}
        onClick={()=>draft.step===2?void prepare():next()}>
        {draft.step===2?'Spielleitung öffnen':'Weiter'}
      </button>
    </div>
    </div>
</div>
  </section>;
}

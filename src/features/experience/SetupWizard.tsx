import { useEffect, useState } from 'react';
import { EventRepository } from '../../infrastructure/db/event-repository';
import {
  newSetupDraft, readSetupDraft, readPreferences, saveSetupDraft, clearSetupDraft,
  createPreparedRundenquiz, createPreparedQuiztafel, createPreparedVerbindungen, writeHostIdentity, type SetupDraft,
} from './model';

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
  useEffect(()=>{
    try { saveSetupDraft(draft); } catch { setError('Vorbereitung konnte lokal nicht zwischengespeichert werden.'); }
  },[draft]);
  const set=(next:Partial<SetupDraft>)=>{setError('');setDraft(prev=>({...prev,...next}));};
  const next=()=>{if(draft.step===0&&!validNames(draft)){setError('Bitte jedem Team einen eindeutigen Namen geben.');return;}
    set({step:Math.min(2,draft.step+1) as SetupDraft['step']});
  };
  async function prepare() {
    if(busy)return;
    if(!validNames(draft)){setError('Bitte Teamnamen prüfen.');set({step:0});return;}
    if(!projectorAcknowledged){setError('Bitte die Beamer-Hinweise bestätigen.');return;}
    setBusy(true);setError('');
    const repo=new EventRepository();
    try{
      const identity=draft.game==='quiztafel'?await createPreparedQuiztafel(repo,draft):
        draft.game==='verbindungen'?await createPreparedVerbindungen(repo,draft):
        await createPreparedRundenquiz(repo,draft);
      writeHostIdentity(identity);
      clearSetupDraft();
      window.location.hash='#/host';
    }catch(e){setError(e instanceof Error?e.message:'Die Vorbereitung konnte nicht gespeichert werden.');}
    finally{await repo.close();setBusy(false);}
  }

  return <section className="exp-page" aria-label="Quizabend vorbereiten">
    <div className="exp-heading"><div><p className="eyebrow">NEUER QUIZABEND</p><h1>Spielabend vorbereiten</h1>
      <p>In drei kurzen Schritten zur Spielleitung. Es sind keine Geräte für die Teams erforderlich.</p></div>
      <a href="#/spielen" className="exp-quiet">Zur Übersicht</a></div>
    <nav aria-label="Vorbereitungsschritte" className="exp-steps">
      {steps.map((name,i)=><div key={name} aria-current={draft.step===i?'step':undefined}
        className={draft.step===i?'exp-current':''}><b>0{i+1}</b>{name}</div>)}
    </nav>
    {draft.step===0&&<div className="exp-form">
      <h2>Teams festlegen</h2><p>Vier Teams sind voreingestellt. Namen können jederzeit vor dem Start geändert werden.</p>
      <label className="exp-field">Anzahl der Teams
        <select value={draft.count} onChange={e=>set({count:Number(e.target.value) as SetupDraft['count']})}>
          {[3,4,5].map(n=><option key={n} value={n}>{n} Teams</option>)}</select>
      </label>
      <div className="exp-roster">{draft.teams.slice(0,draft.count).map((name,i)=>
        <label className="exp-field" key={i}><span>Team {i+1}</span>
          <input value={name} maxLength={40} onChange={e=>set({teams:draft.teams.map((v,j)=>j===i?e.target.value:v)})}/>
        </label>)}</div>
    </div>}
    {draft.step===1&&<div className="exp-form">
      <h2>Programm wählen</h2>
      <p>Drei Spielmodi sind im Testbetrieb verfügbar. Logikleiter und Umfrageduell folgen.</p>
      <div className="exp-choice-games" aria-label="Spielmodus wählen">
        <button type="button" className={'exp-program'+(draft.game==='rundenquiz'?' chosen':'')}
          aria-pressed={draft.game==='rundenquiz'} onClick={()=>set({game:'rundenquiz'})}>
          <span className="exp-program-id">01 / RQ</span>
          <span><strong>Rundenquiz</strong><small>Wissen, Hinweise, Schätzen, Finale</small></span>
          <b>{draft.game==='rundenquiz'?'Ausgewählt':'Wählen'}</b>
        </button>
        <button type="button" className={'exp-program'+(draft.game==='quiztafel'?' chosen':'')}
          aria-pressed={draft.game==='quiztafel'} onClick={()=>set({game:'quiztafel'})}>
          <span className="exp-program-id">02 / QT</span>
          <span><strong>Quiztafel</strong><small>Kategorien, 100–600 Punkte, eine Übernahmechance</small></span>
          <b>{draft.game==='quiztafel'?'Ausgewählt':'Wählen'}</b>
        </button>
        <button type="button" className={'exp-program'+(draft.game==='verbindungen'?' chosen':'')}
          aria-pressed={draft.game==='verbindungen'} onClick={()=>set({game:'verbindungen'})}>
          <span className="exp-program-id">03 / VB</span>
          <span><strong>Verbindungen</strong><small>Vier Hinweise, Folgen, 4×4 Verbindungswand</small></span>
          <b>{draft.game==='verbindungen'?'Ausgewählt':'Wählen'}</b>
        </button>
      </div>
      <label className="exp-field">Umfang
        <select value={draft.profile} onChange={e=>set({profile:e.target.value as SetupDraft['profile']})}>
          <option value="kurz">Kurz · {draft.game==='quiztafel'?draft.count*3+' Felder':draft.game==='verbindungen'?(draft.count+1)+' Aufgaben':'7 Aufgaben'}</option>
          <option value="standard">Standard · {draft.game==='quiztafel'?draft.count*5+' Felder':draft.game==='verbindungen'?(2*draft.count+1)+' Aufgaben':'11 Aufgaben'}</option>
          <option value="lang">Lang · {draft.game==='quiztafel'?draft.count*6+' Felder':draft.game==='verbindungen'?(3*draft.count+1)+' Aufgaben':'16 Aufgaben'}</option>
        </select>
      </label>
      <p className="exp-notice">Die Probeinhalte sind weder importiert noch redaktionell freigegeben. Quiztafel hat feste Wahlrechte; Verbindungen verteilt alle Einzelaufgaben gleichmäßig.</p>
    </div>}
    {draft.step===2&&<div className="exp-form">
      <h2>Bereit zum Spielen</h2>
      <div className="exp-summary">
        <div><span>Teams</span><strong>{draft.count}</strong><p>{draft.teams.slice(0,draft.count).join(' · ')}</p></div>
        <div><span>Programm</span><strong>{draft.game==='quiztafel'?'Quiztafel':draft.game==='verbindungen'?'Verbindungen':'Rundenquiz'}</strong><p>{draft.game==='quiztafel'?draft.count*(draft.profile==='kurz'?3:draft.profile==='standard'?5:6):draft.game==='verbindungen'?draft.count*(draft.profile==='kurz'?1:draft.profile==='standard'?2:3)+1:draft.profile==='kurz'?7:draft.profile==='standard'?11:16} {draft.game==='quiztafel'?'Felder':'Aufgaben'} · Probeinhalte</p></div>
        <div><span>Beamer</span><strong>Noch nicht verbunden</strong><p>Das Beamerfenster öffnest du in der Spielleitung.</p></div>
      </div>
      <label className="exp-ack"><input type="checkbox" checked={projectorAcknowledged}
        onChange={e=>setProjectorAcknowledged(e.target.checked)}/>
        <span>Ich prüfe vor dem Spielen die Beameransicht auf einem <b>erweiterten</b> Bildschirm oder moderiere bewusst ohne Beamer. Beim Spiegeln könnte die private Lösung sichtbar sein.</span></label>
    </div>}
    {error&&<p className="exp-error" role="alert">{error}</p>}
    <div className="exp-actions">
      {draft.step>0&&<button className="exp-secondary" disabled={busy}
        onClick={()=>set({step:(draft.step-1) as SetupDraft['step']})}>Zurück</button>}
      <button className="exp-primary" disabled={busy}
        onClick={()=>draft.step===2?void prepare():next()}>
        {draft.step===2?'Spielleitung öffnen':'Weiter'}
      </button>
    </div>
    <p className="exp-footnote">Die Vorbereitung wird in diesem Browser zwischengespeichert. Sie startet weder einen Timer noch zeigt sie eine Frage auf dem Beamer.</p>
  </section>;
}

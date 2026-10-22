import {describeHostStep, type HostGame} from './HostModerationGuide';

const PHASES:Record<'rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell',Readonly<Record<string,number>>>={
 rundenquiz:{setup:0,ready:0,open:1,closed:1,revealed:2,graded:3,complete:3},
 quiztafel:{setup:0,board:0,prepared:0,question:1,'steal-offer':1,steal:1,adjudicated:1,revealed:2,awarded:3,complete:3},
 verbindungen:{setup:0,ready:0,'clue-open':1,'sequence-open':1,'wall-open':1,'wall-closed':1,'wall-reveal':2,revealed:2,graded:3,complete:3},
 logikleiter:{setup:0,ready:0,open:1,closed:1,revealed:2,graded:3,complete:3},
 umfrageduell:{setup:0,ready:0,open:1,closed:1,revealed:2,graded:3,complete:3},
};
const LABELS=[
 {name:'Vorbereiten',hint:'Teams & Auswahl'},
 {name:'Antworten',hint:'Frage & Team'},
 {name:'Werten',hint:'Lösung & Punkte'},
 {name:'Weiter',hint:'Nächster Schritt'},
] as const;
export type HostGameplayRailProps={
 game:Extract<HostGame,'rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell'>;
 phase:string;paused:boolean;recovery:boolean;completed:number;total:number;
};
/** Display-only rail. Action labels come from original G14 guide; no dispatching or new phase transitions. */
export function HostGameplayRail({game,phase,paused,recovery,completed,total}:HostGameplayRailProps){
 const active=PHASES[game][phase]??0;
 const guidance=describeHostStep({game,phase,paused,recovery,completed,total,viewers:0,ready:true,busy:false});
 const safeCompleted=Math.max(0,Math.min(total,completed));
 const steps=game==='verbindungen'?
  [{name:'Vorbereiten',hint:'Teams & Aufgaben'},{name:'Antworten',hint:'Hinweis / Folge / Wand'},{name:'Werten',hint:'Gruppen & Lösung'},{name:'Weiter',hint:'Nächste Aufgabe'}]:
  game==='logikleiter'?
  [{name:'Vorbereiten',hint:'Stufen & Teams'},{name:'Antworten',hint:'Sperren & Hinweis'},{name:'Werten',hint:'Teampunkte'},{name:'Weiter',hint:'Nächste Stufe'}]:
  game==='umfrageduell'?
  [{name:'Vorbereiten',hint:'Format & Herkunft'},{name:'Antworten',hint:'Teamantworten schließen'},{name:'Werten',hint:'Zuordnung & Auflösung'},{name:'Weiter',hint:'Nächste Umfrage'}]:LABELS;
 return <section className={'u07-phase-rail u07-phase-rail--'+game} data-u07-phase={phase}
   aria-label="Spielablauf" aria-roledescription="Moderationsschritte">
   <div className="u07-rail-top">
     <strong>{recovery?'Wiederherstellung prüfen':paused?'Spiel pausiert':guidance.step}</strong>
     <small>{safeCompleted} / {total} {game==='quiztafel'?'Felder':game==='logikleiter'?'Stufen':'Aufgaben'} abgeschlossen</small>
   </div>
   <ol className="u07-phase-steps">
     {steps.map((step,i)=><li key={step.name} className={i===active?'is-current':i<active?'is-complete':''}
       aria-current={i===active?'step':undefined}>
       <span className="u07-phase-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
       <span className="u07-phase-copy"><strong>{step.name}</strong></span>
       {i<active&&<span className="u07-phase-check" aria-hidden="true">✓</span>}
     </li>)}
   </ol>
 </section>;
}

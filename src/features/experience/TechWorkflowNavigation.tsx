import './u10-tech.css';

const sections=[
 {id:'u10-offline-check',number:'01',title:'Offline-Start',description:'Lokaler Browser- und Speichertest'},
 {id:'u10-projector-check',number:'02',title:'Beamerprobe',description:'Getrennte öffentliche Anzeige'},
 {id:'u10-g26-evidence',number:'03',title:'Originalnachweise',description:'Rechte, Rückweg und G26 NO-GO'},
] as const;

/** Navigation only: no new publisher, test authority, status flag or persistence. */
export function TechWorkflowNavigation(){
 function jump(id:string){
  const element=document.getElementById(id);
  if(!element)return;
  element.scrollIntoView({block:'start',behavior:'auto'});
  element.focus({preventScroll:true});
 }
 return <nav className="u10-tech-navigation" aria-label="Regie Arbeitsablauf">
  <div className="u10-tech-navigation-title">
   <div><span>DEIN VOR-SHOW-ABLAUF</span><strong>Prüfen. Proben. Nachweise behalten.</strong></div>
   <p>Die Schritte verlinken die echten vorhandenen Prüfwerkzeuge, nicht simulierte Freigaben.</p>
  </div>
  <div className="u10-tech-step-grid">
   {sections.map(step=><button key={step.id} type="button" aria-controls={step.id}
     onClick={()=>jump(step.id)}>
    <span>{step.number}</span><strong>{step.title}</strong><small>{step.description}</small>
    <b aria-hidden="true">↓</b>
   </button>)}
  </div>
  <div className="u10-tech-handoffs">
   <a href="#/spielen">Spielabend fortsetzen ↗</a>
   <a href="#/einstellungen">Backup exportieren ↗</a>
   <a href="#/verlauf">Abendberichte ↗</a>
  </div>
 </nav>;
}

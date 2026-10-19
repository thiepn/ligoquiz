import './u10-tech.css';

const sections=[
 {id:'u10-offline-check',title:'Offline-Start'},
 {id:'u10-projector-check',title:'Beamerprobe'},
 {id:'u10-g26-evidence',title:'Originalnachweise'},
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
  <div className="u10-tech-step-grid">
   {sections.map(step=><button key={step.id} type="button" aria-controls={step.id}
     onClick={()=>jump(step.id)}>
    <strong>{step.title}</strong>
   </button>)}
  </div>
  <div className="u10-tech-handoffs">
   <a href="#/spielen">Spielabend fortsetzen ↗</a>
   <a href="#/einstellungen">Backup exportieren ↗</a>
   <a href="#/verlauf">Abendberichte ↗</a>
  </div>
 </nav>;
}

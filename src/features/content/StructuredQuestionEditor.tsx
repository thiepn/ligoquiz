import type {GameType} from '../../domain/game/contracts';
import {
 editQuestionField,editAnswerVariants,switchQuestionFormat,editorialIssues,spectatorPromptPreview,
} from './structured-question-model';
import './u16-structured-editor.css';

type Path=readonly (string|number)[];
type ObjectValue=Record<string,unknown>;
const obj=(value:unknown):value is ObjectValue=>typeof value==='object'&&value!==null&&!Array.isArray(value);
function at(value:unknown,path:Path):unknown{
 return path.reduce<unknown>((node,key)=>Array.isArray(node)&&typeof key==='number'?node[key]:
  obj(node)&&typeof key==='string'?node[key]:undefined,value);
}
const str=(value:unknown)=>typeof value==='string'?value:'';
const rows=(value:unknown)=>Array.isArray(value)?value:[];

type EditProps={game:GameType;value:unknown;onChange:(next:unknown)=>void};
export function StructuredQuestionEditor({game,value,onChange}:EditProps){
 if(!obj(value))return <p role="alert">Aufgabenstruktur ist kein Objekt. JSON-Datensatz korrigieren.</p>;
 const set=(path:Path,v:string|number)=>onChange(editQuestionField(game,value,path,v));
 const field=(label:string,path:Path,{long=false,number=false,max=3000}:{
  long?:boolean;number?:boolean;max?:number;
 }={})=>{
  const v=at(value,path),id='u16-'+path.join('-');
  return <label key={id} className="u16-field" htmlFor={id}>
   <span>{label}</span>
   {long?<textarea id={id} rows={3} maxLength={max} value={str(v)}
    onChange={e=>set(path,e.target.value)}/>:
    <input id={id} type={number?'number':'text'} maxLength={number?undefined:max}
     value={number?(typeof v==='number'?v:0):str(v)}
     onChange={e=>set(path,number?Number(e.target.value):e.target.value)}/>}
  </label>;
 };
 const select=(label:string,path:Path,options:readonly [string,string][])=>{
  const v=str(at(value,path)),id='u16-'+path.join('-');
  return <label className="u16-field" key={id} htmlFor={id}><span>{label}</span>
    <select id={id} value={v} onChange={e=>set(path,e.target.value)}>
     {options.map(([key,title])=><option value={key} key={key}>{title}</option>)}
    </select></label>;
 };
 const lists=(label:string,path:Path,{max=15,allowed=true}:{max?:number;allowed?:boolean}={})=>{
  const members=rows(at(value,path));
  return <fieldset className="u16-list" key={path.join('-')}>
   <legend>{label}</legend>
   {members.map((_,i)=><div className="u16-choice" key={i}>
    {field(label+' '+(i+1),[...path,i],{max:100})}
    {allowed&&<button type="button" onClick={()=>onChange(editAnswerVariants(game,value,path,'remove',i))}
      aria-label={label+' '+(i+1)+' entfernen'}>Entfernen</button>}
   </div>)}
   {allowed&&members.length<max&&<button type="button" className="u16-add"
    onClick={()=>onChange(editAnswerVariants(game,value,path,'add'))}>+ {label} hinzufügen</button>}
  </fieldset>;
 };
 const issues=editorialIssues(game,value);
 const preview=spectatorPromptPreview(game,value);
 const kind=str(value.kind),round=str(value.round);
 return <section className="u16-editor" aria-label="Frage visuell bearbeiten" data-u16-mode={game}>
  <header className="u16-editor-head"><h3>Aufgabe bearbeiten</h3>
   <span className={issues.length?'u16-invalid':'u16-valid'} role="status">
    {issues.length?issues.length+' Eingaben prüfen':'Aufgabe strukturell gültig'}</span>
  </header>
  <div className="u16-fields">
   {game==='rundenquiz'&&<>
    <label className="u16-field" htmlFor="u16-rq-round"><span>Runde</span>
     <select id="u16-rq-round" value={round}
      onChange={e=>onChange(switchQuestionFormat('rundenquiz',value,e.target.value as 'wissen'|'hinweise'|'schaetzen'|'finale'))}>
      <option value="wissen">Wissen</option><option value="hinweise">Vier Hinweise</option>
      <option value="schaetzen">Schätzen</option><option value="finale">Finale</option>
     </select></label>
    {field('Fragestellung',['prompt'],{long:true})}
    {field('Lösung',['answer'])}
    {field('Quelle',['reference'])}
    {field('Antwortzeit (Sekunden)',['durationSeconds'],{number:true})}
    {round==='hinweise'&&lists('Hinweis',['clues'],{allowed:false,max:4})}
    {round==='wissen'&&lists('Antwortmöglichkeit',['choices'],{max:6})}
    {round==='schaetzen'&&<>
     {field('Richtige Zahl',['truth'],{max:80})}
     {field('Einheit',['unit'],{max:60})}
    </>}
   </>}
   {game==='quiztafel'&&<>
    {field('Kategorie-ID',['categoryId'],{max:128})}
    {field('Kategorie',['categoryName'],{max:55})}
    <label className="u16-field" htmlFor="u16-qt-row"><span>Feldwert</span>
     <select id="u16-qt-row" value={Number(value.row)}
      onChange={e=>{
       const row=Number(e.target.value);
       onChange(editQuestionField(game,editQuestionField(game,value,['row'],row),['value'],row*100));
      }}>
      {[1,2,3,4,5,6].map(row=><option key={row} value={row}>{row*100} Punkte</option>)}
     </select></label>
    {field('Fragestellung',['prompt'],{long:true})}
    {field('Lösung',['answer'])}
    {field('Quelle',['reference'])}
   </>}
   {game==='verbindungen'&&<>
    <label className="u16-field" htmlFor="u16-vb-kind"><span>Aufgabentyp</span>
     <select id="u16-vb-kind" value={kind} onChange={e=>onChange(
      switchQuestionFormat('verbindungen',value,e.target.value as 'clues'|'sequence'|'wall'))}>
      <option value="clues">Vier Hinweise</option><option value="sequence">Folge ergänzen</option>
      <option value="wall">Verbindungswand</option></select></label>
    {kind==='clues'&&<>
     {field('Lösung',['target'])}
     {lists('Hinweis',['clues'],{allowed:false,max:4})}
    </>}
    {kind==='sequence'&&<>
     {field('Fragestellung',['prompt'],{long:true})}
     {lists('Folgenelement',['items'],{allowed:false,max:3})}
     {field('Lösung',['answer'])}
     {field('Erklärung',['explanation'],{long:true})}
    </>}
    {kind==='wall'&&<>
     <fieldset className="u16-list"><legend>16 Wandfelder</legend>
      <div className="u16-four-grid">{rows(value.tiles).map((_,i)=>field('Feld '+(i+1),['tiles',i,'label'],{max:3000}))}</div>
     </fieldset>
     <fieldset className="u16-list"><legend>Vier Verbindungen</legend>
      {rows(value.groups).map((group,i)=><section className="u16-wall-group" key={i}>
       <h4>Gruppe {i+1}</h4>
       {field('Verbindung',['groups',i,'link'],{long:true})}
       <div className="u16-four-grid">{rows(obj(group)?group.tileIds:[]).map((tileId,j)=>
        <label className="u16-field" key={i+'-'+j}><span>Feld {j+1}</span>
         <select value={str(tileId)} onChange={e=>set(['groups',i,'tileIds',j],e.target.value)}>
          {rows(value.tiles).map((t,k)=><option key={k} value={str(obj(t)?t.id:'')}>
           {str(obj(t)?t.label:'')||'Feld '+(k+1)}</option>)}
         </select></label>)}</div>
       {lists('Akzeptierte Verbindung',['groups',i,'acceptedLinks'])}
      </section>)}
     </fieldset>
    </>}
    {field('Quelle',['reference'])}
   </>}
   {game==='logikleiter'&&<>
    {field('Stufe (1–7)',['difficulty'],{number:true})}
    {select('Denkaufgabentyp',['kind'],[['deduction','Schlussfolgern'],['numeric','Zahlen'],
     ['ordering','Reihenfolge'],['constraint','Bedingungen']])}
    {field('Fragestellung',['prompt'],{long:true})}
    {field('Hinweis',['hint'],{long:true})}
    {field('Lösung',['answer'])}
    {field('Erklärung',['explanation'],{long:true})}
    {field('Quelle',['reference'])}
   </>}
   {game==='umfrageduell'&&<>
    {select('Umfrageformat',['format'],[['popular','Beliebteste Antwort'],['top3','Top 3']])}
    {field('Fragestellung',['prompt'],{long:true})}
    <fieldset className="u16-list"><legend>Antwortkategorien in Rangfolge</legend>
     {rows(value.categories).map((_,i)=><div className="u16-category" key={i}>
      <h4>Platz {i+1}</h4>
      {field('Kategorie '+(i+1),['categories',i,'label'],{max:100})}
      {lists('Synonym',['categories',i,'synonyms'],{max:15})}
     </div>)}
    </fieldset>
    <div className="u16-source"><strong>Datenherkunft: {obj(value.source)&&value.source.kind==='observed'?'Beobachtete Umfrage':'Illustrative Beispieldaten'}</strong>
     {obj(value.source)&&value.source.kind==='observed'&&<>
      {field('Quelle',['source','source'])}
      {field('Grundgesamtheit',['source','population'])}
      {field('Erhebungsmethode',['source','method'])}
      {field('Erhebungsdatum (YYYY-MM-DD)',['source','collectedOn'],{max:10})}
      {field('Einschränkungen',['source','limitations'],{long:true})}
     </>}</div>
   </>}
  </div>
  {issues.length>0&&<div className="u16-errors" role="alert">
   <strong>Noch nicht speicherbar</strong><ul>{issues.slice(0,6).map((issue,i)=><li key={i}>{issue}</li>)}</ul>
  </div>}
  <section className="u16-preview" aria-label="Vorschau nur freigegebener Fragefelder">
   <strong>Publikumsvorschau · lokal, nicht veröffentlicht</strong>
   <h4>{preview.heading}</h4>
   {preview.lines.length>0&&<ul>{preview.lines.map((line,i)=><li key={i}>{line||'—'}</li>)}</ul>}
  </section>
 </section>;
}

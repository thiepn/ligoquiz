import {useEffect,useMemo,useState} from 'react';
import {ContentRepository} from '../../content/repository';
import {DEPTH} from '../../games/quiztafel/engine';
import type {SetupDraft} from './model';
import {
 reviewedQuiztafelChoices,selectedQuiztafelBoardStatus,type QuiztafelInventory,
} from './quiztafel-board-composer';
import './u22-quiztafel-board.css';

const EMPTY:QuiztafelInventory={tiles:[],excluded:0};
export function QuiztafelBoardComposer({draft,onChange,onValidity}:{
 draft:Pick<SetupDraft,'profile'|'count'|'qtTileIds'>;
 onChange:(ids:string[]|undefined)=>void;
 onValidity:(valid:boolean)=>void;
}){
 const [inventory,setInventory]=useState<QuiztafelInventory>(EMPTY);
 const [revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  setInventory(EMPTY);setLoading(true);setError('');
  const repo=new ContentRepository();
  void (async()=>{
   try{
    const entries=await repo.list(),next=await reviewedQuiztafelChoices(entries);
    if(active)setInventory(next);
   }catch(e){if(active)setError(e instanceof Error?e.message:'Inhaltsbibliothek nicht lesbar');}
   finally{await repo.close();if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[revision]);
 const manual=draft.qtTileIds!==undefined;
 const ids=draft.qtTileIds??[];
 const status=useMemo(()=>selectedQuiztafelBoardStatus(draft.profile,draft.count,inventory.tiles,ids),
  [draft.profile,draft.count,inventory.tiles,ids]);
 const valid=manual&&!loading&&!error&&status.exact;
 useEffect(()=>onValidity(!manual||valid),[manual,valid,onValidity]);
 const categories=useMemo(()=>{
  const grouped=new Map<string,{name:string;id:string}>();
  for(const tile of inventory.tiles)
   if(!grouped.has(tile.categoryId))grouped.set(tile.categoryId,{id:tile.categoryId,name:tile.categoryName});
  return [...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,'de-DE'));
 },[inventory.tiles]);
 const selectedCategories=new Set(inventory.tiles.filter(t=>ids.includes(t.id)).map(t=>t.categoryId));
 function choose(categoryId:string,row:number,id:string){
  const without=ids.filter(selectedId=>!inventory.tiles.some(
   tile=>tile.id===selectedId&&tile.categoryId===categoryId&&tile.row===row));
  onChange(id?[...without,id]:without);
 }
 return <section className="u22-board" aria-label="Quiztafel Spielfeld zusammenstellen">
  <div className="u22-board-header"><h3>Quiztafel-Spielfeld</h3>
   <button type="button" onClick={()=>setRevision(x=>x+1)} disabled={loading}>Fragen neu laden</button>
  </div>
  <div className="u22-board-modes">
   <button type="button" aria-pressed={!manual} onClick={()=>onChange(undefined)}>Automatische Originaltafel</button>
   <button type="button" aria-pressed={manual} onClick={()=>onChange([])}>Spielfeld selbst zusammenstellen</button>
  </div>
  {loading&&<p role="status">Freigegebene Kategorien werden geprüft.</p>}
  {error&&<p role="alert" className="u22-board-error">{error}</p>}
  {manual&&!loading&&!error&&<>
   <div className="u22-board-status" role="status" data-board-valid={valid}>
    <strong>{valid?'Spielfeld vollständig':'Spielfeld unvollständig'}</strong>
    <span>{status.categories} / {status.categoryLimit} Kategorien · {status.selected} / {status.needed} Felder</span>
   </div>
   {inventory.excluded>0&&<p className="u22-board-error">
    {inventory.excluded} nicht freigegebene oder veränderte Fragen ausgeschlossen.</p>}
   <div className="u22-board-categories">
    {categories.map(category=>{
     const active=selectedCategories.has(category.id);
     const unavailable=!active&&selectedCategories.size>=draft.count;
     return <fieldset className="u22-board-category" key={category.id}>
      <legend>{category.name}</legend>
      {Array.from({length:DEPTH[draft.profile]},(_,i)=>{
       const row=i+1,options=inventory.tiles.filter(t=>t.categoryId===category.id&&t.row===row);
       const selected=options.find(t=>ids.includes(t.id))?.id??'';
       return <label key={row} className="u22-board-cell">
        <span>{row*100} Punkte</span>
        <select aria-label={category.name+' '+row*100+' Punkte'}
         value={selected} disabled={unavailable}
         onChange={e=>choose(category.id,row,e.target.value)}>
         <option value="">Kein Feld ausgewählt</option>
         {options.map(tile=><option key={tile.id} value={tile.id}>{tile.prompt}</option>)}
        </select>
       </label>;
      })}
     </fieldset>;
    })}
   </div>
   {!categories.length&&<p>Keine freigegebenen Quiztafel-Fragen vorhanden.</p>}
  </>}
 </section>;
}

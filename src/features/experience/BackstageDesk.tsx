import type {EventRecord} from '../../domain/event/schemas';
import {GAME_VISUALS} from '../../design-system/theme';
import {backupHref,describeBackstageDirectory} from './backstage-model';
import './u10-backstage.css';
const date=(timestamp:number)=>new Date(timestamp).toLocaleString('de-DE');
function labelFor(event:EventRecord){
 const key=event.program[0]?.type;
 return key?GAME_VISUALS[key].label:'Gespeicherter Abend';
}
/** One read-only backstage surface for real sessions, not an alternate host. */
export function BackstageDesk({items,invalid}:{items:readonly EventRecord[];invalid:number}){
 const data=describeBackstageDirectory(items,invalid);
 return <section className="sp-backstage-desk" aria-labelledby="sp-backstage-title">
  <header className="sp-backstage-desk-head">
   <div><span className="sp-backstage-overline">BACKSTAGE · LOKALES REGIEPULT</span>
    <h2 id="sp-backstage-title">Alles für deinen Quizabend<span aria-hidden="true">.</span></h2>
    <p>Weiterspielen, Projektor testen, vollständige Sitzung sichern und Ergebnisse nach der Show prüfen.
     Die Übersicht liest nur gespeicherte Spielstände dieses Browsers.</p></div>
   <span className="sp-backstage-desk-mark" aria-hidden="true">↗</span>
  </header>
  <div className="sp-backstage-counters" aria-label="Lokaler Spielstandüberblick">
   <div><strong>{data.open}</strong><span>Offene Abende</span></div>
   <div><strong>{data.finished}</strong><span>Abgeschlossen</span></div>
   <div className={data.review||data.invalid?'is-warning':''}>
    <strong>{data.review+data.invalid}</strong><span>Prüffälle <small>Wiederherstellung / beschädigte Einträge</small></span>
   </div>
  </div>
  {(data.review>0||data.invalid>0)&&<p role="alert" className="sp-backstage-warning">
   {data.review>0?data.review+' Sitzung(en) benötigen eine ausdrückliche Wiederherstellungsprüfung. ':''}
   {data.invalid>0?data.invalid+' beschädigte Einträge werden nicht verändert. ':''}
   Beamer bleibt bis zur Prüfung unter Kontrolle des Original-Hosts. Eine Sicherung niemals blind überschreiben.
  </p>}
  <div className="sp-backstage-workflows">
   <a href="#/spielen" className="sp-backstage-workflow">
    <span>01 / WEITERSPIELEN</span><strong>Spielstände</strong>
    <small>{data.latestOpen?labelFor(data.latestOpen)+' · '+data.latestOpen.teams.length+' Teams':'Einen Abend vorbereiten oder gespeicherte Sitzung auswählen'}</small>
    <b aria-hidden="true">↗</b>
   </a>
   <a href="#/technik" className="sp-backstage-workflow">
    <span>02 / VOR DEM START</span><strong>Beamer & Offline</strong>
    <small>Erweiterten Bildschirm, Empfang und installierte Offline-Dateien prüfen</small>
    <b aria-hidden="true">↗</b>
   </a>
   <a href={data.latestOpen?backupHref(data.latestOpen.id):'#/einstellungen'} className="sp-backstage-workflow">
    <span>03 / DATENSICHERHEIT</span><strong>Sitzung sichern</strong>
    <small>Originales vollständiges Backup, mit Prüfsumme und ohne Überschreiben</small>
    <b aria-hidden="true">↗</b>
   </a>
   <a href="#/verlauf" className="sp-backstage-workflow">
    <span>04 / NACH DER SHOW</span><strong>Ergebnisse & Protokoll</strong>
    <small>Gespeicherter Endstand, redaktionelle Herkunft und nachvollziehbarer Verlauf</small>
    <b aria-hidden="true">↗</b>
   </a>
  </div>
  <div className="sp-backstage-recent">
   <div className="sp-backstage-recent-head"><div>
    <span className="sp-backstage-overline">LETZTE ABSCHLÜSSE</span><h3>Vergangene Abende</h3>
   </div><a href="#/verlauf">Alle Berichte ansehen <span aria-hidden="true">→</span></a></div>
   {data.latestFinished.length===0?
    <p className="sp-backstage-no-history">Noch kein abgeschlossener Abend in diesem Browser. Ergebnisse erscheinen hier nach dem Abschluss eines Spiels.</p>:
    <div className="sp-backstage-recent-list">{data.latestFinished.map(event=>
     <article key={event.id} className="sp-backstage-recent-item">
      <div><span>{labelFor(event)} · {date(event.updatedAt)}</span>
       <strong>{event.teams.map(t=>t.name).join(' · ')}</strong>
       <small>{event.teams.length} Teams · lokal gespeicherter Endstand</small></div>
      <nav aria-label={'Aktionen für '+labelFor(event)}>
       <a href={'#/bericht?event='+encodeURIComponent(event.id)}>Bericht</a>
       <a href={backupHref(event.id)}>Backup</a>
      </nav>
     </article>)}</div>}
  </div>
  <p className="sp-backstage-privacy">Kein Cloud-Sync. Gespeicherte Lösungen, Rohantworten und interne Hostkennungen werden hier nicht angezeigt.
   Links öffnen ausschließlich vorhandene Prüf- und Sicherungsabläufe.</p>
 </section>;
}

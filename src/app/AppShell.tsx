import type {ReactNode} from 'react';
import type {Route} from './routes';
import {routeHref} from './routes';
import {StudioPopLogo} from '../design-system/StudioPop';
import {
  BACKSTAGE_LINKS, PRIMARY_LINKS,
  backstageActiveRoute, shellHeadingFor, shellShortcutsFor, shellZoneFor,
  type ShellLink,
} from './shell-model';
import './app-shell.css';

function NavLink({link,current,route,compact=false}:{link:ShellLink;current:boolean;route:Route;compact?:boolean}){
 return <a className={'sp-shell-nav-link'+(current?' is-active':'')} href={routeHref(link.route)}
   aria-current={route===link.route?'page':undefined}>
   <span className="sp-shell-nav-symbol" aria-hidden="true">{link.symbol}</span>
   <span className="sp-shell-nav-copy"><strong>{link.label}</strong>{!compact&&<small>{link.description}</small>}</span>
 </a>;
}

export function AppShell({route,children}:{route:Route;children:ReactNode}){
 const zone=shellZoneFor(route);
 const heading=shellHeadingFor(route);
 const shortcuts=shellShortcutsFor(route);
 const activePrimary=zone==='spielwelt'?'spielen':zone==='spielleitung'?'host':'inhalte';
 const activeBackstage=backstageActiveRoute(route);
 // The public projector deliberately has no app chrome. StageView handles it separately.
 if(zone==='public')return <>{children}</>;

 return <div className={'sp-shell sp-shell--'+zone} data-lq-theme="studio-pop">
   <button type="button" onClick={()=>document.getElementById("main-content")?.focus()} className="sp-shell-skip">Zum Inhalt springen</button>
   <header className="sp-shell-header">
     <div className="sp-shell-header-inner">
       <a className="sp-shell-brand" href={routeHref('spielen')} aria-label="LiGoQuiz – Spielwelt öffnen">
         <StudioPopLogo/>
       </a>
       <nav className="sp-shell-mainnav" aria-label="Hauptnavigation">
         {PRIMARY_LINKS.map(link=><NavLink key={link.route} route={route} link={link} compact
            current={link.route===activePrimary}/>)}
       </nav>
       <a className="sp-shell-start" href={routeHref('setup')}>Neuen Abend <span aria-hidden="true">↗</span></a>
       <details key={route} className="sp-shell-mobile-menu">
         <summary aria-label="Menü"><span aria-hidden="true">☰</span> MENÜ</summary>
         <nav aria-label="Mobiles Hauptmenü">
           {PRIMARY_LINKS.map(link=><NavLink key={link.route} route={route} link={link} current={link.route===activePrimary}/>)}
           <span className="sp-shell-mobile-label">BACKSTAGE</span>
           {BACKSTAGE_LINKS.map(link=><NavLink key={link.route} route={route} link={link} current={link.route===activeBackstage}/>)}
           <NavLink route={route} link={{route:'setup',label:'Neuen Quizabend',description:'Teams & Programm',symbol:'↗'}} current={route==='setup'}/>
         </nav>
       </details>
     </div>
   </header>

   <section className="sp-shell-region" aria-label="Aktueller Bereich">
     <div className="sp-shell-region-content">
       <span className="sp-shell-overline">{heading.overline}</span>
       <p className="sp-shell-region-title">{heading.headline}<span aria-hidden="true">.</span></p>
       <p className="sp-shell-region-description">{heading.description}</p>
     </div>
     <nav className="sp-shell-shortcuts" aria-label="Schnellzugriffe">
       {shortcuts.map(link=><a key={link.route} href={routeHref(link.route)}><span aria-hidden="true">{link.symbol}</span>{link.label}</a>)}
     </nav>
     <span className="sp-shell-region-pattern" aria-hidden="true">✳</span>
   </section>

   {zone==='backstage'&&<nav className="sp-shell-subnav" aria-label="Backstage-Bereiche">
     {BACKSTAGE_LINKS.map(link=><NavLink key={link.route} route={route} link={link} current={link.route===activeBackstage} compact/>)}
   </nav>}

   <main id="main-content" tabIndex={-1} className="workspace sp-shell-workspace">
     <div className="sp-shell-legacy">{children}</div>
   </main>
   <footer className="sp-shell-footer">
     <span>LiGoQuiz · GAME SHOW EDITION</span>
     <span>Spielstände und private Lösungen bleiben lokal und unter Kontrolle der Spielleitung.</span>
   </footer>
 </div>;
}

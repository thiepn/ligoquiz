import type {ReactNode} from 'react';
import type {Route} from './routes';
import {routeHref} from './routes';
import {StudioPopLogo} from '../design-system/StudioPop';
import {
  BACKSTAGE_LINKS, PRIMARY_LINKS,
  backstageActiveRoute, shellZoneFor,
  type ShellLink,
} from './shell-model';
import './app-shell.css';
import './ui-copy-cleanup.css';

function NavLink({link,current,route}:{link:ShellLink;current:boolean;route:Route}){
 return <a className={'sp-shell-nav-link'+(current?' is-active':'')} href={routeHref(link.route)}
   aria-current={route===link.route?'page':undefined}>
   <span className="sp-shell-nav-symbol" aria-hidden="true">{link.symbol}</span>
   <span className="sp-shell-nav-copy"><strong>{link.label}</strong></span>
 </a>;
}

export function AppShell({route,children}:{route:Route;children:ReactNode}){
 const zone=shellZoneFor(route);
const activePrimary=zone==='spielwelt'?'spielen':zone==='spielleitung'?'host':'inhalte';
 const activeBackstage=backstageActiveRoute(route);
 const isPreparing=route==='setup';
 const inGame=route==='host';
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
         {PRIMARY_LINKS.map(link=><NavLink key={link.route} route={route} link={link}
            current={link.route===activePrimary}/>)}
       </nav>
       {!isPreparing&&!inGame&&<a className="sp-shell-start" href={routeHref('setup')}>Neuen Abend <span aria-hidden="true">↗</span></a>}
       {!isPreparing&&!inGame&&<details key={route} className="sp-shell-mobile-menu">
         <summary aria-label="Menü"><span aria-hidden="true">☰</span> MENÜ</summary>
         <nav aria-label="Mobiles Hauptmenü">
           {PRIMARY_LINKS.map(link=><NavLink key={link.route} route={route} link={link} current={link.route===activePrimary}/>)}
           <span className="sp-shell-mobile-label">BACKSTAGE</span>
           {BACKSTAGE_LINKS.map(link=><NavLink key={link.route} route={route} link={link} current={link.route===activeBackstage}/>)}
           {!isPreparing&&!inGame&&<NavLink route={route} link={{route:'setup',label:'Neuen Quizabend',symbol:'↗'}} current={false}/>}
         </nav>
       </details>}
     </div>
   </header>

   {isPreparing&&<nav className="sp-shell-context" aria-label="Vorbereitung"><a href="#/spielen">← Spiele</a><strong>Quizabend vorbereiten</strong></nav>}
   {inGame&&<nav className="sp-shell-context" aria-label="Aktuelle Spielleitung"><a href="#/spielen">← Spiele</a><strong>Spiel leiten</strong></nav>}

   {zone==='backstage'&&<nav className="sp-shell-subnav" aria-label="Backstage-Bereiche">
     {BACKSTAGE_LINKS.map(link=><NavLink key={link.route} route={route} link={link} current={link.route===activeBackstage}/>)}
   </nav>}

   {!isPreparing&&!inGame&&<nav className="sp-shell-mobile-bottom" aria-label="Mobile Schnellnavigation">
     {PRIMARY_LINKS.map(link=><a key={link.route} href={routeHref(link.route)}
       aria-current={link.route===activePrimary?'page':undefined}
       className={link.route===activePrimary?'is-active':''}>
       <span aria-hidden="true">{link.symbol}</span>
       <strong>{link.route==='spielen'?'Spielen':link.route==='host'?'Leiten':'Inhalte'}</strong>
     </a>)}
   </nav>}

   <main id="main-content" tabIndex={-1} className="workspace sp-shell-workspace">
     <div className="sp-shell-legacy">{children}</div>
   </main>
 </div>;
}

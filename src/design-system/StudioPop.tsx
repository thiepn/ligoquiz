import type {ButtonHTMLAttributes, HTMLAttributes, ReactNode} from 'react';
import type {GameType} from '../domain/game/contracts';
import {GAME_VISUALS, type TeamTone} from './theme';
import './studio-pop.css';

const join = (...values:(string | undefined | false)[]) => values.filter(Boolean).join(' ');

export function StudioPopLogo({compact = false}:{compact?:boolean}) {
  return <div className={join('sp-logo', compact && 'sp-logo--compact')} aria-label="LiGoQuiz">
    <svg className="sp-logo-mark" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <path d="M5 14 38 5l29 16-4 37-35 9L5 48Z" fill="#FFE45C"/>
      <path d="m24 15-8 33 26 5 3-11-13-2 5-21Z" fill="#101629"/>
      <path d="m46 13 12 7-8 12-12-8Z" fill="#285BFF"/>
      <path d="m48 47 8-6 8 9-11 8Z" fill="#DA2C70"/>
    </svg>
    {!compact && <span className="sp-logo-word">LiGo<span>Quiz!</span></span>}
  </div>;
}

export function StudioPopMotif({game}:{game:GameType}) {
  return <svg className="sp-motif" viewBox="0 0 196 158" aria-hidden="true" focusable="false">
    {game==='rundenquiz' && <>
      <circle cx="114" cy="72" r="57" fill="none" stroke="currentColor" strokeWidth="13"/>
      <path d="M94 54q4-25 27-25c35 0 37 35 6 49-14 6-13 15-13 21" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
      <circle cx="115" cy="122" r="8" fill="currentColor"/>
    </>}
    {game==='quiztafel' && Array.from({length:12},(_,i)=>{
      const row=Math.floor(i/4), col=i%4;
      return <rect key={i} x={26+col*35} y={24+row*35} width="29" height="29" rx="3"
        fill={i===5||i===6?'#FFE45C':'none'} stroke="currentColor" strokeWidth="5"/>;
    })}
    {game==='verbindungen' && <>
      <path d="M45 45 100 23 155 52 121 126 42 116Z M45 45 121 126 M155 52 42 116 M100 23 121 126" stroke="currentColor" strokeWidth="6" fill="none"/>
      {[[45,45],[100,23],[155,52],[121,126],[42,116]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="12" fill={i===2?'#FFE45C':'currentColor'}/>)}
    </>}
    {game==='logikleiter' && <>
      {[0,1,2,3,4].map(i=><rect key={i} x={34+i*22} y={115-i*22} width="28" height={20+i*22} rx="4" fill={i===4?'#FFE45C':'none'} stroke="currentColor" strokeWidth="5"/>)}
      <path d="m130 28 21-18 19 20" stroke="currentColor" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </>}
    {game==='umfrageduell' && <>
      {[0,1,2].map(i=><g key={i}><rect x="32" y={19+i*43} width={136-i*14} height="34" rx="6" stroke="currentColor" strokeWidth="5" fill="none"/><circle cx="52" cy={36+i*43} r="8" fill={i===0?'#FFE45C':'currentColor'}/></g>)}
      <path d="m170 22 7 10 13 2-9 9 1 12-12-6-12 6 2-13-9-8 13-2Z" fill="#FFE45C"/>
    </>}
  </svg>;
}

export type PopButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'normal' | 'large';
  busy?: boolean;
  leading?: ReactNode;
};
export function PopButton({tone='primary',size='normal',busy=false,leading,children,className,disabled,type='button',...rest}:PopButtonProps){
  return <button type={type} className={join('sp-button','sp-button--'+tone,size==='large'&&'sp-button--large',className)}
    disabled={disabled||busy} aria-busy={busy||undefined} {...rest}>{leading}<span>{children}</span><span className="sp-button-arrow" aria-hidden="true">↗</span></button>;
}

export function PopTag({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'live'|'warning'|'positive'}){
  return <span className={join('sp-tag','sp-tag--'+tone)}>{children}</span>;
}

export function PopPanel({children,title,eyebrow,className,...rest}:HTMLAttributes<HTMLElement>&{
  title?:string;eyebrow?:string;
}){
  return <section className={join('sp-panel',className)} {...rest}>
    {(eyebrow||title)&&<header className="sp-panel-heading">{eyebrow&&<span className="sp-eyebrow">{eyebrow}</span>}{title&&<h2>{title}</h2>}</header>}
    {children}
  </section>;
}

export function GameTile({game,href,description,onSelect}:{game:GameType;number?:string;href?:string;description?:string;onSelect?:()=>void}){
  const visual=GAME_VISUALS[game];
  const content=<>
    <span className="sp-game-top" aria-hidden="true">{visual.symbol}</span>
    <StudioPopMotif game={game}/>
    <span className="sp-game-bottom"><strong>{visual.label}</strong><span>{description ?? visual.description}</span></span>
  </>;
  const cn=join('sp-game-tile','sp-tone--'+visual.tone);
  return onSelect?<button type="button" className={cn} onClick={onSelect} aria-label={visual.label+' auswählen und Vorbereitung öffnen'}>{content}</button>:
    href?<a className={cn} href={href}>{content}</a>:<article className={cn}>{content}</article>;
}

export function TeamBadge({name,tone='blue',short}:{name:string;tone?:TeamTone;short?:string}){
  return <span className={join('sp-team-badge','sp-tone--'+tone)}>
    <span className="sp-team-avatar" aria-hidden="true">{short??name.slice(0,2).toUpperCase()}</span><strong>{name}</strong>
  </span>;
}

export function ScoreChip({name,points,tone='blue',leading=false,change}:{name:string;points:number;tone?:TeamTone;leading?:boolean;change?:number}){
  return <div className={join('sp-score-chip','sp-tone--'+tone,leading&&'sp-score-chip--leading')}
    aria-label={name+': '+points+' Punkte'}>
    <div className="sp-score-label"><span className="sp-score-pip" aria-hidden="true"/><strong>{name}</strong>{leading&&<span className="sp-leader">VORN</span>}</div>
    <div className="sp-score-value"><strong>{points.toLocaleString('de-DE')}</strong>{change!==undefined&&<span className="sp-score-change">{change>0?'+':''}{change}</span>}</div>
  </div>;
}

export function PopTimer({seconds,paused=false,warningAt=10}:{seconds:number;paused?:boolean;warningAt?:number}){
  const safe=Math.max(0,Math.floor(seconds)),mins=Math.floor(safe/60),secs=String(safe%60).padStart(2,'0');
  return <div className={join('sp-timer',paused&&'sp-timer--paused',safe<=warningAt&&'sp-timer--warning')}
    role="timer" aria-label={(paused?'Pausiert: ':'')+safe+' Sekunden verbleiben'}>
    <span className="sp-timer-caption">{paused?'PAUSIERT':'ZEIT'}</span>
    <strong>{mins}:{secs}</strong>
  </div>;
}

export function PopProgress({current,total,label}:{current:number;total:number;label:string}){
  const max=Math.max(1,total),step=Math.min(max,Math.max(0,current));
  return <div className="sp-progress" aria-label={label+' '+step+' von '+total}>
    <div className="sp-progress-meta"><strong>{label}</strong><span>{step} / {total}</span></div>
    <div className="sp-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={step} aria-label={label}>
      <span style={{width:(step/max*100)+'%'}}/>
    </div>
  </div>;
}

export function PopShowFrame({children,kind='stage'}:{children:ReactNode;kind?:'stage'|'host'}){
  return <div className={join('sp-show-frame','sp-show-frame--'+kind)}><span className="sp-frame-grid" aria-hidden="true"/>{children}</div>;
}

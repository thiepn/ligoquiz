import type {PublicStageDto,PublicStageScene} from '../../domain/projection/public-stage';
import type {ViewerState} from './stage-viewer';
import {stageEventIdFromHash,stageUrl} from './protocol';

export type AudienceRound={
  kind:'waiting'|'question'|'reveal'|'board'|'scores';
  key:string|null;
  title:string;
  prompt:string;
  details:readonly string[];
  published:readonly string[];
  scores:readonly {name:string;value:number}[];
};
export type LocalGuess={
  eventId:string;gameId:string|null;hostEpoch:number;key:string;
  text:string;locked:boolean;
};

export function playalongUrl(eventId:string):string{
  return stageUrl(eventId).replace('#/stage?','#/mitspielen?');
}
export function playalongEventIdFromHash(hash:string):string|null{
  const match=/^#\/mitspielen\?(.+)$/.exec(hash);
  return match?stageEventIdFromHash('#/stage?'+match[1]):null;
}

export function audienceRound(scene:PublicStageScene|null,priorKey:string|null=null):AudienceRound{
  const waiting=(title:string):AudienceRound=>({kind:'waiting',key:null,title,prompt:'',details:[],published:[],scores:[]});
  const base=(kind:'question'|'reveal'|'board',key:string|null,title:string,prompt:string,
    details:readonly string[]=[],published:readonly string[]=[]):AudienceRound=>
    ({kind,key,title,prompt,details,published,scores:[]});
  if(!scene)return waiting('Verbindung unterbrochen');
  switch(scene.kind){
    case 'waiting':return waiting('Warte auf die Spielleitung');
    case 'paused':return waiting('Spiel pausiert');
    case 'scores':return {kind:'scores',key:null,title:scene.heading,prompt:'',details:[],
      published:[],scores:scene.visibleScores};
    case 'question':{
      const clue=scene.heading.startsWith('Vier Hinweise ·');
      const key=clue?'vb-clue:'+scene.heading+':'+(scene.visibleClues[0]??''):
        'question:'+scene.publicPrompt;
      return base('question',key,scene.heading,scene.publicPrompt,scene.visibleClues);
    }
    case 'answer':{
      const verbindungen=scene.heading.startsWith('Verbindungen ·');
      const inherited=verbindungen && ((scene.publicPrompt==='Vier Hinweise'&&priorKey?.startsWith('vb-clue:'))||
        (scene.publicPrompt==='Folge ergänzen'&&priorKey?.startsWith('vb-sequence:')));
      return base('reveal',inherited?priorKey:'question:'+scene.publicPrompt,
        scene.heading,scene.publicPrompt,[],[scene.publishedSolution]);
    }
    case 'qt-board':return base('board',null,'Quiztafel','Feldwahl: '+scene.selectorName,
      scene.categories.map(c=>c.name));
    case 'qt-question':case 'qt-answer':{
      const key='qt:'+scene.category+':'+scene.points+':'+scene.publicPrompt;
      return base(scene.kind==='qt-answer'?'reveal':'question',key,scene.heading,scene.publicPrompt,
        scene.kind==='qt-question'?[scene.steal?'Übernahme: '+scene.respondingName:
          'Antwortrecht: '+scene.respondingName]:[],
        scene.kind==='qt-answer'?[scene.publishedSolution]:[]);
    }
    case 'll-ladder':case 'll-answer':{
      const key='ll:'+scene.step+':'+scene.prompt;
      return base(scene.kind==='ll-answer'?'reveal':'question',key,
        'Logikleiter · '+scene.step+'/'+scene.total,scene.prompt,
        scene.kind==='ll-ladder'&&scene.hint?[scene.hint]:[],
        scene.kind==='ll-answer'?[scene.answer,scene.explanation]:[]);
    }
    case 'vb-sequence':return base('question','vb-sequence:'+scene.prompt+':'+scene.items.join('|'),
      'Verbindungen · Folge',scene.prompt,[...scene.items]);
    case 'vb-wall':{
      const key='vb-wall:'+scene.tiles.map(t=>t.id+':'+t.label).join('|');
      return base(scene.revealed.length===4?'reveal':'question',key,'Verbindungswand',
        'Was gehört zusammen?',scene.tiles.map(t=>t.label),
        scene.revealed.map(g=>g.link));
    }
    case 'ud-prompt':case 'ud-reveal':{
      const key='ud:'+scene.step+':'+scene.prompt;
      return base(scene.kind==='ud-reveal'?'reveal':'question',key,
        'Umfrageduell · '+scene.step+'/'+scene.total,scene.prompt,
        [scene.provenance,...(scene.sourceContext?[scene.sourceContext]:[])],
        scene.kind==='ud-reveal'?scene.categories:[]);
    }
  }
}

/** Any interrupted, changed-owner or different-task frame invalidates private tab memory. */
export function retainedGuess(guess:LocalGuess|null,view:ViewerState):LocalGuess|null{
  if(!guess || view.status!=='live' || !view.frame)return null;
  const frame=view.frame;
  if(frame.eventId!==guess.eventId || frame.gameId!==guess.gameId ||
    frame.hostEpoch!==guess.hostEpoch)return null;
  const round=audienceRound(frame.scene,guess.key);
  if(round.key!==guess.key || (round.kind==='reveal'&&!guess.locked))return null;
  return guess;
}

export function freshGuess(frame:PublicStageDto,round:AudienceRound,text:string):LocalGuess{
  if(round.kind!=='question'||!round.key)throw new Error('Tipp nur zu einer freigegebenen Frage');
  return {eventId:frame.eventId,gameId:frame.gameId,hostEpoch:frame.hostEpoch,
    key:round.key,text:text.slice(0,240),locked:false};
}

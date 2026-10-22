import {describe,expect,it} from 'vitest';
import {createDraft,validatePayload} from '../src/content/contracts';
import {editQuestionField,editAnswerVariants,editorialIssues,spectatorPromptPreview,switchQuestionFormat}
 from '../src/features/content/structured-question-model';

describe('U16 original authoring fields without a second content engine',()=>{
 const rq=createDraft('rundenquiz',{id:'u16-original-rq',round:'wissen',prompt:'Welches Element hat das Symbol Au?',
  answer:'Gold',reference:'NIST Gold',durationSeconds:30});
 it('retains exact original ID/source while editing basic Rundenquiz and extra multiple-choice options',()=>{
  const copy=JSON.stringify(rq);
  let v=editQuestionField('rundenquiz',rq.payload,['prompt'],'Was ist das Symbol für Gold?');
  for(const choice of ['Au','Ag','Fe']){void choice;v=editAnswerVariants('rundenquiz',v,['choices'],'add');}
  v=editQuestionField('rundenquiz',v,['choices',0],'Au');
  v=editQuestionField('rundenquiz',v,['choices',1],'Ag');
  v=editQuestionField('rundenquiz',v,['choices',2],'Fe');
  expect((v as {id:string}).id).toBe(rq.id);
  expect(editorialIssues('rundenquiz',v)).toEqual([]);
  expect(spectatorPromptPreview('rundenquiz',v).lines).toEqual([
   'Was ist das Symbol für Gold?','Au','Ag','Fe']);
  expect(JSON.stringify(rq)).toBe(copy);
 });
 it('switches original Rundenquiz rounds using EMPTY authored fields, not made-up solutions',()=>{
  let v=switchQuestionFormat('rundenquiz',rq.payload,'hinweise');
  expect(editorialIssues('rundenquiz',v).length).toBeGreaterThan(0);
  expect((v as {clues:string[]}).clues).toEqual(['','','','']);
  for(let i=0;i<4;i++)v=editQuestionField('rundenquiz',v,['clues',i],'Eigener Hinweis '+(i+1));
  expect(editorialIssues('rundenquiz',v)).toEqual([]);
  const estimate=switchQuestionFormat('rundenquiz',v,'schaetzen');
  expect(editorialIssues('rundenquiz',estimate).length).toBeGreaterThan(0);
  const number=editQuestionField('rundenquiz',estimate,['truth'],'1979');
  const unit=editQuestionField('rundenquiz',number,['unit'],'Jahre');
  expect(editorialIssues('rundenquiz',unit)).toEqual([]);
  expect((unit as {clues?:unknown}).clues).toBeUndefined();
 });
 it('edits Quiztafel category and exact row/value via original validator',()=>{
  const q={id:'u16-qt-1',categoryId:'history',categoryName:'Geschichte',row:1,value:100,
   prompt:'Frage',answer:'Antwort',reference:'Quelle'};
  const wrong=editQuestionField('quiztafel',q,['row'],2);
  expect(editorialIssues('quiztafel',wrong).length).toBeGreaterThan(0);
  const fixed=editQuestionField('quiztafel',wrong,['value'],200);
  expect(editorialIssues('quiztafel',fixed)).toEqual([]);
  expect(spectatorPromptPreview('quiztafel',fixed).lines).toEqual(['Frage']);
  expect((fixed as {id:string}).id).toBe(q.id);
 });
 it('makes editable Verbindungen 4-clue, 3-sequence and complete 16-tile wall with preserved IDs',()=>{
  const original={id:'u16-vb-1',kind:'clues',target:'Gold',clues:['Hinweis eins','Hinweis zwei','Hinweis drei','Hinweis vier'],reference:'NIST'};
  expect(editorialIssues('verbindungen',original)).toEqual([]);
  let seq=switchQuestionFormat('verbindungen',original,'sequence');
  expect(editorialIssues('verbindungen',seq).length).toBeGreaterThan(0);
  seq=editQuestionField('verbindungen',seq,['prompt'],'Welche Zahl folgt?');
  for(let i=0;i<3;i++)seq=editQuestionField('verbindungen',seq,['items',i],String(i+1));
  seq=editQuestionField('verbindungen',seq,['answer'],'4');
  seq=editQuestionField('verbindungen',seq,['explanation'],'Die Zahlenfolge steigt jeweils um eins');
  expect(editorialIssues('verbindungen',seq)).toEqual([]);
  let wall=switchQuestionFormat('verbindungen',seq,'wall');
  expect(editorialIssues('verbindungen',wall).length).toBeGreaterThan(0);
  for(let i=0;i<16;i++)wall=editQuestionField('verbindungen',wall,['tiles',i,'label'],'Eigener Begriff '+(i+1));
  for(let i=0;i<4;i++){
   wall=editQuestionField('verbindungen',wall,['groups',i,'link'],'Gemeinsame Eigenschaft '+(i+1));
   wall=editQuestionField('verbindungen',wall,['groups',i,'acceptedLinks',0],'Alternative '+(i+1));
  }
  expect(editorialIssues('verbindungen',wall)).toEqual([]);
  expect((wall as {id:string}).id).toBe(original.id);
  expect((wall as {tiles:{id:string}[]}).tiles).toHaveLength(16);
  const duplicate=editQuestionField('verbindungen',wall,['groups',1,'tileIds',0],
    (wall as {groups:{tileIds:string[]}[]}).groups[0]!.tileIds[0]!);
  expect(editorialIssues('verbindungen',duplicate).length).toBeGreaterThan(0);
  const added=editAnswerVariants('verbindungen',wall,['groups',0,'acceptedLinks'],'add');
  expect((added as {groups:{acceptedLinks:string[]}[]}).groups[0]?.acceptedLinks).toHaveLength(2);
 });
 it('keeps original Logikleiter answer/hint separation and authored explanation',()=>{
  const task={id:'u16-ll',difficulty:1,kind:'deduction',prompt:'Welche Aussage folgt?',
   hint:'Prüfe den Unterschied zwischen alle und einige',
   answer:'Keine Aussage folgt',explanation:'Keine Prämisse garantiert die Schlussfolgerung',reference:'Eigene Logikaufgabe'};
  const change=editQuestionField('logikleiter',task,['kind'],'constraint');
  expect(editorialIssues('logikleiter',change)).toEqual([]);
  expect(spectatorPromptPreview('logikleiter',change).lines).toEqual([task.prompt]);
  const unsafe=editQuestionField('logikleiter',change,['hint'],task.answer);
  expect(editorialIssues('logikleiter',unsafe).length).toBeGreaterThan(0);
 });
 it('preserves Umfrageduell illustrative data origin and edits five original ranks with synonyms',()=>{
  const original={id:'u16-ud-1',format:'popular',prompt:'Welche Situation kommt vor?',
   categories:['A','B','C','D','E'].map(label=>({label,synonyms:[]})),source:{kind:'illustrative'}};
  let edited=editAnswerVariants('umfrageduell',original,['categories',0,'synonyms'],'add');
  edited=editQuestionField('umfrageduell',edited,['categories',0,'synonyms',0],'Andere Bezeichnung');
  expect(editorialIssues('umfrageduell',edited)).toEqual([]);
  expect(spectatorPromptPreview('umfrageduell',edited).lines).toEqual([original.prompt]);
  expect(JSON.stringify(edited)).not.toContain('reviewed');
  const duplicate=editQuestionField('umfrageduell',edited,['categories',1,'label'],'A');
  expect(editorialIssues('umfrageduell',duplicate).length).toBeGreaterThan(0);
  expect(()=>editQuestionField('umfrageduell',edited,['source','kind'],'observed')).toThrow();
  expect(()=>editQuestionField('umfrageduell',edited,['source','reviewed'],1)).toThrow();
 });
 it('forbids changes to IDs, nested author identity, unrecognized paths and source approval bits',()=>{
  expect(()=>editQuestionField('rundenquiz',rq.payload,['id'],'replaced')).toThrow();
  expect(()=>editQuestionField('rundenquiz',rq.payload,['notThere'],'added')).toThrow();
  expect(()=>editQuestionField('rundenquiz',rq.payload,['choices',100],'fake')).toThrow();
  expect(()=>editAnswerVariants('umfrageduell',rq.payload,['choices'],'add')).toThrow();
  expect(()=>switchQuestionFormat('rundenquiz',rq.payload,'wall')).toThrow();
  const rq2=editQuestionField('rundenquiz',rq.payload,['answer'],'Au');
  expect((rq2 as {id:string}).id).toBe('u16-original-rq');
  expect(validatePayload('rundenquiz',rq2)).toEqual([]);
 });
});

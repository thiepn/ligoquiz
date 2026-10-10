import {describe,expect,it} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createPreparedRundenquiz,createPreparedQuiztafel,newSetupDraft} from '../src/features/experience/model';
import {filterSessions,reportCsv,csvFileName} from '../src/features/experience/session-tools';

describe('G13 organizer workflow',()=>{
 it('finds sessions by game, team and status without reading private answers',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g13-search-'+crypto.randomUUID());
  try{
   await createPreparedRundenquiz(repo,{...newSetupDraft(),count:3,teams:['Nordgruppe','Mitte','Süd','Team 4','Team 5']});
   await createPreparedQuiztafel(repo,{...newSetupDraft(),count:3,teams:['West','Ost','Mitte','Team 4','Team 5']});
   const sessions=(await repo.listSessions()).items;
   expect(sessions).toHaveLength(2);
   expect(filterSessions(sessions,'Nordgruppe')).toHaveLength(1);
   expect(filterSessions(sessions,'Quiztafel')).toHaveLength(1);
   expect(filterSessions(sessions,'VORBEREITUNG')).toHaveLength(2);
   expect(filterSessions(sessions,'  ')).toHaveLength(2);
   expect(filterSessions(sessions,'Josua')).toHaveLength(0);
   expect(filterSessions(sessions,'unbekannt')).toHaveLength(0);
  }finally{await repo.close();}
 });
 it('exports Excel-safe ranks, ties, half-points and provenance',()=>{
  const csv=reportCsv({
   gameLabel:'Rundenquiz',profile:'kurz',finishedAt:Date.UTC(2026,9,9),
   sourceLabel:'Nur Probeinhalte',
   teams:[
    {id:'1',name:'=HYPERLINK("https://test.example")',rawPoints:15,eveningHalfPoints:17},
    {id:'2',name:'Nord;"Team"',rawPoints:15,eveningHalfPoints:17},
    {id:'3',name:'\t+CMD',rawPoints:5,eveningHalfPoints:8},
    {id:'4',name:'Team 4',rawPoints:2,eveningHalfPoints:2},
   ],
  });
  expect(csv.startsWith('\uFEFFsep=;\r\n')).toBe(true);
  expect(csv).toContain('1;"\'=HYPERLINK(""https://test.example"")";15;8,5');
  expect(csv).toContain('1;"Nord;""Team""";15;8,5');
  expect(csv).toContain('3;"\'\t+CMD";5;4');
  expect(csv).toContain('"Inhaltsquelle";"Nur Probeinhalte"');
  expect(csvFileName('../../evil\\name')).toBe('ligoquiz-ergebnis-evilname.csv');
 });
 it('refuses non-finite point exports',()=>{
  expect(()=>reportCsv({gameLabel:'Quiztafel',profile:'kurz',finishedAt:0,sourceLabel:'Probe',
   teams:[{id:'1',name:'Alpha',rawPoints:Number.NaN,eveningHalfPoints:0}]})).toThrow(/Punktzahl/);
 });
});

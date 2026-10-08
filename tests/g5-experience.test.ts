import { describe, expect, it } from 'vitest';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { createPreparedRundenquiz, newSetupDraft, parsePreferences, parseSetupDraft,
  reportFor, safeFileName } from '../src/features/experience/model';
import { EventRepository } from '../src/infrastructure/db/event-repository';
import { currentEventId, parseRoute } from '../src/app/routes';

describe('G5 organizer preferences and routing', () => {
  it('sanitizes malformed settings and maintains viable defaults', () => {
    expect(parsePreferences(null)).toMatchObject({defaultTeams:4,defaultProfile:'kurz',motion:'system'});
    expect(parsePreferences({defaultTeams:99,defaultProfile:'broken',motion:'invalid'}))
      .toMatchObject({defaultTeams:4,defaultProfile:'kurz',motion:'system'});
    expect(parsePreferences({defaultTeams:5,defaultProfile:'lang',motion:'reduce'}))
      .toEqual({defaultTeams:5,defaultProfile:'lang',motion:'reduce'});
    expect(newSetupDraft({defaultTeams:3,defaultProfile:'standard',motion:'system'}))
      .toMatchObject({count:3,profile:'standard',step:0});
  });
  it('rejects incomplete drafts and keeps all five placeholders', () => {
    expect(parseSetupDraft({count:4,profile:'kurz',step:0,teams:['x']})).toBeNull();
    const draft=newSetupDraft();
    expect(parseSetupDraft({...draft,step:2})).toMatchObject({step:2,count:4});
  });
  it('recognizes organizer, private host and event report routes', () => {
    for(const key of ['spielen','setup','host','demo','verlauf','bericht','einstellungen','technik'])
      expect(parseRoute('#/'+key)).toBe(key);
    expect(currentEventId('#/bericht?event=event_12345')).toBe('event_12345');
    expect(currentEventId('#/bericht?event=%2e%2e%2fsecret')).toBeNull();
    expect(safeFileName('../../secret')).not.toContain('/');
  });
});

describe('G5 saved sessions, recovery and history', () => {
  it('indexes committed sessions without removing invalid rows', async () => {
    const name='g5-list-'+crypto.randomUUID();
    const repo=new EventRepository(fakeIndexedDB,name);
    try{
      const a=await createPreparedRundenquiz(repo,newSetupDraft());
      const b=await createPreparedRundenquiz(repo,{...newSetupDraft(),count:3});
      expect(a.eventId).not.toBe(b.eventId);
      const result=await repo.listSessions();
      expect(result.items).toHaveLength(2);
      expect(result.invalidCount).toBe(0);
      expect(result.items.every(e=>e.lifecycle==='draft'&&e.rundenquiz?.phase==='setup')).toBe(true);
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{
        const req=fakeIndexedDB.open(name);
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
      const tx=db.transaction('events','readwrite');
      tx.objectStore('events').put({id:'damaged-event',teams:[]});
      await new Promise<void>((resolve,reject)=>{
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
      });
      db.close();
      const indexed=await repo.listSessions();
      expect(indexed.items).toHaveLength(2);
      expect(indexed.invalidCount).toBe(1);
    }finally{await repo.close();}
  });
  it('fences stale host on explicit reprise and preserves frozen question pack', async()=>{
    const repo=new EventRepository(fakeIndexedDB,'g5-resume-'+crypto.randomUUID());
    try{
      const identity=await createPreparedRundenquiz(repo,newSetupDraft());
      const original=await repo.get(identity.eventId);
      expect(original?.frozenTasks).toHaveLength(7);
      if(!original)throw new Error('missing original');
      const takeover=await repo.takeover({
        eventId:identity.eventId,commandId:crypto.randomUUID(),newHostId:'recovered-host',
        expectedRevision:original.revision,expectedEpoch:original.hostEpoch,
        at:Date.now(),reason:'Manual control transfer',acknowledged:true,
      });
      expect(takeover.effect).toBe('committed');
      const recovered=await repo.get(identity.eventId);
      expect(recovered?.hostEpoch).toBe(2);
      expect(recovered?.hostId).toBe('recovered-host');
      expect(recovered?.frozenTasks).toEqual(original.frozenTasks);
      await expect(repo.dispatch({
        protocolVersion:1,eventId:identity.eventId,commandId:'old-host-attempt',
        expectedRevision:recovered!.revision,hostEpoch:1,hostId:identity.hostId,
        issuedAtEpochMs:Date.now(),actor:'host',payload:{type:'RQ_ACTION',action:{type:'START'}},
      })).rejects.toMatchObject({code:'STALE_HOST'});
    }finally{await repo.close();}
  });
  it('reports only completed events without exposing the frozen answer bank', async()=>{
    const repo=new EventRepository(fakeIndexedDB,'g5-report-'+crypto.randomUUID());
    try{
      const identity=await createPreparedRundenquiz(repo,newSetupDraft());
      const event=await repo.get(identity.eventId);
      if(!event||!event.rundenquiz)throw new Error('missing Rundenquiz');
      expect(reportFor(event)).toBeNull();
      const finish={
        ...event,lifecycle:'complete' as const,
        rundenquiz:{...event.rundenquiz,phase:'complete' as const,awards:[
          {teamId:'rq-team-1',questionId:event.rundenquiz.questions[0]!.id,points:10,judgement:'richtig' as const},
          {teamId:'rq-team-2',questionId:event.rundenquiz.questions[0]!.id,points:0,judgement:'falsch' as const},
        ]},
      };
      const report=reportFor(finish);
      expect(report?.teams[0]).toMatchObject({name:'Team 1',rawPoints:10,eveningHalfPoints:8});
      expect(report?.teams.filter(t=>t.rawPoints===0).map(t=>t.eveningHalfPoints)).toEqual([3,3,3]);
      expect(JSON.stringify(report)).not.toContain('Josua');
      expect(report?.awards).toHaveLength(2);
    }finally{await repo.close();}
  });
});

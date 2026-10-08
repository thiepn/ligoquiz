import { useEffect, useRef, useState } from 'react';
import { createEvent } from '../../domain/event/transition';
import type { EventRecord, SessionCommand } from '../../domain/event/schemas';
import { EventRepository } from '../../infrastructure/db/event-repository';
import { HostSessionController } from '../../application/host-controller/host-session';
import { BrowserStagePort, stageUrl } from '../stage/protocol';
import { HostStagePublisher, type PublisherStatus } from '../stage/host-publisher';

type Identity = { eventId: string; hostId: string };
const STORAGE_KEY = 'ligoquiz.v2.g3.technical-rehearsal';
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(value);

function loadIdentity(): Identity | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && typeof raw === 'object' && 'eventId' in raw && 'hostId' in raw &&
        validId(raw.eventId) && validId(raw.hostId)) return { eventId: raw.eventId, hostId: raw.hostId };
  } catch { /* private browsing and corrupted temporary identity are treated as no session */ }
  return null;
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Fehler';
}
function availableAction(event: EventRecord | null): { label: string; command: SessionCommand } | null {
  if (!event) return null;
  if (event.recoveryRequired || event.lifecycle === 'complete') return null;
  if (event.lifecycle === 'draft') return { label: 'Technikdemo starten', command: { type: 'EVENT_START' } };
  if (event.lifecycle === 'paused') return { label: 'Fortsetzen', command: { type: 'EVENT_RESUME' } };
  if (event.lifecycle !== 'active') return null;
  if (!event.currentTaskId) return { label: 'Beispielfrage zeigen', command: { type: 'TASK_PUBLISH', taskId: 'g3-task-1' } };
  if (!event.solutionPublished) {
    if (event.publishedClueCount === 0) return {
      label: 'Hinweis zeigen', command: { type: 'HINT_PUBLISH', taskId: event.currentTaskId, clueIndex: 0 },
    };
    return { label: 'Antwort zeigen', command: { type: 'SOLUTION_PUBLISH', taskId: event.currentTaskId } };
  }
  return { label: 'Frage abschließen', command: { type: 'NEXT_TASK' } };
}

export function ProjectorTechCheck() {
  const [identity, setIdentity] = useState<Identity | null>(loadIdentity);
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publisherStatus, setPublisherStatus] = useState<PublisherStatus | 'off'>('off');
  const [audienceCount, setAudienceCount] = useState(0);
  const controllerRef = useRef<HostSessionController | null>(null);

  useEffect(() => {
    if (!identity) return;
    const repo = new EventRepository();
    let disposed = false;
    let publisher: HostStagePublisher;
    try {
      publisher = new HostStagePublisher(identity.eventId, identity.hostId, repo,
        new BrowserStagePort(identity.eventId),
        (status) => { if (!disposed) setPublisherStatus(status); },
        (count) => { if (!disposed) setAudienceCount(count); });
      publisher.start();
    } catch (failure) {
      setError(errorText(failure));
      void repo.close();
      return;
    }
    const controller = new HostSessionController(repo, identity.eventId, identity.hostId,
      () => { void publisher.refresh(); });
    controllerRef.current = controller;
    void repo.get(identity.eventId).then((current) => {
      if (disposed) return;
      if (!current || current.hostId !== identity.hostId) {
        setError('Der Techniktest ist nicht mehr in diesem Fenster steuerbar.');
        setPublisherStatus('revoked');
        return;
      }
      setEvent(current);
    }).catch((failure: unknown) => { if (!disposed) setError(errorText(failure)); });
    const timer = window.setInterval(() => { void publisher.refresh(); }, 1600);
    return () => {
      disposed = true;
      controllerRef.current = null;
      window.clearInterval(timer);
      publisher.stop();
      void repo.close();
    };
  }, [identity]);

  async function begin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next: Identity = { eventId: crypto.randomUUID(), hostId: crypto.randomUUID() };
    const repo = new EventRepository();
    try {
      const eventSeed = createEvent({
        id: next.eventId, hostId: next.hostId, at: Date.now(),
        teams: [
          { id: 'g3-team-1', name: 'Team 1', order: 0, colorToken: 'blue' },
          { id: 'g3-team-2', name: 'Team 2', order: 1, colorToken: 'red' },
          { id: 'g3-team-3', name: 'Team 3', order: 2, colorToken: 'green' },
        ],
        program: [{ id: 'g3-demo-rq', type: 'rundenquiz', profile: 'kurz', order: 0, rulesVersion: 'g3-demo-only' }],
        frozenTasks: [{
          taskId: 'g3-task-1', gameType: 'rundenquiz', publicPrompt: 'Wer führte Israel nach Mose?',
          publicClues: ['Sein Name beginnt mit J.'], privateAnswers: ['Josua'],
          moderatorNotes: 'Diese Antwort darf nicht vor der Enthüllung am Beamer erscheinen.',
          sourceContentId: 'g3-demo-only', sourceHash: 'g3-v1',
        }],
      });
      await repo.create(eventSeed);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setEvent(eventSeed);
      setIdentity(next);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      await repo.close();
      setBusy(false);
    }
  }
  async function submit(command: SessionCommand) {
    const controller = controllerRef.current;
    if (!controller || !event || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await controller.submit(command, event, crypto.randomUUID());
      setEvent(next);
    } catch (failure) {
      setError(errorText(failure));
      try { setEvent(await controller.load()); } catch { /* allow user to see original error */ }
    } finally { setBusy(false); }
  }

  const next = availableAction(event);
  return <section className="g3-tech" aria-label="Beamer-Techniktest">
    <div className="g3-tech-heading">
      <div><div className="eyebrow">G3 · FUNKTIONSTEST</div>
        <h2>Beamer-Verbindung</h2>
        <p>Öffne die separate Publikumsansicht. Kontrolliere Frage, Hinweis, Antwort und Verbindungsabbruch.</p>
      </div><span className="g3-tech-tag">KEIN SPIELMODUS</span>
    </div>
    {!identity ? <button className="g3-tech-primary" disabled={busy} onClick={() => void begin()}>
      Techniktest anlegen
    </button> : <>
      <div className="g3-tech-grid">
        <div className="g3-tech-state">
          <span>HOST</span>
          <strong>{event ? 'Test bereit' : 'Lade Sitzung'}</strong>
          <small>{publisherStatus === 'ready' ? 'Sendet freigegebene Daten'
            : publisherStatus === 'revoked' ? 'Host-Berechtigung entzogen'
            : publisherStatus === 'invalid' ? 'Sitzungsdaten ungültig' : 'Verbindungsaufbau'}</small>
        </div>
        <div className="g3-tech-state">
          <span>BEAMER</span>
          <strong>{audienceCount > 0 ? audienceCount + ' Ansicht(en) verbunden' : 'Warte auf Empfang'}</strong>
          <small>Gleicher Browser-Ursprung · keine Fernverbindung</small>
        </div>
      </div>
      <a className="g3-tech-link" href={stageUrl(identity.eventId)} target="_blank" rel="noopener noreferrer">
        Beamer-Fenster öffnen ↗
      </a>
      {event && <>
        <p className="g3-tech-line">Zustand: {event.lifecycle} · Revision {event.revision} · Darstellung {event.stageRevision}</p>
        <div className="g3-tech-actions">
          <button className="g3-tech-primary" disabled={!next || busy || publisherStatus === 'revoked'}
            onClick={() => { if (next) void submit(next.command); }}>{next?.label ?? 'Kein Schritt verfügbar'}</button>
          <button disabled={event.lifecycle !== 'active' || busy} onClick={() => void submit({ type: 'EVENT_PAUSE' })}>
            Pausieren
          </button>
        </div>
      </>}
      <p className="g3-tech-footnote">Die Technikdemo ist ausschließlich für die Übertragungsprüfung bestimmt. Für neue Tests kann eine neue Sitzung angelegt werden; es werden keine v1-Daten gelesen.</p>
    </>}
    {error && <p className="g3-tech-error" role="alert">{error}</p>}
  </section>;
}

import type { EventRecord } from '../../domain/event/schemas';
import type { reportFor } from './model';

type Report = NonNullable<ReturnType<typeof reportFor>>;
type ResultData = Pick<Report, 'gameLabel' | 'profile' | 'finishedAt' | 'sourceLabel' | 'teams'>;

/** Search public session metadata only; never index frozen answers or moderator notes. */
export function filterSessions(items: readonly EventRecord[], query: string): EventRecord[] {
 const needle = query.trim().normalize('NFKC').toLocaleLowerCase('de-DE');
 if (!needle) return [...items];
 return items.filter(event => {
  const game = event.program[0]?.type ?? '';
  const label = game === 'rundenquiz' ? 'Rundenquiz' :
   game === 'quiztafel' ? 'Quiztafel' :
   game === 'verbindungen' ? 'Verbindungen' :
   game === 'logikleiter' ? 'Logikleiter' :
   game === 'umfrageduell' ? 'Umfrageduell' : '';
  const status = event.lifecycle === 'complete' ? 'Abgeschlossen' :
   event.recoveryRequired ? 'Wiederherstellung Überprüfung' :
   event.lifecycle === 'paused' ? 'Pausiert' :
   event.lifecycle === 'active' ? 'Läuft' : 'Vorbereitung';
  const searchable = [game, label, status, event.program[0]?.profile ?? '',
   ...event.teams.map(team => team.name)].join(' ').normalize('NFKC').toLocaleLowerCase('de-DE');
  return searchable.includes(needle);
 });
}

function textCell(input: string): string {
 const clean = input.replace(/\0/g, '').replace(/\r\n?/g, '\n');
 const safe = /^[\s\u200B-\u200F\uFEFF]*[=+\-@]/u.test(clean) ? "'" + clean : clean;
 return '"' + safe.replace(/"/g, '""') + '"';
}
function numberCell(input: number): string {
 if (!Number.isFinite(input)) throw new Error('Ungültige Punktzahl im Bericht');
 return String(input).replace('.', ',');
}
export function reportCsv(report: ResultData): string {
 const header = ['Rang', 'Team', 'Spielpunkte', 'Abendpunkte'].map(textCell).join(';');
 const meta = [
  [textCell('Spiel'), textCell(report.gameLabel)],
  [textCell('Umfang'), textCell(report.profile)],
  [textCell('Datum'), textCell(new Date(report.finishedAt).toLocaleDateString('de-DE', {timeZone:'UTC'}))],
  [textCell('Inhaltsquelle'), textCell(report.sourceLabel)],
 ].map(row => row.join(';'));
 const teams = report.teams.map(team => {
  const rank = 1 + report.teams.filter(other => other.rawPoints > team.rawPoints).length;
  return [numberCell(rank), textCell(team.name), numberCell(team.rawPoints),
   numberCell(team.eveningHalfPoints / 2)].join(';');
 });
 return '\uFEFFsep=;\r\n' + [...meta, '', header, ...teams].join('\r\n') + '\r\n';
}
export function csvFileName(eventId: string): string {
 return 'ligoquiz-ergebnis-' + eventId.replace(/[^\w-]/g, '').slice(0, 60) + '.csv';
}

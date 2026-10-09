import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// G12: real browser flows; trial content is deliberately NOT treated as reviewed content.
// Each scenario uses a fresh Playwright browser context and separate stage window.
const modes = [
  { id: 'rundenquiz', label: 'Rundenquiz', host: '.rq-host', scores: '.rq-scoreboard strong', secret: 'Josua', publicProbe: 'Wer führte Israel', award: 10 },
  { id: 'quiztafel', label: 'Quiztafel', host: '.qt-host', scores: '.qt-scorebar strong', secret: 'Noah', publicProbe: 'Wer baute', award: 100 },
  { id: 'verbindungen', label: 'Verbindungen', host: '.vb-host', scores: '.vb-scorebar strong', secret: 'David', publicProbe: 'Bethlehem', award: 30 },
  { id: 'logikleiter', label: 'Logikleiter', host: '.ll-host', scores: '.ll-scorebar strong', secret: 'Alle Rosen sind Pflanzen, und keine Pflanze ist ein Metall.', publicProbe: 'Alle Rosen', award: 10 },
  { id: 'umfrageduell', label: 'Umfrageduell', host: '.ud-host', scores: '.ud-scorebar strong', secret: 'Notizblock', publicProbe: 'BEISPIELDATEN', award: 20 },
];

async function prepare(page, mode, count) {
  await page.goto('/#/setup');
  await page.getByRole('combobox', { name: 'Anzahl der Teams' }).selectOption(String(count));
  for (let i = 0; i < count; i++) {
    await page.getByRole('textbox', { name: 'Team ' + (i + 1) }).fill('G12 Team ' + (i + 1));
  }
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: new RegExp(mode.label) }).click();
  await page.getByRole('combobox', { name: 'Umfang' }).selectOption('kurz');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.locator('.exp-summary')).toContainText(count + '');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Spielleitung öffnen' }).click();
  await expect(page).toHaveURL(/#\/host$/);
  const host = page.locator(mode.host);
  await expect(host).toBeVisible();
  await expect(host.locator(mode.scores)).toHaveCount(count);
  return host;
}

async function connectStage(page, host) {
  const href = await host.getByRole('link', { name: /Beamer öffnen/ }).getAttribute('href');
  expect(href).toMatch(/^#\/stage\?event=[\w-]+$/);
  const stage = await page.context().newPage();
  await stage.goto('http://127.0.0.1:4178/' + href);
  await expect(stage.getByRole('main', { name: 'Beamer-Ansicht' })).toBeVisible();
  await expect(host).toContainText(/1 Beamer (verbunden|bestätigt)/);
  return { stage, eventId: href.split('event=')[1] };
}

async function openFirstQuestion(host, mode) {
  switch (mode.id) {
    case 'rundenquiz':
      await host.getByRole('button', { name: 'Teams bestätigen' }).click();
      await host.getByRole('button', { name: 'Frage auf Beamer zeigen' }).click();
      break;
    case 'quiztafel':
      await host.getByRole('button', { name: 'Quiztafel auf dem Beamer vorbereiten' }).click();
      await host.locator('.qt-column').first().getByRole('button', { name: '100' }).click();
      await host.getByRole('button', { name: 'Frage ausdrücklich veröffentlichen' }).click();
      break;
    case 'verbindungen':
      await host.getByRole('button', { name: 'Aufgabenreihenfolge bestätigen' }).click();
      await host.getByRole('button', { name: 'Aufgabe veröffentlichen' }).click();
      break;
    case 'logikleiter':
      await host.getByRole('button', { name: 'Stufenfolge bestätigen' }).click();
      await host.getByRole('button', { name: 'Aufgabe veröffentlichen' }).click();
      break;
    case 'umfrageduell':
      await host.getByRole('button', { name: 'Aufgabenfolge bestätigen' }).click();
      await host.getByRole('button', { name: 'Aufgabe veröffentlichen' }).click();
      break;
    default:
      throw Error('Unrecognized G12 game: ' + mode.id);
  }
}

async function resumeAfterCrash(host, mode) {
  await host.getByRole('button', {
    name: mode.id === 'rundenquiz' ? 'Spiel fortsetzen' : 'Spiel ausdrücklich fortsetzen',
  }).click();
}

async function scoreFirstQuestion(host, mode, count) {
  switch (mode.id) {
    case 'rundenquiz':
      await host.getByRole('button', { name: 'Antwortphase schließen' }).click();
      await host.getByRole('button', { name: 'Lösung auf Beamer zeigen' }).click();
      for (let i = 0; i < count; i++) {
        await host.locator('.rq-judge').nth(i).getByRole('button', { name: i === 0 ? 'richtig' : 'falsch' }).click();
      }
      await host.getByRole('button', { name: 'Punkte verbindlich bestätigen' }).click();
      break;
    case 'quiztafel':
      await host.getByRole('button', { name: 'Erstantwort richtig' }).click();
      await host.getByRole('button', { name: 'Lösung ausdrücklich zeigen' }).click();
      await host.getByRole('button', { name: 'Punkte verbindlich bestätigen' }).click();
      break;
    case 'verbindungen':
      await host.getByRole('button', { name: 'Richtige Antwort' }).click();
      await host.getByRole('button', { name: 'Lösung veröffentlichen' }).click();
      await host.getByRole('button', { name: 'Wertung verbindlich bestätigen' }).click();
      break;
    case 'logikleiter':
      await host.locator('.ll-team-row').nth(0).getByRole('button', { name: 'Abgabe jetzt sperren' }).click();
      await host.getByRole('button', { name: 'Alle Antworten schließen' }).click();
      await host.getByRole('button', { name: 'Lösung und Begründung veröffentlichen' }).click();
      for (let i = 0; i < count; i++) {
        await host.locator('.ll-grades').nth(i).getByRole('button', { name: i === 0 ? 'Richtig' : 'Keine Antwort' }).click();
      }
      await host.getByRole('button', { name: 'Alle Wertungen verbindlich bestätigen' }).click();
      break;
    case 'umfrageduell':
      await host.getByRole('button', { name: 'Alle Antworten schließen' }).click();
      for (let i = 0; i < count; i++) {
        const team = host.locator('.ud-team').nth(i);
        if (i === 0) await team.getByRole('textbox', { name: 'Antwort 1' }).fill('Snacks');
        await team.getByRole('button', { name: 'Antwort erfassen' }).click();
      }
      await host.getByRole('button', { name: 'Kategorien und Rangfolge veröffentlichen' }).click();
      await host.getByRole('button', { name: 'Teamwertungen verbindlich bestätigen' }).click();
      break;
  }
}

async function verifyDownload(page, mode, count, eventId) {
  await page.goto('/#/einstellungen');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Vollständiges Sitzungsbackup exportieren' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(eventId);
  const file = JSON.parse(await readFile(await download.path(), 'utf-8'));
  const digest = createHash('sha256').update(JSON.stringify(file.payload)).digest('hex');
  expect(file.sha256).toBe(digest);
  expect(file.payload.format).toBe('ligoquiz-v2-session-backup');
  expect(file.payload.event.id).toBe(eventId);
  expect(file.payload.event.program[0].type).toBe(mode.id);
  expect(file.payload.event.teams.map(t => t.name)).toEqual(
    Array.from({ length: count }, (_, i) => 'G12 Team ' + (i + 1)),
  );
  expect(file.payload.event.frozenTasks.length).toBeGreaterThan(0);
  expect(file.payload.event.revision).toBeGreaterThan(2);
  expect(file.payload.outcomes.length).toBeGreaterThan(0);
  expect(file.payload.audit.length).toBeGreaterThan(0);
  expect(file.payload.checkpoints.at(-1).revision).toBe(file.payload.event.revision);
  return file;
}

for (const mode of modes) {
  for (const count of [3, 4, 5]) {
    test('G12 dress rehearsal: ' + mode.label + ', ' + count + ' teams, public privacy, crash, score, backup', async ({ page }) => {
      const host = await prepare(page, mode, count);
      const { stage, eventId } = await connectStage(page, host);
      await openFirstQuestion(host, mode);
      // Demand a genuinely received live public frame before crash simulation.
      // A waiting stage trivially hides answers but does not prove privacy or recovery.
      await expect(stage.locator('main')).toContainText(mode.publicProbe);
      await expect(stage.locator('main')).not.toContainText(mode.secret);
      await page.reload();
      await expect(host.getByRole('button', {
        name: mode.id === 'rundenquiz' ? 'Spiel fortsetzen' : 'Spiel ausdrücklich fortsetzen',
      })).toBeEnabled();
      await expect(stage.locator('main')).toContainText('Pause');
      await expect(stage.locator('main')).not.toContainText(mode.secret);
      await resumeAfterCrash(host, mode);
      await scoreFirstQuestion(host, mode, count);
      await expect(host.locator(mode.scores)).toHaveText([
        String(mode.award), ...Array.from({ length: count - 1 }, () => '0'),
      ]);
      await verifyDownload(page, mode, count, eventId);
      await stage.close();
    });
  }
}

// Collision must fail closed even when a real, checksum-verified export is supplied.
test('G12 same-ID restore fails closed without altering saved game', async ({ page }) => {
  const mode = modes[0];
  const host = await prepare(page, mode, 4);
  const { eventId } = await connectStage(page, host).then(async data => { await data.stage.close(); return data; });
  await openFirstQuestion(host, mode);
  await scoreFirstQuestion(host, mode, 4);
  const file = await verifyDownload(page, mode, 4, eventId);
  await page.locator('.g11-restore input[type=file]').setInputFiles({
    name: 'g12-verified-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByRole('heading', { name: 'Prüfsumme gültig – noch nichts verändert' })).toBeVisible();
  await page.locator('.g11-preview input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Wiederherstellung ausdrücklich bestätigen' }).click();
  await expect(page.getByRole('alert')).toContainText('derselben Kennung');
  await expect(page.locator('.g11-row select option:not([value=""])')).toHaveCount(1);
});

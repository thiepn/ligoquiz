import { test, expect } from '@playwright/test';

async function prepare(host, numberOfTeams = 4) {
  await host.goto('/#/host');
  const workbench = host.locator('.rq-host');
  if (numberOfTeams !== 4) {
    await workbench.getByLabel('Teams', { exact: true }).selectOption(String(numberOfTeams));
  }
  await workbench.getByRole('button', { name: 'Quizabend vorbereiten' }).click();
  await expect(workbench.getByRole('button', { name: 'Teams bestätigen' })).toBeEnabled();
  return workbench;
}

async function projector(host, workbench) {
  const href = await workbench.getByRole('link', { name: /Beamer öffnen/ }).getAttribute('href');
  expect(href).toMatch(/^#\/stage\?event=[\w-]+$/);
  const stage = await host.context().newPage();
  await stage.goto('http://127.0.0.1:4178/' + href);
  await expect(workbench.locator('.rq-utility')).toContainText('1 Beamer verbunden');
  await expect(stage.locator('main')).toContainText('Warte auf die Spielleitung');
  return stage;
}

test('host-to-projector reveal, audited correction and lost connection', async ({ page }) => {
  const workbench = await prepare(page);
  const stage = await projector(page, workbench);

  await workbench.getByRole('button', { name: 'Teams bestätigen' }).click();
  await workbench.getByRole('button', { name: 'Frage auf Beamer zeigen' }).click();
  await expect(stage.locator('main')).toContainText('Wer führte Israel nach Mose');
  await expect(stage.locator('main')).not.toContainText('Josua');
  await workbench.getByRole('button', { name: 'Antwortphase schließen' }).click();
  await expect(stage.locator('main')).not.toContainText('Josua');

  await workbench.getByRole('button', { name: 'Lösung auf Beamer zeigen' }).click();
  await expect(stage.locator('main')).toContainText('Josua');
  for (let n = 0; n < 4; n++) {
    await workbench.locator('.rq-judge').nth(n).getByRole('button', { name: 'richtig' }).click();
  }
  await expect(workbench.locator('.rq-preview strong')).toHaveCount(4);
  await workbench.getByRole('button', { name: 'Punkte verbindlich bestätigen' }).click();
  await expect(workbench.locator('.rq-scoreboard strong')).toHaveText(['10','10','10','10']);
  await expect(stage.locator('.stage-scores')).toBeVisible();

  await workbench.getByRole('button', { name: 'Letzte Wertung korrigieren' }).click();
  await expect(workbench.locator('.rq-scoreboard strong')).toHaveText(['0','0','0','0']);
  await workbench.locator('.rq-judge').nth(0).getByRole('button', { name: 'falsch' }).click();
  await expect(workbench.getByRole('button', { name: 'Punkte verbindlich bestätigen' })).toBeEnabled();
  await workbench.getByRole('button', { name: 'Punkte verbindlich bestätigen' }).click();
  await expect(workbench.locator('.rq-scoreboard strong')).toHaveText(['0','10','10','10']);
  await expect(stage.locator('.stage-scores')).toContainText('Team 1');

  await page.close();
  await expect(stage.locator('main')).toContainText('Verbindung unterbrochen', { timeout: 12_000 });
  await expect(stage.locator('main')).not.toContainText('Josua');
  await stage.close();
});

test('reload during open question pauses the host and restores a stopped timer', async ({ page }) => {
  const workbench = await prepare(page, 3);
  await workbench.getByRole('button', { name: 'Teams bestätigen' }).click();
  await workbench.getByRole('button', { name: 'Frage auf Beamer zeigen' }).click();
  await expect(workbench.locator('.rq-timer strong')).toHaveText('30 s');

  await workbench.locator('.rq-timer').getByRole('button', { name: 'Start' }).click();
  await expect.poll(async () => workbench.locator('.rq-timer strong').innerText()).not.toBe('30 s');
  await workbench.locator('.rq-timer').getByRole('button', { name: 'Stopp' }).click();
  const saved = await workbench.locator('.rq-timer strong').innerText();
  await page.waitForTimeout(350);
  await page.reload();

  await expect(workbench.getByRole('button', { name: 'Spiel fortsetzen' })).toBeEnabled({ timeout: 15_000 });
  await expect(workbench.locator('.rq-timer strong')).toHaveText(saved);
  await expect(workbench.locator('.rq-timer').getByRole('button', { name: 'Start' })).toBeDisabled();

  await workbench.getByRole('button', { name: 'Spiel fortsetzen' }).click();
  await expect(workbench.locator('.rq-timer').getByRole('button', { name: 'Start' })).toBeEnabled();
  await expect(workbench.getByRole('button', { name: 'Antwortphase schließen' })).toBeEnabled();
});

test('three-team Kurz completes all seven questions including clues and estimates', async ({ page }) => {
  const workbench = await prepare(page, 3);
  await workbench.getByRole('button', { name: 'Teams bestätigen' }).click();

  for (let question = 0; question < 7; question++) {
    await workbench.getByRole('button', { name: 'Frage auf Beamer zeigen' }).click();
    const status = await workbench.locator('.rq-status strong').innerText();
    if (status.includes('Hinweise')) {
      await workbench.getByRole('button', { name: 'Team 1: Antwort abgegeben' }).click();
      await workbench.getByRole('button', { name: 'Nächsten Hinweis zeigen' }).click();
      await workbench.getByRole('button', { name: 'Team 2: Antwort abgegeben' }).click();
      await workbench.getByRole('button', { name: 'Nächsten Hinweis zeigen' }).click();
      await workbench.getByRole('button', { name: 'Team 3: Antwort abgegeben' }).click();
    }
    if (status.includes('Schätzen')) {
      const rows = workbench.locator('.rq-teamfields > div');
      for (let team = 0; team < 3; team++) {
        const row = rows.nth(team);
        await row.getByRole('textbox').fill(question === 5 ? '1000' : '150');
        await row.getByRole('button', { name: 'Übernehmen' }).click();
        await expect(row).toContainText('Erfasst');
      }
    }
    await workbench.getByRole('button', { name: 'Antwortphase schließen' }).click();
    await workbench.getByRole('button', { name: 'Lösung auf Beamer zeigen' }).click();
    if (!status.includes('Schätzen')) {
      for (let team = 0; team < 3; team++) {
        await workbench.locator('.rq-judge').nth(team).getByRole('button', { name: 'richtig' }).click();
      }
    }
    await expect(workbench.getByRole('button', { name: 'Punkte verbindlich bestätigen' })).toBeEnabled();
    await workbench.getByRole('button', { name: 'Punkte verbindlich bestätigen' }).click();
    await workbench.getByRole('button', { name: question === 6 ? 'Endstand zeigen' : 'Nächste Aufgabe' }).click();
  }
  await expect(workbench.locator('.rq-end')).toContainText('Endstand');
  await expect(workbench.locator('.rq-end p')).toHaveCount(3);
});

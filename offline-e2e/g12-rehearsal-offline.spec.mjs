import { test, expect } from '@playwright/test';
import { URL } from 'node:url';

// These tests run on the actual Vite production build, NOT on vite dev.
// Each test installs the service worker online, then forcefully disconnects the
// entire browser context and verifies both the host and a newly opened stage.
const games = [
  ['Rundenquiz', '.rq-host', 3],
  ['Quiztafel', '.qt-host', 4],
  ['Verbindungen', '.vb-host', 5],
  ['Logikleiter', '.ll-host', 3],
  ['Umfrageduell', '.ud-host', 5],
];

for (const [label, selector, count] of games) {
  test('G12 built-PWA offline restart: ' + label + ' with ' + count + ' teams', async ({ page, context }) => {
    await page.goto('/#/technik');
    await page.evaluate(() => globalThis.navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(
      () => Boolean(globalThis.navigator.serviceWorker.controller),
    )).toBe(true);
    const registration = await page.evaluate(() =>
      globalThis.navigator.serviceWorker.getRegistration().then(r => ({
        scope: r?.scope,
        active: r?.active?.state,
      })));
    expect(registration.active).toBe('activated');
    expect(new URL(registration.scope).origin).toBe(new URL(page.url()).origin);

    await page.goto('/#/setup');
    await page.getByRole('combobox', { name: 'Anzahl der Teams' }).selectOption(String(count));
    await page.getByRole('button', { name: 'Weiter' }).click();
    if (label !== 'Rundenquiz') {
      await page.getByRole('button', { name: new RegExp(label) }).click();
    }
    await page.getByRole('combobox', { name: 'Umfang' }).selectOption('kurz');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Spielleitung öffnen' }).click();
    const host = page.locator(selector);
    await expect(host).toBeVisible();
    const href = await host.getByRole('link', { name: /Beamer öffnen/ }).getAttribute('href');
    expect(href).toMatch(/^#\/stage\?event=[\w-]+$/);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page).toHaveURL(/#\/host$/);
      await expect(host).toBeVisible();
      await expect(host).toContainText('Team ' + count);
      const stage = await context.newPage();
      await stage.goto('http://127.0.0.1:4181/' + href);
      await expect(stage.getByRole('main', { name: 'Beamer-Ansicht' })).toBeVisible();
      await expect(stage.locator('main')).not.toContainText('Josua');
      await stage.close();
      await page.goto('/#/einstellungen');
      await expect(page.getByRole('region', { name: 'Sicherung und Wiederherstellung' })).toBeVisible();
      await expect(page.getByRole('button', {
        name: 'Vollständiges Sitzungsbackup exportieren',
      })).toBeEnabled();
    } finally {
      await context.setOffline(false);
    }
  });
}
